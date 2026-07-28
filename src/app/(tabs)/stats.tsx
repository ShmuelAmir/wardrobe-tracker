import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { StatsCategoryFilter } from '@/components/stats-category-filter';
import { StatsPodium } from '@/components/stats-podium';
import { LeaderboardRow, NeverWornRow } from '@/components/stats-row';
import { SeeAllLink } from '@/components/stats-see-all';
import { StatsSubTabs, type SubTab } from '@/components/stats-subtabs';
import { useStats, type StatsScope, type WornItem } from '@/db/queries';
import type { Item } from '@/db/schema';
import { mostWornEmptyCopy } from '@/stats-copy';
import { wardrobeParams, type WardrobeSort } from '@/wardrobe-view';

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
      // The least-worn list's own "See all →" sits at its end — the point where
      // the `k` cap ran out is exactly where "more rows" belongs. Never-worn has
      // none: it is already the full set (§9.3).
      ListFooterComponent={
        activeTab === 'least' ? (
          <View style={styles.listFooter}>
            <SeeAllLink
              onPress={() => seeAll('least')}
              accessibilityLabel="See all least-worn items in the Wardrobe"
              testID="stats-see-all-least"
            />
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
  const { k, mostWorn } = data;

  // At `k = 0` there is no ranking, so there is nothing to see all of either.
  if (k === 0) {
    return (
      <Text style={styles.notice} testID="stats-most-worn-empty">
        {mostWornEmptyCopy(data.wornCount, scope)}
      </Text>
    );
  }

  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.headerLabel}>Most worn</Text>
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

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  notice: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.6,
    paddingHorizontal: 24,
    paddingVertical: 28,
    textAlign: 'center',
  },
  sectionHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    opacity: 0.5,
    textTransform: 'uppercase',
  },
  listFooter: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
});
