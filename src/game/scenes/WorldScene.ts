import Phaser from 'phaser';
import type { PlayerProfile } from '../PhaserGame';
import { NetworkManager } from '../net/NetworkManager';
import { RemotePlayer } from '../net/RemotePlayer';
import { RoomRenderer } from '../world/RoomRenderer';
import { VoiceManager } from '../voice/VoiceManager';
import { computeGain } from '../voice/audibility';
import { registerVoiceManager } from '../voice/voiceBridge';
import { AvatarSprite } from '../avatars/AvatarSprite';
import { getAvatarStyle } from '../../shared/avatars';
import { ROOMS, RoomId, isBlocked, zoneAt, ZONE_NAMES } from '../../shared/world-helpers';
import { readJoystick } from '../input/inputBridge';

const WALK_SPEED = 220;
const AVATAR_RADIUS = 20;
const SEND_INTERVAL_MS = 50;
const MOVE_EPSILON = 0.5;
const AUDIBILITY_TICK_MS = 200;

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
  avatarId: string;
  room: string;
  zone: string;
  x: number;
  y: number;
}

export default class WorldScene extends Phaser.Scene {
  private avatarSprite!: AvatarSprite;
  private nameTag!: Phaser.GameObjects.Text;
  private avatarX = 0;
  private avatarY = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: WASDKeys;

  private network = new NetworkManager();
  private voice = new VoiceManager();

  private remotes = new Map<string, RemotePlayer>();
  private remoteData = new Map<string, RemotePlayerData>();

  private currentRoom: RoomId = 'atrium';
  private roomRenderer: RoomRenderer | null = null;

  /** True after shutdown(); blocks late network handlers from touching dead objects. */
  private destroyed = false;

  private lastSendAt = 0;
  private lastSentX = -Infinity;
  private lastSentY = -Infinity;
  private lastAudibilityAt = 0;

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
    const httpServerUrl = import.meta.env.VITE_HTTP_SERVER_URL as string | undefined;

    this.renderRoom(this.currentRoom);

    const spawn = ROOMS[this.currentRoom];
    this.avatarX = spawn.spawnX;
    this.avatarY = spawn.spawnY;

    this.avatarSprite = new AvatarSprite(
      this, spawn.spawnX, spawn.spawnY,
      getAvatarStyle(profile.avatarId)
    );
    this.avatarSprite.container.setDepth(10);

