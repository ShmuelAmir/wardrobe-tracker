import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { db } from './db/client';
import { item, type Category, type Season } from './db/schema';
import { ensureItemsDirectory, itemImageFile } from './item-images';

const MAX_EDGE = 1600;

/**
 * §4.4 — cap the **longest** edge at 1600px, and never upscale. Returns the
 * single-axis resize to hand expo-image-manipulator, or `null` when the image
 * is already within bounds (an 800px product photo is stored as-is). Picking
 * the axis by orientation is what makes it the longest edge that gets capped.
 */
export function resizePlan(
  width: number,
  height: number,
): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= MAX_EDGE) return null;
  return width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE };
}

/**
 * A local image, already in the cache dir, plus the UUID minted for it **at
 * capture** (§4.2). Every source (library here; camera and web-import later)
 * lands one of these before Review, which is why Save takes no source-specific
 * argument.
 */
export type CapturedImage = {
  uri: string;
  width: number;
  height: number;
  uuid: string;
};

/** The Review-form values that become a row. Wear stats are derived, so absent. */
export type NewItemFields = {
  category: Category;
  name: string | null;
  brand: string | null;
  season: Season[] | null;
  sourceUrl: string | null;
};

/**
 * §4.4 — the save pipeline, identical for every source and touching no network:
 * normalize the image, move it under its UUID name, insert the row. The UUID is
 * known before the row exists (§4.2), so this is a single insert carrying its
 * final filename rather than insert → read-back-id → rename → update.
 *
 * §4.5 — if the insert throws, the row never landed, so the just-moved file is
 * an orphan: unlink it, best-effort. A failed unlink is swallowed and left to
 * the startup sweep (§4.6) — it must never mask the insert error the caller
 * needs to see.
 */
export async function saveItem(image: CapturedImage, fields: NewItemFields): Promise<void> {
  const context = ImageManipulator.manipulate(image.uri);
  const plan = resizePlan(image.width, image.height);
  if (plan) context.resize(plan);
  const rendered = await context.renderAsync();
  const output = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

  ensureItemsDirectory();
  const imageFile = `${image.uuid}.jpg`;
  const destination = itemImageFile(imageFile);
  new File(output.uri).move(destination);

  try {
    db.insert(item).values({ imageFile, ...fields }).run();
  } catch (error) {
    try {
      destination.delete();
    } catch {
      // Best-effort — the startup sweep reconciles anything left behind (§4.6).
    }
    throw error;
  }
}
