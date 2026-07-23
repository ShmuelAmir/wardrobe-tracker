import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** How long a wear toast — and with it, the chance to Undo — stays on screen. */
export const TOAST_MS = 4000;

/**
 * §8.5 — every wear log shows a toast carrying **Undo**. This is the mis-tap
 * rescued *in place*: Undo deletes the `wear_event` just written and **expires
 * with the toast**. Once it's gone, un-logging moves to the durable path (the
 * history sheet) — the toast never lingers as a second, stale way to un-log.
 *
 * The parent owns the just-written event id; this component owns only the timer,
 * firing `onExpire` once so the parent can drop the toast.
 */
export function WearToast({
  message,
  onUndo,
  onExpire,
}: {
  message: string;
  onUndo: () => void;
  onExpire: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onExpire, TOAST_MS);
    return () => clearTimeout(timer);
  }, [onExpire]);

  return (
    <View style={styles.toast} testID="wear-toast">
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onUndo}
        hitSlop={12}
        testID="wear-toast-undo"
      >
        <Text style={styles.undo}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    alignItems: 'center',
    backgroundColor: '#2a2440',
    borderRadius: 14,
    bottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: 'absolute',
    right: 20,
  },
  message: {
    color: '#ffffff',
    flex: 1,
    fontSize: 15,
  },
  undo: {
    color: '#c9bdf0',
    fontSize: 16,
    fontWeight: '700',
  },
});
