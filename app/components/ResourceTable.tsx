import Link from 'next/link';
import type { ResourceConfig } from '@/config';
import { columnEntries, fieldName, formatCell, label, type Row } from './format';
import { StatusBadge } from './StatusBadge';

type Props = {
  config: ResourceConfig;
  rows: Row[];
  /** Detail-page link for a row; rows are plain text when omitted. */
  hrefFor?: (row: Row) => string;
};

export function ResourceTable({ config, rows, hrefFor }: Props) {
  const columns = columnEntries(config);

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-300 text-left">
          <th className="px-3 py-2">ID</th>
          {columns.map(([column, columnConfig]) => (
            <th key={column} className="px-3 py-2">
              {label(column, columnConfig)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const id = String(row.id);
          return (
            <tr key={id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-3 py-2">
                {hrefFor ? (
                  <Link className="text-blue-700 underline" href={hrefFor(row)}>
                    {id}
                  </Link>
                ) : (
                  id
                )}
              </td>
              {columns.map(([column, columnConfig]) => {
                const value = row[fieldName(column)];
                return (
                  <td key={column} className="px-3 py-2">
                    {columnConfig.type === 'status' ? (
                      <StatusBadge status={String(value)} />
                    ) : (
                      formatCell(value, columnConfig)
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
        {rows.length === 0 && (
          <tr>
            <td className="px-3 py-4 text-gray-500" colSpan={columns.length + 1}>
              Nothing to show.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
