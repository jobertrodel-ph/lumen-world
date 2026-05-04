import Phaser from 'phaser';
import { RoomDef, RoomId, ROOMS } from '../../shared/world';

/**
 * Visually upgraded RoomRenderer. Each room has its own theme:
 *
 *  - Atrium: warm peach floor pattern, fountain water particles
 *  - Library: amber wood-grain floor, bookshelf walls (with spine details),
 *             warm window glows
 *  - Garden: deep teal grass floor, hedge walls with leaf texture,
 *            drifting leaf particles
 */

interface Theme {
  // Floor base
  floorBase: number;
  floorAccent: number;
  // Wall style
  wallStyle: 'shelves' | 'hedge' | 'stone';
  wallColors: { base: number; trim: number; detail: number };
  // Ambient particle config (room-specific atmosphere)
  particleColor?: number;
  particleCount?: number;
}

const THEMES: Record<RoomId, Theme> = {
  atrium: {
    floorBase: 0x141a2e,
    floorAccent: 0x1a2240,
    wallStyle: 'stone',
    wallColors: { base: 0x2a3148, trim: 0x3b4366, detail: 0x4a5380 },
  },
  library: {
    floorBase: 0x1a1612,
    floorAccent: 0x241e18,
    wallStyle: 'shelves',
    wallColors: { base: 0x3a2c1e, trim: 0x5a4632, detail: 0x8a7050 },
    particleColor: 0xe8b88a,
    particleCount: 8,
  },
  garden: {
    floorBase: 0x0e1a1c,
    floorAccent: 0x142826,
    wallStyle: 'hedge',
    wallColors: { base: 0x2a4a38, trim: 0x3d6b4e, detail: 0x5a8868 },
    particleColor: 0x8aa878,
    particleCount: 14,
  },
};

export class RoomRenderer {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  readonly room: RoomDef;
  private theme: Theme;

  constructor(scene: Phaser.Scene, roomId: RoomId) {
    this.scene = scene;
    this.room = ROOMS[roomId];
    this.theme = THEMES[roomId];
    this.container = scene.add.container(0, 0);
    this.container.setDepth(-100);

    this.drawFloor();
    this.drawPools();
    this.drawWalls();
    this.drawZoneHints();
    this.drawPortalLabels();
    this.drawAmbientParticles();
    this.drawRoomSpecificDecor(roomId);
  }

  destroy(): void {
    this.container.destroy(true);
  }

  // ---------------------------------------------------------------------------

  private drawFloor(): void {
    const floor = this.scene.add.rectangle(
      0, 0, this.room.width, this.room.height,
      this.theme.floorBase, 1
    );
    floor.setOrigin(0, 0);
    this.container.add(floor);

    // Floor pattern: scatter subtle accent rectangles to break the flat color.
    // Looks like worn tile / scuffs, far better than pure solid.
    const g = this.scene.add.graphics();
    g.fillStyle(this.theme.floorAccent, 0.6);
    const rng = this.seedableRng(this.room.id);
    const tileCount = Math.floor((this.room.width * this.room.height) / 8000);
    for (let i = 0; i < tileCount; i++) {
      const x = rng() * this.room.width;
      const y = rng() * this.room.height;
      const w = 20 + rng() * 40;
      const h = 14 + rng() * 24;
      g.fillRect(x, y, w, h);
    }
    this.container.add(g);

    // Faint grid for spatial reference.
    const grid = this.scene.add.graphics();
    grid.lineStyle(1, 0xffffff, 0.022);
    const step = 80;
    for (let gx = step; gx < this.room.width; gx += step) {
      grid.lineBetween(gx, 0, gx, this.room.height);
    }
    for (let gy = step; gy < this.room.height; gy += step) {
      grid.lineBetween(0, gy, this.room.width, gy);
    }
    this.container.add(grid);
  }

  private drawPools(): void {
    for (const pool of this.room.pools) {
      const outer = this.scene.add.circle(
        pool.x, pool.y, 60 * pool.scale,
        this.room.poolTint, 0.08
      );
      const inner = this.scene.add.circle(
        pool.x, pool.y, 30 * pool.scale,
        this.room.poolTint, 0.18
      );
      this.container.add([outer, inner]);
    }
  }

  private drawWalls(): void {
    for (const wall of this.room.walls) {
      switch (this.theme.wallStyle) {
        case 'shelves':
          this.drawBookshelfWall(wall);
          break;
        case 'hedge':
          this.drawHedgeWall(wall);
          break;
        case 'stone':
          this.drawStoneWall(wall);
          break;
      }
    }
  }

  private drawStoneWall(wall: { x: number; y: number; width: number; height: number }): void {
    const c = this.theme.wallColors;
    // Base
    const body = this.scene.add.rectangle(wall.x, wall.y, wall.width, wall.height, c.base, 1);
    body.setOrigin(0, 0);
    body.setStrokeStyle(1, c.trim, 0.6);
    this.container.add(body);

    // Top highlight strip — fakes light coming from above.
    const highlight = this.scene.add.rectangle(wall.x, wall.y, wall.width, 2, c.detail, 0.8);
    highlight.setOrigin(0, 0);
    this.container.add(highlight);
  }

