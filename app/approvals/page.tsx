import { PendingApprovals } from '../components/PendingApprovals';

export const dynamic = 'force-dynamic';

export default function ApprovalsPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Approvals</h1>
      <PendingApprovals />
    </>
  );
}
