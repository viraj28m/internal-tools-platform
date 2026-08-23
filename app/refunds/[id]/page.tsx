import Link from 'next/link';
import { getResourceConfig } from '@/config';
import { dal, statusForError } from '@/lib/data';
import { AuditPanel } from '../../components/AuditPanel';
import { ResourceDetail } from '../../components/ResourceDetail';
import type { Row } from '../../components/format';
import { currentUser } from '../../current-user';

export const dynamic = 'force-dynamic';

const config = getResourceConfig('refunds');

export default async function RefundPage({ params }: { params: { id: string } }) {
  const user = currentUser();
  if (!user) return <p className="text-sm">Pick a user in the top nav to open this refund.</p>;

  const id = Number(params.id);
  let record: Row;
  try {
    record = await dal.resource('refunds', { actor: user.actor }).get(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return (
      <p className="text-sm text-red-700">
        {statusForError(error)} — {message}
      </p>
    );
  }

  return (
    <>
      <Link href="/refunds" className="text-sm text-blue-700 underline">
        ← back to the dashboard
      </Link>
      <ResourceDetail
        resource="refunds"
        config={config}
        record={record}
        roles={user.session.roles}
        actorKey={`${user.session.sub}-${params.id}`}
      />
      <AuditPanel resource="refunds" recordId={id} />
    </>
  );
}
