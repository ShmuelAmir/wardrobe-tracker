import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemGrid } from '@/components/item-grid';
import { useOutfitDetail } from '@/db/queries';

/**
 * Outfit Detail — the screen Save lands on (§6.1.5). This slice is the read-only
 * landing target: name, occasion tag (no season, §6.3), item count, and the
 * item grid. Wear logging, the stats strip, and Edit are §8.5's ticket and slot
 * in here later.
 */
export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, loading } = useOutfitDetail(Number(id));

  if (loading) return <View testID="outfit-detail-loading" />;

  if (detail === null) {
    return (
      <View style={styles.missing} testID="outfit-detail-missing">
        <Text style={styles.missingText}>This outfit no longer exists.</Text>
      </View>
    );
  }

  const { outfit, items } = detail;
  const title = outfit.name ?? 'Untitled outfit';
  const count = items.length === 1 ? '1 item' : `${items.length} items`;

  return (
    <ScrollView contentContainerStyle={styles.content} testID="outfit-detail">
      <Stack.Screen options={{ title }} />
      <Text style={styles.title}>{title}</Text>
      <View style={styles.meta}>
        <Text style={styles.count}>{count}</Text>
        {outfit.occasion ? (
          <View style={styles.occasion} testID="outfit-detail-occasion">
            <Text style={styles.occasionLabel}>{outfit.occasion}</Text>
          </View>
        ) : null}
      </View>
      <ItemGrid items={items} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingVertical: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    paddingHorizontal: 20,
  },
  meta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  count: {
    fontSize: 15,
    opacity: 0.6,
  },
  occasion: {
    backgroundColor: '#eceaf2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  occasionLabel: {
    color: '#3a2a6d',
    fontSize: 14,
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
