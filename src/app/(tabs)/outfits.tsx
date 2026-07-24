import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, View } from 'react-native';

import { AddItemButton } from '@/components/add-item-button';
import { OutfitCoverCard } from '@/components/outfit-cover-card';
import { OutfitsEmptyState, OutfitsGatedState } from '@/components/outfits-zero-states';
import { WearAgainRail } from '@/components/wear-again-rail';
import { WearToast } from '@/components/wear-toast';
import { useOutfitCards, useItems, WEAR_AGAIN_RAIL_SIZE } from '@/db/queries';
import { isoToday, logWear, removeWear } from '@/wear-log';

/**
 * The Outfits tab (§7) — the tab you **act from**, not an archive you add to,
 * because logging a wear is the only thing done daily. It leads with the
 * one-tap "Wear again" rail (§7.1), then the "All outfits" list sorted by last
 * worn (§7.2). Two distinct zero states carry the onboarding (§7.5): a **gated**
 * screen when the wardrobe is empty (the precondition, no create) and an
 * **ordinary empty** when there are items but no outfits yet.
 *
 * The nav-bar `+` (§7.3) opens the builder — present whenever there's a wardrobe
 * to build from, hidden on the gated screen since the app offers no button that
 * can't work.
 */
export default function OutfitsTab() {
  const { items, loading: itemsLoading } = useItems();
  const { cards, loading: cardsLoading } = useOutfitCards();
  const navigation = useNavigation();
  const router = useRouter();
  const hasItems = items.length > 0;

  // The just-written event id is what Undo deletes; the outfit id is which rail
  // card shows `✓ Worn today` while the toast is up. Both clear when it expires.
  const [logged, setLogged] = useState<{ eventId: number; outfitId: number } | null>(null);
  const dismissToast = useCallback(() => setLogged(null), []);

  useLayoutEffect(() => {
    if (itemsLoading) return;
    navigation.setOptions({
      headerRight: hasItems
        ? () => (
            <AddItemButton
              accessibilityLabel="New outfit"
              testID="new-outfit-button"
              onPress={() => router.push('/outfit-builder')}
            />
          )
        : undefined,
    });
  }, [navigation, hasItems, itemsLoading, router]);

  function woreIt(outfitId: number) {
    const eventId = logWear(outfitId, isoToday());
    setLogged({ eventId, outfitId });
  }

  function undo() {
    if (logged) removeWear(logged.eventId);
    setLogged(null);
  }

  // `[]` is "not read yet" as often as "nothing here"; the loading flags keep
  // the zero states from flashing on a cold start (same trap as `useItems`).
  if (itemsLoading || cardsLoading) return <View testID="outfits-loading" />;

  if (!hasItems) {
    return <OutfitsGatedState onGoToWardrobe={() => router.navigate('/')} />;
  }

  if (cards.length === 0) {
    return <OutfitsEmptyState onNewOutfit={() => router.push('/outfit-builder')} />;
  }

  // Rail scope is `wears ≥ 1` — "wear *again*" (§7.1); with nothing ever worn the
  // rail section doesn't render at all, no empty scaffold.
  const railOutfits = cards.filter((card) => card.timesWorn > 0).slice(0, WEAR_AGAIN_RAIL_SIZE);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        testID="outfits-list"
        data={cards}
        keyExtractor={(card) => String(card.id)}
        ListHeaderComponent={
          railOutfits.length > 0 ? (
            <WearAgainRail
              outfits={railOutfits}
              confirmedOutfitId={logged?.outfitId ?? null}
              onWoreIt={woreIt}
              onOpen={(id) => router.push(`/outfit/${id}`)}
            />
          ) : null
        }
        renderItem={({ item: card }) => (
          <OutfitCoverCard outfit={card} onPress={() => router.push(`/outfit/${card.id}`)} />
        )}
      />

      {logged ? (
        <WearToast message="Logged a wear." onUndo={undo} onExpire={dismissToast} />
      ) : null}
    </View>
  );
}
