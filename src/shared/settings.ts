/**
 * User settings — persisted in localStorage, keyed by uid. Currently just
 * movement preference; structured for future additions.
 */

export type MovementMode = 'click' | 'arrows';

export interface UserSettings {
  movementMode: MovementMode;
}

const STORAGE_PREFIX = 'lumen:settings:';

const DEFAULT_SETTINGS: UserSettings = {
  movementMode: 'click',
};

export function loadSettings(uid: string): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + uid);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      movementMode: parsed.movementMode === 'arrows' ? 'arrows' : 'click',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(uid: string, settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + uid, JSON.stringify(settings));
  } catch {
    // localStorage disabled / private mode — silently ignore.
  }
}

// ----- Module-level current settings, accessible from Phaser side without React.

let current: UserSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<(s: UserSettings) => void>();

export function setActiveSettings(settings: UserSettings): void {
  current = { ...settings };
  for (const l of listeners) l(current);
}

export function getActiveSettings(): UserSettings {
  return current;
}

export function subscribeSettings(listener: (s: UserSettings) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
