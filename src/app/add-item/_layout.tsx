import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { AddItemDraftProvider } from '@/components/add-item-draft';

/**
 * The add-item wizard (§5): a guided, always-forward stack with a per-step Back.
 * All three sources are wired: web-import (the primary path, §5.1) walks through
 * paste-link → confirm-image, while camera/library share the confirm(-photo)
 * step. The draft provider spans every step so the picked image — and the
 * web-import parse result — survive the walk to Review.
 */
export default function AddItemLayout() {
  const router = useRouter();

  return (
    <AddItemDraftProvider>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: 'Add item',
            // Step 1 is the modal's root, so its Back closes the whole wizard.
            headerLeft: () => (
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => router.dismissAll()}
                testID="add-item-cancel"
              >
                <Text style={{ color: '#3a2a6d', fontSize: 17 }}>Cancel</Text>
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="paste-link" options={{ title: 'Paste link' }} />
        <Stack.Screen name="confirm-image" options={{ title: 'Confirm image' }} />
        <Stack.Screen name="confirm" options={{ title: 'Confirm photo' }} />
        <Stack.Screen name="review" options={{ title: 'Review' }} />
        <Stack.Screen name="saved" options={{ title: 'Saved', headerBackVisible: false }} />
      </Stack>
    </AddItemDraftProvider>
  );
}
