import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { toIsoDate } from '@/wear-log';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * §8.5 "Other day" — a calendar for **past-date backfill with future dates
 * disabled**. A wear you log for a day you didn't yet live is meaningless, so
 * days after `today` are non-tappable and the "next month" arrow stops at the
 * current month — the app never offers a control that can't do anything
 * (§3.1 rule 6). Picking a day emits its local `YYYY-MM-DD`.
 */
export function DateBackfillCalendar({
  today,
  onPick,
  onCancel,
}: {
  today: Date;
  onPick: (iso: string) => void;
  onCancel: () => void;
}) {
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayIso = toIsoDate(today);

  // The next arrow can't page past the month that holds today — every day
  // beyond it is future, so there'd be nothing to pick there.
  const atCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  function step(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  // Leading blanks align the 1st under its weekday; a fixed 7-wide grid does the
  // rest of the layout.
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <Modal transparent animationType="slide" onRequestClose={onCancel} visible>
      <Pressable style={styles.backdrop} onPress={onCancel} testID="calendar-backdrop" />
      <View style={styles.sheet} testID="date-backfill-calendar">
        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            hitSlop={12}
            onPress={() => step(-1)}
            style={styles.arrow}
            testID="calendar-prev"
          >
            <Text style={styles.arrowLabel}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: atCurrentMonth }}
            disabled={atCurrentMonth}
            hitSlop={12}
            onPress={() => step(1)}
            style={[styles.arrow, atCurrentMonth && styles.arrowDisabled]}
            testID="calendar-next"
          >
            <Text style={styles.arrowLabel}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((day, index) => (
            <Text key={index} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, index) => {
            if (day === null) return <View key={`blank-${index}`} style={styles.day} />;
            const iso = toIsoDate(new Date(viewYear, viewMonth, day));
            const future = iso > todayIso;
            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                accessibilityState={{ disabled: future }}
                disabled={future}
                onPress={() => onPick(iso)}
                style={styles.day}
                testID={`calendar-day-${iso}`}
              >
                <Text style={[styles.dayLabel, future && styles.dayLabelDisabled]}>{day}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  monthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  arrow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  arrowDisabled: {
    opacity: 0.25,
  },
  arrowLabel: {
    color: '#3a2a6d',
    fontSize: 24,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'center',
    width: `${100 / 7}%`,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    width: `${100 / 7}%`,
  },
  dayLabel: {
    fontSize: 16,
  },
  dayLabelDisabled: {
    opacity: 0.25,
  },
});
