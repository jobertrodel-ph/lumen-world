/**
 * Movement bridge — a tiny module that React HUD components and Phaser
 * communicate through. Currently only used to pass the click target to
 * the scene; the scene owns the actual pathing and walking.
 *
 * (We could just call directly into Phaser, but this keeps separation.)
 */

interface ClickTarget {
  /** World x in current room. */
  x: number;
  /** World y in current room. */
  y: number;
  /** Monotonic counter, lets the scene detect duplicate clicks at the same point. */
  seq: number;
}

let pendingTarget: ClickTarget | null = null;
let seq = 0;

export function setClickTarget(x: number, y: number): void {
  seq += 1;
  pendingTarget = { x, y, seq };
}

/** Called from Phaser scene; consumes the latest target if there is one. */
export function consumeClickTarget(): ClickTarget | null {
  const t = pendingTarget;
  pendingTarget = null;
  return t;
}

export function clearClickTarget(): void {
  pendingTarget = null;
}
