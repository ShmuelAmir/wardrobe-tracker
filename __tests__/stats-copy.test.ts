import { mostWornEmptyCopy } from '@/stats-copy';

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
