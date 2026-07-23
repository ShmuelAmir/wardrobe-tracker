import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import SourceStep from '@/app/add-item/index';
import ReviewStep from '@/app/add-item/review';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  // ReviewStep renders <Redirect> only when there is no capture; the tests below
  // always provide one, so a light stand-in keeps the module importable.
  Redirect: () => null,
}));

const mockLaunch = jest.fn();
const mockLaunchCamera = jest.fn();
const mockRequestCamera = jest.fn();
const mockRequestLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunch(...args),
  launchCameraAsync: (...args: unknown[]) => mockLaunchCamera(...args),
  requestCameraPermissionsAsync: (...args: unknown[]) => mockRequestCamera(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestLibrary(...args),
}));

jest.mock('expo-crypto', () => ({ randomUUID: () => 'a3f2c1de' }));

const granted = { granted: true, status: 'granted', canAskAgain: true };
const denied = { granted: false, status: 'denied', canAskAgain: false };

const mockSetCapture = jest.fn();
let mockCapture: unknown = null;
jest.mock('@/components/add-item-draft', () => ({
  useAddItemDraft: () => ({
    capture: mockCapture,
    setCapture: mockSetCapture,
    reset: jest.fn(),
  }),
}));

const mockSaveItem = jest.fn();
jest.mock('@/item-save', () => ({ saveItem: (...args: unknown[]) => mockSaveItem(...args) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockCapture = null;
  // Permission is granted unless a test overrides it; both source paths pass
  // through a permission gate before launching (§5.6).
  mockRequestCamera.mockResolvedValue(granted);
  mockRequestLibrary.mockResolvedValue(granted);
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
});

/**
 * §5.1 — the source step lists all three sources; only the library is wired in
 * this slice. Choosing a photo mints the UUID at capture (§4.2) and walks
 * forward to confirm, carrying the picked file — it never restarts (§5).
 */
describe('source step — choose from library', () => {
  it('lists all three sources, all live, with Import from web the primary one', async () => {
    await render(<SourceStep />);

    expect(screen.getByTestId('source-web')).toBeOnTheScreen();
    expect(screen.getByTestId('source-camera')).toBeOnTheScreen();
    expect(screen.getByTestId('source-library')).toBeOnTheScreen();
    expect(screen.getByText('Import from web')).toBeOnTheScreen();
    // Every source is live now — none is greyed out.
    expect(screen.getByTestId('source-web').props.accessibilityState).toMatchObject({
      disabled: false,
    });
    expect(screen.getByTestId('source-library').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('walks to the paste-link step when Import from web is chosen', async () => {
    const user = userEvent.setup();
    await render(<SourceStep />);

    await user.press(screen.getByTestId('source-web'));

    expect(mockPush).toHaveBeenCalledWith('/add-item/paste-link');
  });

  it('captures the picked photo under a fresh UUID and advances to confirm', async () => {
    mockLaunch.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///cache/pick.jpg', width: 4032, height: 3024 }],
    });
    const user = userEvent.setup();
    await render(<SourceStep />);

    await user.press(screen.getByTestId('source-library'));

    await waitFor(() =>
      expect(mockSetCapture).toHaveBeenCalledWith({
        uri: 'file:///cache/pick.jpg',
        width: 4032,
        height: 3024,
        uuid: 'a3f2c1de',
      }),
    );
    expect(mockPush).toHaveBeenCalledWith('/add-item/confirm');
  });

  it('does nothing when the picker is canceled', async () => {
    mockLaunch.mockResolvedValueOnce({ canceled: true, assets: null });
    const user = userEvent.setup();
    await render(<SourceStep />);

    await user.press(screen.getByTestId('source-library'));

    await waitFor(() => expect(mockLaunch).toHaveBeenCalled());
    expect(mockSetCapture).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

/**
 * §5.2 / §5.6 — the camera tile is a live source: grant → capture → confirm,
 * the same pipeline the library uses, with no page metadata to pre-fill.
 */
describe('source step — take a photo', () => {
  it('requests permission, captures under a fresh UUID, and advances to confirm', async () => {
    mockLaunchCamera.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///cache/shot.jpg', width: 3024, height: 4032 }],
    });
    const user = userEvent.setup();
    await render(<SourceStep />);

    await user.press(screen.getByTestId('source-camera'));

    await waitFor(() => expect(mockRequestCamera).toHaveBeenCalled());
    expect(mockSetCapture).toHaveBeenCalledWith({
      uri: 'file:///cache/shot.jpg',
      width: 3024,
      height: 4032,
      uuid: 'a3f2c1de',
    });
    expect(mockPush).toHaveBeenCalledWith('/add-item/confirm');
  });

  it('does nothing when the capture is canceled', async () => {
    mockLaunchCamera.mockResolvedValueOnce({ canceled: true, assets: null });
    const user = userEvent.setup();
    await render(<SourceStep />);

    await user.press(screen.getByTestId('source-camera'));

    await waitFor(() => expect(mockLaunchCamera).toHaveBeenCalled());
    expect(mockSetCapture).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

/**
 * §5.6 — a denied source goes quiet in place: its tile becomes a reason card
 * with a Settings deep link. The step never changes, the flow never restarts,
 * and the other two sources stay live beside it.
 */
describe('source step — permission denial', () => {
  it('replaces the camera tile in place while leaving the others usable', async () => {
    mockRequestCamera.mockResolvedValue(denied);
    const user = userEvent.setup();
    await render(<SourceStep />);

    await user.press(screen.getByTestId('source-camera'));

    // The tile is gone; a reason card with a Settings link stands in its place.
    await waitFor(() => expect(screen.getByTestId('source-camera-denied')).toBeOnTheScreen());
    expect(screen.queryByTestId('source-camera')).toBeNull();
    // Camera never launched, and the wizard did not advance or restart.
    expect(mockLaunchCamera).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    // The other two sources are untouched: web is still listed, library still works.
    expect(screen.getByTestId('source-web')).toBeOnTheScreen();
    expect(screen.getByTestId('source-library')).toBeOnTheScreen();
  });

  it('deep-links to Settings from the reason card', async () => {
    mockRequestCamera.mockResolvedValue(denied);
    const user = userEvent.setup();
    await render(<SourceStep />);

    await user.press(screen.getByTestId('source-camera'));
    await waitFor(() => expect(screen.getByTestId('source-camera-denied')).toBeOnTheScreen());
    await user.press(screen.getByTestId('source-camera-denied-settings'));

    expect(Linking.openSettings).toHaveBeenCalled();
  });

  it('gives photo-library denial the identical treatment', async () => {
    mockRequestLibrary.mockResolvedValue(denied);
    const user = userEvent.setup();
    await render(<SourceStep />);

    await user.press(screen.getByTestId('source-library'));

    await waitFor(() => expect(screen.getByTestId('source-library-denied')).toBeOnTheScreen());
    expect(screen.queryByTestId('source-library')).toBeNull();
    expect(mockLaunch).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    // Camera stays live beside the silenced library tile.
    expect(screen.getByTestId('source-camera')).toBeOnTheScreen();
  });
});

/**
 * §5.5 / §4.4 — Review commits through the save pipeline, then the wizard
 * advances to Saved. The captured image and the draft's `source_url` are what
 * the form's fields join to become a row.
 */
describe('review step — commit', () => {
  beforeEach(() => {
    mockCapture = { uri: 'file:///cache/pick.jpg', width: 800, height: 600, uuid: 'a3f2c1de' };
  });

  it('saves the captured image with the chosen fields, then shows Saved', async () => {
    mockSaveItem.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    await render(<ReviewStep />);

    await user.press(screen.getByTestId('category-chip-Top'));
    await user.press(screen.getByTestId('review-save'));

    await waitFor(() =>
      expect(mockSaveItem).toHaveBeenCalledWith(
        { uri: 'file:///cache/pick.jpg', width: 800, height: 600, uuid: 'a3f2c1de' },
        { category: 'Top', name: null, brand: null, season: null, sourceUrl: null },
      ),
    );
    expect(mockReplace).toHaveBeenCalledWith('/add-item/saved');
  });

  it('stays on the form when the save fails — nothing is lost', async () => {
    mockSaveItem.mockRejectedValueOnce(new Error('disk full'));
    const user = userEvent.setup();
    await render(<ReviewStep />);

    await user.press(screen.getByTestId('category-chip-Top'));
    await user.press(screen.getByTestId('review-save'));

    await waitFor(() => expect(mockSaveItem).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
