import { AvatarStyle } from '../shared/avatars';

export function AvatarPreview({
  style,
  size = 96,
}: {
  style: AvatarStyle;
  size?: number;
}) {
  return (
    <svg
      viewBox="-30 -38 60 64"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <ellipse cx="0" cy="22" rx="19" ry="6" fill="#000" opacity="0.25" />

      {/* Body */}
      <g transform="translate(0, 6)">
        <rect x="-13" y="-2" width="26" height="22" rx="4" fill={hex(style.outfitColor)} />
        {/* lapel */}
        <polygon points="-6,-2 0,6 6,-2" fill={hex(style.outfitSecondary)} />
        {/* arms */}
        <rect x="-16" y="0" width="6" height="14" rx="3" fill={darken(style.outfitColor, 0.85)} />
        <rect x="10" y="0" width="6" height="14" rx="3" fill={darken(style.outfitColor, 0.85)} />

        {style.accentType === 'sash' && (
          <polygon
            points="-12,4 -10,0 14,16 12,20"
            fill={hex(style.accentColor)}
            opacity="0.95"
          />
        )}
        {style.accentType === 'pendant' && (
          <>
            <line x1="-3" y1="-1" x2="0" y2="4" stroke="#c9c4b8" strokeWidth="0.6" opacity="0.6" />
            <line x1="3" y1="-1" x2="0" y2="4" stroke="#c9c4b8" strokeWidth="0.6" opacity="0.6" />
            <circle cx="0" cy="5" r="2" fill={hex(style.accentColor)} />
          </>
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
        <circle cx="0" cy="0" r="14" fill={hex(style.bodyColor)}
          stroke={darken(style.bodyColor, 0.85)} strokeWidth="0.6" />

        {hairPath(style)}

        <circle cx="-4" cy="1" r="1.4" fill="#1a1a1a" />
        <circle cx="4" cy="1" r="1.4" fill="#1a1a1a" />
        <line x1="-2.5" y1="6" x2="2.5" y2="6" stroke="#1a1a1a" strokeWidth="1.2"
          strokeLinecap="round" opacity="0.7" />

        {style.accentType === 'glasses' && (
          <g stroke={hex(style.accentColor)} strokeWidth="1.5" fill="none">
            <circle cx="-4" cy="1" r="3.5" />
            <circle cx="4" cy="1" r="3.5" />
            <line x1="-0.5" y1="1" x2="0.5" y2="1" />
          </g>
        )}

        {style.accentType === 'earring' && (
          <circle cx="12" cy="4" r="2.2" fill="none" stroke={hex(style.accentColor)} strokeWidth="1.2" />
        )}

        {style.id === 'hao' && (
          <line x1="-7" y1="-3" x2="-2" y2="5"
            stroke="#6a3030" strokeWidth="0.8" opacity="0.85" />
        )}
      </g>
    </svg>
  );
}

function hairPath(style: AvatarStyle) {
  const hairColor = hex(style.hairColor);
  const skinColor = hex(style.bodyColor);
  switch (style.hairStyle) {
    case 'sweep':
      return (
        <g>
          <rect x="-15" y="-16" width="30" height="18" rx="14" fill={hairColor} />
          <rect x="-15" y="-19" width="12" height="6" fill={hairColor} />
          <rect x="-14" y="2" width="28" height="14" fill={skinColor} />
        </g>
      );
    case 'undercut':
      return (
        <g>
          <rect x="-14" y="-16" width="28" height="11" rx="10" fill={hairColor} />
          <rect x="-14" y="-3" width="28" height="4" fill={darken(style.bodyColor, 0.93)} />
          <rect x="-14" y="2" width="28" height="14" fill={skinColor} />
        </g>
      );
    case 'pony':
      return (
        <g>
          <rect x="-14" y="-16" width="28" height="18" rx="12" fill={hairColor} />
          <rect x="-3" y="-2" width="6" height="12" rx="3" fill={hairColor} />
          <rect x="-14" y="2" width="28" height="14" fill={skinColor} />
        </g>
      );
    case 'long-side':
      return (
        <g>
          <rect x="-16" y="-16" width="32" height="20" rx="14" fill={hairColor} />
          <rect x="10" y="2" width="6" height="18" rx="3" fill={hairColor} />
          <rect x="-14" y="4" width="26" height="14" fill={skinColor} />
        </g>
      );
    case 'tidy':
      return (
        <g>
          <rect x="-15" y="-16" width="30" height="14" rx="12" fill={hairColor} />
          <rect x="-15" y="-8" width="4" height="8" fill={lighten(style.hairColor, 1.4)} />
          <rect x="11" y="-8" width="4" height="8" fill={lighten(style.hairColor, 1.4)} />
          <rect x="-14" y="0" width="28" height="14" fill={skinColor} />
        </g>
      );
    case 'messy':
      return (
        <g>
          <rect x="-15" y="-15" width="30" height="14" rx="10" fill={hairColor} />
          <polygon points="-10,-14 -6,-21 -2,-14" fill={hairColor} />
          <polygon points="-2,-14 4,-23 7,-14" fill={hairColor} />
          <polygon points="7,-14 11,-19 14,-14" fill={hairColor} />
          <rect x="-16" y="-2" width="3" height="8" fill={hairColor} />
          <rect x="-14" y="2" width="28" height="14" fill={skinColor} />
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
function lighten(n: number, f: number): string {
  const r = Math.min(255, Math.floor(((n >> 16) & 0xff) * f));
  const g = Math.min(255, Math.floor(((n >> 8) & 0xff) * f));
  const b = Math.min(255, Math.floor((n & 0xff) * f));
  return hex((r << 16) | (g << 8) | b);
}
