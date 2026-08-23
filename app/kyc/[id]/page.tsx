import Link from 'next/link';
import { getResourceConfig } from '@/config';
import { dal, statusForError } from '@/lib/data';
import { AuditPanel } from '../../components/AuditPanel';
import { ResourceDetail } from '../../components/ResourceDetail';
import type { Row } from '../../components/format';
import { currentUser } from '../../current-user';

export const dynamic = 'force-dynamic';

const config = getResourceConfig('kyc_cases');

export default async function KycCasePage({ params }: { params: { id: string } }) {
  const user = currentUser();
  if (!user) return <p className="text-sm">Pick a user in the top nav to open this case.</p>;

  const id = Number(params.id);
  let record: Row;
  try {
    record = await dal.resource('kyc_cases', { actor: user.actor }).get(id);
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
      <Link href="/kyc" className="text-sm text-blue-700 underline">
        ← back to the queue
      </Link>
      <ResourceDetail
        resource="kyc_cases"
        config={config}
        record={record}
        roles={user.session.roles}
        actorKey={`${user.session.sub}-${params.id}`}
      />
      <AuditPanel resource="kyc_cases" recordId={id} />
    </>
  );
}
