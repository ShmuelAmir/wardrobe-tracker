import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '@/theme';

/**
 * §7.5 — the two Outfits zero states are **different screens**, not one message
 * with a swapped verb, because they mean different things. The gated state is a
 * precondition ("build a wardrobe first") and must read as information; the empty
 * state is an invitation ("now build one") and carries the create action. The
 * nav-bar `+` is the tell: hidden on the gated screen (nothing to build from),
 * present on the empty one — the owning tab wires that, matching what's here.
 */

/**
 * Gated: 0 items in the wardrobe. **No create button** — an outfit *is* items
 * worn together, so with nothing to build from the app offers no button that
 * can't work. The one action points back at the precondition.
 */
export function OutfitsGatedState({ onGoToWardrobe }: { onGoToWardrobe: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.screen} testID="outfits-gated">
      <Text style={styles.glyph}>🧥</Text>
      <Text style={styles.title}>Your wardrobe comes first</Text>
      <Text style={styles.body}>
        An outfit is a set of items worn together — so there’s nothing to build until your wardrobe
        has something in it.
      </Text>
      {/* Ghost button: this is a precondition, a pointer back — not the create invitation. */}
      <Pressable
        accessibilityRole="button"
        onPress={onGoToWardrobe}
        style={({ pressed }) => [styles.ctaGhost, pressed && styles.ctaPressed]}
        testID="outfits-go-to-wardrobe"
      >
        <Text style={styles.ctaGhostLabel}>Go to Wardrobe</Text>
      </Pressable>
    </View>
  );
}

/**
 * Ordinary empty: items exist but no outfit does yet. The invitation, with the
 * create action present (the nav-bar `+` is live alongside it).
 */
export function OutfitsEmptyState({ onNewOutfit }: { onNewOutfit: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.screen} testID="outfits-empty">
      <Text style={styles.glyph}>🧺</Text>
      <Text style={styles.title}>Build your first outfit</Text>
      <Text style={styles.body}>Pick the items you wear together and save them as an outfit.</Text>
      {/* Solid button: this is the create invitation, the primary action. */}
      <Pressable
        accessibilityRole="button"
        onPress={onNewOutfit}
        style={({ pressed }) => [styles.ctaSolid, pressed && styles.ctaPressed]}
        testID="outfits-new-outfit"
      >
        <Text style={styles.ctaSolidLabel}>New outfit</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    screen: {
      alignItems: 'center',
      flex: 1,
      gap: 12,
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    glyph: {
      fontSize: 52,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 19,
      fontWeight: '700',
      textAlign: 'center',
    },
    body: {
      color: theme.textPrimary,
      fontSize: 16,
      lineHeight: 23,
      opacity: 0.6,
      textAlign: 'center',
    },
    ctaPressed: {
      opacity: 0.7,
    },
    // The ghost/solid split carries "precondition vs. invitation": the gated
    // screen points back (ghost), the empty screen creates (solid accent).
    ctaGhost: {
      backgroundColor: theme.accentSoft,
      borderRadius: 999,
      marginTop: 8,
      paddingHorizontal: 32,
      paddingVertical: 16,
    },
    ctaGhostLabel: {
      color: theme.accent,
      fontSize: 17,
      fontWeight: '600',
    },
    ctaSolid: {
      backgroundColor: theme.accent,
      borderRadius: 999,
      marginTop: 8,
      paddingHorizontal: 32,
      paddingVertical: 16,
    },
    ctaSolidLabel: {
      color: theme.onAccent,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
