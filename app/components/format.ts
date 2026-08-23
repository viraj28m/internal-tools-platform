import type { ResourceConfig } from '@/config';
import type { ColumnConfig } from '@/config/types';

export type Row = Record<string, unknown>;

/** Configs are written in snake_case; DAL rows come back in camelCase. */
export function fieldName(column: string): string {
  return column.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

export function label(column: string, config: ColumnConfig): string {
  return config.label ?? column.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function formatCell(value: unknown, config: ColumnConfig): string {
  if (value === null || value === undefined) return '—';
  if (config.type === 'money') return `$${(Number(value) / 100).toFixed(2)}`;
  if (config.type === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

export function columnEntries(config: ResourceConfig): [string, ColumnConfig][] {
  return Object.entries(config.columns);
}
