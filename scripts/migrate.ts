import 'dotenv/config';
import { runMigrations } from '@/lib/data/migrate';

async function main() {
  await runMigrations();
  console.log('migrations applied');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
