import Phaser from 'phaser';
import { RoomDef, RoomId, ROOMS } from '../../shared/world';

interface Theme {
  floorBase: number;
  floorAccent: number;
  wallStyle: 'planter' | 'concrete' | 'booth';
  wallColors: { base: number; trim: number; detail: number };
  particleColor?: number;
  particleCount?: number;
}

const THEMES: Record<RoomId, Theme> = {
  rooftop: {
    floorBase: 0x18221c,
    floorAccent: 0x202a24,
    wallStyle: 'planter',
    wallColors: { base: 0x2a3530, trim: 0x3a4a40, detail: 0x5a8a68 }, // moss + leaf
    particleColor: 0xe8b8a0, // cherry petal
    particleCount: 18,
  },
  subway: {
    floorBase: 0x12141c,
    floorAccent: 0x1a1c24,
    wallStyle: 'concrete',
    wallColors: { base: 0x2a2c34, trim: 0x3a3c44, detail: 0x5a5c64 },
    particleColor: 0x8aa8c8,
    particleCount: 6,
  },
  karaoke: {
    floorBase: 0x1a1018,
    floorAccent: 0x241a22,
    wallStyle: 'booth',
    wallColors: { base: 0x2c1c28, trim: 0x4a2a40, detail: 0x9a3868 }, // velvet + magenta
    particleColor: 0xe8b870,
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
    this.drawPortals();
    this.drawAmbientParticles();
    this.drawRoomDecor(roomId);
  }

  destroy(): void {
    this.container.destroy(true);
  }

  // ---------------------------------------------------------------------------
  // Floor — different patterns per room
  // ---------------------------------------------------------------------------
  private drawFloor(): void {
    const floor = this.scene.add.rectangle(
      0, 0, this.room.width, this.room.height,
      this.theme.floorBase, 1
    );
    floor.setOrigin(0, 0);
    this.container.add(floor);

    if (this.room.id === 'rooftop') {
      this.drawWoodPlanks();
    } else if (this.room.id === 'subway') {
      this.drawConcreteTiles();
    } else {
      this.drawCarpetPattern();
    }

    // Faint grid for subtle spatial reference (very low alpha).
    const grid = this.scene.add.graphics();
    grid.lineStyle(1, 0xffffff, 0.018);
    for (let gx = 80; gx < this.room.width; gx += 80) grid.lineBetween(gx, 0, gx, this.room.height);
    for (let gy = 80; gy < this.room.height; gy += 80) grid.lineBetween(0, gy, this.room.width, gy);
    this.container.add(grid);
  }

  private drawWoodPlanks(): void {
    // Horizontal wooden planks — long thin rects with subtle accent lines.
    const g = this.scene.add.graphics();
    const plankH = 60;
    let y = 10;
    let toggle = false;
    while (y < this.room.height) {
      g.fillStyle(toggle ? this.theme.floorAccent : this.darken(this.theme.floorAccent, 0.92), 0.6);
      g.fillRect(0, y, this.room.width, plankH);
      // Plank seam.
      g.lineStyle(1, 0x000000, 0.18);
      g.lineBetween(0, y, this.room.width, y);
      y += plankH;
      toggle = !toggle;
    }
    this.container.add(g);
  }

  private drawConcreteTiles(): void {
    // Big concrete floor tiles + scattered scuff marks.
    const g = this.scene.add.graphics();
    const tileSize = 120;
    g.lineStyle(1, 0xffffff, 0.04);
    for (let x = 0; x < this.room.width; x += tileSize) {
      for (let y = 0; y < this.room.height; y += tileSize) {
        g.strokeRect(x, y, tileSize, tileSize);
      }
    }
    // Yellow safety stripe near the tracks (top edge of the platform).
    g.fillStyle(0xc8a040, 0.5);
    for (let x = 40; x < this.room.width; x += 32) {
      g.fillRect(x, 200, 16, 6);
    }
    // Random scuffs.
    const rng = this.seedableRng('subway-scuffs');
    g.fillStyle(this.theme.floorAccent, 0.55);
    for (let i = 0; i < 30; i++) {
      const x = rng() * this.room.width;
      const y = 220 + rng() * (this.room.height - 320);
      g.fillRect(x, y, 14 + rng() * 22, 8 + rng() * 12);
    }
    this.container.add(g);
  }

  private drawCarpetPattern(): void {
    // Diamond-pattern velvet carpet, low contrast.
    const g = this.scene.add.graphics();
    g.lineStyle(1, this.theme.floorAccent, 0.5);
    const step = 60;
    for (let x = -step; x < this.room.width + step; x += step) {
      g.lineBetween(x, 0, x + this.room.height, this.room.height);
      g.lineBetween(x, this.room.height, x + this.room.height, 0);
    }
    this.container.add(g);
  }

  // ---------------------------------------------------------------------------
  // Pools / glow
  // ---------------------------------------------------------------------------
  private drawPools(): void {
    for (const pool of this.room.pools) {
      const outer = this.scene.add.circle(pool.x, pool.y, 60 * pool.scale, this.room.poolTint, 0.08);
      const inner = this.scene.add.circle(pool.x, pool.y, 30 * pool.scale, this.room.poolTint, 0.18);
      this.container.add([outer, inner]);
    }
  }

  // ---------------------------------------------------------------------------
  // Walls — themed per room
  // ---------------------------------------------------------------------------
  private drawWalls(): void {
    for (const wall of this.room.walls) {
      switch (this.theme.wallStyle) {
        case 'planter':  this.drawPlanterWall(wall); break;
        case 'concrete': this.drawConcreteWall(wall); break;
        case 'booth':    this.drawBoothWall(wall); break;
      }
    }
  }

  private drawConcreteWall(w: Rect): void {
    const c = this.theme.wallColors;
    const body = this.scene.add.rectangle(w.x, w.y, w.width, w.height, c.base, 1);
    body.setOrigin(0, 0);
    this.container.add(body);
    // Subtle highlight strip.
    const top = this.scene.add.rectangle(w.x, w.y, w.width, 2, c.detail, 0.6);
    top.setOrigin(0, 0);
    this.container.add(top);
  }

  private drawPlanterWall(w: Rect): void {
    const c = this.theme.wallColors;
    // Wooden planter side.
    const body = this.scene.add.rectangle(w.x, w.y, w.width, w.height, c.base, 1);
    body.setOrigin(0, 0);
    this.container.add(body);

    // Leaves on top — only meaningful when the wall is bigger than a railing.
    const isThin = w.width < 32 || w.height < 32;
    if (!isThin) {
      const g = this.scene.add.graphics();
      const leafColors = [c.trim, c.detail, this.darken(c.detail, 0.85)];
      const stride = 6;
      for (let lx = w.x; lx < w.x + w.width; lx += stride) {
        for (let ly = w.y; ly < w.y + w.height; ly += stride) {
          const noise = this.seededHash(lx * 13 + ly * 7);
          if (noise < 0.55) continue;
          const color = leafColors[Math.floor(noise * leafColors.length)];
          g.fillStyle(color, 0.9);
          g.fillCircle(lx + (noise - 0.5) * 4, ly + (noise - 0.5) * 4, 3 + noise * 2);
        }
      }
      this.container.add(g);
    }

    // Rim trim.
    const top = this.scene.add.rectangle(w.x, w.y, w.width, 2, c.detail, 0.7);
    top.setOrigin(0, 0);
    this.container.add(top);
  }

  private drawBoothWall(w: Rect): void {
    const c = this.theme.wallColors;
    // Velvet panel — base + a vertical "tufted" pattern on bigger walls.
    const body = this.scene.add.rectangle(w.x, w.y, w.width, w.height, c.base, 1);
    body.setOrigin(0, 0);
    this.container.add(body);

    const isThin = w.width < 32 || w.height < 32;
    if (!isThin) {
      const g = this.scene.add.graphics();
      g.fillStyle(c.trim, 0.4);
      // Dotted button pattern.
      const stride = 18;
      for (let dx = w.x + 9; dx < w.x + w.width - 4; dx += stride) {
        for (let dy = w.y + 9; dy < w.y + w.height - 4; dy += stride) {
          g.fillCircle(dx, dy, 1.5);
        }
      }
      this.container.add(g);
    }

    // Magenta rim glow on top.
    const top = this.scene.add.rectangle(w.x, w.y, w.width, 2, c.detail, 0.85);
    top.setOrigin(0, 0);
    this.container.add(top);
  }

  // ---------------------------------------------------------------------------
  // Zones — keep subtle, just outlines + tiny labels
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Portals — Spirit Gates
  // ---------------------------------------------------------------------------
  private drawPortals(): void {
    for (const portal of this.room.portals) {
      const b = portal.bounds;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;

      // Outer glow halo.
      const halo = this.scene.add.circle(cx, cy, 36, this.room.poolTint, 0.22);
      // Rotating sigil — a ring of dashes.
      const sigil = this.scene.add.graphics();
      this.drawSigilRing(sigil, this.room.poolTint, 26);
      sigil.x = cx;
      sigil.y = cy;
      // Bright center.
      const core = this.scene.add.circle(cx, cy, 8, 0xfff4ec, 0.85);

      // Animations.
      this.scene.tweens.add({
        targets: halo,
        scale: { from: 0.9, to: 1.18 },
        alpha: { from: 0.22, to: 0.45 },
        duration: 1600,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
      this.scene.tweens.add({
        targets: sigil,
        rotation: { from: 0, to: Math.PI * 2 },
        duration: 12000,
        repeat: -1,
      });
      this.scene.tweens.add({
        targets: core,
        alpha: { from: 0.7, to: 1 },
        duration: 900,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });

      // Label.
      const labelOffsetX = b.width < b.height ? (b.x === 0 ? 80 : -80) : 0;
      const labelOffsetY = b.width >= b.height ? (b.y === 0 ? 60 : -60) : 0;
      const label = this.scene.add
        .text(cx + labelOffsetX, cy + labelOffsetY, `→ ${portal.label}`, {
          fontFamily: '"Noto Serif SC", "Fraunces", serif',
          fontStyle: 'italic',
          fontSize: '18px',
          color: '#f3eee6',
          backgroundColor: 'rgba(13, 15, 26, 0.78)',
          padding: { x: 12, y: 6 },
        })
        .setOrigin(0.5);

      this.container.add([halo, sigil, core, label]);
    }
  }

  private drawSigilRing(g: Phaser.GameObjects.Graphics, color: number, radius: number): void {
    g.lineStyle(2, color, 0.85);
    const dashes = 16;
    for (let i = 0; i < dashes; i++) {
      const a0 = (i / dashes) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / dashes * 0.55;
      g.beginPath();
      g.arc(0, 0, radius, a0, a1);
      g.strokePath();
    }
    // Inner ring (dotted).
    g.fillStyle(color, 0.6);
    const dots = 8;
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * Math.PI * 2;
      g.fillCircle(Math.cos(a) * (radius - 8), Math.sin(a) * (radius - 8), 1.5);
    }
  }

  // ---------------------------------------------------------------------------
  // Particles — drifting room atmosphere
  // ---------------------------------------------------------------------------
  private drawAmbientParticles(): void {
    if (!this.theme.particleColor || !this.theme.particleCount) return;
    const rng = this.seedableRng(this.room.id + ':particles');

    for (let i = 0; i < this.theme.particleCount; i++) {
      const x = rng() * this.room.width;
      const y = rng() * this.room.height;
      const size = 2 + rng() * 2;
      const dot = this.scene.add.circle(x, y, size, this.theme.particleColor, 0.55);
      this.container.add(dot);

      const driftRadius = 30 + rng() * 50;
      const duration = 8000 + rng() * 6000;
      this.scene.tweens.add({
        targets: dot,
        x: { from: x, to: x + (rng() - 0.5) * driftRadius },
        y: { from: y, to: y - 30 - rng() * 60 },
        alpha: { from: 0.55, to: 0 },
        duration,
        delay: rng() * 4000,
        ease: 'Sine.easeInOut',
        repeat: -1,
        onRepeat: () => {
          dot.x = rng() * this.room.width;
          dot.y = this.room.height - 50;
          dot.alpha = 0.55;
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Per-room decor — the special touches
  // ---------------------------------------------------------------------------
  private drawRoomDecor(roomId: RoomId): void {
    if (roomId === 'rooftop') {
      this.drawRooftopDecor();
    } else if (roomId === 'subway') {
      this.drawSubwayDecor();
    } else {
      this.drawKaraokeDecor();
    }
  }

  private drawRooftopDecor(): void {
    // City skyline silhouette behind the railing — fake parallax depth.
    const skyline = this.scene.add.graphics();
    skyline.fillStyle(0x0a0c14, 0.95);
    // Buildings as varying-height rects.
    let bx = 0;
    const rng = this.seedableRng('skyline');
    while (bx < this.room.width) {
      const w = 30 + rng() * 60;
      const h = 100 + rng() * 200;
      skyline.fillRect(bx, 24, w, h);
      bx += w + 4;
    }
    this.container.add(skyline);
    // Window lights — random tiny rects with warm tints.
    const windows = this.scene.add.graphics();
    bx = 0;
    while (bx < this.room.width) {
      for (let wy = 40; wy < 220; wy += 12) {
        if (this.seededHash(bx * 11 + wy * 7) < 0.4) {
          const warm = this.seededHash(bx + wy) > 0.5;
          windows.fillStyle(warm ? 0xe8b870 : 0xa8c4e8, 0.85);
          windows.fillRect(bx + 4, wy, 4, 4);
        }
      }
      bx += 40 + rng() * 40;
    }
    this.container.add(windows);

    // Koi pond water.
    const water = this.scene.add.circle(830, 540, 90, 0x4a8a98, 0.55);
    const waterHi = this.scene.add.circle(830, 540, 60, 0x88c4d0, 0.4);
    this.container.add([water, waterHi]);
    this.scene.tweens.add({
      targets: waterHi,
      scale: { from: 0.85, to: 1.1 },
      alpha: { from: 0.4, to: 0.18 },
      duration: 2200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    // Three glowing koi in the pond.
    const koiSpots = [{ x: 800, y: 520, c: 0xe8765a }, { x: 860, y: 555, c: 0xe8b870 }, { x: 820, y: 575, c: 0xfff4ec }];
    for (const k of koiSpots) {
      const koi = this.scene.add.ellipse(k.x, k.y, 14, 6, k.c, 0.85);
      this.container.add(koi);
      this.scene.tweens.add({
        targets: koi,
        x: k.x + (Math.random() - 0.5) * 30,
        y: k.y + (Math.random() - 0.5) * 20,
        duration: 3500 + Math.random() * 2000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }

    // Bonsai planters — small clusters on top of the planter walls (positions match).
    const bonsaiSpots = [
      { x: 320, y: 280 }, { x: 1380, y: 280 },
      { x: 320, y: 920 }, { x: 1380, y: 920 },
    ];
    for (const b of bonsaiSpots) {
      const trunk = this.scene.add.rectangle(b.x, b.y - 6, 6, 18, 0x4a3020, 1);
      const leaves1 = this.scene.add.circle(b.x - 8, b.y - 18, 12, 0x4a8a4a, 1);
      const leaves2 = this.scene.add.circle(b.x + 8, b.y - 18, 12, 0x4a8a4a, 1);
      const leaves3 = this.scene.add.circle(b.x, b.y - 26, 14, 0x5aa05a, 1);
      this.container.add([trunk, leaves1, leaves2, leaves3]);
    }

    // String lights — a gently sagging line drawn as two short segments per swag.
const stringG = this.scene.add.graphics();
stringG.lineStyle(1, 0x666666, 0.6);
for (let sx = 100; sx < this.room.width - 100; sx += 60) {
  stringG.beginPath();
  stringG.moveTo(sx, 140);
  stringG.lineTo(sx + 30, 158);    // sag low point
  stringG.lineTo(sx + 60, 140);
  stringG.strokePath();
}
this.container.add(stringG);
    // Bulbs.
    for (let sx = 130; sx < this.room.width - 100; sx += 60) {
      const bulb = this.scene.add.circle(sx, 158, 3, 0xffd699, 0.95);
      const halo = this.scene.add.circle(sx, 158, 8, 0xffd699, 0.25);
      this.container.add([halo, bulb]);
      // Subtle twinkle.
      if (Math.random() > 0.7) {
        this.scene.tweens.add({
          targets: bulb,
          alpha: { from: 0.95, to: 0.5 },
          duration: 1500 + Math.random() * 2000,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  private drawSubwayDecor(): void {
    // Subway tracks — black bands behind the safety stripe.
    const tracks = this.scene.add.graphics();
    tracks.fillStyle(0x05060a, 1);
    tracks.fillRect(0, 24, this.room.width, 156);
    // Two metal rails.
    tracks.fillStyle(0x6a6c74, 0.85);
    tracks.fillRect(0, 100, this.room.width, 3);
    tracks.fillRect(0, 140, this.room.width, 3);
    // Wooden ties.
    tracks.fillStyle(0x2a1a14, 0.7);
    for (let tx = 0; tx < this.room.width; tx += 36) {
      tracks.fillRect(tx, 90, 14, 60);
    }
    this.container.add(tracks);

    // Tunnel arch suggestion — a darker band at the very top.
    const tunnel = this.scene.add.rectangle(0, 0, this.room.width, 24, 0x000000, 0.85);
    tunnel.setOrigin(0, 0);
    this.container.add(tunnel);

    // Fluorescent ceiling lights — three thin bright strips at top of platform.
    const lightSpots = [{ x: 280, y: 200 }, { x: 760, y: 200 }, { x: 1240, y: 200 }];
    for (const l of lightSpots) {
      const tube = this.scene.add.rectangle(l.x, l.y, 80, 4, 0xfff4ec, 0.95);
      const bloom = this.scene.add.rectangle(l.x, l.y, 140, 30, 0xfff4ec, 0.12);
      this.container.add([bloom, tube]);
      // Random flicker on one of them.
      if (l.x === 760) {
        this.scene.tweens.add({
          targets: [tube, bloom],
          alpha: { from: 0.95, to: 0.5 },
          duration: 80,
          yoyo: true,
          repeat: -1,
          repeatDelay: 1800 + Math.random() * 3000,
        });
      }
    }

    // Benches — wood plank look on top of the bench rect walls.
    const benchSpots = [{ x: 380, y: 460, w: 200 }, { x: 920, y: 460, w: 200 }];
    for (const b of benchSpots) {
      const slats = this.scene.add.graphics();
      slats.fillStyle(0x5a4030, 1);
      slats.fillRect(b.x, b.y, b.w, 28);
      slats.lineStyle(1, 0x000, 0.5);
      slats.lineBetween(b.x, b.y + 9, b.x + b.w, b.y + 9);
      slats.lineBetween(b.x, b.y + 19, b.x + b.w, b.y + 19);
      this.container.add(slats);
    }

    // Vending machine — bright box with two glowing drink columns.
    const vmBody = this.scene.add.rectangle(232, 760, 64, 80, 0x8a3848, 1);
    const vmGlass = this.scene.add.rectangle(232, 752, 50, 56, 0x12141c, 1);
    const drink1 = this.scene.add.rectangle(220, 752, 8, 50, 0xe8b870, 0.7);
    const drink2 = this.scene.add.rectangle(244, 752, 8, 50, 0x88c4d0, 0.7);
    this.container.add([vmBody, vmGlass, drink1, drink2]);

    // Spirit fox sleeping by the vending machine.
    const foxBody = this.scene.add.ellipse(290, 790, 24, 12, 0xe88c5a, 0.95);
    const foxTail = this.scene.add.ellipse(305, 786, 14, 6, 0xe88c5a, 0.9);
    const foxHead = this.scene.add.circle(279, 786, 6, 0xe88c5a, 1);
    const foxEar1 = this.scene.add.triangle(275, 779, 0, 4, 4, 0, 4, 4, 0xe88c5a, 1);
    const foxEar2 = this.scene.add.triangle(283, 779, 0, 4, 4, 0, 4, 4, 0xe88c5a, 1);
    this.container.add([foxTail, foxBody, foxHead, foxEar1, foxEar2]);
    // Subtle breathing.
    this.scene.tweens.add({
      targets: [foxBody, foxHead],
      scale: { from: 1, to: 1.05 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Pillar.
    const pillar = this.scene.add.rectangle(740 + 16, 380 + 16, 32, 32, 0x4a4c54, 1);
    pillar.setStrokeStyle(1, 0x6a6c74, 0.7);
    this.container.add(pillar);
  }

  private drawKaraokeDecor(): void {
    // Disco ball in the center, hanging from the ceiling.
    const ballHalo = this.scene.add.circle(800, 100, 44, 0xfff4ec, 0.18);
    const ball = this.scene.add.circle(800, 100, 22, 0xc4b8c8, 1);
    ball.setStrokeStyle(1, 0xe8b870, 0.7);
    this.container.add([ballHalo, ball]);
    // Light beams from the disco ball — soft rotating wedges.
    const beam = this.scene.add.graphics();
    beam.fillStyle(0xfff4ec, 0.06);
    beam.fillTriangle(800, 100, 600, 700, 1000, 700);
    this.container.add(beam);
    this.scene.tweens.add({
      targets: beam,
      alpha: { from: 0.06, to: 0.14 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Booth interior glow — soft warm ovals INSIDE each booth.
    const boothInteriors = [
      { x: 380, y: 320 },
      { x: 800, y: 320 },
      { x: 1220, y: 320 },
    ];
    for (const b of boothInteriors) {
      const sofa = this.scene.add.rectangle(b.x, b.y + 50, 240, 30, 0x6a2848, 1);
      sofa.setStrokeStyle(1, 0x8a3868, 0.7);
      const table = this.scene.add.rectangle(b.x, b.y + 8, 80, 30, 0x3a2030, 1);
      table.setStrokeStyle(1, 0x5a3050, 0.6);
      // Tiny drink glasses on the table.
      const drink1 = this.scene.add.circle(b.x - 18, b.y + 6, 3, 0xe8b870, 0.85);
      const drink2 = this.scene.add.circle(b.x + 12, b.y + 6, 3, 0xc84848, 0.85);
      this.container.add([sofa, table, drink1, drink2]);
    }

    // Neon "私人房" sign over each booth.
    for (const b of boothInteriors) {
      const sign = this.scene.add
        .text(b.x, 168, '私人房', {
          fontFamily: '"Noto Serif SC", serif',
          fontSize: '14px',
          color: '#e88adc',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setShadow(0, 0, '#e88adc', 8, true, true);
      this.container.add(sign);
    }

    // Bar counter detail — a row of bottles.
    const barG = this.scene.add.graphics();
    barG.fillStyle(0x4a3020, 1);
    barG.fillRect(360, 820, 880, 28);
    this.container.add(barG);
    // Bottles.
    const bottleColors = [0xc84848, 0x4a8a4a, 0xe8b870, 0x6a4a8a, 0x88c4d0];
    for (let bx = 380; bx < 1240; bx += 40) {
      const c = bottleColors[Math.floor((bx / 40) % bottleColors.length)];
      const bottle = this.scene.add.rectangle(bx, 808, 8, 18, c, 0.9);
      const neck = this.scene.add.rectangle(bx, 798, 3, 5, c, 0.9);
      this.container.add([bottle, neck]);
    }

    // Floor lights — small magenta and gold dots scattered on the dance floor.
    const floorLights = [
      { x: 700, y: 600, c: 0xe88adc }, { x: 800, y: 580, c: 0xe8b870 },
      { x: 900, y: 620, c: 0xe88adc }, { x: 750, y: 700, c: 0xe8b870 },
      { x: 850, y: 720, c: 0xe88adc },
    ];
    for (const f of floorLights) {
      const dot = this.scene.add.circle(f.x, f.y, 4, f.c, 0.95);
      const halo = this.scene.add.circle(f.x, f.y, 12, f.c, 0.3);
      this.container.add([halo, dot]);
      this.scene.tweens.add({
        targets: [dot, halo],
        alpha: { from: 0.95, to: 0.4 },
        duration: 1100 + Math.random() * 700,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private darken(hex: number, factor: number): number {
    const r = Math.floor(((hex >> 16) & 0xff) * factor);
    const g = Math.floor(((hex >> 8) & 0xff) * factor);
    const b = Math.floor((hex & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

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

interface Rect { x: number; y: number; width: number; height: number; }
