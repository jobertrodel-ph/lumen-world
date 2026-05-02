import Phaser from 'phaser';
import type { PlayerProfile } from '../PhaserGame';

const WORLD_SIZE = 4000;
const WALK_SPEED = 220;

interface WASDKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
}

export default class WorldScene extends Phaser.Scene {
  private avatar!: Phaser.GameObjects.Container;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: WASDKeys;

  constructor() {
    super('World');
  }

  create() {
    const profile = this.registry.get('profile') as PlayerProfile;

    // Background floor — tiled across the world.
    this.add.tileSprite(0, 0, WORLD_SIZE, WORLD_SIZE, 'floor').setOrigin(0);

    // Scatter ambient warm pools — gives the empty world atmosphere & parallax cues.
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(120, WORLD_SIZE - 120);
      const y = Phaser.Math.Between(120, WORLD_SIZE - 120);
      const scale = Phaser.Math.FloatBetween(0.6, 1.6);
      this.add.image(x, y, 'pool').setScale(scale).setAlpha(0.85);
    }

    // Spawn near the world center.
    this.avatar = this.makeAvatar(WORLD_SIZE / 2, WORLD_SIZE / 2, profile);
    this.physics.add.existing(this.avatar);
    const body = this.avatar.body as Phaser.Physics.Arcade.Body;
    body.setCircle(20, -20, -20);

    // Camera — smooth follow, gentle zoom.
    this.cameras.main.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    this.cameras.main.startFollow(this.avatar, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.25);

    // Input.
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as WASDKeys;
  }

  private makeAvatar(
    x: number,
    y: number,
    profile: PlayerProfile
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Soft drop shadow under the feet.
    const shadow = this.add.ellipse(0, 24, 46, 14, 0x000000, 0.32);

    // Body disc — warm coral on midnight reads "modern" not "retro".
    const body = this.add.circle(0, 0, 22, 0xe8a07f);
    body.setStrokeStyle(2, 0xfff4ec, 0.95);

    // Initial inside the disc.
    const initial = profile.displayName?.[0]?.toUpperCase() ?? '?';
    const initialText = this.add
      .text(0, 1, initial, {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#3a1a08',
      })
      .setOrigin(0.5);

    // Floating name tag above the head.
    const tag = this.add
      .text(0, -38, profile.displayName, {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '13px',
        color: '#f3eee6',
        backgroundColor: 'rgba(13, 15, 26, 0.78)',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5);

    container.add([shadow, body, initialText, tag]);
    container.setSize(44, 44);
    return container;
  }

  update() {
    const body = this.avatar.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;

    // Normalize diagonals so you don't move 1.4x faster on the diagonal.
    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.SQRT2;
      vx *= inv;
      vy *= inv;
    }

    body.setVelocity(vx * WALK_SPEED, vy * WALK_SPEED);
  }
}
