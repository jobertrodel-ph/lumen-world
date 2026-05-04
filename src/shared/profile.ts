import { DEFAULT_AVATAR_ID } from './avatars';

/**
 * Profile state — currently just avatar choice. Persisted in localStorage,
 * keyed by Firebase uid so each Google account remembers its own pick.
 *
 * For server-side persistence (Firestore), add a separate Phase 5b. For now
 * localStorage is enough: no extra infra, instant, scoped per browser.
 */

interface Profile {
  avatarId: string;
}

const STORAGE_PREFIX = 'lumen:profile:';

export function loadProfile(uid: string): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + uid);
    if (!raw) return { avatarId: DEFAULT_AVATAR_ID };
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return { avatarId: parsed.avatarId || DEFAULT_AVATAR_ID };
  } catch {
    return { avatarId: DEFAULT_AVATAR_ID };
  }
}

export function saveProfile(uid: string, profile: Profile): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + uid, JSON.stringify(profile));
  } catch {
    // localStorage full / disabled / private mode — silently ignore.
  }
}
