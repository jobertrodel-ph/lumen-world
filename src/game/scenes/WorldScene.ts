import Phaser from 'phaser';
import type { PlayerProfile } from '../PhaserGame';
import { NetworkManager } from '../net/NetworkManager';
import { RemotePlayer } from '../net/RemotePlayer';
import { RoomRenderer } from '../world/RoomRenderer';
import { ROOMS, RoomId, isBlocked, zoneAt, ZONE_NAMES } from '../../shared/world-helpers';

const WALK_SPEED = 220;
const AVATAR_RADIUS = 20;
const SEND_INTERVAL_MS = 50;
const MOVE_EPSILON = 0.5;

interface WASDKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
}

interface RemotePlayerData {
  uid: string;
  displayName: string;
  photoURL: string;
  room: string;
  zone: string;
  x: number;
  y: number;
}

export default class WorldScene extends Phaser.Scene {
  private avatar!: Phaser.GameObjects.Container;
  private avatarX = 0;
  private avatarY = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: WASDKeys;

  private network = new NetworkManager();
  private remotes = new Map<string, RemotePlayer>();
  private remoteData = new Map<string, RemotePlayerData>();

  private currentRoom: RoomId = 'atrium';
  private roomRenderer: RoomRenderer | null = null;

  private lastSendAt = 0;
  private lastSentX = -Infinity;
  private lastSentY = -Infinity;

  private hudRoomLabel?: Phaser.GameObjects.Text;
  private hudZoneLabel?: Phaser.GameObjects.Text;
  private currentZone = '';

  constructor() {
    super('World');
  }

  create() {
    const profile = this.registry.get('profile') as PlayerProfile;
    const idToken = this.registry.get('idToken') as string | undefined;
    const serverUrl = import.meta.env.VITE_GAME_SERVER_URL as string | undefined;

    this.renderRoom(this.currentRoom);

    const spawn = ROOMS[this.currentRoom];
    this.avatar = this.makeAvatar(spawn.spawnX, spawn.spawnY, profile);
    this.avatarX = spawn.spawnX;
    this.avatarY = spawn.spawnY;

    this.updateCameraBounds();
    this.cameras.main.startFollow(this.avatar, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.25);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as WASDKeys;

    this.makeRoomHud();

    if (!serverUrl || !idToken) {
      this.showBanner(!serverUrl ? 'Set VITE_GAME_SERVER_URL.' : 'Missing auth token.');
      return;
    }

    this.network
      .connect({
        serverUrl,
        idToken,
        handlers: {
          onPlayerAdd: (sid, p) => this.handlePlayerAdd(sid, p as RemotePlayerData),
          onPlayerRemove: (sid) => this.handlePlayerRemove(sid),
          onPlayerMove: (sid, x, y) => this.handleRemoteMove(sid, x, y),
          onPlayerRoomChange: (sid, room) => this.handleRemoteRoomChange(sid, room as RoomId),
          onSelfRoomChange: (room, x, y) => this.handleSelfRoomChange(room as RoomId, x, y),
          onError: (msg) => this.showBanner(msg),
        },
      })
      .catch((err) => console.error('[net] connect failed:', err));
  }

  private renderRoom(roomId: RoomId): void {
    this.roomRenderer?.destroy();
    this.roomRenderer = new RoomRenderer(this, roomId);
    this.cameras.main.setBackgroundColor('#0a0c16');
  }

  private updateCameraBounds(): void {
    const r = ROOMS[this.currentRoom];
    this.cameras.main.setBounds(0, 0, r.width, r.height);
  }

  private makeAvatar(
    x: number, y: number, profile: PlayerProfile
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const shadow = this.add.ellipse(0, 24, 46, 14, 0x000000, 0.32);
    const body = this.add.circle(0, 0, AVATAR_RADIUS + 2, 0xe8a07f);
    body.setStrokeStyle(2, 0xfff4ec, 0.95);

    const initial = profile.displayName?.[0]?.toUpperCase() ?? '?';
    const initialText = this.add
      .text(0, 1, initial, {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#3a1a08',
      })
      .setOrigin(0.5);

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
    container.setDepth(10);
    return container;
  }

