import { getResourceConfig } from '@/config';
import { dal, statusForError } from '@/lib/data';
import { ResourceTable } from '../components/ResourceTable';
import type { Row } from '../components/format';
import { currentUser } from '../current-user';

export const dynamic = 'force-dynamic';

const config = getResourceConfig('kyc_cases');

export default async function KycQueuePage() {
  const user = currentUser();
  if (!user) return <p className="text-sm">Pick a user in the top nav to open the queue.</p>;

  let rows: Row[];
  try {
    rows = await dal.resource('kyc_cases', { actor: user.actor }).list();
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
      <h1 className="text-xl font-semibold">{config.displayName}</h1>
      <ResourceTable
        config={config}
        rows={rows.sort((a, b) => Number(a.id) - Number(b.id))}
        hrefFor={(row) => `/kyc/${String(row.id)}`}
      />
    </>
  );
}
