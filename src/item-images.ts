import { Paths } from 'expo-file-system';

/**
 * The one place the items directory is named. `item.image_file` holds a bare
 * filename precisely so that reorganizing the layout is this one-line edit and
 * no row has to move (§4.2) — which only holds while every reader comes
 * through here rather than joining the path itself.
 */
const ITEMS_DIRECTORY = 'items';

export function itemImageUri(imageFile: string) {
  return Paths.join(Paths.document, ITEMS_DIRECTORY, imageFile);
}
