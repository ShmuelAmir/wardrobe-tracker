import type { Doc, Id } from '@convex/_generated/dataModel';

/**
 * A whole `items` row, so a test can name only the field it is about. The
 * defaults are deliberately boring — a test that depends on one of them should
 * pass it explicitly instead.
 */
export function anItem(overrides: Partial<Doc<'items'>> = {}): Doc<'items'> {
  return {
    _id: 'item' as Id<'items'>,
    _creationTime: 0,
    userId: 'owner',
    image: 'storage' as Id<'_storage'>,
    imageUrl: 'https://example.test/item.jpg',
    category: 'Top',
    ...overrides,
  };
}
