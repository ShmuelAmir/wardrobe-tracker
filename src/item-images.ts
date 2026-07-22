import { Directory, File, Paths } from 'expo-file-system';

/**
 * The one place the items directory is named. `item.image_file` holds a bare
 * filename precisely so that reorganizing the layout is this one-line edit and
 * no row has to move (§4.2) — which only holds while every reader comes
 * through here rather than joining the path itself.
 */
const ITEMS_DIRECTORY = 'items';

/** The absolute URI of a stored item image, for `expo-image` at read time. */
export function itemImageUri(imageFile: string) {
  return Paths.join(Paths.document, ITEMS_DIRECTORY, imageFile);
}

/** A `File` handle to a stored (or about-to-be-stored) item image. */
export function itemImageFile(imageFile: string) {
  return new File(Paths.document, ITEMS_DIRECTORY, imageFile);
}

/**
 * Create the items directory on first use (§4.2), idempotently. `intermediates`
 * builds `document/` too if the OS ever hands us a container without it.
 */
export function ensureItemsDirectory() {
  const directory = new Directory(Paths.document, ITEMS_DIRECTORY);
  if (!directory.exists) directory.create({ intermediates: true });
}
