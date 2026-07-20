import type { Config } from 'drizzle-kit';

/**
 * drizzle-kit only generates the SQL here; it never connects to a device.
 * `driver: 'expo'` makes it also emit `drizzle/migrations.js`, the bundle the
 * app imports at startup (§2).
 */
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
