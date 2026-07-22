import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { MigrationGate } from '@/components/migration-gate';

/**
 * Root stack. The tab shell is one screen in it; the add-item wizard (§5) is
 * another, presented *over* the tabs as a modal so it reads as a focused,
 * always-forward flow rather than a fourth tab. Later stack routes (item detail,
 * §8) slot in here the same way.
 */
export default function RootLayout() {
  return (
    <MigrationGate>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-item" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </MigrationGate>
  );
}
