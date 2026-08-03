import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { StatsCategoryFilter } from '@/components/stats-category-filter';
import { StatsEmptyCard } from '@/components/stats-empty-card';
import { StatsPodium } from '@/components/stats-podium';
import { LeaderboardRow, NeverWornRow } from '@/components/stats-row';
import { SeeAllLink } from '@/components/stats-see-all';
import { StatsSubTabs, type SubTab } from '@/components/stats-subtabs';
import { useStats, type StatsScope, type WardrobeSort, type WornItem } from '@/db/queries';
import type { Item } from '@/db/schema';
import {
  listCaption,
  mostWornEmptyCopy,
  neverWornEmptyCopy,
  MOST_WORN_HEADING,
} from '@/stats-copy';
import { useTheme, type Theme } from '@/theme';
import { wardrobeParams } from '@/wardrobe-view';

/**
 * The Stats tab (§9) — **a leaderboard you read**, not a to-do list you act
 * from (that's §7). Layout is a global category filter → an adaptive most-worn
 * head → the Least/Never sub-tabs, one list at a time. All of it is scoped by
 * the single filter (§9.1), and everything is derived from `wear_event` — Stats
 * writes nothing.
 *
 * The whole screen is one `FlatList` so the never-worn list (which can be the
 * entire wardrobe on a fresh install) stays virtualized; the filter, head, and
 * sub-tab bar ride along as its header.
 */
export default function StatsTab() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [scope, setScope] = useState<StatsScope>(null);
  const [subTab, setSubTab] = useState<SubTab>('least');
  const { data, loading } = useStats(scope);
  const today = useMemo(() => new Date(), []);
  const router = useRouter();

  // The §9.4 forcing rule: at `k = 0` the Least tab is empty and disabled, so
  // the screen shows Never regardless of the user's last pick; above `k = 0`
  // their choice stands (default Least).
  const activeTab: SubTab = data.k === 0 ? 'never' : subTab;

  /**
   * "See all →" — the Wardrobe tab, re-sorted to match the list tapped from and
   * **carrying the active category** (§9.2/§9.6). Carrying it is the decision:
   * "See all" means more rows of the same question, so dropping the filter would
   * discard a just-expressed intent and land the user on a list whose top row
   * isn't what they were looking at. `navigate`, not `push` — the Wardrobe is a
   * tab you switch to, not a screen to stack a second copy of.
   */
  const seeAll = (sort: WardrobeSort) =>
    router.navigate({ pathname: '/', params: wardrobeParams({ sort, category: scope }) });

  if (loading) return <View testID="stats-loading" />;

  const header = (
    <View>
      <StatsCategoryFilter scope={scope} onChange={setScope} />
      <MostWornHead data={data} scope={scope} today={today} onSeeAll={() => seeAll('most')} />
      <StatsSubTabs
        active={activeTab}
        leastCount={data.k}
        neverCount={data.neverWorn.length}
        onSelect={setSubTab}
      />
    </View>
  );

  const rows: (WornItem | Item)[] = activeTab === 'never' ? data.neverWorn : data.leastWorn;

  return (
    <FlatList
      testID="stats-screen"
      data={rows}
      keyExtractor={(row) => String(row.id)}
      ListHeaderComponent={header}
      // An empty Never tab is the one good empty state in the app — everything in
      // scope has been worn — so it congratulates rather than showing a blank.
      // (Least can't be empty here: `k = 0` forces the Never tab.)
      ListEmptyComponent={
        activeTab === 'never' ? (
          <StatsEmptyCard {...neverWornEmptyCopy(scope)} testID="stats-never-worn-empty" />
        ) : null
      }
      // The caption names the sort the list is in, since neither list has a
      // header row to say so. Alongside it — on the least list only — sits its
      // "See all →": the point where the `k` cap ran out is exactly where "more
      // rows" belongs. Never-worn gets no link: it is already the full set (§9.3).
      ListFooterComponent={
        rows.length > 0 ? (
          <View style={styles.listFooter}>
            <Text style={styles.listCaption}>{listCaption(activeTab)}</Text>
            {activeTab === 'least' ? (
              <SeeAllLink
                onPress={() => seeAll('least')}
                accessibilityLabel="See all least-worn items in the Wardrobe"
                testID="stats-see-all-least"
              />
            ) : null}
          </View>
        ) : null
      }
      contentContainerStyle={styles.content}
      renderItem={({ item, index }) =>
        activeTab === 'never' ? (
          <NeverWornRow item={item} today={today} />
        ) : (
          <LeaderboardRow item={item as WornItem} rank={index + 1} today={today} />
        )
      }
    />
  );
}

/**
 * §9.4 adaptive head, sized by `k`: a podium of the top three at `k ≥ 3` (with
 * ranks 4..`k` trailing as rows), plain ranked rows at `k` of 1–2, and the
 * empty-state copy at `k = 0`. The podium is a view of the **capped** slice, so
 * it can never surface a card the cap excluded (§9.2).
 */
function MostWornHead({
  data,
  scope,
  today,
  onSeeAll,
}: {
  data: ReturnType<typeof useStats>['data'];
  scope: StatsScope;
  today: Date;
  onSeeAll: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { k, mostWorn } = data;

  // At `k = 0` there is no ranking, so there is nothing to see all of either.
  // The card's title is the head's own label — the slot the ranking will fill.
  if (k === 0) {
    return (
      <StatsEmptyCard
        title={MOST_WORN_HEADING}
        body={mostWornEmptyCopy(data.wornCount, scope)}
        testID="stats-most-worn-empty"
      />
    );
  }

  return (
    <View>
      {/* The label belongs to §9.4's `k = 1–2` head only — the podium carries its
          own meaning, and this ticket has no business relabelling it. Above the
          podium the row holds nothing but the link. */}
      <View style={[styles.sectionHead, k >= 3 && styles.sectionHeadLinkOnly]}>
        {k >= 3 ? null : <Text style={styles.headerLabel}>{MOST_WORN_HEADING}</Text>}
        <SeeAllLink
          onPress={onSeeAll}
          accessibilityLabel="See all most-worn items in the Wardrobe"
          testID="stats-see-all-most"
        />
      </View>
      {k >= 3 ? (
        <View>
          <StatsPodium top={mostWorn.slice(0, 3)} />
          {mostWorn.slice(3).map((item, index) => (
            <LeaderboardRow key={item.id} item={item} rank={index + 4} today={today} />
          ))}
        </View>
      ) : (
        // k of 1–2: no podium, ranked rows under the plain header.
        mostWorn.map((item, index) => (
          <LeaderboardRow key={item.id} item={item} rank={index + 1} today={today} />
        ))
      )}
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    content: {
      paddingBottom: 24,
    },
    sectionHead: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    sectionHeadLinkOnly: {
      justifyContent: 'flex-end',
    },
    headerLabel: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.4,
      opacity: 0.5,
      textTransform: 'uppercase',
    },
    listFooter: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    listCaption: {
      color: theme.textTertiary,
      fontSize: 13,
    },
  });
}
