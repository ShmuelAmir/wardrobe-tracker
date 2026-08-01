import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateBackfillCalendar } from '@/components/date-backfill-calendar';
import { ItemGrid } from '@/components/item-grid';
import { OutfitStatsStrip } from '@/components/outfit-stats-strip';
import { WearHistorySheet } from '@/components/wear-history-sheet';
import { WearLogger } from '@/components/wear-logger';
import { WearToast } from '@/components/wear-toast';
import { formatDay } from '@/date-format';
import { useOutfitDetail, useOutfitStats, useWearHistory } from '@/db/queries';
import { zeroItemOutfitLabel } from '@/delete-copy';
import { useTheme, type Theme } from '@/theme';
import { useWearLog } from '@/use-wear-log';
import { isoToday, removeWear } from '@/wear-log';

/**
 * Outfit Detail & wear logging (§8.5) — the outfit's own page, and the first
 * place a wear can be logged (the only thing a user does daily). Header + stats
 * strip + item grid scroll together; "Wore this today" / "Other day" write one
 * `wear_event` each and raise a toast carrying Undo. Un-logging has two horizons:
 * the toast's Undo (the mis-tap, in place) and the wears-cell history sheet (the
 * long-past mistake). Edit re-enters §6's builder pre-selected.
 */
export default function OutfitDetailScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const outfitId = Number(id);
  const router = useRouter();
  const { detail, loading } = useOutfitDetail(outfitId);
  const stats = useOutfitStats(outfitId);
  const wears = useWearHistory(outfitId);

  // The wear-log-with-Undo controller — the same hook the Outfits rail drives,
  // so "log a wear then Undo that tap" is one code path on both surfaces (§2).
  const { logged, log, undo, dismiss } = useWearLog();
  const [pickingDay, setPickingDay] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  if (loading) return <View testID="outfit-detail-loading" />;

  if (detail === null) {
    return (
      <View style={styles.missing} testID="outfit-detail-missing">
        <Text style={styles.missingText}>This outfit no longer exists.</Text>
      </View>
    );
  }

  const { outfit, items } = detail;
  const title = outfit.name ?? 'Untitled outfit';
  const count = items.length === 1 ? '1 item' : `${items.length} items`;

  // Header + stats + logger ride the FlatList's own header so they scroll with
  // the grid and virtualization survives (no ScrollView wrapping the list).
  const header = (
    <View style={styles.header} testID="outfit-detail">
      <Text style={styles.title}>{title}</Text>
      <View style={styles.meta}>
        <Text style={styles.count}>{count}</Text>
        <Text style={styles.created} testID="outfit-detail-created">
          Added {formatDay(outfit.createdAt)}
        </Text>
        {outfit.occasion ? (
          <View style={styles.occasion} testID="outfit-detail-occasion">
            <Text style={styles.occasionLabel}>{outfit.occasion}</Text>
          </View>
        ) : null}
      </View>

      <OutfitStatsStrip stats={stats} onPressWears={() => setShowHistory(true)} />
      <WearLogger onToday={() => log(outfitId, isoToday())} onOtherDay={() => setPickingDay(true)} />

      {/*
       * §8.4 — a garment-less outfit is a **legal, labelled state**, not a bug:
       * every item in it was deleted and the offered cleanup was declined each
       * time. The label exists so the empty grid below reads as explained rather
       * than broken, and it names the wears **because those wears really did
       * happen** — they keep counting toward stats.
       */}
      {items.length === 0 ? (
        <Text style={styles.zeroItems} testID="outfit-zero-items">
          {zeroItemOutfitLabel(stats.timesWorn)}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => router.push(`/outfit-builder?editId=${outfitId}`)}
              testID="outfit-edit"
            >
              <Text style={styles.edit}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ItemGrid items={items} header={header} />

      {logged ? (
        <WearToast message="Logged a wear." onUndo={undo} onExpire={dismiss} />
      ) : null}

      {pickingDay ? (
        <DateBackfillCalendar
          today={new Date()}
          onPick={(iso) => {
            setPickingDay(false);
            log(outfitId, iso);
          }}
          onCancel={() => setPickingDay(false)}
        />
      ) : null}

      {showHistory ? (
        <WearHistorySheet
          rows={wears}
          onRemove={(eventId) => removeWear(eventId)}
          onClose={() => setShowHistory(false)}
        />
      ) : null}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    header: {
      gap: 14,
      paddingBottom: 14,
      paddingTop: 16,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 26,
      fontWeight: '700',
      paddingHorizontal: 20,
    },
    meta: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 20,
    },
    count: {
      color: theme.textSecondary,
      fontSize: 15,
      opacity: 0.6,
    },
    created: {
      color: theme.textSecondary,
      fontSize: 15,
      opacity: 0.6,
    },
    occasion: {
      backgroundColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    occasionLabel: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: '600',
    },
    zeroItems: {
      backgroundColor: theme.fill,
      borderRadius: 12,
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginHorizontal: 20,
      opacity: 0.7,
      padding: 14,
    },
    edit: {
      color: theme.accent,
      fontSize: 17,
      fontWeight: '600',
    },
    missing: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    missingText: {
      color: theme.textSecondary,
      fontSize: 16,
      opacity: 0.6,
    },
  });
}
