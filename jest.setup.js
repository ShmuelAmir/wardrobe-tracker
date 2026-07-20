/**
 * expo-sqlite is a native module with no JS fallback, so every test that pulls
 * in a route would otherwise have to stub the data layer itself. These defaults
 * make the database a no-op; the suites that actually exercise it
 * (`schema-migrations`, `db-client`) override them with their own mocks.
 */
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({ execSync: () => {} }),
}));

jest.mock('drizzle-orm/expo-sqlite', () => {
  // Swallows any chain — `db.select().from(x).orderBy(y)` — since the stubbed
  // useLiveQuery below never looks at the query it is handed.
  const queryBuilder = new Proxy({}, { get: () => () => queryBuilder });
  return {
    drizzle: () => queryBuilder,
    // An empty wardrobe that *has* been read: the default route state is the
    // §7.5 hero, not the pre-first-read blank.
    useLiveQuery: () => ({ data: [], error: undefined, updatedAt: 0 }),
  };
});

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: () => ({ success: true, error: undefined }),
}));
