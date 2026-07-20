import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { Item } from '@/db/schema';
import { itemImageUri } from '@/item-images';

const COLUMNS = 3;
const GAP = 2;

/**
 * The Wardrobe grid (§4.1). Tiles are `contentFit: 'cover'` and nothing else:
 * `none` and `fill` disable expo-image's decode-time downscaling, which is the
 * entire reason this app stores no thumbnails (§10.8).
 */
export function ItemGrid({ items }: { items: Item[] }) {
  return (
    <FlatList
      testID="wardrobe-grid"
      data={items}
      keyExtractor={(row) => String(row.id)}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => <ItemCell item={item} />}
    />
  );
}

function ItemCell({ item }: { item: Item }) {
  // A row whose file is missing shouldn't happen once §4.5's ordering holds,
  // but the grid degrades to a category placeholder rather than a broken tile.
  const [missing, setMissing] = useState(false);

  return (
    <View style={styles.cell} testID={`item-cell-${item.id}`}>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#e9e6f0',
    justifyContent: 'center',
  },
  placeholderLabel: {
    fontSize: 12,
    opacity: 0.55,
  },
});