  private makeRoomHud(): void {
    const r = ROOMS[this.currentRoom];
    this.hudRoomLabel = this.add
      .text(this.scale.width / 2, 28, r.name.toUpperCase(), {
        fontFamily: '"Fraunces", serif',
        fontStyle: 'italic',
        fontSize: '14px',
        color: '#f3eee6',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0.7);

    this.hudZoneLabel = this.add
      .text(this.scale.width / 2, 50, '', {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '11px',
        color: '#a09a8e',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  // --- Network handlers ---

  private handlePlayerAdd(sessionId: string, p: RemotePlayerData): void {
    this.remoteData.set(sessionId, p);
    if (sessionId === this.network.sessionId) {
      // Don't render our own; we have the local avatar.
      return;
    }
    if (p.room !== this.currentRoom) {
      // Player exists but isn't in our current room — don't render.
      return;
    }
    const remote = new RemotePlayer(this, p.x, p.y, p.displayName);
    this.remotes.set(sessionId, remote);
  }

  private handlePlayerRemove(sessionId: string): void {
    this.remoteData.delete(sessionId);
    const remote = this.remotes.get(sessionId);
    if (remote) {
      remote.destroy();
      this.remotes.delete(sessionId);
    }
  }

  private handleRemoteMove(sessionId: string, x: number, y: number): void {
    const data = this.remoteData.get(sessionId);
    if (data) { data.x = x; data.y = y; }
    if (sessionId === this.network.sessionId) return;
    this.remotes.get(sessionId)?.setTarget(x, y);
  }

  private handleRemoteRoomChange(sessionId: string, newRoom: RoomId): void {
    const data = this.remoteData.get(sessionId);
    if (data) data.room = newRoom;

    const existing = this.remotes.get(sessionId);
    if (newRoom === this.currentRoom) {
      // Just entered our room — render them.
      if (!existing && data) {
        const remote = new RemotePlayer(this, data.x, data.y, data.displayName);
        this.remotes.set(sessionId, remote);
      }
    } else {
      // Left our room — remove visual.
      if (existing) {
        existing.destroy();
        this.remotes.delete(sessionId);
      }
    }
  }

  private handleSelfRoomChange(newRoom: RoomId, x: number, y: number): void {
    if (newRoom === this.currentRoom) {
      // Same room, just snap position (e.g. server correction).
      this.avatar.setPosition(x, y);
      this.avatarX = x;
      this.avatarY = y;
      return;
    }

    // Full room transition.
    this.currentRoom = newRoom;
    this.avatar.setPosition(x, y);
    this.avatarX = x;
    this.avatarY = y;

    // Re-render world.
    this.renderRoom(newRoom);
    this.updateCameraBounds();

    // Update HUD label.
    if (this.hudRoomLabel) {
      this.hudRoomLabel.setText(ROOMS[newRoom].name.toUpperCase());
      this.tweens.add({
        targets: this.hudRoomLabel,
        alpha: { from: 0, to: 0.7 },
        duration: 600,
      });
    }

    // Rebuild remote players to match new room.
    for (const [sid, remote] of this.remotes) {
      remote.destroy();
      this.remotes.delete(sid);
    }
    for (const [sid, data] of this.remoteData) {
      if (sid === this.network.sessionId) continue;
      if (data.room !== newRoom) continue;
      this.remotes.set(sid, new RemotePlayer(this, data.x, data.y, data.displayName));
    }
  }

  private showBanner(message: string): void {
    const banner = this.add
      .text(this.scale.width / 2, 90, message, {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '14px',
        color: '#f0856b',
        backgroundColor: 'rgba(13, 15, 26, 0.92)',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 6000,
      duration: 800,
      onComplete: () => banner.destroy(),
    });
  }

  update(time: number, delta: number) {
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;

    if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.SQRT2;
      vx *= inv;
      vy *= inv;
    }

    // Client-side collision prediction. Move axis-by-axis so sliding along
    // walls feels natural instead of binary stop.
    const step = (delta / 1000) * WALK_SPEED;
    let nextX = this.avatarX + vx * step;
    let nextY = this.avatarY + vy * step;

    const room = ROOMS[this.currentRoom];
    nextX = Math.max(AVATAR_RADIUS, Math.min(room.width - AVATAR_RADIUS, nextX));
    nextY = Math.max(AVATAR_RADIUS, Math.min(room.height - AVATAR_RADIUS, nextY));

    if (!isBlocked(this.currentRoom, nextX, this.avatarY, AVATAR_RADIUS)) {
      this.avatarX = nextX;
    }
    if (!isBlocked(this.currentRoom, this.avatarX, nextY, AVATAR_RADIUS)) {
      this.avatarY = nextY;
    }

    this.avatar.setPosition(this.avatarX, this.avatarY);

    // Tick remote interpolation.
    this.remotes.forEach((r) => r.tick());

    // Update zone HUD.
    const z = zoneAt(this.currentRoom, this.avatarX, this.avatarY);
    if (z !== this.currentZone) {
      this.currentZone = z ?? '';
      if (this.hudZoneLabel) {
        const name = z ? ZONE_NAMES[z] ?? '' : '';
        this.hudZoneLabel.setText(name ? `· ${name} ·` : '');
      }
    }

    // Throttled position broadcast.
    if (time - this.lastSendAt >= SEND_INTERVAL_MS) {
      const dx = Math.abs(this.avatarX - this.lastSentX);
      const dy = Math.abs(this.avatarY - this.lastSentY);
      if (dx > MOVE_EPSILON || dy > MOVE_EPSILON) {
        this.network.sendMove(this.avatarX, this.avatarY);
        this.lastSentX = this.avatarX;
        this.lastSentY = this.avatarY;
        this.lastSendAt = time;
      }
    }
  }

  shutdown() {
    this.network.disconnect();
    this.remotes.forEach((r) => r.destroy());
    this.remotes.clear();
    this.remoteData.clear();
    this.roomRenderer?.destroy();
  }
}
