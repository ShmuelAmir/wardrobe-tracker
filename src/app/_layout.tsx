import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { MigrationGate } from '@/components/migration-gate';

export default function RootLayout() {
  return (
    <MigrationGate>
      <StatusBar style="auto" />
      <Tabs screenOptions={{ headerShown: true }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Wardrobe',
            tabBarButtonTestID: 'tab-wardrobe',
            tabBarIcon: ({ color, size }) => <Ionicons name="shirt" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="outfits"
          options={{
            title: 'Outfits',
            tabBarButtonTestID: 'tab-outfits',
            tabBarIcon: ({ color, size }) => <Ionicons name="albums" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarButtonTestID: 'tab-stats',
            tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" color={color} size={size} />,
          }}
        />
      </Tabs>
    </MigrationGate>
  );
}
