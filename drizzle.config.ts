import { readFileSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit does not read .env.local, and the fallback below is a localhost URL,
 * so without this a mistyped or missing environment silently migrates the local
 * container instead of the database you meant. Load it here so every drizzle-kit
 * command sees the same DATABASE_URL the app does.
 */
try {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.trimStart().startsWith('#')) {
      const key = line.slice(0, eq).trim();
      if (!process.env[key]) process.env[key] = line.slice(eq + 1).trim();
    }
  }
} catch {
  // No .env.local: fall through to the environment and the local default.
}

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
