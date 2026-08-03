import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, type Theme } from '@/theme';

/**
 * The Stats screen's switch chrome, in one place: a recessed `fill` track with
 * the chosen segment raised out of it as a shadowed `surface` tile.
 *
 * Both Stats controls are the same gesture — "which slice of this screen am I
 * looking at?" — stacked one above the other (the category filter, then the
 * Least/Never sub-tabs), so they have to *look* like one kind of switch. They
 * had drifted apart as two hand-styled copies; this is the shared original.
 *
 * The chosen segment is marked by its raised tile, not by tinting its label:
 * the label reads `textPrimary` because it is simply the ink of the thing you
 * picked (accent-on-raised-tile would be emphasis on top of emphasis).
 */
export type Segment<T> = {
  /** React key and testID suffix — stable, not the label (labels get abbreviated). */
  key: string;
  value: T;
  label: string;
  /** The spoken label, when the visible one is abbreviated ("Acc." → "Accessory"). */
  accessibilityLabel?: string;
  disabled?: boolean;
};

export function SegmentedControl<T>({
  segments,
  value,
  onChange,
  accessibilityRole,
  testID,
  testIDPrefix,
  /**
   * Seven segments at 390pt leave ~50pt each, so the filter shrinks its labels
   * to fit; a two-segment control never needs to.
   */
  shrinkLabels = false,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityRole: 'button' | 'tab';
  testID: string;
  testIDPrefix: string;
  shrinkLabels?: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.track} testID={testID}>
      {segments.map((segment) => {
        const selected = segment.value === value;
        const disabled = segment.disabled ?? false;
        return (
          <Pressable
            key={segment.key}
            accessibilityRole={accessibilityRole}
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={segment.accessibilityLabel}
            testID={`${testIDPrefix}${segment.key}`}
            disabled={disabled}
            onPress={() => onChange(segment.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit={shrinkLabels}
              style={[
                styles.label,
                selected && styles.labelSelected,
                disabled && styles.labelDisabled,
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    track: {
      backgroundColor: theme.fill,
      borderRadius: 10,
      flexDirection: 'row',
      marginHorizontal: 16,
      marginVertical: 12,
      padding: 3,
    },
    segment: {
      alignItems: 'center',
      borderRadius: 8,
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 2,
      paddingVertical: 8,
    },
    segmentSelected: {
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOffset: { height: 1, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
    },
    label: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    labelSelected: {
      color: theme.textPrimary,
      fontWeight: '700',
    },
    labelDisabled: {
      opacity: 0.4,
    },
  });
}
