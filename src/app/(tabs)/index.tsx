import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { View } from 'react-native';

import { ItemGrid } from '@/components/item-grid';
import { WardrobeHero } from '@/components/wardrobe-hero';
import { useItems } from '@/db/queries';

export default function WardrobeTab() {
  const { items, loading } = useItems();
  const navigation = useNavigation();
  const router = useRouter();
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

  // Empty: the hero's CTA opens the wizard, since the nav-bar `+` is hidden
  // along with the header. Populated: the `+` in the header opens it (§7.3).
  return isEmpty ? (
    <WardrobeHero onAddItem={() => router.push('/add-item')} />
  ) : (
    <ItemGrid items={items} />
  );
}
