import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside Next, so it does not pick up .env.local automatically.
// The fallback matches docker-compose.yml for local development.

export default defineConfig({
  schema: './src/server/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://inventory:inventory@127.0.0.1:15433/inventory',
  },
});
