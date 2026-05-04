import { AvatarStyle } from '../shared/avatars';

/**
 * SVG preview of an avatar style. Mirrors the Phaser AvatarSprite layout
 * so the picker shows the same character users will see in-world.
 *
 * Drawn in SVG instead of canvas so it scales cleanly in HTML and respects
 * CSS sizing.
 */
export function AvatarPreview({
  style,
  size = 96,
}: {
  style: AvatarStyle;
  size?: number;
}) {
  return (
    <svg
      viewBox="-30 -36 60 64"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {/* Shadow */}
      <ellipse cx="0" cy="22" rx="19" ry="6" fill="#000" opacity="0.25" />

      {/* Body */}
      <g transform="translate(0, 6)">
        <rect
          x="-13"
          y="-2"
          width="26"
          height="22"
          rx="4"
          fill={hex(style.outfitColor)}
        />
        <rect x="-16" y="0" width="6" height="14" rx="3" fill={darken(style.outfitColor, 0.85)} />
        <rect x="10" y="0" width="6" height="14" rx="3" fill={darken(style.outfitColor, 0.85)} />
        {style.accentType === 'collar' && (
          <rect x="-11" y="-2.5" width="22" height="3" fill={hex(style.accentColor)} opacity="0.9" />
        )}
        {style.accentType === 'scarf' && (
          <>
            <rect x="-12" y="-4" width="24" height="6" rx="3" fill={hex(style.accentColor)} />
            <rect x="-4" y="0" width="5" height="12" fill={hex(style.accentColor)} />
          </>
        )}
      </g>

      {/* Head */}
      <g transform="translate(0, -10)">
        <circle cx="0" cy="0" r="14" fill={hex(style.bodyColor)} stroke={darken(style.bodyColor, 0.85)} strokeWidth="0.6" />

        {/* Hair */}
        {hairPath(style)}

        {/* Eyes */}
        <circle cx="-4" cy="1" r="1.4" fill="#1a1a1a" />
        <circle cx="4" cy="1" r="1.4" fill="#1a1a1a" />

        {/* Mouth */}
        <line x1="-2.5" y1="6" x2="2.5" y2="6" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />

        {/* Glasses */}
        {style.accentType === 'glasses' && (
          <g stroke={hex(style.accentColor)} strokeWidth="1.5" fill="none">
            <circle cx="-4" cy="1" r="3.5" />
            <circle cx="4" cy="1" r="3.5" />
            <line x1="-0.5" y1="1" x2="0.5" y2="1" />
          </g>
        )}

        {/* Earring */}
        {style.accentType === 'earring' && (
          <circle cx="12" cy="4" r="1.5" fill={hex(style.accentColor)} />
        )}
      </g>
    </svg>
  );
}

function hairPath(style: AvatarStyle) {
  if (style.hairStyle === 'bald') return null;
  const hairColor = hex(style.hairColor);
  const skinColor = hex(style.bodyColor);
  switch (style.hairStyle) {
    case 'bob':
      return (
        <g>
          <rect x="-15" y="-16" width="30" height="20" rx="14" fill={hairColor} />
          <rect x="-15" y="2" width="30" height="14" fill={skinColor} />
        </g>
      );
    case 'long':
      return (
        <g>
          <rect x="-15" y="-16" width="30" height="20" rx="14" fill={hairColor} />
          <rect x="-16" y="-2" width="4" height="14" rx="2" fill={hairColor} />
          <rect x="12" y="-2" width="4" height="14" rx="2" fill={hairColor} />
          <rect x="-13" y="4" width="26" height="12" fill={skinColor} />
        </g>
      );
    case 'buzz':
      return (
        <g>
          <circle cx="0" cy="-2" r="13" fill={hairColor} />
          <rect x="-14" y="2" width="28" height="14" fill={skinColor} />
        </g>
      );
    case 'tuft':
      return (
        <g>
          <rect x="-14" y="-16" width="28" height="12" rx="10" fill={hairColor} />
          <polygon points="-7,-15 -3,-22 0,-15" fill={hairColor} />
          <polygon points="0,-15 4,-23 8,-15" fill={hairColor} />
        </g>
      );
    case 'wave':
      return (
        <g>
          <rect x="-16" y="-16" width="32" height="20" rx="14" fill={hairColor} />
          <circle cx="13" cy="4" r="4" fill={hairColor} />
          <rect x="-14" y="4" width="28" height="14" fill={skinColor} />
        </g>
      );
  }
  return null;
}

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

function darken(n: number, f: number): string {
  const r = Math.floor(((n >> 16) & 0xff) * f);
  const g = Math.floor(((n >> 8) & 0xff) * f);
  const b = Math.floor((n & 0xff) * f);
  return hex((r << 16) | (g << 8) | b);
}
