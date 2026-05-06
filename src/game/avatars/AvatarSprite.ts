import Phaser from 'phaser';
import { AvatarStyle } from '../../shared/avatars';

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

    const shadow = scene.add.ellipse(0, 22, SHADOW_W, SHADOW_H, 0x000000, 0.32);

    // Qi pulse — soft gold ring (not white). Hidden until speaking.
    this.speakingRing = scene.add.circle(0, -4, 30, 0xe8b870, 0);
    this.speakingRing.setStrokeStyle(3, 0xe8b870, 0);

    // --- Body group ---
    this.bodyGroup = scene.add.container(0, 6);

    const outfit = scene.add.graphics();
    outfit.fillStyle(style.outfitColor, 1);
    outfit.fillRoundedRect(-BODY_WIDTH / 2, -2, BODY_WIDTH, BODY_HEIGHT, {
      tl: 8, tr: 8, bl: 4, br: 4,
    });
    // Lapel / collar detail using outfitSecondary.
    outfit.fillStyle(style.outfitSecondary, 1);
    outfit.fillTriangle(-6, -2, 0, 6, 6, -2);   // V-neck / lapel
    // Arm hints.
    outfit.fillStyle(this.darken(style.outfitColor, 0.85), 1);
    outfit.fillRoundedRect(-BODY_WIDTH / 2 - 3, 0, 6, 14, 3);
    outfit.fillRoundedRect(BODY_WIDTH / 2 - 3, 0, 6, 14, 3);
    this.bodyGroup.add(outfit);

    // Sash accent — diagonal across the chest.
    if (style.accentType === 'sash' && style.accentColor) {
      const sash = scene.add.graphics();
      sash.fillStyle(style.accentColor, 0.95);
      sash.fillTriangle(-12, 4, -10, 0, 12, 14);
      sash.fillTriangle(-12, 4, 12, 14, 14, 16);
      this.bodyGroup.add(sash);
    }

    // Pendant — small drop on a thin chain.
    if (style.accentType === 'pendant' && style.accentColor) {
      const chain = scene.add.graphics();
      chain.lineStyle(0.6, 0xc9c4b8, 0.65);
      chain.lineBetween(-3, -1, 0, 4);
      chain.lineBetween(3, -1, 0, 4);
      const pendant = scene.add.circle(0, 5, 2, style.accentColor, 1);
      pendant.setStrokeStyle(0.6, this.darken(style.accentColor, 0.7), 0.8);
      this.bodyGroup.add([chain, pendant]);
    }

    // Scarf — loose wrap with hanging end.
    if (style.accentType === 'scarf' && style.accentColor) {
      const scarfWrap = scene.add.graphics();
      scarfWrap.fillStyle(style.accentColor, 1);
      scarfWrap.fillRoundedRect(-12, -4, 24, 6, 3);
      scarfWrap.fillRect(-4, 0, 5, 12);
      this.bodyGroup.add(scarfWrap);
    }

    // --- Head group ---
    this.headGroup = scene.add.container(0, -10);

    const head = scene.add.circle(0, 0, HEAD_RADIUS, style.bodyColor, 1);
    head.setStrokeStyle(1, this.darken(style.bodyColor, 0.85), 0.6);
    this.headGroup.add(head);

    this.drawHair(scene, this.headGroup, style);

    // Eyes.
    const eyeL = scene.add.circle(-4, 1, 1.4, 0x1a1a1a, 1);
    const eyeR = scene.add.circle(4, 1, 1.4, 0x1a1a1a, 1);
    this.headGroup.add([eyeL, eyeR]);

    // Mouth.
    const mouth = scene.add.graphics();
    mouth.lineStyle(1.2, 0x1a1a1a, 0.7);
    mouth.beginPath();
    mouth.moveTo(-2.5, 6);
    mouth.lineTo(2.5, 6);
    mouth.strokePath();
    this.headGroup.add(mouth);

    // Glasses.
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

    // Earring.
    if (style.accentType === 'earring' && style.accentColor) {
      // Small hoop on the right side.
      const earring = scene.add.graphics();
      earring.lineStyle(1.2, style.accentColor, 1);
      earring.strokeCircle(HEAD_RADIUS - 2, 4, 2.2);
      this.headGroup.add(earring);
    }

    // Special touch for `hao` — eye scar.
    if (style.id === 'hao') {
      const scar = scene.add.graphics();
      scar.lineStyle(0.8, 0x6a3030, 0.8);
      scar.lineBetween(-7, -3, -2, 5);
      this.headGroup.add(scar);
    }

    this.container.add([shadow, this.speakingRing, this.bodyGroup, this.headGroup]);
    this.startIdle();
  }

  private drawHair(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    style: AvatarStyle
  ) {
    const g = scene.add.graphics();
    g.fillStyle(style.hairColor, 1);
    const skinColor = style.bodyColor;

    switch (style.hairStyle) {
      case 'sweep':
        // Side-swept — fuller on one side, cleaner on the other.
        g.fillRoundedRect(-HEAD_RADIUS - 1, -HEAD_RADIUS - 2, HEAD_RADIUS * 2 + 2, HEAD_RADIUS + 2, {
          tl: 12, tr: 14, bl: 4, br: 4,
        });
        g.fillRect(-HEAD_RADIUS, -HEAD_RADIUS - 4, 12, 6); // peak
        g.fillStyle(skinColor, 1);
        g.fillRect(-HEAD_RADIUS, 2, HEAD_RADIUS * 2, HEAD_RADIUS);
        break;

      case 'undercut':
        // Sharp top, sides shaved (lighter line near temples).
        g.fillRoundedRect(-HEAD_RADIUS, -HEAD_RADIUS - 2, HEAD_RADIUS * 2, 9, {
          tl: 10, tr: 10, bl: 0, br: 0,
        });
        // Shaved sides — a thin band of slightly darker skin tone.
        g.fillStyle(this.darken(skinColor, 0.93), 1);
        g.fillRect(-HEAD_RADIUS, -3, HEAD_RADIUS * 2, 4);
        g.fillStyle(skinColor, 1);
        g.fillRect(-HEAD_RADIUS, 2, HEAD_RADIUS * 2, HEAD_RADIUS);
        break;

      case 'pony':
        // Cap on top + tail behind.
        g.fillRoundedRect(-HEAD_RADIUS, -HEAD_RADIUS - 2, HEAD_RADIUS * 2, HEAD_RADIUS + 2, {
          tl: 12, tr: 12, bl: 6, br: 6,
        });
        // Ponytail — a curved tail behind the head.
        g.fillRoundedRect(-3, -2, 6, 12, 3);
        g.fillStyle(skinColor, 1);
        g.fillRect(-HEAD_RADIUS, 2, HEAD_RADIUS * 2, HEAD_RADIUS);
        break;

      case 'long-side':
        // Long flowing hair on one side.
        g.fillRoundedRect(-HEAD_RADIUS - 2, -HEAD_RADIUS - 2, HEAD_RADIUS * 2 + 4, HEAD_RADIUS + 4, {
          tl: 14, tr: 16, bl: 6, br: 14,
        });
        // Long strand on the right going past shoulder.
        g.fillRoundedRect(HEAD_RADIUS - 4, 2, 6, 18, 3);
        g.fillStyle(skinColor, 1);
        g.fillRect(-HEAD_RADIUS, 4, HEAD_RADIUS * 2 - 2, HEAD_RADIUS);
        break;

      case 'tidy':
        // Conservative neat short hair, slightly grey-tinted.
        g.fillRoundedRect(-HEAD_RADIUS - 1, -HEAD_RADIUS - 2, HEAD_RADIUS * 2 + 2, HEAD_RADIUS, {
          tl: 12, tr: 12, bl: 6, br: 6,
        });
        // Lighter highlights at temples (suggests salt-and-pepper).
        g.fillStyle(this.lighten(style.hairColor, 1.4), 1);
        g.fillRect(-HEAD_RADIUS - 1, -8, 4, 8);
        g.fillRect(HEAD_RADIUS - 3, -8, 4, 8);
        g.fillStyle(skinColor, 1);
        g.fillRect(-HEAD_RADIUS, 0, HEAD_RADIUS * 2, HEAD_RADIUS);
        break;

      case 'messy':
        // Asymmetric, scattered tufts.
        g.fillRoundedRect(-HEAD_RADIUS - 1, -HEAD_RADIUS - 1, HEAD_RADIUS * 2 + 2, HEAD_RADIUS, {
          tl: 10, tr: 14, bl: 4, br: 4,
        });
        // Three small tufts pointing different ways.
        g.fillTriangle(-10, -HEAD_RADIUS, -6, -HEAD_RADIUS - 7, -2, -HEAD_RADIUS);
        g.fillTriangle(-2, -HEAD_RADIUS, 4, -HEAD_RADIUS - 9, 7, -HEAD_RADIUS);
        g.fillTriangle(7, -HEAD_RADIUS, 11, -HEAD_RADIUS - 5, 14, -HEAD_RADIUS);
        // Side strand.
        g.fillRect(-HEAD_RADIUS - 1, -2, 3, 8);
        g.fillStyle(skinColor, 1);
        g.fillRect(-HEAD_RADIUS, 2, HEAD_RADIUS * 2, HEAD_RADIUS);
        break;
    }

    parent.add(g);
  }

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

  setFacing(vx: number) {
    if (vx > 0.1 && this.facing !== 'right') {
      this.headGroup.scaleX = 1;
      this.bodyGroup.scaleX = 1;
      this.facing = 'right';
    } else if (vx < -0.1 && this.facing !== 'left') {
      this.headGroup.scaleX = -1;
      this.bodyGroup.scaleX = -1;
      this.facing = 'left';
    }
  }

  setSpeaking(speaking: boolean) {
    const scene = this.container.scene;
    if (!scene) return;
    if (speaking) {
      if (this.speakingTween) return;
      // Qi pulse: warm gold instead of white. Slower, softer than Phase 4.
      this.speakingRing.setStrokeStyle(3, 0xe8b870, 0.8);
      this.speakingTween = scene.tweens.add({
        targets: this.speakingRing,
        scale: { from: 0.85, to: 1.35 },
        alpha:  { from: 0.8, to: 0.2 },
        duration: 900,
        ease: 'Sine.easeOut',
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.speakingTween?.stop();
      this.speakingTween = null;
      this.speakingRing.setStrokeStyle(3, 0xe8b870, 0);
      this.speakingRing.setScale(1);
      this.speakingRing.setAlpha(0);
    }
  }

  destroy() {
    this.idleTween?.stop();
    this.walkTween?.stop();
    this.speakingTween?.stop();
    this.container.destroy();
  }

  private darken(hex: number, factor: number): number {
    const r = Math.floor(((hex >> 16) & 0xff) * factor);
    const g = Math.floor(((hex >> 8) & 0xff) * factor);
    const b = Math.floor((hex & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  private lighten(hex: number, factor: number): number {
    const r = Math.min(255, Math.floor(((hex >> 16) & 0xff) * factor));
    const g = Math.min(255, Math.floor(((hex >> 8) & 0xff) * factor));
    const b = Math.min(255, Math.floor((hex & 0xff) * factor));
    return (r << 16) | (g << 8) | b;
  }
}
