import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Category, Item } from '@/db/schema';
import { frontLoadRail } from '@/outfit-selection';

import { SelectableItem } from './selectable-item';

const CELL = 96;

/**
 * §6.1.1 — one category section: a header carrying a **"See all →"** into the
 * category's full grid (§6.1.2), and a **horizontal rail** whose selected items
 * float to the front (`frontLoadRail`). Rails stay lightweight; the on-demand
 * grid is what scales to 100+ item wardrobes.
 */
export function CategoryRail({
  category,
  items,
  selection,
  onToggle,
  onSeeAll,
}: {
  category: Category;
  items: Item[];
  selection: number[];
  onToggle: (id: number) => void;
  onSeeAll: (category: Category) => void;
}) {
  const ordered = frontLoadRail(items, selection);

  return (
    <View style={styles.section} testID={`rail-${category}`}>
      <View style={styles.header}>
        <Text style={styles.title}>{category}</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onSeeAll(category)}
          testID={`see-all-${category}`}
        >
          <Text style={styles.seeAll}>See all →</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={ordered}
        keyExtractor={(row) => String(row.id)}
        contentContainerStyle={styles.rail}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <SelectableItem
              item={item}
              selected={selection.includes(item.id)}
              onToggle={onToggle}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  seeAll: {
    color: '#3a2a6d',
    fontSize: 15,
    fontWeight: '600',
  },
  rail: {
    gap: 10,
    paddingHorizontal: 20,
  },
  cell: {
    height: CELL,
    width: CELL,
  },
});
