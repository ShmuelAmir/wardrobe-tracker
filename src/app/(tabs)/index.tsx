import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ItemGrid } from '@/components/item-grid';
import { WardrobeChips } from '@/components/wardrobe-chips';
import { WardrobeHero } from '@/components/wardrobe-hero';
import { useWardrobeItems } from '@/db/queries';
import { parseWardrobeView, wardrobeChips, wardrobeTitle } from '@/wardrobe-view';

/**
 * The Wardrobe tab — browsing what you own. Its sort and category filter are
 * **nav params, not screen state** (§9.6): the screen offers no control that
 * sets them, only Stats' "See all →" does. Everything here is therefore a
 * rendering of params in and a clearing of params out, which is what makes the
 * deferred standalone filter (the known v2 ask) a new entry point rather than a
 * rework.
 */
export default function WardrobeTab() {
  const view = parseWardrobeView(useLocalSearchParams());
  const { items, wardrobeEmpty, loading } = useWardrobeItems(view);
  const navigation = useNavigation();
  const router = useRouter();
  const title = wardrobeTitle(view);

  // The title carries the active category (§9.6), so a shortened list is
  // explained in the nav bar before you reach the chips. `headerTitle`, not
  // `title`: the latter would rename the tab bar's own label with it.
  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: title });
  }, [navigation, title]);

  // The zero-state hero is full-bleed, so the nav bar goes away with it and
  // comes back the moment the first item lands (§7.5).
  useLayoutEffect(() => {
    if (loading) return;
    navigation.setOptions({ headerShown: !wardrobeEmpty });
  }, [navigation, wardrobeEmpty, loading]);

  // `[]` means "not read yet" as often as it means "empty wardrobe"; rendering
  // the hero on the first would flash it on every cold start.
  if (loading) return <View testID="wardrobe-loading" />;

  // Empty: the hero's CTA opens the wizard, since the nav-bar `+` is hidden
  // along with the header. Populated: the `+` in the header opens it (§7.3).
  if (wardrobeEmpty) return <WardrobeHero onAddItem={() => router.push('/add-item')} />;

  // Clearing sets params rather than local state — the chip's own `clearedParams`
  // drops exactly itself and leaves the other param standing (§9.6).
  const chips = (
    <WardrobeChips
      chips={wardrobeChips(view)}
      onClear={(chip) => router.setParams(chip.clearedParams)}
    />
  );

  // A filter can empty the grid on a wardrobe that isn't empty — the last item
  // in the arrived-at category gets deleted while you're standing there. That's
  // a list to clear a chip from, never first-run onboarding. Only a *category*
  // can cause it; a sort never removes rows.
  if (items.length === 0 && view.category) {
    return (
      <View>
        {chips}
        <Text style={styles.emptyNote} testID="wardrobe-filtered-empty">
          {`Nothing in ${view.category} right now — clear the filter to see everything.`}
        </Text>
      </View>
    );
  }

  return (
    <ItemGrid items={items} header={chips} onPressItem={(id) => router.push(`/item/${id}`)} />
  );
}

const styles = StyleSheet.create({
  emptyNote: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.6,
    paddingHorizontal: 24,
    paddingVertical: 24,
    textAlign: 'center',
  },
});
