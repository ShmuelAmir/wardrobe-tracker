import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';

import { AddItemButton } from '@/components/add-item-button';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useItems } from '@/db/queries';

/**
 * §7.3 — the Outfits `+` opens the builder (§6), and is **hidden when the
 * wardrobe is empty**: with nothing to build from, the app offers no button that
 * can't work (§3.1 rule 6). The rail and all-outfits list (§7.1/§7.2) are their
 * own ticket; this slice wires the entry point the builder needs.
 */
export default function OutfitsTab() {
  const { items, loading } = useItems();
  const navigation = useNavigation();
  const router = useRouter();
  const hasItems = items.length > 0;

  useLayoutEffect(() => {
    if (loading) return;
    navigation.setOptions({
      headerRight: hasItems
        ? () => (
            <AddItemButton
              accessibilityLabel="New outfit"
              testID="new-outfit-button"
              onPress={() => router.push('/outfit-builder')}
            />
          )
        : undefined,
    });
  }, [navigation, hasItems, loading, router]);

  return (
    <PlaceholderScreen
      title="Outfits"
      description="Sets of items worn together, with a wear-again rail across the top."
      testID="outfits-screen"
    />
  );
}
