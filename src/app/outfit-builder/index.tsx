import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { OutfitBuilder } from '@/components/outfit-builder';
import { useOutfitBuilder } from '@/components/outfit-builder-draft';
import { OutfitReviewSheet } from '@/components/outfit-review-sheet';
import { useItems, useOccasionChips } from '@/db/queries';
import type { Category } from '@/db/schema';
import { saveOutfit } from '@/outfit-save';

/**
 * §6.1 — the builder screen. Items come from the reactive Wardrobe query;
 * selection and name live in the shared draft so the "See all" grid edits the
 * same set. Save opens the review sheet (§6.1.4); committing writes the outfit,
 * dismisses the builder modal, and **lands on its Detail screen** (§6.1.5) as an
 * ordinary card — so Back returns to the Outfits tab, not into a built flow.
 */
export default function OutfitBuilderScreen() {
  const router = useRouter();
  const { items, loading } = useItems();
  const occasions = useOccasionChips();
  const { selection, name, toggle, setName } = useOutfitBuilder();
  const [reviewing, setReviewing] = useState(false);

  if (loading) return <View testID="outfit-builder-loading" />;

  function onSeeAll(category: Category) {
    router.push(`/outfit-builder/category/${category}`);
  }

  function commit(sheetName: string, occasion: string) {
    // The ≥1-item gate lives on the summary bar's Save; guard anyway so a race
    // can't write an empty outfit.
    if (selection.length === 0) return;
    try {
      const id = saveOutfit({ name: sheetName, occasion, itemIds: selection });
      setReviewing(false);
      // Close the builder modal first, then push Detail onto the tabs stack so
      // its Back lands on Outfits (§6.1.5) rather than back inside the builder.
      router.dismissAll();
      router.push(`/outfit/${id}`);
    } catch {
      setReviewing(false);
      Alert.alert("Couldn't save this outfit", 'Something went wrong. Please try again.');
    }
  }

  return (
    <>
      <OutfitBuilder
        items={items}
        selection={selection}
        name={name}
        onToggle={toggle}
        onSetName={setName}
        onSeeAll={onSeeAll}
        onSave={() => setReviewing(true)}
      />
      {reviewing ? (
        <OutfitReviewSheet
          initialName={name}
          occasions={occasions}
          onCommit={commit}
          onCancel={() => setReviewing(false)}
        />
      ) : null}
    </>
  );
}
