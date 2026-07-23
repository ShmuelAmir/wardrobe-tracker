import { render, screen, userEvent } from '@testing-library/react-native';

import { OutfitBuilder } from '@/components/outfit-builder';
import type { Category, Item } from '@/db/schema';

function anItem(id: number, category: Category): Item {
  return {
    id,
    imageFile: `${id}.jpg`,
    category,
    name: null,
    brand: null,
    season: null,
    sourceUrl: null,
    createdAt: new Date(),
  };
}

const items = [
  anItem(1, 'Top'),
  anItem(2, 'Top'),
  anItem(3, 'Bottom'),
  anItem(4, 'Footwear'),
];

async function renderBuilder(overrides: Partial<React.ComponentProps<typeof OutfitBuilder>> = {}) {
  const props = {
    items,
    selection: [] as number[],
    name: '',
    onToggle: jest.fn(),
    onSetName: jest.fn(),
    onSeeAll: jest.fn(),
    onSave: jest.fn(),
    ...overrides,
  };
  await render(<OutfitBuilder {...props} />);
  return props;
}

/**
 * §6.1.1 — one rail per category **in the fixed order**, and only for categories
 * the wardrobe actually has items in (no rail you can't build from, §3.1 rule 6).
 */
describe('OutfitBuilder — rails', () => {
  it('renders a rail per populated category, in the fixed order', async () => {
    await renderBuilder();

    const rails = screen.getAllByTestId(/^rail-/).map((node) => node.props.testID);
    // Top → Bottom → Footwear present and ordered; empty categories are skipped.
    expect(rails).toEqual(['rail-Top', 'rail-Bottom', 'rail-Footwear']);
  });

  it('expands a category into its grid via "See all"', async () => {
    const user = userEvent.setup();
    const { onSeeAll } = await renderBuilder();

    await user.press(screen.getByTestId('see-all-Bottom'));

    expect(onSeeAll).toHaveBeenCalledWith('Bottom');
  });

  it('selects an item on tap', async () => {
    const user = userEvent.setup();
    const { onToggle } = await renderBuilder();

    await user.press(screen.getByTestId('select-item-1'));

    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('marks a selected item with a check', async () => {
    await renderBuilder({ selection: [1] });

    expect(screen.getByTestId('select-check-1')).toBeOnTheScreen();
    expect(screen.queryByTestId('select-check-2')).toBeNull();
  });
});

/**
 * §6.1.3 — the sticky summary bar: a live count and a Save that is **disabled at
 * zero items and enabled at one**.
 */
describe('OutfitBuilder — summary bar', () => {
  it('disables Save with nothing selected', async () => {
    await renderBuilder({ selection: [] });

    expect(screen.getByTestId('outfit-save').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('enables Save once an item is selected', async () => {
    await renderBuilder({ selection: [1] });

    expect(screen.getByTestId('outfit-save').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('does not fire Save while disabled', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderBuilder({ selection: [] });

    await user.press(screen.getByTestId('outfit-save'));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('fires Save when at least one item is selected', async () => {
    const user = userEvent.setup();
    const { onSave } = await renderBuilder({ selection: [1] });

    await user.press(screen.getByTestId('outfit-save'));

    expect(onSave).toHaveBeenCalled();
  });

  it('counts a single pick in the singular', async () => {
    await renderBuilder({ selection: [1] });
    expect(screen.getByTestId('summary-count')).toHaveTextContent('1 item selected');
  });

  it('counts multiple picks in the plural', async () => {
    await renderBuilder({ selection: [1, 3] });
    expect(screen.getByTestId('summary-count')).toHaveTextContent('2 items selected');
  });
});
