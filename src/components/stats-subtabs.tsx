import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '@/theme';

/** The two §9.4 sub-tabs — one list at a time, counts in the labels. */
export type SubTab = 'least' | 'never';

/**
 * §9.4 sub-tab bar: `Least worn (k)` / `Never worn (count)`, below the head.
 * **The Least tab is disabled when `k = 0`** — the screen forces `never` there,
 * so a fresh install can't land on an empty Least tab with the whole wardrobe
 * hidden behind the unselected one (a real bug caught in the prototype).
 *
 * Rendered as a **segmented control** sharing the category filter's chrome
 * (#77): both controls choose which slice of the same screen you're looking at,
 * so they should look like the same kind of switch, stacked.
 */
export function StatsSubTabs({
  active,
  leastCount,
  neverCount,
  onSelect,
}: {
  active: SubTab;
  leastCount: number;
  neverCount: number;
  onSelect: (tab: SubTab) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const leastDisabled = leastCount === 0;
  return (
    <View style={styles.bar} testID="stats-subtabs">
      <Tab
        tab="least"
        label={countedLabel('Least worn', leastCount)}
        active={active === 'least'}
        disabled={leastDisabled}
        onSelect={onSelect}
        styles={styles}
      />
      <Tab
        tab="never"
        label={countedLabel('Never worn', neverCount)}
        active={active === 'never'}
        disabled={false}
        onSelect={onSelect}
        styles={styles}
      />
    </View>
  );
}

/**
 * A `(0)` is noise: on the Least tab at `k = 0` it labels a segment the user
 * can't even press, and on either tab it counts nothing. The parentheses are
 * earned only by a count there is something to count.
 */
function countedLabel(label: string, count: number): string {
  return count === 0 ? label : `${label} (${count})`;
}

function Tab({
  tab,
  label,
  active,
  disabled,
  onSelect,
  styles,
}: {
  tab: SubTab;
  label: string;
  active: boolean;
  disabled: boolean;
  onSelect: (tab: SubTab) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      testID={`stats-subtab-${tab}`}
      disabled={disabled}
      onPress={() => onSelect(tab)}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.label, active && styles.labelActive, disabled && styles.labelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    bar: {
      backgroundColor: theme.fill,
      borderRadius: 10,
      flexDirection: 'row',
      marginHorizontal: 16,
      marginVertical: 12,
      padding: 2,
    },
    tab: {
      alignItems: 'center',
      borderRadius: 8,
      flex: 1,
      justifyContent: 'center',
      paddingVertical: 8,
    },
    tabActive: {
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOffset: { height: 1, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
    },
    label: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    labelActive: {
      color: theme.textPrimary,
      fontWeight: '700',
    },
    labelDisabled: {
      opacity: 0.4,
    },
  });
}
