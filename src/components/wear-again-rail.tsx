import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { OutfitCoverImage } from '@/components/outfit-cover-image';
import { SectionHeading } from '@/components/section-heading';
import type { OutfitCard } from '@/db/queries';
import { daysSinceIso, humanizeDaysAgo } from '@/relative-time';
import { useTheme, type Theme } from '@/theme';

/**
 * §7.1 — the "Wear again" rail: a horizontal strip of the 5 most recently worn
 * outfits, each a one-tap **today-only** log. It's a deliberate strict subset of
 * Detail (no backfill, no other day) because it's the fast path for the only
 * thing a user does daily. The parent owns the write and its Undo toast, so this
 * component only turns taps into calls and flips the tapped card to its in-place
 * confirmation.
 *
 * The rail's scope (`wears ≥ 1`) and its "render nothing when empty" rule live
 * in the parent: it passes only worn outfits and doesn't mount the rail at all
 * when there are none, so there's no empty scaffold here to guard.
 *
 * The Variant C card (#75) is a bordered, rounded, clipped container with the
 * cover art on top and the "Wore it" action a full-width **ghost bar** fused to
 * the bottom edge. Its confirmed state is **persistent, not transient** (§2):
 * a card reads "logged today" whenever the outfit was worn today — either the
 * data says so (`lastWorn === today`) or it was just tapped (`confirmedOutfitId`)
 * — and the two compose, so the muted status survives after the Undo toast
 * expires and only clears if the wear is actually undone.
 */
export function WearAgainRail({
  outfits,
  today,
  confirmedOutfitId,
  onWoreIt,
  onOpen,
}: {
  outfits: OutfitCard[];
  /** Today as `YYYY-MM-DD` — drives the persistent "logged today" state and the when-line. */
  today: string;
  /** The outfit tapped this session — its card confirms immediately, before the query re-reads. */
  confirmedOutfitId: number | null;
  onWoreIt: (outfitId: number) => void;
  onOpen: (outfitId: number) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.section} testID="wear-again-rail">
      <SectionHeading title="Wear again" subLabel="tap to log for today" />
      <FlatList
        horizontal
        data={outfits}
        keyExtractor={(outfit) => String(outfit.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        renderItem={({ item: outfit }) => (
          <WearAgainCard
            outfit={outfit}
            confirmed={confirmedOutfitId === outfit.id || outfit.lastWorn === today}
            today={today}
            onWoreIt={() => onWoreIt(outfit.id)}
            onOpen={() => onOpen(outfit.id)}
            styles={styles}
          />
        )}
      />
    </View>
  );
}

function WearAgainCard({
  outfit,
  confirmed,
  today,
  onWoreIt,
  onOpen,
  styles,
}: {
  outfit: OutfitCard;
  confirmed: boolean;
  today: string;
  onWoreIt: () => void;
  onOpen: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const title = outfit.name ?? 'Untitled outfit';
  // The "when" sub-line: "logged today" once worn today, else the relative
  // last-worn ("worn 3 days ago"). The rail only holds worn outfits, so
  // `lastWorn` is never null here.
  const when = confirmed
    ? 'logged today'
    : `worn ${humanizeDaysAgo(daysSinceIso(outfit.lastWorn!, isoDate(today)))}`;

  return (
    <View style={styles.card} testID={`wear-again-card-${outfit.id}`}>
      <Pressable accessibilityRole="button" onPress={onOpen} testID={`wear-again-open-${outfit.id}`}>
        <OutfitCoverImage
          imageFile={outfit.coverImage}
          style={styles.cover}
          testID={`wear-again-cover-${outfit.id}`}
        />
      </Pressable>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.when} numberOfLines={1} testID={`wear-again-when-${outfit.id}`}>
          {when}
        </Text>
      </View>
      {confirmed ? (
        <View style={[styles.bar, styles.barConfirmed]} testID={`wear-again-confirmed-${outfit.id}`}>
          <Text style={styles.barConfirmedLabel}>✓ Logged today</Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={onWoreIt}
          style={[styles.bar, styles.barGhost]}
          testID={`wear-again-wore-it-${outfit.id}`}
        >
          <Text style={styles.barGhostLabel}>Wore it</Text>
        </Pressable>
      )}
    </View>
  );
}

/** `humanizeDaysAgo` measures against a `Date`; the rail speaks in ISO days. */
function isoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const CARD_WIDTH = 148;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    section: {
      gap: 10,
      paddingTop: 16,
    },
    rail: {
      gap: 12,
      paddingHorizontal: 20,
    },
    // Bordered, rounded, clipped container: the cover art sits flush at the top,
    // the ghost bar flush at the bottom.
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
      width: CARD_WIDTH,
    },
    cover: {
      aspectRatio: 1,
      width: '100%',
    },
    body: {
      gap: 2,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    name: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    when: {
      color: theme.textTertiary,
      fontSize: 13,
    },
    // The full-width action bar fused to the bottom edge — ghost when actionable,
    // muted when it's the persistent logged-today status.
    bar: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    barGhost: {
      backgroundColor: theme.accentSoft,
    },
    barGhostLabel: {
      color: theme.accent,
      fontSize: 15,
      fontWeight: '600',
    },
    barConfirmed: {
      backgroundColor: theme.fill,
    },
    barConfirmedLabel: {
      color: theme.textTertiary,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
