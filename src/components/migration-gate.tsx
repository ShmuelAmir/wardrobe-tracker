import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { db } from '@/db/client';
import { sweepOrphanImages } from '@/orphan-sweep';

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
   * §4.6 / ADR-0008 — the startup orphan sweep, and the *only* place it is
   * ever fired from. It is deliberately not a timer, an interval, or an
   * app-foreground subscription: save is "move file → insert row", so a
   * concurrent sweep could unlink a legitimate file out from under an
   * in-flight save. Firing once here — after migrations resolve, before a tap
   * can reach the wizard — rules that race out by construction.
   *
   * The ref is what makes "once" hold: `useMigrations` returns a fresh object
   * on every render, so a dependency on it alone would re-sweep on each one.
   * An effect rather than a render-phase call because housekeeping the user
   * never asked for must not sit between them and the first frame; nothing can
   * be tapped before effects flush, so the wizard is still unreachable until
   * after it has run.
   */
  const hasSwept = useRef(false);
  useEffect(() => {
    if (!success || hasSwept.current) return;
    hasSwept.current = true;
    sweepOrphanImages();
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
