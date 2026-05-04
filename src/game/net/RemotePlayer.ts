import Phaser from 'phaser';
import { AvatarSprite } from '../avatars/AvatarSprite';
import { getAvatarStyle } from '../../shared/avatars';

/**
 * RemotePlayer wraps an AvatarSprite for someone else's avatar with smooth
 * position interpolation toward the latest server position.
 */
export class RemotePlayer {
  readonly sprite: AvatarSprite;
  readonly nameTag: Phaser.GameObjects.Text;
  private targetX: number;
  private targetY: number;
  private lastX: number;
  private lastY: number;
  private static readonly LERP = 0.18;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    displayName: string,
    avatarId: string
  ) {
    this.targetX = x;
    this.targetY = y;
    this.lastX = x;
    this.lastY = y;
    this.sprite = new AvatarSprite(scene, x, y, getAvatarStyle(avatarId));

    this.nameTag = scene.add
      .text(x, y - 38, displayName || 'Visitor', {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '13px',
        color: '#f3eee6',
        backgroundColor: 'rgba(13, 15, 26, 0.78)',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(20);
  }

  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  setSpeaking(speaking: boolean): void {
    this.sprite.setSpeaking(speaking);
  }

  tick(): void {
    const c = this.sprite.container;
    const dx = (this.targetX - c.x) * RemotePlayer.LERP;
    const dy = (this.targetY - c.y) * RemotePlayer.LERP;
    c.x += dx;
    c.y += dy;

    // Movement-driven animation.
    const moved = Math.abs(c.x - this.lastX) + Math.abs(c.y - this.lastY);
    this.sprite.setMoving(moved > 0.4);
    if (Math.abs(c.x - this.lastX) > 0.05) {
      this.sprite.setFacing(c.x - this.lastX);
    }
    this.lastX = c.x;
    this.lastY = c.y;

    this.nameTag.setPosition(c.x, c.y - 38);
  }

  destroy(): void {
    this.sprite.destroy();
    this.nameTag.destroy();
  }
}
