import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme, type Theme } from '@/theme';

/**
 * §5.6 — a denied source, replaced in place. It states the reason and deep-links
 * to Settings; it never blocks the other sources or the wizard. Shared by the
 * source step and the web-import photo fallback so both silence a source the same
 * way (§5.3 — "the classification biases the UI; it never locks anyone out").
 *
 * It rides the `danger`/`onDanger` pair: a filled danger card that reads as a
 * blocked affordance — the tuned strong red in light, the lifted coral in dark —
 * with `onDanger` text legible on either.
 */
export function PermissionDeniedCard({ source, testID }: { source: string; testID: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.title}>{source} access is off</Text>
      <Text style={styles.body}>
        Turn it on to add photos this way. The other options still work.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openSettings()}
        testID={`${testID}-settings`}
      >
        <Text style={styles.link}>Turn it on in Settings →</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.danger,
      borderRadius: 16,
      gap: 6,
      padding: 20,
    },
    title: {
      color: theme.onDanger,
      fontSize: 16,
      fontWeight: '700',
    },
    body: {
      color: theme.onDanger,
      fontSize: 14,
    },
    link: {
      color: theme.onDanger,
      fontSize: 15,
      fontWeight: '600',
      paddingTop: 6,
    },
  });
}
