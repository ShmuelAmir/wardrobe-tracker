import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * SPEC.md §7.5 — the first screen of a fresh install, and the only hero in the
 * app. There is no onboarding flow; this screen is it, which is why the body
 * copy names the product-link path first: §5 makes it the highest-quality
 * source, so the zero state is where to say so.
 */
export function WardrobeHero({ onAddItem }: { onAddItem: () => void }) {
  return (
    <LinearGradient
      colors={['#1b1033', '#3a2a6d', '#6b4fa8']}
      style={styles.fill}
      testID="wardrobe-hero"
    >
      <View style={styles.content}>
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

const styles = StyleSheet.create({
  // Full-bleed: the gradient runs under the status bar, and the layout drops
  // the nav bar entirely while this is showing.
  fill: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 23,
    opacity: 0.8,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    marginTop: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  ctaPressed: {
    opacity: 0.7,
  },
  ctaLabel: {
    color: '#1b1033',
    fontSize: 17,
    fontWeight: '600',
  },
});
