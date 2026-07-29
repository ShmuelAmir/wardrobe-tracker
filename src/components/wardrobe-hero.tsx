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
 * The hero is a dark brand block in both themes, so its foreground reads off
 * `onHero` (light in both) rather than `onAccent` (which flips). The CTA label
 * uses the darkest gradient stop, so the pill's dark-on-light text tracks the
 * gradient it sits over.
 */
export function WardrobeHero({ onAddItem }: { onAddItem: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <LinearGradient colors={theme.heroGradient} style={styles.fill} testID="wardrobe-hero">
      <View style={styles.content}>
        <Text variant="title" style={styles.title}>
          Your wardrobe starts here
        </Text>
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
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing.xxl,
    },
    title: {
      color: theme.onHero,
      textAlign: 'center',
    },
    body: {
      color: theme.onHero,
      opacity: 0.8,
      textAlign: 'center',
    },
    cta: {
      backgroundColor: theme.onHero,
      borderRadius: radii.pill,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.lg,
    },
    ctaPressed: {
      opacity: 0.7,
    },
    ctaLabel: {
      color: theme.heroGradient[0],
      fontSize: 17,
      fontWeight: '600',
    },
  });
}
