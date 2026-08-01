import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeleteRow } from '@/components/delete-row';
import { ReviewFields, useReviewForm } from '@/components/review-form';
import { useItemDetail } from '@/db/queries';
import type { Category, Item } from '@/db/schema';
import { deleteItem, planItemDelete, readItemDeleteImpact } from '@/item-delete';
import { itemImageUri } from '@/item-images';
import { updateItem } from '@/item-save';
import { useTheme, type Theme } from '@/theme';
import {
  captureFromCamera,
  captureFromLibrary,
  type CaptureResult,
} from '@/photo-capture';
import type { CapturedImage } from '@/item-save';

/**
 * §8.2 Edit — **not a separate editor**: the wizard's own Review & fill screen
 * (§5.5) re-entered in Edit mode, so the field set, chip picker and required
 * split are identical to create. Only three things differ, and they all live
 * here rather than in the shared parts: the nav bar is `Cancel` / `Save` (it
 * commits or abandons — there's nothing after it), a `Delete Item` row sits at
 * the very bottom, and nothing pre-fills from page metadata — values come from
 * the row and `source_url` is preserved, never re-derived.
 *
 * The row is loaded before the form mounts so `useReviewForm`'s initial state
 * seeds from real values in one shot; a pre-read blank or a vanished item render
 * their own states instead, the same guard the detail page uses.
 */
export default function ItemEditScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, loading } = useItemDetail(Number(id));

  if (loading) return <View testID="item-edit-loading" />;

  if (item === null) {
    return (
      <View style={styles.missing} testID="item-edit-missing">
        <Text style={styles.missingText}>This item no longer exists.</Text>
      </View>
    );
  }

  return <ItemEditForm item={item} />;
}

