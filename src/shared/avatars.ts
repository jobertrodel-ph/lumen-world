/**
 * The six avatar styles. Each is a coherent look — body color, hair, accent.
 * Designed to feel like distinct personalities without being literal characters.
 *
 * Drawn procedurally with Phaser graphics. No bitmap assets needed.
 *
 * Naming: warm-named for personality flavor; user picks before entering world.
 */

export interface AvatarStyle {
  id: string;
  name: string;
  /** Skin/body tint. */
  bodyColor: number;
  /** Hair color. 0 = bald (no hair drawn). */
  hairColor: number;
  /** "bob" | "long" | "buzz" | "tuft" | "wave" */
  hairStyle: 'bob' | 'long' | 'buzz' | 'tuft' | 'wave' | 'bald';
  /** Outfit color (the body block). */
  outfitColor: number;
  /** Accent — scarf, glasses, etc. 0 = none. */
  accentColor: number;
  accentType: 'scarf' | 'glasses' | 'earring' | 'collar' | 'none';
}

export const AVATAR_STYLES: AvatarStyle[] = [
  {
    id: 'ember',
    name: 'Ember',
    bodyColor: 0xe8a07f,
    hairColor: 0x3a2418,
    hairStyle: 'bob',
    outfitColor: 0xc04848,
    accentColor: 0xf5b39a,
    accentType: 'scarf',
  },
  {
    id: 'sage',
    name: 'Sage',
    bodyColor: 0xd9b48c,
    hairColor: 0x5a4030,
    hairStyle: 'wave',
    outfitColor: 0x4a6b58,
    accentColor: 0xfff4ec,
    accentType: 'collar',
  },
  {
    id: 'aster',
    name: 'Aster',
    bodyColor: 0xf2c4a3,
    hairColor: 0x8a3f3f,
    hairStyle: 'long',
    outfitColor: 0x6b4880,
    accentColor: 0xffd966,
    accentType: 'earring',
  },
  {
    id: 'rune',
    name: 'Rune',
    bodyColor: 0xb88860,
    hairColor: 0x1a1a1a,
    hairStyle: 'buzz',
    outfitColor: 0x2a3458,
    accentColor: 0xfff4ec,
    accentType: 'glasses',
  },
  {
    id: 'wren',
    name: 'Wren',
    bodyColor: 0xead0b0,
    hairColor: 0xe0a040,
    hairStyle: 'tuft',
    outfitColor: 0x8a5a3a,
    accentColor: 0xffd966,
    accentType: 'none',
  },
  {
    id: 'ivy',
    name: 'Ivy',
    bodyColor: 0xc99880,
    hairColor: 0x5a8a4a,
    hairStyle: 'long',
    outfitColor: 0x3a5868,
    accentColor: 0xa0c468,
    accentType: 'scarf',
  },
];

export const DEFAULT_AVATAR_ID = 'ember';

export function getAvatarStyle(id: string): AvatarStyle {
  return AVATAR_STYLES.find((a) => a.id === id) ?? AVATAR_STYLES[0];
}
