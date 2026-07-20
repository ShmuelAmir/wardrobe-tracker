import { db } from './client';
import { item, type Category } from './schema';

/**
 * ⚠️ THROWAWAY — see `components/dev-seed-button.tsx`. Delete both with the
 * photo-library ticket, which brings the real insert path.
 *
 * The filename it writes points at nothing: no file is ever created, so these
 * rows land as category placeholders in the grid (§4.2). That is enough to
 * prove the grid renders and re-renders; it is not a stand-in for the real
 * save pipeline (§4.4).
 */
export function insertDevItem(category: Category) {
  return db
    .insert(item)
    .values({ imageFile: `dev-${Date.now()}.jpg`, category, name: `Dev ${category}` })
    .run();
}
