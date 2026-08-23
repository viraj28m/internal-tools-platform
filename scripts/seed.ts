import 'dotenv/config';
import { seed } from '@/lib/data/seed';

async function main() {
  await seed();
  console.log('seed complete');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