  private drawBookshelfWall(wall: { x: number; y: number; width: number; height: number }): void {
    const c = this.theme.wallColors;
    // Wood frame.
    const frame = this.scene.add.rectangle(wall.x, wall.y, wall.width, wall.height, c.base, 1);
    frame.setOrigin(0, 0);
    this.container.add(frame);

    const thin = wall.width < 32 || wall.height < 32;
    if (thin) {
      // Thin walls — just simple wood.
      const trim = this.scene.add.rectangle(wall.x, wall.y, wall.width, 2, c.trim, 1);
      trim.setOrigin(0, 0);
      this.container.add(trim);
      return;
    }

    // Draw book "spines" — lots of thin colored rects packed inside the wall.
    const g = this.scene.add.graphics();
    const bookColors = [0x8a4040, 0x4a6b58, 0x6b4880, 0x8a6a3a, 0x3a5868, 0x4a4a5a];
    const isHorizontal = wall.width > wall.height;
    if (isHorizontal) {
      // Books stand vertically along a horizontal shelf.
      let cursor = wall.x + 4;
      const spineH = wall.height - 8;
      while (cursor < wall.x + wall.width - 4) {
        const w = 6 + Math.floor(this.seededHash(cursor + wall.y) * 6);
        const color = bookColors[Math.floor(this.seededHash(cursor) * bookColors.length)];
        g.fillStyle(color, 0.85);
        g.fillRect(cursor, wall.y + 4, w, spineH);
        cursor += w + 1;
      }
    } else {
      // Books stack horizontally on a vertical shelf.
      let cursor = wall.y + 4;
      const spineW = wall.width - 8;
      while (cursor < wall.y + wall.height - 4) {
        const h = 6 + Math.floor(this.seededHash(wall.x + cursor) * 6);
        const color = bookColors[Math.floor(this.seededHash(cursor) * bookColors.length)];
        g.fillStyle(color, 0.85);
        g.fillRect(wall.x + 4, cursor, spineW, h);
        cursor += h + 1;
      }
    }
    this.container.add(g);

    // Top trim (warm wood highlight).
    const trim = this.scene.add.rectangle(wall.x, wall.y, wall.width, 3, c.detail, 0.9);
    trim.setOrigin(0, 0);
    this.container.add(trim);
  }

  private drawHedgeWall(wall: { x: number; y: number; width: number; height: number }): void {
    const c = this.theme.wallColors;
    // Base hedge body.
    const body = this.scene.add.rectangle(wall.x, wall.y, wall.width, wall.height, c.base, 1);
    body.setOrigin(0, 0);
    this.container.add(body);

    // Leaf clusters — many small overlapping circles in slightly different greens.
    const g = this.scene.add.graphics();
    const leafColors = [c.trim, c.detail, this.darken(c.trim, 0.85)];
    const stride = 6;
    for (let lx = wall.x; lx < wall.x + wall.width; lx += stride) {
      for (let ly = wall.y; ly < wall.y + wall.height; ly += stride) {
        const noise = this.seededHash(lx * 13 + ly * 7);
        if (noise < 0.55) continue;
        const color = leafColors[Math.floor(noise * leafColors.length)];
        g.fillStyle(color, 0.9);
        g.fillCircle(lx + (noise - 0.5) * 4, ly + (noise - 0.5) * 4, 3 + noise * 2);
      }
    }
    this.container.add(g);
  }

  private drawZoneHints(): void {
    for (const zone of this.room.zones) {
      const b = zone.bounds;
      const outline = this.scene.add.graphics();
      outline.lineStyle(2, this.room.poolTint, 0.18);
      outline.strokeRoundedRect(b.x, b.y, b.width, b.height, 16);
      this.container.add(outline);

      const label = this.scene.add
        .text(b.x + 12, b.y + 8, zone.name.toUpperCase(), {
          fontFamily: '"General Sans", system-ui, sans-serif',
          fontSize: '10px',
          color: '#f3eee6',
        })
        .setAlpha(0.32);
      this.container.add(label);
    }
  }

