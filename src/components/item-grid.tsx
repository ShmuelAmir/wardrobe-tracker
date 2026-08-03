import { Image } from 'expo-image';
import { useMemo, useState, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import type { Item } from '@/db/schema';
import { itemImageUri } from '@/item-images';
import { radii, spacing, useTheme, type Theme } from '@/theme';

const COLUMNS = 3;
// The flush detail-grid gap vs. the roomier, rounded Wardrobe idiom.
const FLUSH_GAP = 2;
const LABELLED_GAP = 10;

/**
 * The Wardrobe grid (§4.1), also the item grid on outfit Detail. Tiles are
 * `contentFit: 'cover'` and nothing else: `none` and `fill` disable expo-image's
 * decode-time downscaling, which is the entire reason this app stores no
 * thumbnails (§10.8).
 *
 * `header` scrolls with the grid as the list's own header — the way to put
 * content above a `FlatList` without nesting it in a `ScrollView` (which would
 * defeat virtualization).
 *
 * `onPressItem` makes a tile a doorway to the item's detail page (§8.1) — the
 * Wardrobe grid passes it; the outfit-detail grid omits it, so those tiles stay
 * inert (an item is a place you go *from the Wardrobe*, §8.1).
 *
 * `labelled` is the **prop-scoped Wardrobe variant**: rounded, 10px-gapped tiles
 * each captioned with the item's name. It is set only at the Wardrobe call site;
 * outfit Detail leaves it off and keeps the flush, unlabelled grid, so this one
 * component serves both without a shared restyle.
 */
export function ItemGrid({
  items,
  header,
  onPressItem,
  labelled = false,
}: {
  items: Item[];
  header?: ReactElement;
  onPressItem?: (id: number) => void;
  labelled?: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme, labelled), [theme, labelled]);

  return (
    <FlatList
      testID="wardrobe-grid"
      data={items}
      keyExtractor={(row) => String(row.id)}
      numColumns={COLUMNS}
      ListHeaderComponent={header}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => (
        <ItemCell item={item} styles={styles} onPress={onPressItem} labelled={labelled} />
      )}
    />
  );
}

function ItemCell({
  item,
  styles,
  onPress,
  labelled,
}: {
  item: Item;
  styles: ReturnType<typeof makeStyles>;
  onPress?: (id: number) => void;
  labelled: boolean;
}) {
  // A row whose file is missing shouldn't happen once §4.5's ordering holds,
  // but the grid degrades to a category placeholder rather than a broken tile.
  const [missing, setMissing] = useState(false);

  return (
    <Pressable
      style={styles.cell}
      testID={`item-cell-${item.id}`}
      disabled={onPress === undefined}
      onPress={onPress ? () => onPress(item.id) : undefined}
    >
      {missing ? (
        <View style={[styles.image, styles.placeholder]} testID={`item-placeholder-${item.id}`}>
          <Text style={styles.placeholderLabel}>{item.category}</Text>
        </View>
      ) : (
        <Image
          testID={`item-image-${item.id}`}
          source={itemImageUri(item.imageFile)}
          contentFit="cover"
          style={styles.image}
          onError={() => setMissing(true)}
        />
      )}
      {labelled && (
        <Text style={styles.label} numberOfLines={1} testID={`item-label-${item.id}`}>
          {item.name ?? item.category}
        </Text>
      )}
    </Pressable>
  );
}

function makeStyles(theme: Theme, labelled: boolean) {
  const gap = labelled ? LABELLED_GAP : FLUSH_GAP;
  return StyleSheet.create({
    grid: {
      gap,
      // The labelled variant sits inset from the screen edge; the flush grid
      // runs edge-to-edge.
      paddingHorizontal: labelled ? spacing.lg : 0,
      paddingTop: labelled ? spacing.sm : 0,
    },
    row: {
      gap,
    },
    cell: {
      flex: 1 / COLUMNS,
    },
    image: {
      aspectRatio: 1,
      width: '100%',
      // Rounded, clipped tiles in the Wardrobe idiom; square-flush on Detail.
      borderRadius: labelled ? radii.md : 0,
    },
    placeholder: {
      alignItems: 'center',
      backgroundColor: theme.border,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    placeholderLabel: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    label: {
      color: theme.textPrimary,
      fontSize: 13,
      paddingHorizontal: spacing.xs,
      paddingTop: spacing.xs,
    },
  });
}
