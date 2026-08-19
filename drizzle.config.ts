import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside Next, so .env.local is loaded here explicitly. Run the
// scripts through `npm run db:*`, which pass --env-file, or export DATABASE_URL.
// The fallback matches docker-compose.yml for local development.

export default defineConfig({
  schema: './src/server/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://inventory:inventory@127.0.0.1:15433/inventory',
    // Hosted Postgres such as Neon requires TLS; the local container has none.
    ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? 'localhost')
      ? false
      : { rejectUnauthorized: true },
  },
});
