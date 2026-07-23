import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { useOutfitBuilder } from '@/components/outfit-builder-draft';
import { SelectableItem } from '@/components/selectable-item';
import { useItems } from '@/db/queries';
import { CATEGORIES, type Category } from '@/db/schema';

const COLUMNS = 3;
const GAP = 8;

/**
 * §6.1.2 — "See all" expands one category into a full **vertical grid**, the
 * on-demand surface for 100+ item wardrobes that keeps the rails lightweight.
 * Selection is the same shared draft, so a tap here shows up on the rail behind
 * it. No global search in v1 — this is per-category only.
 */
export default function CategoryGridScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const { items } = useItems();
  const { selection, toggle } = useOutfitBuilder();

  const valid = (CATEGORIES as readonly string[]).includes(category);
  const inCategory = valid ? items.filter((item) => item.category === (category as Category)) : [];

  return (
    <View style={styles.screen} testID={`category-grid-${category}`}>
      <Stack.Screen options={{ title: valid ? category : 'All items' }} />
      <FlatList
        data={inCategory}
        keyExtractor={(row) => String(row.id)}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <SelectableItem
              item={item}
              selected={selection.includes(item.id)}
              onToggle={toggle}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  grid: {
    gap: GAP,
    padding: GAP,
  },
  row: {
    gap: GAP,
  },
  cell: {
    aspectRatio: 1,
    flex: 1 / COLUMNS,
  },
});
