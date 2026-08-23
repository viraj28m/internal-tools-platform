export type ColumnConfig = {
  label?: string;
  type?: 'number' | 'money' | 'status' | 'boolean';
  editable?: boolean;
};

export type TransitionConfig = {
  from: string[];
  to: string;
  allowedRoles: string[];
  requiresApproval: boolean;
  effect?: string;
};

export type ResourceConfig = {
  table: string;
  displayName: string;
  columns: Record<string, ColumnConfig>;
  permissions: Record<string, string[]>;
  transitions: Record<string, TransitionConfig>;
};
