import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { MigrationGate } from '@/components/migration-gate';

/**
 * Root stack. The tab shell is one screen in it; the add-item wizard (§5) and
 * the outfit builder (§6) are others, each presented *over* the tabs as a modal
 * so they read as focused, always-forward flows rather than fourth tabs. The
 * outfit Detail screen (§6.1.5, §8.5) is an ordinary pushed card — Save lands on
 * it, and its Back returns to the Outfits tab.
 */
export default function RootLayout() {
  return (
    <MigrationGate>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add-item" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="outfit-builder" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="outfit/[id]" options={{ title: 'Outfit' }} />
      </Stack>
    </MigrationGate>
  );
}
