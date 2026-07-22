import { render, screen, userEvent } from '@testing-library/react-native';

import { ReviewForm } from '@/components/review-form';

/**
 * §5.5 — Review & fill. **Category is the only required field**; name, brand and
 * season are all genuinely optional. This is the screen §8 reuses for edit
 * rather than building a second editor, so its contract is pinned here at the
 * component seam, independent of the wizard that mounts it.
 */
describe('ReviewForm', () => {
  it('blocks Save until a category is chosen', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<ReviewForm onSubmit={onSubmit} />);

    // Nothing selected: pressing Save does nothing.
    await user.press(screen.getByTestId('review-save'));
    expect(onSubmit).not.toHaveBeenCalled();

    await user.press(screen.getByTestId('category-chip-Top'));
    await user.press(screen.getByTestId('review-save'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('saves with only a category — name, brand and season stay null', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<ReviewForm onSubmit={onSubmit} />);

    await user.press(screen.getByTestId('category-chip-Footwear'));
    await user.press(screen.getByTestId('review-save'));

    expect(onSubmit).toHaveBeenCalledWith({
      category: 'Footwear',
      name: null,
      brand: null,
      season: null,
    });
  });

  it('collects the optional fields when filled', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<ReviewForm onSubmit={onSubmit} />);

    await user.press(screen.getByTestId('category-chip-Outerwear'));
    await user.type(screen.getByTestId('review-name'), 'Wool overcoat');
    await user.type(screen.getByTestId('review-brand'), 'Acme');
    await user.press(screen.getByTestId('season-chip-winter'));
    await user.press(screen.getByTestId('season-chip-fall'));
    await user.press(screen.getByTestId('review-save'));

    expect(onSubmit).toHaveBeenCalledWith({
      category: 'Outerwear',
      name: 'Wool overcoat',
      brand: 'Acme',
      season: ['winter', 'fall'],
    });
  });

  it('treats season as a toggle — tapping a chosen season clears it', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<ReviewForm onSubmit={onSubmit} />);

    await user.press(screen.getByTestId('category-chip-Top'));
    await user.press(screen.getByTestId('season-chip-summer'));
    await user.press(screen.getByTestId('season-chip-summer'));
    await user.press(screen.getByTestId('review-save'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ season: null }));
  });

  it('drops whitespace-only text back to null', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(<ReviewForm onSubmit={onSubmit} />);

    await user.press(screen.getByTestId('category-chip-Bag'));
    await user.type(screen.getByTestId('review-name'), '   ');
    await user.press(screen.getByTestId('review-save'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: null }));
  });

  it('pre-fills from initial values — the second entry point §8 reuses', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(
      <ReviewForm
        initial={{ category: 'Top', name: 'Grey tee', brand: 'Acme', season: ['spring'] }}
        onSubmit={onSubmit}
      />,
    );

    await user.press(screen.getByTestId('review-save'));

    expect(onSubmit).toHaveBeenCalledWith({
      category: 'Top',
      name: 'Grey tee',
      brand: 'Acme',
      season: ['spring'],
    });
  });
});
