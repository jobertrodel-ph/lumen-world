/**
 * Microsoft Fluent Emoji catalog.
 *
 * For each emoji we prefer the animated lottie/webp variant from Fluent's
 * "Animated" folder; if Microsoft hasn't shipped an animated version,
 * we fall back to the high-fidelity static "3D" PNG.
 *
 * Source: https://github.com/microsoft/fluentui-emoji (MIT licensed)
 * Hosted via jsDelivr's GitHub mirror — free, persistent CDN, no auth.
 *
 * The `animated` field is an animated webp; `static` is the still PNG.
 * Code uses `animated` first and falls back on load error.
 */

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

export interface FluentEmoji {
  /** Stable id used as our reaction key. */
  id: string;
  name: string;
  /** Animated webp URL (preferred). */
  animated: string;
  /** Static fallback PNG. */
  static: string;
  /** Single-character unicode for embedding into chat text. */
  char: string;
}

function asset(folder: string, file: string): string {
  return `${CDN_BASE}/${encodeURIComponent(folder)}/${file}`;
}

// Format: each entry hand-picked. Microsoft's repo has slightly different
// path conventions per emoji ("Default" subfolder for skin-tone-having ones,
// no subfolder for the rest). We bake the right path in here.
export const FLUENT_EMOJI: FluentEmoji[] = [
  {
    id: 'thumbs-up',
    name: 'Thumbs Up',
    char: '👍',
    animated: asset('Thumbs up', 'Default/Animated/thumbs_up_color_default.webp'),
    static:   asset('Thumbs up', 'Default/3D/thumbs_up_3d_default.png'),
  },
  {
    id: 'red-heart',
    name: 'Heart',
    char: '❤️',
    animated: asset('Red heart', 'Animated/red_heart_color.webp'),
    static:   asset('Red heart', '3D/red_heart_3d.png'),
  },
  {
    id: 'fire',
    name: 'Fire',
    char: '🔥',
    animated: asset('Fire', 'Animated/fire_color.webp'),
    static:   asset('Fire', '3D/fire_3d.png'),
  },
  {
    id: 'face-tears-of-joy',
    name: 'Tears of Joy',
    char: '😂',
    animated: asset('Face with tears of joy', 'Animated/face_with_tears_of_joy_color.webp'),
    static:   asset('Face with tears of joy', '3D/face_with_tears_of_joy_3d.png'),
  },
  {
    id: 'rolling-on-floor',
    name: 'Rolling',
    char: '🤣',
    animated: asset('Rolling on the floor laughing', 'Animated/rolling_on_the_floor_laughing_color.webp'),
    static:   asset('Rolling on the floor laughing', '3D/rolling_on_the_floor_laughing_3d.png'),
  },
  {
    id: 'skull',
    name: 'Skull',
    char: '💀',
    animated: asset('Skull', 'Animated/skull_color.webp'),
    static:   asset('Skull', '3D/skull_3d.png'),
  },
  {
    id: 'clapping-hands',
    name: 'Clap',
    char: '👏',
    animated: asset('Clapping hands', 'Default/Animated/clapping_hands_color_default.webp'),
    static:   asset('Clapping hands', 'Default/3D/clapping_hands_3d_default.png'),
  },
  {
    id: 'eyes',
    name: 'Eyes',
    char: '👀',
    animated: asset('Eyes', 'Animated/eyes_color.webp'),
    static:   asset('Eyes', '3D/eyes_3d.png'),
  },
  {
    id: 'thinking-face',
    name: 'Thinking',
    char: '🤔',
    animated: asset('Thinking face', 'Animated/thinking_face_color.webp'),
    static:   asset('Thinking face', '3D/thinking_face_3d.png'),
  },
  {
    id: 'face-screaming',
    name: 'Screaming',
    char: '😱',
    animated: asset('Face screaming in fear', 'Animated/face_screaming_in_fear_color.webp'),
    static:   asset('Face screaming in fear', '3D/face_screaming_in_fear_3d.png'),
  },
  {
    id: 'pleading-face',
    name: 'Pleading',
    char: '🥺',
    animated: asset('Pleading face', 'Animated/pleading_face_color.webp'),
    static:   asset('Pleading face', '3D/pleading_face_3d.png'),
  },
  {
    id: 'sparkles',
    name: 'Sparkles',
    char: '✨',
    animated: asset('Sparkles', 'Animated/sparkles_color.webp'),
    static:   asset('Sparkles', '3D/sparkles_3d.png'),
  },
  {
    id: 'high-voltage',
    name: 'Bolt',
    char: '⚡',
    animated: asset('High voltage', 'Animated/high_voltage_color.webp'),
    static:   asset('High voltage', '3D/high_voltage_3d.png'),
  },
  {
    id: 'party-popper',
    name: 'Party',
    char: '🎉',
    animated: asset('Party popper', 'Animated/party_popper_color.webp'),
    static:   asset('Party popper', '3D/party_popper_3d.png'),
  },
  {
    id: 'beaming-face',
    name: 'Smile',
    char: '😁',
    animated: asset('Beaming face with smiling eyes', 'Animated/beaming_face_with_smiling_eyes_color.webp'),
    static:   asset('Beaming face with smiling eyes', '3D/beaming_face_with_smiling_eyes_3d.png'),
  },
  {
    id: 'smirking-face',
    name: 'Smirk',
    char: '😏',
    animated: asset('Smirking face', 'Animated/smirking_face_color.webp'),
    static:   asset('Smirking face', '3D/smirking_face_3d.png'),
  },
  {
    id: 'fox',
    name: 'Fox',
    char: '🦊',
    animated: asset('Fox', 'Animated/fox_color.webp'),
    static:   asset('Fox', '3D/fox_3d.png'),
  },
  {
    id: 'crystal-ball',
    name: 'Crystal Ball',
    char: '🔮',
    animated: asset('Crystal ball', 'Animated/crystal_ball_color.webp'),
    static:   asset('Crystal ball', '3D/crystal_ball_3d.png'),
  },
  {
    id: 'gem-stone',
    name: 'Gem',
    char: '💎',
    animated: asset('Gem stone', 'Animated/gem_stone_color.webp'),
    static:   asset('Gem stone', '3D/gem_stone_3d.png'),
  },
  {
    id: 'rocket',
    name: 'Rocket',
    char: '🚀',
    animated: asset('Rocket', 'Animated/rocket_color.webp'),
    static:   asset('Rocket', '3D/rocket_3d.png'),
  },
];

export const QUICK_REACTIONS: string[] = [
  'thumbs-up', 'red-heart', 'face-tears-of-joy', 'fire', 'eyes', 'skull',
];

const byId = new Map<string, FluentEmoji>();
for (const e of FLUENT_EMOJI) byId.set(e.id, e);

export function getEmoji(id: string): FluentEmoji | undefined {
  return byId.get(id);
}
