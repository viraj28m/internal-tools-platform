import 'dotenv/config';
import { closeDb, verifyAuditChain } from '@/lib/data';

async function main() {
  const result = await verifyAuditChain();
  await closeDb();

  if (result.ok) {
    console.log(`audit chain OK — ${result.rows} rows verified`);
    return;
  }

  console.error(
    `audit chain BROKEN at row ${result.brokenRowId}\n  expected ${result.expected}\n  found    ${result.found}`,
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
