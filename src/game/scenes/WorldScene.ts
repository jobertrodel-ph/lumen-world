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
import { ROOMS, RoomId, isBlocked, ZONE_NAMES } from '../../shared/world-helpers';
import { readJoystick } from '../input/inputBridge';
import { registerChatActions, setLocation, setMessages } from '../chat/chatBridge';
import type { ChatMessage } from '../chat/types';
import { findPath } from '../movement/pathfinding';
import { getActiveSettings, subscribeSettings } from '../../shared/settings';

const WALK_SPEED = 220;
const AVATAR_RADIUS = 20;
const SEND_INTERVAL_MS = 50;
const MOVE_EPSILON = 0.5;
const AUDIBILITY_TICK_MS = 200;
const WAYPOINT_REACHED_DIST = 6;

// Throttle drag-issue: while right-button is held and pointer is moving, we
// re-issue at most this often. Keeps A* costs bounded if the user sweeps
// the cursor wildly. 80ms (~12hz) feels responsive without being wasteful.
const DRAG_REISSUE_MS = 80;

interface ArrowKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
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
  private arrowKeys!: ArrowKeys;

  private network = new NetworkManager();
  private voice = new VoiceManager();

  private remotes = new Map<string, RemotePlayer>();
  private remoteData = new Map<string, RemotePlayerData>();

  private currentRoom: RoomId = 'rooftop';
  private roomRenderer: RoomRenderer | null = null;
  private destroyed = false;

  private lastSendAt = 0;
  private lastSentX = -Infinity;
  private lastSentY = -Infinity;
  private lastAudibilityAt = 0;

  private hudRoomLabel?: Phaser.GameObjects.Text;
  private hudRoomSubtitle?: Phaser.GameObjects.Text;
  private hudZoneLabel?: Phaser.GameObjects.Text;
  private currentZone = '';

  // Pathfinding state
  private currentPath: Array<{ x: number; y: number }> = [];
  private pathIndex = 0;
  private destIndicator: Phaser.GameObjects.Container | null = null;
  private destIndicatorTween: Phaser.Tweens.Tween | null = null;

  // Right-button drag state
  private rightButtonHeld = false;
  private lastDragIssueAt = 0;

  private settingsUnsubscribe: (() => void) | null = null;

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
        color: '#f0ece4',
        backgroundColor: 'rgba(7, 9, 15, 0.78)',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.updateCameraBounds();
    this.cameras.main.startFollow(this.avatarSprite.container, true, 0.12, 0.12);
    this.applyResponsiveZoom();
    this.scale.on('resize', () => this.applyResponsiveZoom());

    this.arrowKeys = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };

    // Right-click + drag movement system.
    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.rightButtonHeld = true;
        this.lastDragIssueAt = this.time.now;
        this.handleClickToMove(pointer.worldX, pointer.worldY);
      }
    });

    // While the right button is held, re-issue on every meaningful move.
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.rightButtonHeld) return;
      // Phaser also clears button state if the OS thinks it's released.
      if (!pointer.rightButtonDown()) {
        this.rightButtonHeld = false;
        return;
      }
      const now = this.time.now;
      if (now - this.lastDragIssueAt < DRAG_REISSUE_MS) return;
      this.lastDragIssueAt = now;
      this.handleClickToMove(pointer.worldX, pointer.worldY);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Right released → stop drag-tracking. We don't cancel the path —
      // the avatar finishes walking to the last destination set.
      if (pointer.button === 2 || !pointer.rightButtonDown()) {
        this.rightButtonHeld = false;
      }
    });

    // Edge case: pointer leaves the game canvas while held → end the drag.
    this.input.on('pointerout', () => {
      this.rightButtonHeld = false;
    });

    this.makeRoomHud();

    setLocation(this.currentRoom, this.currentZone);
    setActiveSettingsListener(this);

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
          onSelfZoneChange: (zone) => this.handleSelfZoneChange(zone),
          onChatChanged: (messages: ChatMessage[]) => setMessages(messages),
          onError: (msg) => this.showBanner(msg),
        },
      })
      .then(() => {
        if (this.destroyed) return;
        registerChatActions({
          send: (text, scope, opts) => this.network.sendChat(text, scope, opts),
          react: (id, emoji) => this.network.reactChat(id, emoji),
          bump: (id) => this.network.bumpChat(id),
        });
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
    this.cameras.main.setBackgroundColor('#07090f');
  }

  private updateCameraBounds(): void {
    const r = ROOMS[this.currentRoom];
    this.cameras.main.setBounds(0, 0, r.width, r.height);
  }

  private makeRoomHud(): void {
    const r = ROOMS[this.currentRoom];
    this.hudRoomLabel = this.add
      .text(this.scale.width / 2, 28, r.name.toUpperCase(), {
        fontFamily: '"Noto Serif SC", "Fraunces", serif',
        fontSize: '15px', color: '#f0ece4',
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1000).setAlpha(0.75);

    this.hudRoomSubtitle = this.add
      .text(this.scale.width / 2, 50, r.subtitle, {
        fontFamily: '"Noto Serif SC", serif',
        fontSize: '12px', color: '#7fc4a3',
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1000).setAlpha(0.65);

    this.hudZoneLabel = this.add
      .text(this.scale.width / 2, 72, '', {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '11px', color: '#9a9488',
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1000);
  }

  private updateRoomHud(roomId: RoomId): void {
    if (!this.hudRoomLabel || !this.hudRoomSubtitle) return;
    const r = ROOMS[roomId];
    this.hudRoomLabel.setText(r.name.toUpperCase());
    this.hudRoomSubtitle.setText(r.subtitle);
    this.tweens.add({
      targets: [this.hudRoomLabel, this.hudRoomSubtitle],
      alpha: { from: 0, to: 0.75 },
      duration: 700,
    });
  }

  private handleClickToMove(worldX: number, worldY: number): void {
    if (this.destroyed) return;
    if (getActiveSettings().movementMode === 'arrows') return;

    const path = findPath(this.currentRoom, this.avatarX, this.avatarY, worldX, worldY);
    if (!path || path.length === 0) {
      this.flashIndicator(worldX, worldY, 0xc84848);
      return;
    }

    this.currentPath = path;
    this.pathIndex = 0;
    this.placeDestIndicator(path[path.length - 1].x, path[path.length - 1].y);
  }

  private placeDestIndicator(x: number, y: number): void {
    this.clearDestIndicator();
    const container = this.add.container(x, y).setDepth(5);
    const outer = this.add.circle(0, 0, 18, 0x7fc4a3, 0.0);
    outer.setStrokeStyle(2, 0x7fc4a3, 0.85);
    const dot = this.add.circle(0, 0, 4, 0x7fc4a3, 0.95);
    container.add([outer, dot]);
    this.destIndicator = container;
    this.destIndicatorTween = this.tweens.add({
      targets: outer,
      scale: { from: 0.6, to: 1.4 },
      alpha: { from: 1, to: 0 },
      duration: 900,
      ease: 'Sine.out',
      repeat: -1,
    });
  }

  private flashIndicator(x: number, y: number, color: number): void {
    const ring = this.add.circle(x, y, 18, color, 0).setDepth(5);
    ring.setStrokeStyle(2, color, 0.9);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.6, to: 1.5 },
      alpha: { from: 0.9, to: 0 },
      duration: 500,
      ease: 'Sine.out',
      onComplete: () => ring.destroy(),
    });
  }

  private clearDestIndicator(): void {
    this.destIndicatorTween?.stop();
    this.destIndicatorTween = null;
    this.destIndicator?.destroy();
    this.destIndicator = null;
  }

  private cancelPath(): void {
    this.currentPath = [];
    this.pathIndex = 0;
    this.clearDestIndicator();
  }

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
    this.cancelPath();
    this.renderRoom(newRoom);
    this.updateCameraBounds();
    this.updateRoomHud(newRoom);
    setLocation(newRoom, this.currentZone);

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

  private handleSelfZoneChange(zone: string): void {
    if (this.destroyed) return;
    this.currentZone = zone;
    setLocation(this.currentRoom, zone);
    if (this.hudZoneLabel) {
      const name = zone ? ZONE_NAMES[zone] ?? '' : '';
      this.hudZoneLabel.setText(name ? `· ${name} ·` : '');
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
      .text(this.scale.width / 2, 110, message, {
        fontFamily: '"General Sans", system-ui, sans-serif',
        fontSize: '14px', color: '#e88a6a',
        backgroundColor: 'rgba(7, 9, 15, 0.92)',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(1000);
    this.tweens.add({
      targets: banner, alpha: 0, delay: 6000, duration: 800,
      onComplete: () => banner.destroy(),
    });
  }

  private isTyping(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      (active as HTMLElement).isContentEditable
    );
  }

  update(time: number, delta: number) {
    if (this.destroyed) return;

    const settings = getActiveSettings();
    const typing = this.isTyping();
    const stepSize = (delta / 1000) * WALK_SPEED;

    let vx = 0, vy = 0;

    if (!typing) {
      if (this.arrowKeys.left.isDown) vx -= 1;
      if (this.arrowKeys.right.isDown) vx += 1;
      if (this.arrowKeys.up.isDown) vy -= 1;
      if (this.arrowKeys.down.isDown) vy += 1;
    }

    if (vx !== 0 || vy !== 0) {
      if (this.currentPath.length > 0) this.cancelPath();
    }

    if (vx === 0 && vy === 0) {
      const j = readJoystick();
      if (j.x !== 0 || j.y !== 0) {
        if (this.currentPath.length > 0) this.cancelPath();
        vx = j.x;
        vy = j.y;
      }
    } else if (vx !== 0 && vy !== 0) {
      const inv = 1 / Math.SQRT2;
      vx *= inv;
      vy *= inv;
    }

    if (vx === 0 && vy === 0 && this.currentPath.length > 0 && settings.movementMode === 'click') {
      const next = this.currentPath[this.pathIndex];
      const dx = next.x - this.avatarX;
      const dy = next.y - this.avatarY;
      const dist = Math.hypot(dx, dy);

      if (dist <= WAYPOINT_REACHED_DIST || dist <= stepSize) {
        this.avatarX = next.x;
        this.avatarY = next.y;
        this.pathIndex++;
        if (this.pathIndex >= this.currentPath.length) {
          this.cancelPath();
        }
      } else {
        const move = stepSize / dist;
        const nextX = this.avatarX + dx * move;
        const nextY = this.avatarY + dy * move;
        if (!isBlocked(this.currentRoom, nextX, this.avatarY, AVATAR_RADIUS)) {
          this.avatarX = nextX;
        }
        if (!isBlocked(this.currentRoom, this.avatarX, nextY, AVATAR_RADIUS)) {
          this.avatarY = nextY;
        }
      }
    } else if (vx !== 0 || vy !== 0) {
      const nextX = this.avatarX + vx * stepSize;
      const nextY = this.avatarY + vy * stepSize;
      const room = ROOMS[this.currentRoom];
      const clampedX = Math.max(AVATAR_RADIUS, Math.min(room.width - AVATAR_RADIUS, nextX));
      const clampedY = Math.max(AVATAR_RADIUS, Math.min(room.height - AVATAR_RADIUS, nextY));
      if (!isBlocked(this.currentRoom, clampedX, this.avatarY, AVATAR_RADIUS)) this.avatarX = clampedX;
      if (!isBlocked(this.currentRoom, this.avatarX, clampedY, AVATAR_RADIUS)) this.avatarY = clampedY;
    }

    this.avatarSprite.container.setPosition(this.avatarX, this.avatarY);
    this.nameTag.setPosition(this.avatarX, this.avatarY - 38);

    const dxThisFrame = this.avatarX - this.lastSentX;
    const dyThisFrame = this.avatarY - this.lastSentY;
    const moving = Math.hypot(dxThisFrame, dyThisFrame) > 0.5 ||
      vx !== 0 || vy !== 0 ||
      this.currentPath.length > 0;
    this.avatarSprite.setMoving(moving);
    if (Math.abs(dxThisFrame) > 0.1) this.avatarSprite.setFacing(dxThisFrame);
    else if (Math.abs(vx) > 0.05) this.avatarSprite.setFacing(vx);

    this.remotes.forEach((r) => r.tick());

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
    this.destroyed = true;
    registerChatActions(null);
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
    this.clearDestIndicator();
    this.settingsUnsubscribe?.();
    this.settingsUnsubscribe = null;
  }
}

function setActiveSettingsListener(scene: WorldScene): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = scene as any;
  s.settingsUnsubscribe = subscribeSettings((settings) => {
    if (settings.movementMode === 'arrows') {
      if (s.currentPath?.length > 0) {
        s.currentPath = [];
        s.pathIndex = 0;
        s.clearDestIndicator?.();
      }
    }
  });
}
