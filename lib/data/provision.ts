import { appDatabaseName, appRoleName, withMaintenanceConnection } from './admin';

/** Drops and recreates the database and the limited application role. */
export async function resetDatabase(): Promise<void> {
  const database = appDatabaseName();
  const role = appRoleName();
  const password = process.env.APP_DB_PASSWORD;
  if (!password) throw new Error('APP_DB_PASSWORD is not set');

  // The role name is a SQL identifier and cannot be parameterized; restrict it
  // to a safe character set as defense-in-depth before it reaches format('%I').
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(role)) {
    throw new Error(`Unsafe application role name '${role}'`);
  }

  await withMaintenanceConnection(async (client) => {
    await client.query(`drop database if exists ${JSON.stringify(database)} with (force)`);

    // DO blocks can't take bind parameters, so build the DDL server-side with
    // format() via a parameterized SELECT (proper %I/%L escaping), then run the
    // returned statement. role/password never touch the SQL text directly.
    const exists = await client.query('select 1 from pg_roles where rolname = $1', [role]);
    const action = exists.rowCount ? 'alter role' : 'create role';
    const ddl = await client.query<{ statement: string }>(
      `select format('${action} %I login password %L', $1::text, $2::text) as statement`,
      [role, password],
    );
    await client.query(ddl.rows[0].statement);

    await client.query(`create database ${JSON.stringify(database)}`);
  });
}
