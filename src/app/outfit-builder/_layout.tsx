import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { OutfitBuilderProvider } from '@/components/outfit-builder-draft';

/**
 * The outfit builder (§6): the sectioned checklist plus its on-demand "See all"
 * grid. The draft provider spans both screens so the in-progress selection
 * survives the walk into a category's grid and back. Presented as a modal from
 * the Outfits `+` (§7.3); the root stack owns that presentation.
 */
export default function OutfitBuilderLayout() {
  const router = useRouter();

  return (
    <OutfitBuilderProvider>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: 'New outfit',
            headerLeft: () => (
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => router.dismissAll()}
                testID="outfit-builder-cancel"
              >
                <Text style={{ color: '#3a2a6d', fontSize: 17 }}>Cancel</Text>
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="category/[category]" options={{ title: 'All items' }} />
      </Stack>
    </OutfitBuilderProvider>
  );
}
