import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MigrationGate } from '@/components/migration-gate';

/**
 * §4.6's *when*, which ADR-0008 makes the load-bearing half. The gate is where
 * "after migrations resolve" is knowable, so it is where the sweep is fired
 * from and where these assertions belong; what the sweep then does to disk is
 * `orphan-sweep.test.ts`.
 */
const mockSweep = jest.fn();
jest.mock('@/orphan-sweep', () => ({
  sweepOrphanImagesOnce: () => mockSweep(),
}));

let mockMigrations: { success: boolean; error: Error | undefined } = {
  success: true,
  error: undefined,
};
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: () => mockMigrations,
}));

const Wardrobe = () => <Text testID="wardrobe">Wardrobe</Text>;

beforeEach(() => {
  mockSweep.mockClear();
  mockMigrations = { success: true, error: undefined };
});

describe('MigrationGate — fires the sweep once, after migrations resolve (§4.6)', () => {
  it('sweeps once when the gate opens', async () => {
    await render(
      <MigrationGate>
        <Wardrobe />
      </MigrationGate>,
    );

    expect(mockSweep).toHaveBeenCalledTimes(1);
  });

  it('does not sweep while migrations are still pending', async () => {
    mockMigrations = { success: false, error: undefined };

    await render(
      <MigrationGate>
        <Wardrobe />
      </MigrationGate>,
    );

    expect(screen.getByTestId('migration-pending')).toBeOnTheScreen();
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it('does not sweep when migrations failed — there is no honest row set to diff against', async () => {
    mockMigrations = { success: false, error: new Error('no such table: item') };

    await render(
      <MigrationGate>
        <Wardrobe />
      </MigrationGate>,
    );

    expect(screen.getByTestId('migration-error')).toBeOnTheScreen();
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it('sweeps once when migrations resolve, not on every re-render after', async () => {
    mockMigrations = { success: false, error: undefined };
    const { rerender } = await render(
      <MigrationGate>
        <Wardrobe />
      </MigrationGate>,
    );

    // `useMigrations` hands back a fresh object each render, so the effect has
    // to key off the resolved flag rather than the result — otherwise a chatty
    // hook re-sweeps under an in-flight save.
    mockMigrations = { success: true, error: undefined };
    await rerender(
      <MigrationGate>
        <Wardrobe />
      </MigrationGate>,
    );
    mockMigrations = { success: true, error: undefined };
    await rerender(
      <MigrationGate>
        <Wardrobe />
      </MigrationGate>,
    );

    expect(mockSweep).toHaveBeenCalledTimes(1);
  });

  it('does not hold the UI back — the wardrobe renders alongside the sweep', async () => {
    await render(
      <MigrationGate>
        <Wardrobe />
      </MigrationGate>,
    );

    expect(screen.getByTestId('wardrobe')).toBeOnTheScreen();
  });
});

describe('MigrationGate — never on a timer, never in the background (§4.6)', () => {
  it('never fires again, however long the app is left open', async () => {
    jest.useFakeTimers();
    try {
      await render(
        <MigrationGate>
          <Wardrobe />
        </MigrationGate>,
      );
      expect(mockSweep).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(24 * 60 * 60 * 1000);

      expect(mockSweep).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('subscribes to no app-lifecycle event that could re-trigger it', async () => {
    const AppState = require('react-native').AppState;
    const addEventListener = jest.spyOn(AppState, 'addEventListener');

    await render(
      <MigrationGate>
        <Wardrobe />
      </MigrationGate>,
    );

    expect(addEventListener).not.toHaveBeenCalled();
    addEventListener.mockRestore();
  });
});
