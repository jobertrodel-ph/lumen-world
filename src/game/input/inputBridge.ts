/**
 * Tiny input bridge — React's joystick component writes a movement vector
 * here; Phaser's update() reads from it. Same pattern as voiceBridge.
 *
 * Vector: x and y in [-1, 1]. Magnitude is meaningful (slow walk vs sprint).
 */

interface InputState {
  x: number;
  y: number;
}

const state: InputState = { x: 0, y: 0 };

export function setJoystick(x: number, y: number): void {
  // Clamp to unit circle so diagonals aren't faster.
  const m = Math.hypot(x, y);
  if (m > 1) {
    state.x = x / m;
    state.y = y / m;
  } else {
    state.x = x;
    state.y = y;
  }
}

export function clearJoystick(): void {
  state.x = 0;
  state.y = 0;
}

export function readJoystick(): InputState {
  return state;
}
