import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

const DATABASE_NAME = 'wardrobe.db';

/**
 * ⚠️ expo-sqlite defaults foreign keys OFF, so without this none of the
 * schema's cascades fire and the whole delete story silently does nothing
 * (§10.1).
 *
 * It is a named export purely so the cascade tests can run the app's own
 * pragma against a real SQLite rather than asserting the string by inspection
 * — the AC asks to see a cascade actually fire, and a pragma the tests only
 * spy on is a pragma nothing proves.
 */
export function enableForeignKeys(connection: { execSync: (sql: string) => void }) {
  connection.execSync('PRAGMA foreign_keys = ON');
}

/**
 * The one connection the app uses. `enableChangeListener` is what makes
 * `useLiveQuery` re-run when a write lands, which is the whole reason this app
 * needs no state library (§2).
 */
const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

enableForeignKeys(sqlite);

export const db = drizzle(sqlite, { schema });
