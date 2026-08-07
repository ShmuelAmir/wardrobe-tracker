import { label, type Item } from './data';

/**
 * The one thing all three variants share. A leaf that renders a real Convex
 * image URL (or a labelled placeholder) — sharing it is safe, because it makes
 * no layout claim. Sharing anything larger would smuggle one variant's thesis
 * into the other two.
 */
export function Thumb({ item, size }: { item: Item | undefined; size?: number }) {
  const style = size === undefined ? undefined : { width: size, height: size, flex: 'none' };
  if (item?.imageUrl == null) {
    return (
      <div className="thumb thumb-empty" style={style}>
        {item?.category ?? '—'}
      </div>
    );
  }
  return (
    <img className="thumb" style={style} src={item.imageUrl} alt={label(item)} loading="lazy" />
  );
}

export function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}
