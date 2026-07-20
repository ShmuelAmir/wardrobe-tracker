const mockExecSync = jest.fn();
const mockOpenDatabaseSync = jest.fn(() => ({ execSync: mockExecSync }));

jest.mock('expo-sqlite', () => ({ openDatabaseSync: mockOpenDatabaseSync }));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: jest.fn(() => ({ marker: 'drizzle-db' })),
  useLiveQuery: jest.fn(),
}));

/**
 * §10.1 — the pragma is the single most load-bearing line in the data layer:
 * expo-sqlite defaults foreign keys OFF, and without it none of the schema's
 * cascades fire. The cascades themselves are proven for real against SQLite in
 * `schema-migrations.test.ts`; what this file pins is that the app's own
 * connection actually turns them on, before anything can query it.
 */
describe('database connection', () => {
  it('enables foreign keys on the connection (§10.1)', () => {
    require('@/db/client');

    expect(mockExecSync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
  });

  it('opens with the change listener on, so useLiveQuery re-runs on writes', () => {
    require('@/db/client');

    expect(mockOpenDatabaseSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ enableChangeListener: true }),
    );
  });
});
