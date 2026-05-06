/**
 * Six modern-cultivation avatar styles. Each is a coherent look — body color,
 * hair, outfit, accent. Drawn procedurally; no bitmap assets.
 *
 * Designed to feel like distinct personalities: disciplined, street, alchemist,
 * confident, elder, rogue. Picker shows live SVG previews.
 */

export interface AvatarStyle {
  id: string;
  name: string;
  /** Bilingual flavor name shown subtly under the picker tile name. */
  subtitle: string;
  /** Skin/body tint. */
  bodyColor: number;
  /** Hair color. */
  hairColor: number;
  hairStyle: 'sweep' | 'undercut' | 'pony' | 'long-side' | 'tidy' | 'messy';
  /** Outfit (the body block) base. */
  outfitColor: number;
  /** Outfit secondary — collar / sash / lapel. */
  outfitSecondary: number;
  /** Accent — pendant, sash, glasses, etc. 0 = none. */
  accentColor: number;
  accentType: 'pendant' | 'sash' | 'glasses' | 'earring' | 'scarf' | 'none';
}

export const AVATAR_STYLES: AvatarStyle[] = [
  {
    id: 'yan',
    name: 'Yan',
    subtitle: '言 · disciplined',
    bodyColor: 0xe5c4a8,
    hairColor: 0x1a1a1a,
    hairStyle: 'sweep',
    outfitColor: 0x1a1d28,        // black blazer
    outfitSecondary: 0x2a3340,    // jacket lapel
    accentColor: 0x7fc4a3,        // jade pendant
    accentType: 'pendant',
  },
  {
    id: 'ren',
    name: 'Ren',
    subtitle: '刃 · street',
    bodyColor: 0xc9a888,
    hairColor: 0x2a2018,
    hairStyle: 'undercut',
    outfitColor: 0x3a3540,        // dark hoodie
    outfitSecondary: 0x2a2530,    // hood shadow
    accentColor: 0xc84848,        // crimson sash
    accentType: 'sash',
  },
  {
    id: 'lin',
    name: 'Lin',
    subtitle: '林 · alchemist',
    bodyColor: 0xeed0b4,
    hairColor: 0x4a3020,
    hairStyle: 'pony',
    outfitColor: 0xd8d4cc,        // lab coat off-white
    outfitSecondary: 0x9a4848,    // tang collar peeking out
    accentColor: 0x2a2a3a,        // dark glasses frame
    accentType: 'glasses',
  },
  {
    id: 'mei',
    name: 'Mei',
    subtitle: '梅 · confident',
    bodyColor: 0xe8b896,
    hairColor: 0x1a0e0a,
    hairStyle: 'long-side',
    outfitColor: 0x9a3050,        // crimson crop
    outfitSecondary: 0x6a1a30,    // belt
    accentColor: 0xe8b870,        // gold hoop earring
    accentType: 'earring',
  },
  {
    id: 'zhe',
    name: 'Zhe',
    subtitle: '哲 · elder',
    bodyColor: 0xd4b89a,
    hairColor: 0x4a4a48,          // grey-tipped
    hairStyle: 'tidy',
    outfitColor: 0x3a3a3e,        // grey turtleneck
    outfitSecondary: 0x4a4a4e,    // collar
    accentColor: 0xe8b870,        // gold pendant
    accentType: 'pendant',
  },
  {
    id: 'hao',
    name: 'Hao',
    subtitle: '昊 · rogue',
    bodyColor: 0xc99880,
    hairColor: 0x1a1410,
    hairStyle: 'messy',
    outfitColor: 0x2a2a30,        // dark jacket
    outfitSecondary: 0x3a3a40,    // jacket trim
    accentColor: 0x9a3848,        // wine scarf
    accentType: 'scarf',
  },
];

export const DEFAULT_AVATAR_ID = 'yan';

export function getAvatarStyle(id: string): AvatarStyle {
  return AVATAR_STYLES.find((a) => a.id === id) ?? AVATAR_STYLES[0];
}
