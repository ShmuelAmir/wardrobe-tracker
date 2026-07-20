import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { View } from 'react-native';

import { DevSeedButton } from '@/components/dev-seed-button';
import { ItemGrid } from '@/components/item-grid';
import { WardrobeHero } from '@/components/wardrobe-hero';
import { useItems } from '@/db/queries';

export default function WardrobeTab() {
  const { items, loading } = useItems();
  const navigation = useNavigation();
  const isEmpty = items.length === 0;

  // The zero-state hero is full-bleed, so the nav bar goes away with it and
  // comes back the moment the first item lands (§7.5).
  useLayoutEffect(() => {
    if (loading) return;
    navigation.setOptions({ headerShown: !isEmpty });
  }, [navigation, isEmpty, loading]);

  // `[]` means "not read yet" as often as it means "empty wardrobe"; rendering
  // the hero on the first would flash it on every cold start.
  if (loading) return <View testID="wardrobe-loading" />;

  return (
    <>
      {isEmpty ? <WardrobeHero onAddItem={addItem} /> : <ItemGrid items={items} />}
      <DevSeedButton />
    </>
  );
}

function addItem() {
  // The add-item wizard (§5) lands with the photo-library ticket. Until then
  // the hero's CTA is inert — use the dev seed below to populate the grid.
}
