import { appDatabaseName, appRoleName, withMaintenanceConnection } from './admin';

/** Drops and recreates the database and the limited application role. */
export async function resetDatabase(): Promise<void> {
  const database = appDatabaseName();
  const role = appRoleName();
  const password = process.env.APP_DB_PASSWORD;
  if (!password) throw new Error('APP_DB_PASSWORD is not set');

  await withMaintenanceConnection(async (client) => {
    await client.query(`drop database if exists ${JSON.stringify(database)} with (force)`);
    await client.query(
      `do $$ begin
         if not exists (select 1 from pg_roles where rolname = '${role}') then
           execute format('create role %I login password %L', '${role}', '${password}');
         else
           execute format('alter role %I login password %L', '${role}', '${password}');
         end if;
       end $$;`,
    );
    await client.query(`create database ${JSON.stringify(database)}`);
  });
}
