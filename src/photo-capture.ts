import { randomUUID } from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';

import type { CapturedImage } from './item-save';

/**
 * §5.6 / §5.3 — the two iOS-permissioned sources, shared by the source step and
 * by the web-import photo fallback so the permission-gate → launch → UUID-at-
 * capture pipeline (§4.2) lives in exactly one place. Web-import itself can never
 * be denied, so it is not a `DeniableSource`.
 */
export type DeniableSource = 'camera' | 'library';

/**
 * The three ways a capture attempt ends, mapped to what the caller must do next:
 * carry the image forward, silence the source in place, or simply do nothing.
 */
export type CaptureResult =
  | { status: 'captured'; capture: CapturedImage }
  | { status: 'denied' }
  | { status: 'canceled' };

export async function captureFromCamera(): Promise<CaptureResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return toResult(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
}

export async function captureFromLibrary(): Promise<CaptureResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };
  return toResult(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }));
}

/** §4.2 — mint the UUID at capture and carry it with the picked file forward. */
function toResult(result: ImagePicker.ImagePickerResult): CaptureResult {
  if (result.canceled) return { status: 'canceled' };
  const asset = result.assets[0];
  return {
    status: 'captured',
    capture: { uri: asset.uri, width: asset.width, height: asset.height, uuid: randomUUID() },
  };
}
