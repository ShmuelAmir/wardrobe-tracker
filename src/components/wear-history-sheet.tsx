import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatIsoDay } from '@/date-format';
import type { WearRow } from '@/db/queries';

/**
 * §8.5 — the **durable un-log path**. Opened from the tappable wears cell, one
 * row per `wear_event`, dated, each with `Remove`. This reaches the mistake a
 * toast can't — *"I logged Tuesday by mistake"* — because that wear's toast
 * expired long ago. Remove carries the event's own id, so it deletes exactly
 * that day's log and no other same-day one.
 *
 * Wear history is **outfit-level only** (§8.5): a wear belongs to an outfit, so
 * this sheet lives here and item detail never offers to un-log.
 */
export function WearHistorySheet({
  rows,
  onRemove,
  onClose,
}: {
  rows: WearRow[];
  onRemove: (eventId: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} visible>
      <Pressable style={styles.backdrop} onPress={onClose} testID="history-backdrop" />
      <View style={styles.sheet} testID="wear-history-sheet">
        <Text style={styles.heading}>Wear history</Text>

        {rows.length === 0 ? (
          <Text style={styles.empty} testID="history-empty">
            Not worn yet.
          </Text>
        ) : (
          <ScrollView style={styles.list}>
            {rows.map((row) => (
              <View key={row.id} style={styles.row} testID={`history-row-${row.id}`}>
                <Text style={styles.date}>{formatIsoDay(row.wornOn)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove wear on ${formatIsoDay(row.wornOn)}`}
                  hitSlop={8}
                  onPress={() => onRemove(row.id)}
                  testID={`history-remove-${row.id}`}
                >
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    padding: 20,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  empty: {
    fontSize: 15,
    opacity: 0.6,
    paddingVertical: 16,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#eceaf2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  date: {
    fontSize: 16,
  },
  remove: {
    color: '#b3261e',
    fontSize: 15,
    fontWeight: '600',
  },
});
