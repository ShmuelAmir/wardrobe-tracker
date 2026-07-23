import { render, screen, userEvent } from '@testing-library/react-native';

import { OutfitReviewSheet } from '@/components/outfit-review-sheet';

async function renderSheet(overrides: Partial<React.ComponentProps<typeof OutfitReviewSheet>> = {}) {
  const props = {
    initialName: '',
    occasions: [] as string[],
    onCommit: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
  await render(<OutfitReviewSheet {...props} />);
  return props;
}

/**
 * §6.2 — no seeding. Outfit #1's sheet has **zero chips** (a fresh install has no
 * history), just a bare optional occasion field; chips appear only once history
 * exists, capped and ordered by the query that feeds them.
 */
describe('OutfitReviewSheet — occasion vocabulary', () => {
  it('shows no chips when history is empty (outfit #1)', async () => {
    await renderSheet({ occasions: [] });

    expect(screen.queryByTestId(/^occasion-chip-/)).toBeNull();
    // The bare free-text field is still there.
    expect(screen.getByTestId('review-occasion')).toBeOnTheScreen();
  });

  it('renders the history chips it is given', async () => {
    await renderSheet({ occasions: ['Work', 'Shul'] });

    expect(screen.getByTestId('occasion-chip-Work')).toBeOnTheScreen();
    expect(screen.getByTestId('occasion-chip-Shul')).toBeOnTheScreen();
  });
});

/**
 * §6.2 — chips are **radio buttons** over a single free-text value: tapping one
 * selects it, tapping the **active** chip clears the occasion, and committing
 * hands back whatever the field holds.
 */
describe('OutfitReviewSheet — radio behaviour', () => {
  it('selects a chip, then clears it when the active chip is tapped again', async () => {
    const user = userEvent.setup();
    const { onCommit } = await renderSheet({ occasions: ['Work', 'Shul'] });

    await user.press(screen.getByTestId('occasion-chip-Work'));
    expect(screen.getByTestId('occasion-chip-Work').props.accessibilityState).toMatchObject({
      selected: true,
    });

    // Tapping the active chip clears it — occasion is optional.
    await user.press(screen.getByTestId('occasion-chip-Work'));
    expect(screen.getByTestId('occasion-chip-Work').props.accessibilityState).toMatchObject({
      selected: false,
    });

    await user.press(screen.getByTestId('review-commit'));
    expect(onCommit).toHaveBeenLastCalledWith('', '');
  });

  it('replaces the current pick when a different chip is tapped', async () => {
    const user = userEvent.setup();
    const { onCommit } = await renderSheet({ occasions: ['Work', 'Shul'] });

    await user.press(screen.getByTestId('occasion-chip-Work'));
    await user.press(screen.getByTestId('occasion-chip-Shul'));

    expect(screen.getByTestId('occasion-chip-Work').props.accessibilityState).toMatchObject({
      selected: false,
    });
    await user.press(screen.getByTestId('review-commit'));
    expect(onCommit).toHaveBeenLastCalledWith('', 'Shul');
  });

  it('carries the builder name in and commits name + occasion', async () => {
    const user = userEvent.setup();
    const { onCommit } = await renderSheet({ initialName: 'Smart evening', occasions: ['Work'] });

    await user.press(screen.getByTestId('occasion-chip-Work'));
    await user.press(screen.getByTestId('review-commit'));

    expect(onCommit).toHaveBeenLastCalledWith('Smart evening', 'Work');
  });
});
