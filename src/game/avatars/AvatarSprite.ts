import Phaser from 'phaser';
import { AvatarStyle } from '../../shared/avatars';

/**
 * AvatarSprite renders a small humanoid character from an AvatarStyle spec.
 * Composed of layered shapes (no bitmaps): shadow, body block, head, hair,
 * face details, accent. Has idle breathing and walk bob animations.
 *
 * Faces "down" by default; faces left/right via flipping. No back-facing
 * animation for now — modern Gather-style games typically only show 3
 * facing directions (down, left, right) and look great.
 */

const HEAD_RADIUS = 14;
const BODY_WIDTH = 26;
const BODY_HEIGHT = 22;
const SHADOW_W = 38;
const SHADOW_H = 12;

export class AvatarSprite {
  readonly container: Phaser.GameObjects.Container;
  private headGroup: Phaser.GameObjects.Container;
  private bodyGroup: Phaser.GameObjects.Container;
  private speakingRing: Phaser.GameObjects.Arc;
  private idleTween: Phaser.Tweens.Tween | null = null;
  private walkTween: Phaser.Tweens.Tween | null = null;
  private speakingTween: Phaser.Tweens.Tween | null = null;
  private facing: 'left' | 'right' | 'down' = 'down';
  private isMoving = false;

  constructor(scene: Phaser.Scene, x: number, y: number, style: AvatarStyle) {
    this.container = scene.add.container(x, y);

    // --- Shadow ---
    const shadow = scene.add.ellipse(0, 22, SHADOW_W, SHADOW_H, 0x000000, 0.32);

    // --- Speaking ring (hidden by default) ---
    this.speakingRing = scene.add.circle(0, -4, 28, 0xfff4ec, 0);
    this.speakingRing.setStrokeStyle(3, 0xfff4ec, 0);

    // --- Body group ---
    this.bodyGroup = scene.add.container(0, 6);

    // Outfit block — slightly tapered shape using a polygon for shoulders.
    const outfit = scene.add.graphics();
    outfit.fillStyle(style.outfitColor, 1);
    // Shoulders narrower, waist a touch wider.
    outfit.fillRoundedRect(-BODY_WIDTH / 2, -2, BODY_WIDTH, BODY_HEIGHT, {
      tl: 8, tr: 8, bl: 4, br: 4,
    });
    // Arm hints — small darker blocks at shoulders.
    outfit.fillStyle(this.darken(style.outfitColor, 0.85), 1);
    outfit.fillRoundedRect(-BODY_WIDTH / 2 - 3, 0, 6, 14, 3);
    outfit.fillRoundedRect(BODY_WIDTH / 2 - 3, 0, 6, 14, 3);
    this.bodyGroup.add(outfit);

    // Collar accent (simple horizontal stripe)
    if (style.accentType === 'collar' && style.accentColor) {
      const collar = scene.add.rectangle(0, -1, BODY_WIDTH - 4, 3, style.accentColor, 0.9);
      this.bodyGroup.add(collar);
    }

    // Scarf accent (loose wrap with a hanging end)
    if (style.accentType === 'scarf' && style.accentColor) {
      const scarfWrap = scene.add.graphics();
      scarfWrap.fillStyle(style.accentColor, 1);
      scarfWrap.fillRoundedRect(-12, -4, 24, 6, 3);
      scarfWrap.fillRect(-4, 0, 5, 12); // hanging end
      this.bodyGroup.add(scarfWrap);
    }

    // --- Head group ---
    this.headGroup = scene.add.container(0, -10);

    // Head circle
    const head = scene.add.circle(0, 0, HEAD_RADIUS, style.bodyColor, 1);
    head.setStrokeStyle(1, this.darken(style.bodyColor, 0.85), 0.6);
    this.headGroup.add(head);

    // Hair (drawn over the head)
    this.drawHair(scene, this.headGroup, style);

    // Eyes — two tiny dots, expressive and minimal.
    const eyeL = scene.add.circle(-4, 1, 1.4, 0x1a1a1a, 1);
    const eyeR = scene.add.circle(4, 1, 1.4, 0x1a1a1a, 1);
    this.headGroup.add([eyeL, eyeR]);

    // Mouth — subtle curved line. Two small rectangles approximate a smile.
    const mouth = scene.add.graphics();
    mouth.lineStyle(1.2, 0x1a1a1a, 0.7);
    mouth.beginPath();
    mouth.moveTo(-2.5, 6);
    mouth.lineTo(2.5, 6);
    mouth.strokePath();
    this.headGroup.add(mouth);

    // Glasses
    if (style.accentType === 'glasses' && style.accentColor) {
      const glasses = scene.add.graphics();
      glasses.lineStyle(1.5, style.accentColor, 0.95);
      glasses.strokeCircle(-4, 1, 3.5);
      glasses.strokeCircle(4, 1, 3.5);
      glasses.beginPath();
      glasses.moveTo(-0.5, 1);
      glasses.lineTo(0.5, 1);
      glasses.strokePath();
      this.headGroup.add(glasses);
    }

    // Earring (one dot at the right side of the head)
    if (style.accentType === 'earring' && style.accentColor) {
      const earring = scene.add.circle(HEAD_RADIUS - 2, 4, 1.5, style.accentColor, 1);
      this.headGroup.add(earring);
    }

    this.container.add([shadow, this.speakingRing, this.bodyGroup, this.headGroup]);

    // Start idle breathing.
    this.startIdle();
  }

