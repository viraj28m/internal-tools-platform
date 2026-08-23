const COLORS: Record<string, string> = {
  open: 'bg-gray-200 text-gray-800',
  in_review: 'bg-blue-100 text-blue-800',
  pending_approval: 'bg-amber-100 text-amber-900',
  approved: 'bg-green-100 text-green-800',
  executed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-1 text-xs ${COLORS[status] ?? 'bg-gray-200 text-gray-800'}`}>
      {status}
    </span>
  );
}
