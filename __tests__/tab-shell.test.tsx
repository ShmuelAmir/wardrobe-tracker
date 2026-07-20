import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

const APP_ROOT = 'src/app';

/**
 * The three-tab shell is the ground everything else stands on: if these
 * assertions hold, a route added under any tab has somewhere to render.
 *
 * Note on the `renderRouter` calls below: it is async in expo-router 57 but
 * hangs its route getters (`getPathname` etc.) on the returned promise object
 * itself. Awaiting it in a position that unwraps the thenable — including
 * `return await` from a helper — loses those getters, so each test holds the
 * promise in a local and awaits it separately.
 */
describe('three-tab shell', () => {
  it('opens on the Wardrobe tab', async () => {
    const router = renderRouter(APP_ROOT, { initialUrl: '/' });
    await router;

    expect(router.getPathname()).toBe('/');
    expect(await screen.findByTestId('wardrobe-hero')).toBeOnTheScreen();
  });

  it.each([
    ['Outfits', 'tab-outfits', '/outfits', 'outfits-screen'],
    ['Stats', 'tab-stats', '/stats', 'stats-screen'],
    ['Wardrobe', 'tab-wardrobe', '/', 'wardrobe-hero'],
  ])('switches to the %s tab', async (_label, tabTestID, pathname, screenTestID) => {
    const user = userEvent.setup();
    const router = renderRouter(APP_ROOT, { initialUrl: '/' });
    await router;

    await user.press(await screen.findByTestId(tabTestID));

    expect(router.getPathname()).toBe(pathname);
    expect(await screen.findByTestId(screenTestID)).toBeOnTheScreen();
  });

  it('renders all three tab buttons', async () => {
    await renderRouter(APP_ROOT, { initialUrl: '/' });

    for (const tabTestID of ['tab-wardrobe', 'tab-outfits', 'tab-stats']) {
      expect(await screen.findByTestId(tabTestID)).toBeOnTheScreen();
    }
  });
});
