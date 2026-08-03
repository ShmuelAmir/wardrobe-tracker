import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';

import { AddItemButton } from '@/components/add-item-button';

export default function TabsLayout() {
  const router = useRouter();

  return (
    // §7 — a bigger, left-aligned native header title across all three
    // tabs. Bottom-tabs can't do iOS's collapsing large-title (that's a
    // native-stack feature), so this is a statically enlarged left title.
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: 22, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wardrobe',
          tabBarButtonTestID: 'tab-wardrobe',
          tabBarIcon: ({ color, size }) => <Ionicons name="shirt" color={color} size={size} />,
          // §7.3 — the add affordance is a contextual nav-bar `+`, not a FAB and
          // not global. On Wardrobe it opens the add-item wizard (§5).
          headerRight: () => <AddItemButton onPress={() => router.push('/add-item')} />,
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
  );
}
