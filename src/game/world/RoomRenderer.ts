import Phaser from 'phaser';
import { RoomDef, RoomId, ROOMS } from '../../shared/world';

/**
 * RoomRenderer holds all visual elements for a single room — floor, walls,
 * pools, zone overlays, portal labels. Created/destroyed when the local
 * player switches rooms. Acts as a clean container so we can swap rooms
 * without leftover artifacts.
 */
export class RoomRenderer {
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  readonly room: RoomDef;

  constructor(scene: Phaser.Scene, roomId: RoomId) {
    this.scene = scene;
    this.room = ROOMS[roomId];
    this.container = scene.add.container(0, 0);
    this.container.setDepth(-100); // behind avatars

    this.drawFloor();
    this.drawPools();
    this.drawWalls();
    this.drawZoneHints();
    this.drawPortalLabels();
  }

  destroy(): void {
    this.container.destroy(true);
  }

  private drawFloor(): void {
    // Subtle vignette: floor tile + radial darkening at edges via gradient image
    // is overkill for now. Plain tinted tile-sprite reads "modern matte" fine.
    const floor = this.scene.add.rectangle(
      0, 0, this.room.width, this.room.height,
      this.room.floorTint, 1
    );
    floor.setOrigin(0, 0);
    this.container.add(floor);

    // Faint grid for spatial reference.
    const grid = this.scene.add.graphics();
    grid.lineStyle(1, 0xffffff, 0.025);
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
    // Pools render as soft radial glows. Two concentric circles fake a falloff.
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
      // Slightly brighter than floor + thin highlight on top edge for depth.
      const body = this.scene.add.rectangle(
        wall.x, wall.y, wall.width, wall.height,
        0x2a3148, 1
      );
      body.setOrigin(0, 0);
      body.setStrokeStyle(1, 0x3b4366, 0.8);
      this.container.add(body);
    }
  }

  private drawZoneHints(): void {
    // Zones are barely-visible boundaries. Just enough to suggest "this is a
    // hangout area" without screaming "VIDEO GAME OBJECTIVE!"
    for (const zone of this.room.zones) {
      const b = zone.bounds;
      const outline = this.scene.add.graphics();
      outline.lineStyle(2, this.room.poolTint, 0.18);
      outline.strokeRoundedRect(b.x, b.y, b.width, b.height, 16);
      this.container.add(outline);

      // Zone name, very faint, top-left of the zone.
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

      // Glowing marker in the doorway.
      const glow = this.scene.add.circle(cx, cy, 28, this.room.poolTint, 0.3);
      const dot = this.scene.add.circle(cx, cy, 10, 0xfff4ec, 0.85);

      // Gentle pulse.
      this.scene.tweens.add({
        targets: glow,
        scale: { from: 0.9, to: 1.15 },
        alpha: { from: 0.3, to: 0.55 },
        duration: 1400,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });

      // Floating label — offset so it doesn't sit in the doorway itself.
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
}
