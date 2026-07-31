import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { radii, spacing, useTheme, type Theme } from '@/theme';

/**
 * SPEC.md §7.5 — the first screen of a fresh install, and the only hero in the
 * app. There is no onboarding flow; this screen is it, which is why the body
 * copy names the product-link path first: §5 makes it the highest-quality
 * source, so the zero state is where to say so.
 *
 * The design-parity retrofit (#74, Variant C) redrew the hero from a dark brand
 * block into a soft tinted panel: an `accentSoft → surface` gradient that tracks
 * the theme, with content **bottom-left** aligned over a large glyph. Because the
 * panel is now an ordinary light/dark surface (not a fixed-dark block), its
 * foreground reads off the everyday `textPrimary`/`textSecondary` roles and the
 * CTA is a **solid accent** pill (`accent` fill, `onAccent` label) — the old
 * `onHero` role it used to need is retired with this redraw.
 */
export function WardrobeHero({ onAddItem }: { onAddItem: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <LinearGradient colors={theme.heroGradient} style={styles.fill} testID="wardrobe-hero">
      <View style={styles.content}>
        <Text style={styles.glyph}>👕</Text>
        <Text style={styles.title}>Your wardrobe starts here</Text>
        <Text style={styles.body} testID="wardrobe-hero-body">
          Paste a product link and we’ll pull in the photo, brand and name for you — or shoot it
          yourself with the camera.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onAddItem}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaLabel}>Add your first item</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    // Full-bleed: the gradient runs under the status bar, and the layout drops
    // the nav bar entirely while this is showing.
    fill: {
      flex: 1,
    },
    // Bottom-aligned, left-aligned content — the Variant C hero composition.
    content: {
      flex: 1,
      alignItems: 'flex-start',
      justifyContent: 'flex-end',
      gap: spacing.md,
      paddingBottom: spacing.xxl,
      paddingHorizontal: spacing.xxl,
    },
    glyph: {
      fontSize: 52,
      marginBottom: spacing.sm,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 27,
      fontWeight: '700',
    },
    body: {
      color: theme.textSecondary,
    },
    cta: {
      backgroundColor: theme.accent,
      borderRadius: radii.pill,
      marginTop: spacing.md,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.lg,
    },
    ctaPressed: {
      opacity: 0.7,
    },
    ctaLabel: {
      color: theme.onAccent,
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
