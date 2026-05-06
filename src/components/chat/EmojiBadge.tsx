import { useState } from 'react';
import { getEmoji } from './emojis';

interface Props {
  id: string;
  size?: number;
}

/**
 * Render a Fluent emoji. Tries the animated webp first; if that fails to load
 * (e.g., older browser, CDN miss), falls back to the static 3D PNG.
 */
export function EmojiBadge({ id, size = 16 }: Props) {
  const emoji = getEmoji(id);
  const [errored, setErrored] = useState(false);

  if (!emoji) {
    return <span className="emoji-badge emoji-badge--missing" aria-hidden="true">·</span>;
  }

  return (
    <img
      src={errored ? emoji.static : emoji.animated}
      alt={emoji.name}
      width={size}
      height={size}
      className="emoji-badge"
      loading="lazy"
      draggable={false}
      onError={() => setErrored(true)}
    />
  );
}
