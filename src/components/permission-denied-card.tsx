import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * §5.6 — a denied source, replaced in place. It states the reason and deep-links
 * to Settings; it never blocks the other sources or the wizard. Shared by the
 * source step and the web-import photo fallback so both silence a source the same
 * way (§5.3 — "the classification biases the UI; it never locks anyone out").
 */
export function PermissionDeniedCard({ source, testID }: { source: string; testID: string }) {
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#faf0ee',
    borderColor: '#e7c4bd',
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 20,
  },
  title: {
    color: '#7a2e1f',
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: '#7a5b54',
    fontSize: 14,
  },
  link: {
    color: '#b23c22',
    fontSize: 15,
    fontWeight: '600',
    paddingTop: 6,
  },
});
