import Phaser from 'phaser';

/**
 * BootScene generates placeholder textures programmatically so the scaffold
 * works without any external art. Replace these with real spritesheets
 * (Kenney's modern packs, Synty 2D, or commissioned art) once you're past
 * the "does it run" stage.
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Floor tile — soft midnight with a faint grid for depth perception.
    this.makeTexture('floor', 64, 64, (g) => {
      g.fillStyle(0x141a2e, 1);
      g.fillRect(0, 0, 64, 64);
      g.lineStyle(1, 0x1f2742, 1);
      g.strokeRect(0, 0, 64, 64);
    });

    // Ambient pool — a soft glow blob to scatter around.
    this.makeTexture('pool', 96, 96, (g) => {
      g.fillStyle(0xf5b39a, 0.08);
      g.fillCircle(48, 48, 44);
      g.fillStyle(0xf5b39a, 0.16);
      g.fillCircle(48, 48, 24);
    });
  }

  create() {
    this.scene.start('World');
  }

  private makeTexture(
    key: string,
    width: number,
    height: number,
    draw: (g: Phaser.GameObjects.Graphics) => void
  ) {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }
}