function ItemEditForm({ item }: { item: Item }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const state = useReviewForm({
    category: item.category,
    name: item.name,
    brand: item.brand,
    season: item.season,
  });
  // The replacement capture, once picked — null keeps the item's current photo.
  // Its presence is what turns Save into a replace-photo run (§4.4) vs. a plain
  // field update.
  const [replacement, setReplacement] = useState<CapturedImage | null>(null);
  const saving = useRef(false);

  async function replaceWith(launch: () => Promise<CaptureResult>) {
    const result = await launch();
    if (result.status === 'captured') {
      setReplacement(result.capture);
    } else if (result.status === 'denied') {
      Alert.alert('Permission needed', 'Allow photo access in Settings to replace this photo.');
    }
  }

  function promptReplace() {
    Alert.alert('Replace photo', undefined, [
      { text: 'Take Photo', onPress: () => replaceWith(captureFromCamera) },
      { text: 'Choose from Library', onPress: () => replaceWith(captureFromLibrary) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function save() {
    const submission = state.build();
    if (submission === null || saving.current) return;
    saving.current = true;
    try {
      // `source_url` is intentionally not passed — the edit preserves it (§5.5).
      await updateItem(
        item.id,
        submission,
        replacement ? { image: replacement, previousImageFile: item.imageFile } : null,
      );
      router.back();
    } catch {
      saving.current = false;
      Alert.alert("Couldn't save changes", 'Something went wrong. Please try again.');
    }
  }

  /**
   * §8.3 / §8.4 — the delete confirm. The impact is read **at the moment of the
   * tap**, so the outfit names and counts it quotes are the wardrobe's, not a
   * render-old snapshot's. `planItemDelete` assembles the whole confirm from that
   * one read — title, body, and the ordered actions — so the message that names
   * the doomed outfits and the button that carries their ids agree by
   * construction (§8.4). The screen just renders it and appends the inert Cancel.
   */
  function promptDelete() {
    const plan = planItemDelete(readItemDeleteImpact(item.id));

    Alert.alert(plan.title, plan.message, [
      ...plan.actions.map((action) => ({
        text: action.label,
        style: action.style,
        onPress: () => remove(action.outfitIds),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  function remove(alsoDeleteOutfitIds: number[]) {
    try {
      deleteItem(item.id, item.imageFile, alsoDeleteOutfitIds);
    } catch {
      Alert.alert("Couldn't delete this item", 'Something went wrong. Please try again.');
      return;
    }
    // Edit *and* the detail page underneath it both describe a row that no
    // longer exists, so leave the pair rather than popping back into a tombstone.
    router.dismissTo('/');
  }

  const photoUri = replacement ? replacement.uri : itemImageUri(item.imageFile);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit item',
          // §5.5 difference 1 — the wizard's always-forward Back becomes
          // Cancel / Save. Cancel abandons without writing; both return to detail.
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => router.back()}
              testID="item-edit-cancel"
            >
              <Text style={styles.navAction}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !state.canSave }}
              disabled={!state.canSave}
              hitSlop={12}
              onPress={save}
              testID="item-edit-save"
            >
              <Text style={[styles.navAction, !state.canSave && styles.navActionDisabled]}>
                Save
              </Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} testID="item-edit-form">
        <ReplacePhoto uri={photoUri} category={item.category} onReplace={promptReplace} styles={styles} />

        <View style={styles.fields}>
          <ReviewFields state={state} />
        </View>

        {/*
         * §5.5 difference 2 — a Delete Item row, in Edit mode only (the iOS
         * Contacts pattern): reachable here, never on the read path. **Delete is
         * only ever reachable from the bottom of an Edit surface** (§8.3), which
         * is why this is the item's single delete affordance in the whole app.
         */}
        <DeleteRow label="Delete Item" onPress={promptDelete} testID="item-delete" />
      </ScrollView>
    </>
  );
}

/**
 * §5.5 — Replace-photo lives in Edit mode, not on the read-only detail page. The
 * preview degrades to a category placeholder on a missing file, exactly as the
 * grid tile and detail hero do (§8.1); tapping runs the standard pipeline.
 */
function ReplacePhoto({
  uri,
  category,
  onReplace,
  styles,
}: {
  uri: string;
  category: Category;
  onReplace: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [missing, setMissing] = useState(false);

  return (
    <View style={styles.photoBlock}>
      <View style={styles.photoFrame}>
        {missing ? (
          <View style={[styles.photo, styles.photoPlaceholder]} testID="item-edit-photo-placeholder">
            <Text style={styles.photoPlaceholderLabel}>{category}</Text>
          </View>
        ) : (
          <Image
            testID="item-edit-photo"
            source={uri}
            contentFit="cover"
            style={styles.photo}
            onError={() => setMissing(true)}
          />
        )}
        {/*
         * §5.5 — the replace affordance overlays the hero as a bottom-right pill
         * (matching the read page's inset hero, so the photo doesn't jump on
         * entering Edit) rather than sitting below it as a separate button.
         */}
        <Pressable
          accessibilityRole="button"
          onPress={onReplace}
          style={styles.replace}
          testID="item-edit-replace"
        >
          <Text style={styles.replaceLabel}>Replace photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    content: {
      paddingBottom: 32,
    },
    photoBlock: {
      paddingVertical: 16,
    },
    photoFrame: {
      aspectRatio: 1,
      borderRadius: 16,
      marginHorizontal: 20,
      overflow: 'hidden',
    },
    photo: {
      backgroundColor: theme.fill,
      height: '100%',
      width: '100%',
    },
    photoPlaceholder: {
      alignItems: 'center',
      backgroundColor: theme.fill,
      justifyContent: 'center',
    },
    photoPlaceholderLabel: {
      color: theme.textSecondary,
      fontSize: 16,
      opacity: 0.55,
    },
    replace: {
      backgroundColor: theme.textPrimary,
      borderRadius: 999,
      bottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
      position: 'absolute',
      right: 12,
    },
    replaceLabel: {
      color: theme.surface,
      fontSize: 14,
      fontWeight: '600',
    },
    fields: {
      gap: 12,
      paddingHorizontal: 20,
    },
    navAction: {
      color: theme.accent,
      fontSize: 17,
      fontWeight: '600',
    },
    navActionDisabled: {
      opacity: 0.4,
    },
    missing: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    missingText: {
      color: theme.textSecondary,
      fontSize: 16,
      opacity: 0.6,
    },
  });
}
