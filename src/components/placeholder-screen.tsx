import { StyleSheet, Text, View } from 'react-native';

type PlaceholderScreenProps = {
  /** Tab name, shown as the heading. */
  title: string;
  /** One line on what this tab will eventually do. */
  description: string;
  testID: string;
};

/**
 * Stand-in body for a tab whose real screen hasn't been built yet. Every tab
 * ships one so the shell is navigable before any feature lands.
 */
export function PlaceholderScreen({ title, description, testID }: PlaceholderScreenProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: 'center',
  },
});
