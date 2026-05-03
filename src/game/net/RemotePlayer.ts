import Phaser from 'phaser';

/**
 * RemotePlayer wraps the visuals (disc, initial, name tag, shadow) for someone
 * else's avatar in our world. The server pushes authoritative positions; we
 * smoothly lerp toward them so movement looks fluid even at low send rates.
 */
export class RemotePlayer {
  readonly container: Phaser.GameObjects.Container;
  private targetX: number;
  private targetY: number;

  // Lerp factor per frame. Higher = snappier, lower = smoother but laggier.
  // 0.18 at 60fps reaches ~95% of target in ~16 frames, which feels right
  // for room-scale movement without looking floaty.
  private static readonly LERP = 0.18;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    displayName: string
  ) {
    this.targetX = x;
    this.targetY = y;

    const container = scene.add.container(x, y);

    const shadow = scene.add.ellipse(0, 24, 46, 14, 0x000000, 0.32);

    // Cooler tint than the local player (peach) so you can spot yourself.
    const body = scene.add.circle(0, 0, 22, 0x8a7fc4);
    body.setStrokeStyle(2, 0xfff4ec, 0.95);

    const initial = (displayName?.[0] ?? '?').toUpperCase();
    const initialText = scene.add
      .text(0, 1, initial, {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#1a142e',
      })
      .setOrigin(0.5);

    const tag = scene.add
      .text(0, -38, displayName || 'Visitor', {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '13px',
        color: '#f3eee6',
        backgroundColor: 'rgba(13, 15, 26, 0.78)',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5);

    container.add([shadow, body, initialText, tag]);
    this.container = container;
  }

  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  /** Call from scene.update(). Smoothly approaches the latest server position. */
  tick(): void {
    const c = this.container;
    c.x += (this.targetX - c.x) * RemotePlayer.LERP;
    c.y += (this.targetY - c.y) * RemotePlayer.LERP;
  }

  destroy(): void {
    this.container.destroy();
  }
}
