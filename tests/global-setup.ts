import 'dotenv/config';
import { runMigrations } from '@/lib/data/migrate';
import { resetDatabase } from '@/lib/data/provision';
import { seed } from '@/lib/data/seed';

/** SPEC §7.1: the suite always runs against a freshly built database. */
export async function setup() {
  await resetDatabase();
  await runMigrations();
  await seed();
}
