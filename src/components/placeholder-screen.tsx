import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme, type Theme } from '@/theme';

type PlaceholderScreenProps = {
  /** Tab name, shown as the heading. */
  title: string;
  /** One line on what this tab will eventually do. */
  description: string;
  testID: string;
};

/**
 * Stand-in body for a tab whose real screen hasn't been built yet. Every tab
 * ships one so the shell is navigable before any feature lands. It sits on the
 * `background`/`textPrimary`/`textSecondary` roles so a not-yet-built tab still
 * renders correctly in dark.
 */
export function PlaceholderScreen({ title, description, testID }: PlaceholderScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      gap: 8,
      paddingHorizontal: 32,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 24,
      fontWeight: '600',
    },
    description: {
      color: theme.textSecondary,
      fontSize: 15,
      textAlign: 'center',
    },
  });
}
