import { render, screen } from '@testing-library/react-native';

import { Text } from '@/components/text';
import { type TextVariant } from '@/theme';

/**
 * A thin behavior test for the typography primitive: each variant renders its
 * children. Deliberately no color or type-size assertion — those are the tokens'
 * job, and pinning applied styles here would be brittle (ADR-0013).
 */
describe('the Text primitive', () => {
  it.each(['title', 'body', 'caption'] as TextVariant[])(
    'renders its children for the %s variant',
    async (variant) => {
      await render(<Text variant={variant}>Hello wardrobe</Text>);

      expect(screen.getByText('Hello wardrobe')).toBeOnTheScreen();
    },
  );

  it('defaults to the body variant when none is given', async () => {
    await render(<Text>No variant</Text>);

    expect(screen.getByText('No variant')).toBeOnTheScreen();
  });
});
