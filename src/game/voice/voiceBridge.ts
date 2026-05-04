import { VoiceManager } from './VoiceManager';

/**
 * Tiny bridge so React HUD components can toggle the mic without depending
 * on Phaser internals. The WorldScene registers its VoiceManager on mount;
 * unregisters on shutdown.
 */

let active: VoiceManager | null = null;

export function registerVoiceManager(vm: VoiceManager | null): void {
  active = vm;
}

export async function toggleMic(): Promise<boolean> {
  if (!active) return false;
  const next = !active.isMicEnabled();
  return await active.setMicEnabled(next);
}

export function isMicOn(): boolean {
  return active?.isMicEnabled() ?? false;
}
