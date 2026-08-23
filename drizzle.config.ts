import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/data/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.ADMIN_DATABASE_URL ?? 'postgres://postgres@localhost:5432/internal_tools',
  },
});
