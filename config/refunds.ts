import type { ResourceConfig } from './types';

const config: ResourceConfig = {
  table: 'refunds',
  displayName: 'Refunds',
  columns: {
    customer_name: { label: 'Customer' },
    order_ref: { label: 'Order' },
    amount_cents: { label: 'Amount', type: 'money' },
    reason: { label: 'Reason', editable: true },
    status: { type: 'status' },
  },
  permissions: {
    view: ['support_agent', 'support_lead', 'admin'],
    create: ['support_agent', 'support_lead'],
  },
  transitions: {
    submit: {
      from: ['requested'],
      to: 'pending_approval',
      allowedRoles: ['support_agent', 'support_lead'],
      requiresApproval: true,
    },
    execute: {
      from: ['approved'],
      to: 'executed',
      allowedRoles: ['support_lead'],
      requiresApproval: false,
      effect: 'processor.executeRefund',
    },
    reject: {
      from: ['requested', 'approved'],
      to: 'rejected',
      allowedRoles: ['support_lead'],
      requiresApproval: false,
    },
  },
};

export default config;