    this.nameTag = this.add
      .text(spawn.spawnX, spawn.spawnY - 38, profile.displayName, {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '13px',
        color: '#f3eee6',
        backgroundColor: 'rgba(13, 15, 26, 0.78)',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.updateCameraBounds();
    this.cameras.main.startFollow(this.avatarSprite.container, true, 0.12, 0.12);
    this.applyResponsiveZoom();

    this.scale.on('resize', () => this.applyResponsiveZoom());

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
        avatarId: profile.avatarId,
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

    if (httpServerUrl) {
      this.connectVoice(httpServerUrl, idToken);
    }
  }

  private applyResponsiveZoom(): void {
    const w = this.scale.width;
    let zoom = 1.25;
    if (w < 500) zoom = 1.7;
    else if (w < 820) zoom = 1.45;
    this.cameras.main.setZoom(zoom);
  }

  private async connectVoice(httpServerUrl: string, idToken: string): Promise<void> {
    try {
      const resp = await fetch(`${httpServerUrl}/livekit-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
      });
      if (!resp.ok) throw new Error(`token ${resp.status}: ${await resp.text()}`);
      const data = (await resp.json()) as { token: string; url: string };
      if (!data.url) throw new Error('LIVEKIT_URL not configured on server');

      // Bail if the scene was destroyed during the network round-trip.
      if (this.destroyed) return;

      await this.voice.connect({
        serverUrl: data.url,
        token: data.token,
        handlers: {
          onSpeakingChange: (uid, speaking) => this.handleSpeakingChange(uid, speaking),
          onError: (msg) => this.showBanner(`voice: ${msg}`),
        },
      });
      if (this.destroyed) {
        this.voice.disconnect();
        return;
      }
      registerVoiceManager(this.voice);
      window.dispatchEvent(new CustomEvent('lumen:voice-ready'));
    } catch (err) {
      console.error('[voice] connect failed:', err);
      if (!this.destroyed) this.showBanner(`voice unavailable: ${(err as Error).message}`);
    }
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

  private makeRoomHud(): void {
    const r = ROOMS[this.currentRoom];
    this.hudRoomLabel = this.add
      .text(this.scale.width / 2, 28, r.name.toUpperCase(), {
        fontFamily: '"Fraunces", serif', fontStyle: 'italic',
        fontSize: '14px', color: '#f3eee6',
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1000).setAlpha(0.7);

    this.hudZoneLabel = this.add
      .text(this.scale.width / 2, 50, '', {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '11px', color: '#a09a8e',
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1000);
  }

  // --- Network handlers — all guarded against late-arriving messages ---

  private handlePlayerAdd(sessionId: string, p: RemotePlayerData): void {
    if (this.destroyed || !this.sys.isActive()) return;
    this.remoteData.set(sessionId, p);
    if (sessionId === this.network.sessionId) return;
    if (p.room !== this.currentRoom) return;
    this.remotes.set(
      sessionId,
      new RemotePlayer(this, p.x, p.y, p.displayName, p.avatarId)
    );
  }

  private handlePlayerRemove(sessionId: string): void {
    if (this.destroyed) return;
    const data = this.remoteData.get(sessionId);
    if (data) this.voice.setAudibility(data.uid, 0);
    this.remoteData.delete(sessionId);
    const remote = this.remotes.get(sessionId);
    if (remote) { remote.destroy(); this.remotes.delete(sessionId); }
  }

  private handleRemoteMove(sessionId: string, x: number, y: number): void {
    if (this.destroyed) return;
    const data = this.remoteData.get(sessionId);
    if (data) { data.x = x; data.y = y; }
    if (sessionId === this.network.sessionId) return;
    this.remotes.get(sessionId)?.setTarget(x, y);
  }

  private handleRemoteRoomChange(sessionId: string, newRoom: RoomId): void {
    if (this.destroyed || !this.sys.isActive()) return;
    const data = this.remoteData.get(sessionId);
    if (data) data.room = newRoom;
    const existing = this.remotes.get(sessionId);
    if (newRoom === this.currentRoom && !existing && data) {
      this.remotes.set(
        sessionId,
        new RemotePlayer(this, data.x, data.y, data.displayName, data.avatarId)
      );
    } else if (newRoom !== this.currentRoom && existing) {
      if (data) this.voice.setAudibility(data.uid, 0);
      existing.destroy();
      this.remotes.delete(sessionId);
    }
  }

  private handleSelfRoomChange(newRoom: RoomId, x: number, y: number): void {
    if (this.destroyed || !this.sys.isActive()) return;
    if (newRoom === this.currentRoom) {
      this.avatarSprite.container.setPosition(x, y);
      this.avatarX = x; this.avatarY = y;
      return;
    }
    this.currentRoom = newRoom;
    this.avatarSprite.container.setPosition(x, y);
    this.avatarX = x; this.avatarY = y;
    this.renderRoom(newRoom);
    this.updateCameraBounds();

    if (this.hudRoomLabel) {
      this.hudRoomLabel.setText(ROOMS[newRoom].name.toUpperCase());
      this.tweens.add({ targets: this.hudRoomLabel, alpha: { from: 0, to: 0.7 }, duration: 600 });
    }

    for (const [sid, remote] of this.remotes) { remote.destroy(); this.remotes.delete(sid); }
    for (const [sid, data] of this.remoteData) {
      if (sid === this.network.sessionId) continue;
      if (data.room !== newRoom) continue;
      this.remotes.set(
        sid,
        new RemotePlayer(this, data.x, data.y, data.displayName, data.avatarId)
      );
    }
  }

  private handleSpeakingChange(uid: string, speaking: boolean): void {
    if (this.destroyed) return;
    for (const [sid, data] of this.remoteData) {
      if (data.uid !== uid) continue;
      this.remotes.get(sid)?.setSpeaking(speaking);
      break;
    }
  }

  private showBanner(message: string): void {
    if (this.destroyed || !this.sys.isActive()) return;
    const banner = this.add
      .text(this.scale.width / 2, 90, message, {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '14px', color: '#f0856b',
        backgroundColor: 'rgba(13, 15, 26, 0.92)',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    this.tweens.add({
      targets: banner, alpha: 0, delay: 6000, duration: 800,
      onComplete: () => banner.destroy(),
    });
  }

  update(time: number, delta: number) {
    if (this.destroyed) return;

    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;

    if (vx === 0 && vy === 0) {
      const j = readJoystick();
      vx = j.x;
      vy = j.y;
    } else if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.SQRT2;
      vx *= inv;
      vy *= inv;
    }

    const step = (delta / 1000) * WALK_SPEED;
    let nextX = this.avatarX + vx * step;
    let nextY = this.avatarY + vy * step;

    const room = ROOMS[this.currentRoom];
    nextX = Math.max(AVATAR_RADIUS, Math.min(room.width - AVATAR_RADIUS, nextX));
    nextY = Math.max(AVATAR_RADIUS, Math.min(room.height - AVATAR_RADIUS, nextY));
    if (!isBlocked(this.currentRoom, nextX, this.avatarY, AVATAR_RADIUS)) this.avatarX = nextX;
    if (!isBlocked(this.currentRoom, this.avatarX, nextY, AVATAR_RADIUS)) this.avatarY = nextY;

    this.avatarSprite.container.setPosition(this.avatarX, this.avatarY);
    this.nameTag.setPosition(this.avatarX, this.avatarY - 38);

    const moving = Math.hypot(vx, vy) > 0.05;
    this.avatarSprite.setMoving(moving);
    if (Math.abs(vx) > 0.05) this.avatarSprite.setFacing(vx);

    this.remotes.forEach((r) => r.tick());

    const z = zoneAt(this.currentRoom, this.avatarX, this.avatarY);
    if (z !== this.currentZone) {
      this.currentZone = z ?? '';
      if (this.hudZoneLabel) {
        const name = z ? ZONE_NAMES[z] ?? '' : '';
        this.hudZoneLabel.setText(name ? `· ${name} ·` : '');
      }
    }

    if (time - this.lastSendAt >= SEND_INTERVAL_MS) {
      const dx = Math.abs(this.avatarX - this.lastSentX);
      const dy = Math.abs(this.avatarY - this.lastSentY);
      if (dx > MOVE_EPSILON || dy > MOVE_EPSILON) {
        this.network.sendMove(this.avatarX, this.avatarY);
        this.lastSentX = this.avatarX; this.lastSentY = this.avatarY;
        this.lastSendAt = time;
      }
    }

    if (time - this.lastAudibilityAt >= AUDIBILITY_TICK_MS) {
      this.lastAudibilityAt = time;
      if (this.voice.isConnected()) {
        const self = { room: this.currentRoom, x: this.avatarX, y: this.avatarY };
        for (const [sid, peer] of this.remoteData) {
          if (sid === this.network.sessionId) continue;
          this.voice.setAudibility(peer.uid, computeGain(self, peer));
        }
      }
    }
  }

  shutdown() {
    // Mark destroyed FIRST so any in-flight handlers bail before touching state.
    this.destroyed = true;

    this.network.disconnect();
    this.voice.disconnect();
    registerVoiceManager(null);

    this.remotes.forEach((r) => r.destroy());
    this.remotes.clear();
    this.remoteData.clear();

    this.roomRenderer?.destroy();
    this.roomRenderer = null;
    this.avatarSprite?.destroy();
    this.nameTag?.destroy();
  }
}