  private drawHair(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    style: AvatarStyle
  ) {
    if (style.hairStyle === 'bald' || !style.hairColor) return;
    const g = scene.add.graphics();
    g.fillStyle(style.hairColor, 1);

    switch (style.hairStyle) {
      case 'bob':
        // Rounded cap covering the top half + sides.
        g.fillRoundedRect(-HEAD_RADIUS - 1, -HEAD_RADIUS - 2, HEAD_RADIUS * 2 + 2, HEAD_RADIUS + 4, {
          tl: 14, tr: 14, bl: 8, br: 8,
        });
        // Trim the bottom by drawing the head color back over the lower part.
        g.fillStyle(style.bodyColor, 1);
        g.fillRect(-HEAD_RADIUS - 1, 2, HEAD_RADIUS * 2 + 2, HEAD_RADIUS);
        break;
      case 'long':
        // Bob + long flowing strands on the sides.
        g.fillRoundedRect(-HEAD_RADIUS - 1, -HEAD_RADIUS - 2, HEAD_RADIUS * 2 + 2, HEAD_RADIUS + 4, {
          tl: 14, tr: 14, bl: 4, br: 4,
        });
        g.fillRoundedRect(-HEAD_RADIUS - 2, -2, 4, 14, 2);
        g.fillRoundedRect(HEAD_RADIUS - 2, -2, 4, 14, 2);
        g.fillStyle(style.bodyColor, 1);
        g.fillRect(-HEAD_RADIUS + 2, 4, HEAD_RADIUS * 2 - 4, HEAD_RADIUS);
        break;
      case 'buzz':
        // Subtle cap, very close to the head.
        g.fillCircle(0, -2, HEAD_RADIUS - 1);
        g.fillStyle(style.bodyColor, 1);
        g.fillRect(-HEAD_RADIUS, 2, HEAD_RADIUS * 2, HEAD_RADIUS);
        break;
      case 'tuft':
        // Spiky top tuft.
        g.fillRoundedRect(-HEAD_RADIUS, -HEAD_RADIUS - 2, HEAD_RADIUS * 2, HEAD_RADIUS - 2, {
          tl: 10, tr: 10, bl: 0, br: 0,
        });
        // Three small tufts pointing up.
        g.fillTriangle(-7, -HEAD_RADIUS - 1, -3, -HEAD_RADIUS - 8, 0, -HEAD_RADIUS - 1);
        g.fillTriangle(0, -HEAD_RADIUS - 1, 4, -HEAD_RADIUS - 9, 8, -HEAD_RADIUS - 1);
        break;
      case 'wave':
        // Wavy bob with subtle curl.
        g.fillRoundedRect(-HEAD_RADIUS - 2, -HEAD_RADIUS - 2, HEAD_RADIUS * 2 + 4, HEAD_RADIUS + 4, {
          tl: 16, tr: 14, bl: 8, br: 14,
        });
        // Curl detail
        g.fillCircle(HEAD_RADIUS - 1, 4, 4);
        g.fillStyle(style.bodyColor, 1);
        g.fillRect(-HEAD_RADIUS, 4, HEAD_RADIUS * 2, HEAD_RADIUS);
        break;
    }

    parent.add(g);
  }

  /** Subtle breathing — head bobs ~1px on a slow loop. */
  private startIdle() {
    const scene = this.container.scene;
    if (!scene) return;
    this.idleTween?.stop();
    this.idleTween = scene.tweens.add({
      targets: this.headGroup,
      y: { from: -10, to: -11.2 },
      duration: 1800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private stopWalkTween() {
    this.walkTween?.stop();
    this.walkTween = null;
    this.headGroup.y = -10;
    this.bodyGroup.y = 6;
  }

  /**
   * Tell the avatar it's moving (or not). Triggers walk bob animation when on,
   * idle breath when off.
   */
  setMoving(moving: boolean) {
    if (moving === this.isMoving) return;
    this.isMoving = moving;
    const scene = this.container.scene;
    if (!scene) return;

    if (moving) {
      this.idleTween?.stop();
      this.walkTween = scene.tweens.add({
        targets: [this.headGroup, this.bodyGroup],
        y: '-=2',
        duration: 180,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.stopWalkTween();
      this.startIdle();
    }
  }

  /** Flip horizontally based on movement direction. Pure flip, no separate sprite needed. */
  setFacing(vx: number) {
    if (vx > 0.1) {
      if (this.facing !== 'right') {
        this.headGroup.scaleX = 1;
        this.bodyGroup.scaleX = 1;
        this.facing = 'right';
      }
    } else if (vx < -0.1) {
      if (this.facing !== 'left') {
        this.headGroup.scaleX = -1;
        this.bodyGroup.scaleX = -1;
        this.facing = 'left';
      }
    }
  }

  setSpeaking(speaking: boolean) {
    const scene = this.container.scene;
    if (!scene) return;
    if (speaking) {
      if (this.speakingTween) return;
      this.speakingRing.setStrokeStyle(3, 0xfff4ec, 0.7);
      this.speakingTween = scene.tweens.add({
        targets: this.speakingRing,
        scale: { from: 0.85, to: 1.25 },
        duration: 700,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.speakingTween?.stop();
      this.speakingTween = null;
      this.speakingRing.setStrokeStyle(3, 0xfff4ec, 0);
      this.speakingRing.setScale(1);
    }
  }

  destroy() {
    this.idleTween?.stop();
    this.walkTween?.stop();
    this.speakingTween?.stop();
    this.container.destroy();
  }

  /** Multiply each RGB channel — cheap "darken" used for outline tones. */
  private darken(hex: number, factor: number): number {
    const r = Math.floor(((hex >> 16) & 0xff) * factor);
    const g = Math.floor(((hex >> 8) & 0xff) * factor);
    const b = Math.floor((hex & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }
}
