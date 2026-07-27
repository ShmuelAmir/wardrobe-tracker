import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { db } from '@/db/client';
import { sweepOrphanImagesOnce } from '@/orphan-sweep';

import migrations from '../../drizzle/migrations';

/**
 * Applies the drizzle-kit migrations on-device before anything can query (§2),
 * and holds the app back until they land — a screen that renders against
 * tables that do not exist yet is worse than a spinner.
 *
 * Recovery from a *failed* migration is deliberately out of scope for v1
 * (§11): there is no backup to roll back to, so the honest thing is to say so.
 *
 * It is also, by being the one place that knows migrations have resolved, the
 * only correct moment to fire §4.6's orphan sweep — see below.
 */
export function MigrationGate({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);

  /**
   * §4.6's orphan sweep, and the *only* place it is ever fired from — this is
   * the one component that knows migrations have resolved, which is the
   * earliest moment the `image_file` column can be read. Never a timer, an
   * interval, or an app-foreground subscription; `orphan-sweep.ts` explains
   * why the timing is the feature, and owns the once-per-launch guard.
   *
   * An effect rather than a render-phase call: housekeeping the user never
   * asked for must not sit between them and the first frame. Nothing can be
   * tapped before effects flush, so the wizard is still unreachable when it
   * runs.
   */
  useEffect(() => {
    if (success) sweepOrphanImagesOnce();
  }, [success]);

  if (error) {
    return (
      <View style={styles.center} testID="migration-error">
        <Text style={styles.errorTitle}>Couldn’t open your wardrobe</Text>
        <Text style={styles.errorBody}>{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.center} testID="migration-pending">
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
});
