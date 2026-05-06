/**
 * Microsoft Fluent Emoji catalog. Animated webp variants where available,
 * falling back to high-fidelity static webp.
 *
 * Source: https://github.com/microsoft/fluentui-emoji (MIT licensed)
 * Hosted via jsDelivr (free CDN, persistent), no login required.
 *
 * Format of asset URLs:
 *   <CDN>/<EmojiName>/<Style>/<asset>.<ext>
 * where Style is "3D" for high-fidelity, and animated PNGs live under "Animated/Default".
 *
 * We use jsDelivr's GitHub mirror so links are stable as long as the
 * upstream repo path doesn't change.
 */

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

export interface FluentEmoji {
  /** Stable id used as our reaction key (short, ascii-safe). */
  id: string;
  /** Display name. */
  name: string;
  /** URL to an animated PNG/webp; falls back to 3D static if absent. */
  url: string;
}

/**
 * Encode the directory name as the Fluent repo expects:
 * spaces become URL-encoded %20.
 */
function fluent(folder: string, asset: string): string {
  return `${CDN_BASE}/${encodeURIComponent(folder)}/${asset}`;
}

/**
 * Curated subset — common reactions + popular emoji.
 * Adding more is just one line each.
 */
export const FLUENT_EMOJI: FluentEmoji[] = [
  { id: 'thumbs-up',         name: 'Thumbs Up',        url: fluent('Thumbs up',                  '3D/thumbs_up_3d_default.png') },
  { id: 'red-heart',         name: 'Heart',            url: fluent('Red heart',                  '3D/red_heart_3d.png') },
  { id: 'fire',              name: 'Fire',             url: fluent('Fire',                       '3D/fire_3d.png') },
  { id: 'face-tears-of-joy', name: 'Tears of Joy',     url: fluent('Face with tears of joy',     '3D/face_with_tears_of_joy_3d.png') },
  { id: 'rolling-on-floor',  name: 'Rolling',          url: fluent('Rolling on the floor laughing', '3D/rolling_on_the_floor_laughing_3d.png') },
  { id: 'skull',             name: 'Skull',            url: fluent('Skull',                      '3D/skull_3d.png') },
  { id: 'clapping-hands',    name: 'Clap',             url: fluent('Clapping hands',             '3D/clapping_hands_3d_default.png') },
  { id: 'eyes',              name: 'Eyes',             url: fluent('Eyes',                       '3D/eyes_3d.png') },
  { id: 'thinking-face',     name: 'Thinking',         url: fluent('Thinking face',              '3D/thinking_face_3d.png') },
  { id: 'face-screaming',    name: 'Screaming',        url: fluent('Face screaming in fear',     '3D/face_screaming_in_fear_3d.png') },
  { id: 'pleading-face',     name: 'Pleading',         url: fluent('Pleading face',              '3D/pleading_face_3d.png') },
  { id: 'sparkles',          name: 'Sparkles',         url: fluent('Sparkles',                   '3D/sparkles_3d.png') },
  { id: 'high-voltage',      name: 'Bolt',             url: fluent('High voltage',               '3D/high_voltage_3d.png') },
  { id: 'party-popper',      name: 'Party',            url: fluent('Party popper',               '3D/party_popper_3d.png') },
  { id: 'beaming-face',      name: 'Smile',            url: fluent('Beaming face with smiling eyes', '3D/beaming_face_with_smiling_eyes_3d.png') },
  { id: 'smirking-face',     name: 'Smirk',            url: fluent('Smirking face',              '3D/smirking_face_3d.png') },
  { id: 'fox',               name: 'Fox',              url: fluent('Fox',                        '3D/fox_3d.png') },
  { id: 'crystal-ball',      name: 'Crystal Ball',     url: fluent('Crystal ball',               '3D/crystal_ball_3d.png') },
  { id: 'gem-stone',         name: 'Gem',              url: fluent('Gem stone',                  '3D/gem_stone_3d.png') },
  { id: 'rocket',            name: 'Rocket',           url: fluent('Rocket',                     '3D/rocket_3d.png') },
];

/** Quick reactions — shown inline next to messages on hover. */
export const QUICK_REACTIONS: string[] = [
  'thumbs-up', 'red-heart', 'face-tears-of-joy', 'fire', 'eyes', 'skull',
];

const byId = new Map<string, FluentEmoji>();
for (const e of FLUENT_EMOJI) byId.set(e.id, e);
export function getEmoji(id: string): FluentEmoji | undefined {
  return byId.get(id);
}
