import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORIES, type Category, type Item } from '@/db/schema';
import { itemImageUri } from '@/item-images';
import { useTheme, type Theme } from '@/theme';

import { CategoryRail } from './category-rail';
import { DeleteRow } from './delete-row';

const MINI_STACK = 4;

/**
 * §6.1 — the sectioned checklist. A vertical scroll of one **horizontal rail per
 * category** in the fixed order (§6.1.1) over a **sticky summary bar** (§6.1.3):
 * a mini-stack of the first few picks, the count, a name field, and Save. Save
 * is **disabled until ≥1 item is selected**. Categories with no items are
 * skipped — the app never shows a rail that can't be built from (§3.1 rule 6).
 *
 * `onDelete` puts a `Delete Outfit` row at the very bottom of the scroll — the
 * outfit half of §8.3's rule that **delete lives at the bottom of Edit, both
 * times**. It is omitted while a *new* outfit is being built, because there is
 * nothing yet to delete (§10 rule 6: the app never offers a button that can't
 * work).
 */
export function OutfitBuilder({
  items,
  selection,
  name,
  onToggle,
  onSetName,
  onSeeAll,
  onSave,
  onDelete,
}: {
  items: Item[];
  selection: number[];
  name: string;
  onToggle: (id: number) => void;
  onSetName: (name: string) => void;
  onSeeAll: (category: Category) => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const byCategory = new Map<Category, Item[]>();
  for (const item of items) {
    const bucket = byCategory.get(item.category);
    if (bucket) bucket.push(item);
    else byCategory.set(item.category, [item]);
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const stack = selection
    .slice(0, MINI_STACK)
    .map((id) => byId.get(id))
    .filter((item): item is Item => item !== undefined);

  const count = selection.length;
  const canSave = count > 0;

  return (
    <View style={styles.screen} testID="outfit-builder">
      <ScrollView contentContainerStyle={styles.rails}>
        {CATEGORIES.filter((category) => byCategory.has(category)).map((category) => (
          <CategoryRail
            key={category}
            category={category}
            items={byCategory.get(category) ?? []}
            selection={selection}
            onToggle={onToggle}
            onSeeAll={onSeeAll}
          />
        ))}

        {onDelete ? (
          <DeleteRow label="Delete Outfit" onPress={onDelete} testID="outfit-delete" />
        ) : null}
      </ScrollView>

      <View style={styles.summary} testID="summary-bar">
        <View style={styles.stackRow}>
          <View style={styles.stack}>
            {stack.map((item, index) => (
              <Image
                key={item.id}
                source={itemImageUri(item.imageFile)}
                contentFit="cover"
                style={[styles.stackImage, index > 0 && styles.stackImageOverlap]}
              />
            ))}
          </View>
          <Text style={styles.count} testID="summary-count">
            {count === 1 ? '1 item selected' : `${count} items selected`}
          </Text>
        </View>

        <TextInput
          placeholder="Name this outfit (optional)"
          placeholderTextColor={theme.textSecondary}
          value={name}
          onChangeText={onSetName}
          style={styles.input}
          testID="outfit-name"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={onSave}
          style={[styles.save, !canSave && styles.saveDisabled]}
          testID="outfit-save"
        >
          <Text style={styles.saveLabel}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    rails: {
      gap: 22,
      paddingBottom: 24,
      paddingTop: 12,
    },
    summary: {
      backgroundColor: theme.surface,
      borderTopColor: theme.border,
      borderTopWidth: 1,
      gap: 12,
      padding: 16,
    },
    stackRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      minHeight: 40,
    },
    stack: {
      flexDirection: 'row',
    },
    stackImage: {
      backgroundColor: theme.border,
      borderColor: theme.surface,
      borderRadius: 8,
      borderWidth: 2,
      height: 40,
      width: 40,
    },
    stackImageOverlap: {
      marginLeft: -14,
    },
    count: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: '600',
      opacity: 0.7,
    },
    input: {
      backgroundColor: theme.fill,
      borderRadius: 10,
      color: theme.textPrimary,
      fontSize: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    save: {
      alignItems: 'center',
      backgroundColor: theme.accent,
      borderRadius: 14,
      paddingVertical: 16,
    },
    saveDisabled: {
      opacity: 0.4,
    },
    saveLabel: {
      color: theme.onAccent,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
