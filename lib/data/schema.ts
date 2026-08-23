import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
});

export const userRoles = pgTable(
  'user_roles',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.roleId] }) }),
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.roleId, t.resource, t.action] }) }),
);

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  actorId: integer('actor_id')
    .notNull()
    .references(() => users.id),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  resource: text('resource').notNull(),
  recordId: text('record_id').notNull(),
  action: text('action').notNull(),
  permissionUsed: text('permission_used').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  prevHash: text('prev_hash').notNull(),
});

export const pendingActions = pgTable('pending_actions', {
  id: serial('id').primaryKey(),
  resource: text('resource').notNull(),
  recordId: text('record_id').notNull(),
  action: text('action').notNull(),
  payload: jsonb('payload').notNull(),
  initiatorId: integer('initiator_id')
    .notNull()
    .references(() => users.id),
  status: text('status').notNull().default('pending'),
  approverId: integer('approver_id').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const kycCases = pgTable('kyc_cases', {
  id: serial('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  riskScore: integer('risk_score').notNull(),
  status: text('status').notNull().default('open'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  orderRef: text('order_ref').notNull(),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('USD'),
  reason: text('reason'),
  status: text('status').notNull().default('requested'),
  processorRef: text('processor_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: serial('id').primaryKey(),
    key: text('key').notNull(),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ keyIdx: uniqueIndex('feature_flags_key_unique').on(t.key) }),
);

export const tables = {
  kyc_cases: kycCases,
  refunds,
  feature_flags: featureFlags,
} as const;

export type TableName = keyof typeof tables;
