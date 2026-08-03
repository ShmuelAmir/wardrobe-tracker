import { listCaption, mostWornEmptyCopy, neverWornEmptyCopy, wearCountLabel } from '@/stats-copy';

describe('wearCountLabel — the badge unit (§9.5)', () => {
  it('spells the unit out, singular at one', () => {
    expect(wearCountLabel(0)).toBe('0 wears');
    expect(wearCountLabel(1)).toBe('1 wear');
    expect(wearCountLabel(12)).toBe('12 wears');
  });
});

describe('listCaption — naming each list’s sort (§9.4)', () => {
  it('names the sort, since neither list has a header row to', () => {
    expect(listCaption('least')).toBe('Ranked from least used');
    expect(listCaption('never')).toBe('Oldest additions first');
  });
});

describe('mostWornEmptyCopy — §9.5 head empty states', () => {
  it('gives the honest fresh-install line when nothing is worn', () => {
    expect(mostWornEmptyCopy(0, null)).toBe(
      'No ranking yet — log a wear and your top items show up here.',
    );
    // Same line even under a filter — nothing worn is nothing worn.
    expect(mostWornEmptyCopy(0, 'Bottom')).toContain('No ranking yet');
  });

  it('names the actual reason at one worn item, naming the category when filtered', () => {
    expect(mostWornEmptyCopy(1, null)).toBe(
      'Only one item has been worn — a leaderboard needs at least two.',
    );
    expect(mostWornEmptyCopy(1, 'Footwear')).toBe(
      'Only one item in Footwear has been worn — a leaderboard needs at least two.',
    );
  });
});

describe('neverWornEmptyCopy — the never-tab empty card (§9.4)', () => {
  it('congratulates an entirely-worn wardrobe', () => {
    expect(neverWornEmptyCopy(null)).toEqual({
      title: 'Everything’s been worn',
      body: 'Nothing in your wardrobe is sitting unused.',
    });
  });

  // Under a filter the claim is only about that category — saying "your
  // wardrobe" would overstate it while five unworn coats sit one tab away.
  it('narrows the claim to the filtered category', () => {
    expect(neverWornEmptyCopy('Footwear')).toEqual({
      title: 'Everything’s been worn',
      body: 'Nothing in Footwear is sitting unused.',
    });
  });
});