  private drawPortalLabels(): void {
    for (const portal of this.room.portals) {
      const b = portal.bounds;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;

      const glow = this.scene.add.circle(cx, cy, 28, this.room.poolTint, 0.3);
      const dot = this.scene.add.circle(cx, cy, 10, 0xfff4ec, 0.85);

      this.scene.tweens.add({
        targets: glow,
        scale: { from: 0.9, to: 1.15 },
        alpha: { from: 0.3, to: 0.55 },
        duration: 1400,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });

      const labelOffsetX = b.width < b.height ? (b.x === 0 ? 80 : -80) : 0;
      const labelOffsetY = b.width >= b.height ? (b.y === 0 ? 60 : -60) : 0;

      const label = this.scene.add
        .text(cx + labelOffsetX, cy + labelOffsetY, `→ ${portal.label}`, {
          fontFamily: '"Fraunces", serif',
          fontStyle: 'italic',
          fontSize: '18px',
          color: '#f3eee6',
          backgroundColor: 'rgba(13, 15, 26, 0.78)',
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5);
      this.container.add([glow, dot, label]);
    }
  }

  private drawAmbientParticles(): void {
    if (!this.theme.particleColor || !this.theme.particleCount) return;
    const rng = this.seedableRng(this.room.id + ':particles');

    for (let i = 0; i < this.theme.particleCount; i++) {
      const x = rng() * this.room.width;
      const y = rng() * this.room.height;
      const size = 2 + rng() * 2;
      const dot = this.scene.add.circle(x, y, size, this.theme.particleColor, 0.55);
      this.container.add(dot);

      // Slow drift in a small circular path.
      const driftRadius = 30 + rng() * 40;
      const duration = 8000 + rng() * 6000;
      this.scene.tweens.add({
        targets: dot,
        x: { from: x, to: x + (rng() - 0.5) * driftRadius },
        y: { from: y, to: y - 30 - rng() * 50 },
        alpha: { from: 0.55, to: 0 },
        duration,
        delay: rng() * 4000,
        ease: 'Sine.easeInOut',
        repeat: -1,
        onRepeat: () => {
          // Reset to bottom and drift up again.
          dot.x = rng() * this.room.width;
          dot.y = this.room.height - 50;
          dot.alpha = 0.55;
        },
      });
    }
  }

  private drawRoomSpecificDecor(roomId: RoomId): void {
    if (roomId === 'atrium') {
      // Center fountain — water pool inside the fountain walls.
      const water = this.scene.add.circle(800, 600, 56, 0x7fc4d4, 0.45);
      const waterHighlight = this.scene.add.circle(800, 600, 36, 0xa5dde8, 0.4);
      this.container.add([water, waterHighlight]);

      // Water ripple — subtle scaling pulse.
      this.scene.tweens.add({
        targets: waterHighlight,
        scale: { from: 0.85, to: 1.1 },
        alpha: { from: 0.4, to: 0.15 },
        duration: 2200,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });

      // Tiny droplet particles around the fountain.
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const r = 50;
        const dx = 800 + Math.cos(angle) * r;
        const dy = 600 + Math.sin(angle) * r;
        const drop = this.scene.add.circle(dx, dy, 2, 0xa5dde8, 0.7);
        this.container.add(drop);
        this.scene.tweens.add({
          targets: drop,
          y: dy - 24,
          alpha: 0,
          duration: 1400,
          ease: 'Sine.out',
          delay: i * 220,
          repeat: -1,
        });
      }
    }

    if (roomId === 'library') {
      // Warm window glows in the back wall — gives the room a "lit" feel.
      for (let i = 0; i < 3; i++) {
        const wx = 1300 + i * 50;
        const wy = 200 + Math.floor(i / 3) * 200;
        const window = this.scene.add.rectangle(wx, wy, 28, 50, 0xffd699, 0.75);
        const halo = this.scene.add.rectangle(wx, wy, 80, 100, 0xffd699, 0.08);
        this.container.add([halo, window]);
      }
    }

    if (roomId === 'garden') {
      // Flower clusters — small bright dots around hedges.
      const flowerSpots: Array<{ x: number; y: number; color: number }> = [
        { x: 480, y: 280, color: 0xe88aa0 },
        { x: 540, y: 320, color: 0xffd966 },
        { x: 1180, y: 760, color: 0xe88aa0 },
        { x: 720, y: 760, color: 0xa088c4 },
        { x: 880, y: 580, color: 0xffd966 },
      ];
      for (const f of flowerSpots) {
        const flower = this.scene.add.circle(f.x, f.y, 4, f.color, 0.95);
        const halo = this.scene.add.circle(f.x, f.y, 10, f.color, 0.25);
        this.container.add([halo, flower]);
      }
    }
  }

  // ---------------------------------------------------------------------------

  private darken(hex: number, factor: number): number {
    const r = Math.floor(((hex >> 16) & 0xff) * factor);
    const g = Math.floor(((hex >> 8) & 0xff) * factor);
    const b = Math.floor((hex & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  /** Mulberry32 — small, deterministic, good enough for visual scatter. */
  private seedableRng(seed: string): () => number {
    let t = 0;
    for (let i = 0; i < seed.length; i++) t = (t + seed.charCodeAt(i) * 2654435761) | 0;
    return () => {
      t |= 0; t = (t + 0x6d2b79f5) | 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  private seededHash(input: number): number {
    let x = (input | 0) * 2654435761;
    x = (x ^ (x >>> 16)) * 0x85ebca6b;
    x = (x ^ (x >>> 13)) * 0xc2b2ae35;
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }
}
