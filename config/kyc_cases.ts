import type { ResourceConfig } from './types';

const config: ResourceConfig = {
  table: 'kyc_cases',
  displayName: 'KYC Review Queue',
  columns: {
    customer_name: { label: 'Customer' },
    risk_score: { label: 'Risk', type: 'number' },
    status: { type: 'status' },
    notes: { label: 'Notes', editable: true },
  },
  permissions: {
    view: ['analyst', 'senior_analyst', 'admin'],
    update: ['analyst', 'senior_analyst'],
  },
  transitions: {
    start_review: {
      from: ['open'],
      to: 'in_review',
      allowedRoles: ['analyst', 'senior_analyst'],
      requiresApproval: false,
    },
    approve: {
      from: ['in_review'],
      to: 'approved',
      allowedRoles: ['senior_analyst'],
      requiresApproval: true,
    },
    reject: {
      from: ['in_review'],
      to: 'rejected',
      allowedRoles: ['senior_analyst'],
      requiresApproval: false,
    },
  },
};

export default config;
