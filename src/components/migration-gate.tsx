import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { db } from '@/db/client';

import migrations from '../../drizzle/migrations';

/**
 * Applies the drizzle-kit migrations on-device before anything can query (§2),
 * and holds the app back until they land — a screen that renders against
 * tables that do not exist yet is worse than a spinner.
 *
 * Recovery from a *failed* migration is deliberately out of scope for v1
 * (§11): there is no backup to roll back to, so the honest thing is to say so.
 */
export function MigrationGate({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);

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
