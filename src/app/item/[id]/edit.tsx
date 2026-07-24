import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ReviewFields, useReviewForm } from '@/components/review-form';
import { useItemDetail } from '@/db/queries';
import type { Category, Item } from '@/db/schema';
import { itemImageUri } from '@/item-images';
import { updateItem } from '@/item-save';
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
        <ReplacePhoto uri={photoUri} category={item.category} onReplace={promptReplace} />

        <View style={styles.fields}>
          <ReviewFields state={state} />
        </View>

        {/*
         * §5.5 difference 2 — a Delete Item row, in Edit mode only (the iOS
         * Contacts pattern): reachable here, never on the read path. The delete
         * behaviour itself lands in the deletes ticket; this ticket only
         * establishes the row's home.
         */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            // Wired in the deletes ticket — the row's home is established here.
          }}
          style={styles.delete}
          testID="item-delete"
        >
          <Text style={styles.deleteLabel}>Delete Item</Text>
        </Pressable>
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
}: {
  uri: string;
  category: Category;
  onReplace: () => void;
}) {
  const [missing, setMissing] = useState(false);

  return (
    <View style={styles.photoBlock}>
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
      <Pressable
        accessibilityRole="button"
        onPress={onReplace}
        style={styles.replace}
        testID="item-edit-replace"
      >
        <Text style={styles.replaceLabel}>Replace photo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  photoBlock: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  photo: {
    aspectRatio: 1,
    backgroundColor: '#f2f1f6',
    borderRadius: 16,
    width: '60%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#e9e6f0',
    justifyContent: 'center',
  },
  photoPlaceholderLabel: {
    fontSize: 16,
    opacity: 0.55,
  },
  replace: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  replaceLabel: {
    color: '#3a2a6d',
    fontSize: 16,
    fontWeight: '600',
  },
  fields: {
    gap: 12,
    paddingHorizontal: 20,
  },
  navAction: {
    color: '#3a2a6d',
    fontSize: 17,
    fontWeight: '600',
  },
  navActionDisabled: {
    opacity: 0.4,
  },
  delete: {
    alignItems: 'center',
    marginTop: 28,
    paddingVertical: 16,
  },
  deleteLabel: {
    color: '#c0392b',
    fontSize: 17,
    fontWeight: '600',
  },
  missing: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  missingText: {
    fontSize: 16,
    opacity: 0.6,
  },
});
