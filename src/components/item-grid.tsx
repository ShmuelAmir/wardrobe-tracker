import { Image } from 'expo-image';
import { useMemo, useState, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import type { Item } from '@/db/schema';
import { itemImageUri } from '@/item-images';
import { useTheme, type Theme } from '@/theme';

const COLUMNS = 3;
const GAP = 2;

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
 */
export function ItemGrid({
  items,
  header,
  onPressItem,
}: {
  items: Item[];
  header?: ReactElement;
  onPressItem?: (id: number) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <FlatList
      testID="wardrobe-grid"
      data={items}
      keyExtractor={(row) => String(row.id)}
      numColumns={COLUMNS}
      ListHeaderComponent={header}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => <ItemCell item={item} styles={styles} onPress={onPressItem} />}
    />
  );
}

function ItemCell({
  item,
  styles,
  onPress,
}: {
  item: Item;
  styles: ReturnType<typeof makeStyles>;
  onPress?: (id: number) => void;
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
    </Pressable>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    grid: {
      gap: GAP,
    },
    row: {
      gap: GAP,
    },
    cell: {
      flex: 1 / COLUMNS,
      aspectRatio: 1,
    },
    image: {
      height: '100%',
      width: '100%',
    },
    placeholder: {
      alignItems: 'center',
      backgroundColor: theme.border,
      justifyContent: 'center',
    },
    placeholderLabel: {
      color: theme.textSecondary,
      fontSize: 12,
    },
  });
}
