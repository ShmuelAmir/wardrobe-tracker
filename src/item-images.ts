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

/** A `Directory` handle to the items directory — existing or not. */
function itemsDirectory() {
  return new Directory(Paths.document, ITEMS_DIRECTORY);
}

/**
 * Create the items directory on first use (§4.2), idempotently. `intermediates`
 * builds `document/` too if the OS ever hands us a container without it.
 */
export function ensureItemsDirectory() {
  const directory = itemsDirectory();
  if (!directory.exists) directory.create({ intermediates: true });
}

/**
 * Every image filename currently on disk — the disk half of §4.6's diff, in
 * the same bare-filename shape `item.image_file` stores so the two sides
 * compare directly.
 *
 * Deliberately **does not** create the directory: a fresh install has no items
 * dir and nothing to reclaim, and a sweep is not a reason to make one. Only
 * files are listed, so a subdirectory is never a sweep candidate.
 */
export function listItemImageFiles(): string[] {
  const directory = itemsDirectory();
  if (!directory.exists) return [];
  return directory
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .map((entry) => entry.name);
}
