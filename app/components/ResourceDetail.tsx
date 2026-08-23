import type { ResourceConfig } from '@/config';
import { columnEntries, fieldName, formatCell, label, type Row } from './format';
import { StatusBadge } from './StatusBadge';
import { TransitionButtons } from './TransitionButtons';
import { transitionOptions } from './transitions';

type Props = {
  resource: string;
  config: ResourceConfig;
  record: Row;
  /** Roles held by the session, used to reflect what the DAL would allow. */
  roles: string[];
  /** Session subject, used to drop a previous actor's action result on a user switch. */
  actorKey: string;
};

export function ResourceDetail({ resource, config, record, roles, actorKey }: Props) {
  const options = transitionOptions(config, String(record.status ?? ''), roles);

  return (
    <section className="rounded border border-gray-300 p-4">
      <h2 className="mb-3 text-lg font-semibold">
        {config.displayName} #{String(record.id)}
      </h2>

      <dl className="mb-4 grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
        {columnEntries(config).map(([column, columnConfig]) => {
          const value = record[fieldName(column)];
          return (
            <div key={column} className="contents">
              <dt className="text-gray-600">{label(column, columnConfig)}</dt>
              <dd>
                {columnConfig.type === 'status' ? (
                  <StatusBadge status={String(value)} />
                ) : (
                  formatCell(value, columnConfig)
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <h3 className="mb-2 text-sm font-semibold uppercase text-gray-600">Transitions</h3>
      <TransitionButtons
        key={actorKey}
        resource={resource}
        id={Number(record.id)}
        options={options}
      />
    </section>
  );
}
