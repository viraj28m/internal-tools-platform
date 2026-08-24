import Link from 'next/link';
import { getResourceConfig } from '@/config';
import { dal, statusForError } from '@/lib/data';
import { AuditPanel } from '../../components/AuditPanel';
import { ResourceDetail } from '../../components/ResourceDetail';
import type { Row } from '../../components/format';
import { currentUser } from '../../current-user';

export const dynamic = 'force-dynamic';

const config = getResourceConfig('feature_flags');

export default async function FlagPage({ params }: { params: { id: string } }) {
  const user = currentUser();
  if (!user) return <p className="text-sm">Pick a user in the top nav to open this flag.</p>;

  const id = Number(params.id);
  let record: Row;
  try {
    record = await dal.resource('feature_flags', { actor: user.actor }).get(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return (
      <p className="text-sm text-red-700" data-testid="flags-error">
        {statusForError(error)} — {message}
      </p>
    );
  }

  return (
    <>
      <Link href="/flags" className="text-sm text-blue-700 underline">
        ← back to the flag panel
      </Link>
      <ResourceDetail
        resource="feature_flags"
        config={config}
        record={record}
        roles={user.session.roles}
        actorKey={`${user.session.sub}-${params.id}`}
      />
      <AuditPanel resource="feature_flags" recordId={id} />
    </>
  );
}
