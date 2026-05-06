import { getEmoji } from './emojis';

interface Props {
  id: string;
  size?: number;
}

/**
 * Render a Fluent emoji by id. If the id isn't in our catalog, show a
 * subtle placeholder so reactions don't break the layout.
 */
export function EmojiBadge({ id, size = 16 }: Props) {
  const emoji = getEmoji(id);
  if (!emoji) {
    return <span className="emoji-badge emoji-badge--missing" aria-hidden="true">·</span>;
  }
  return (
    <img
      src={emoji.url}
      alt={emoji.name}
      width={size}
      height={size}
      className="emoji-badge"
      loading="lazy"
      draggable={false}
    />
  );
}
