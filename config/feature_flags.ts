import type { ResourceConfig } from './types';

const config: ResourceConfig = {
  table: 'feature_flags',
  displayName: 'Feature Flags',
  columns: {
    key: { label: 'Flag' },
    description: { label: 'Description', editable: true },
    enabled: { label: 'Enabled', type: 'boolean', editable: true },
  },
  permissions: { view: ['engineer', 'admin'], update: ['engineer', 'admin'] },
  transitions: {},
};

export default config;
