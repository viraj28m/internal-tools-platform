import 'dotenv/config';
import { resetDatabase } from '@/lib/data/provision';

async function main() {
  await resetDatabase();
  console.log('database recreated; application role ready');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
