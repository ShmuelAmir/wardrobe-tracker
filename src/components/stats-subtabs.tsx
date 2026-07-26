import { Pressable, StyleSheet, Text, View } from 'react-native';

/** The two §9.4 sub-tabs — one list at a time, counts in the labels. */
export type SubTab = 'least' | 'never';

/**
 * §9.4 sub-tab bar: `Least worn (k)` / `Never worn (count)`, below the head.
 * **The Least tab is disabled when `k = 0`** — the screen forces `never` there,
 * so a fresh install can't land on an empty Least tab with the whole wardrobe
 * hidden behind the unselected one (a real bug caught in the prototype).
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
  const leastDisabled = leastCount === 0;
  return (
    <View style={styles.bar} testID="stats-subtabs">
      <Tab
        tab="least"
        label={`Least worn (${leastCount})`}
        active={active === 'least'}
        disabled={leastDisabled}
        onSelect={onSelect}
      />
      <Tab
        tab="never"
        label={`Never worn (${neverCount})`}
        active={active === 'never'}
        disabled={false}
        onSelect={onSelect}
      />
    </View>
  );
}

function Tab({
  tab,
  label,
  active,
  disabled,
  onSelect,
}: {
  tab: SubTab;
  label: string;
  active: boolean;
  disabled: boolean;
  onSelect: (tab: SubTab) => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      testID={`stats-subtab-${tab}`}
      disabled={disabled}
      onPress={() => onSelect(tab)}
      style={styles.tab}
    >
      <Text style={[styles.label, active && styles.labelActive, disabled && styles.labelDisabled]}>
        {label}
      </Text>
      <View style={[styles.underline, active && styles.underlineActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomColor: '#eceaf2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: 8,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    paddingTop: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.5,
  },
  labelActive: {
    color: '#3a2a6d',
    opacity: 1,
  },
  labelDisabled: {
    opacity: 0.3,
  },
  underline: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    height: 2,
    width: '60%',
  },
  underlineActive: {
    backgroundColor: '#3a2a6d',
  },
});
