import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';

import { OutfitBuilder } from '@/components/outfit-builder';
import { useOutfitBuilder } from '@/components/outfit-builder-draft';
import { OutfitReviewSheet } from '@/components/outfit-review-sheet';
import { useItems, useOccasionChips, useOutfitDetail } from '@/db/queries';
import type { Category } from '@/db/schema';
import { outfitDeleteMessage } from '@/delete-copy';
import { deleteOutfit, readOutfitDeleteImpact } from '@/deletes';
import { saveOutfit, updateOutfit } from '@/outfit-save';

/**
 * §6.1 / §8.5 — the builder screen, in both **new** and **Edit** modes. New:
 * Save writes the outfit and lands on its Detail. Edit (`?editId=`): the draft is
 * seeded once from the outfit's current items and name, Save re-saves in place
 * and pops back to the Detail underneath — its wear history untouched (§8.5). In
 * both modes Save opens **§6's own review sheet** (name + occasion), so tags are
 * edited exactly where they're created — no second tag-editing surface.
 */
export default function OutfitBuilderScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const editingId = editId ? Number(editId) : null;

  const { items, loading } = useItems();
  const occasions = useOccasionChips();
  const { selection, name, toggle, setName, reset } = useOutfitBuilder();
  const [reviewing, setReviewing] = useState(false);

  // Edit mode seeds the draft from the outfit's current set — exactly once, so
  // the user's subsequent (de)selections aren't clobbered on every re-render.
  const { detail } = useOutfitDetail(editingId ?? -1);
  const seeded = useRef(false);
  useEffect(() => {
    if (editingId === null || seeded.current || detail === null) return;
    seeded.current = true;
    reset(
      detail.items.map((item) => item.id),
      detail.outfit.name ?? '',
    );
  }, [editingId, detail, reset]);

  if (loading) return <View testID="outfit-builder-loading" />;

  function onSeeAll(category: Category) {
    router.push(`/outfit-builder/category/${category}`);
  }

  function commit(sheetName: string, occasion: string) {
    // The ≥1-item gate lives on the summary bar's Save; guard anyway so a race
    // can't write an empty outfit.
    if (selection.length === 0) return;
    try {
      if (editingId !== null) {
        updateOutfit(editingId, { name: sheetName, occasion, itemIds: selection });
        setReviewing(false);
        // Detail is already underneath and reactive; just close the builder.
        router.dismissAll();
        return;
      }
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

  /**
   * §8.3 — the outfit confirm, and the one that **warns**: an outfit's
   * `wear_event` rows cascade, so this is the delete that destroys history. The
   * impact is read from the *stored* outfit at the moment of the tap, not from
   * the draft selection — an uncommitted re-pick isn't what's about to be
   * deleted.
   */
  function promptDelete(id: number) {
    Alert.alert('Delete this outfit?', outfitDeleteMessage(readOutfitDeleteImpact(id)), [
      { text: 'Delete Outfit', style: 'destructive', onPress: () => remove(id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function remove(id: number) {
    try {
      deleteOutfit(id);
    } catch {
      Alert.alert("Couldn't delete this outfit", 'Something went wrong. Please try again.');
      return;
    }
    // The builder *and* the Detail underneath it both describe a row that no
    // longer exists, so leave the pair rather than popping into a tombstone.
    // Close the modal, then pop Detail — which lands wherever Detail was opened
    // from (the Outfits tab, or item detail's "In outfits" rail, §8.1), rather
    // than throwing the user onto one particular tab and discarding a stack
    // that is still perfectly valid.
    router.dismissAll();
    router.back();
  }

  return (
    <>
      {editingId !== null ? <Stack.Screen options={{ title: 'Edit outfit' }} /> : null}
      <OutfitBuilder
        items={items}
        selection={selection}
        name={name}
        onToggle={toggle}
        onSetName={setName}
        onSeeAll={onSeeAll}
        onSave={() => setReviewing(true)}
        // Edit mode only — a new outfit has nothing to delete (§8.3).
        onDelete={editingId !== null ? () => promptDelete(editingId) : undefined}
      />
      {reviewing ? (
        <OutfitReviewSheet
          initialName={name}
          // Edit mode carries the outfit's existing occasion into the sheet so a
          // re-save doesn't silently clear it (§8.5 — tags are edited here).
          initialOccasion={editingId !== null ? (detail?.outfit.occasion ?? '') : ''}
          occasions={occasions}
          onCommit={commit}
          onCancel={() => setReviewing(false)}
        />
      ) : null}
    </>
  );
}
