import { Client, Room, getStateCallbacks } from 'colyseus.js';

export interface RemotePlayerState {
  uid: string;
  displayName: string;
  photoURL: string;
  avatarId: string;
  room: string;
  zone: string;
  x: number;
  y: number;
}

export interface NetworkHandlers {
  onPlayerAdd: (sessionId: string, player: RemotePlayerState) => void;
  onPlayerRemove: (sessionId: string) => void;
  onPlayerMove: (sessionId: string, x: number, y: number) => void;
  onPlayerRoomChange: (sessionId: string, room: string) => void;
  onSelfRoomChange: (room: string, x: number, y: number) => void;
  onError: (message: string) => void;
}

interface JoinOptions {
  serverUrl: string;
  idToken: string;
  avatarId: string;
  handlers: NetworkHandlers;
}

export class NetworkManager {
  private client: Client | null = null;
  private room: Room | null = null;
  private handlers: NetworkHandlers | null = null;

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  async connect({ serverUrl, idToken, avatarId, handlers }: JoinOptions): Promise<void> {
    this.handlers = handlers;
    this.client = new Client(serverUrl);

    try {
      this.room = await this.client.joinOrCreate('world', { token: idToken, avatarId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join world';
      handlers.onError(msg);
      throw err;
    }

    await this.waitForFirstSync();
    this.bindRoomEvents();
  }

  sendMove(x: number, y: number): void {
    this.room?.send('move', { x, y });
  }

  setAvatar(avatarId: string): void {
    this.room?.send('setAvatar', { avatarId });
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
    this.client = null;
    this.handlers = null;
  }

  private waitForFirstSync(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.room) return resolve();
      this.room.onStateChange.once(() => resolve());
    });
  }

  private bindRoomEvents(): void {
    if (!this.room || !this.handlers) return;
    const handlers = this.handlers;
    const ownSessionId = this.room.sessionId;
    const $ = getStateCallbacks(this.room);

    $(this.room.state).players.onAdd((player: RemotePlayerState, sessionId: string) => {
      handlers.onPlayerAdd(sessionId, {
        uid: player.uid,
        displayName: player.displayName,
        photoURL: player.photoURL,
        avatarId: player.avatarId,
        room: player.room,
        zone: player.zone,
        x: player.x,
        y: player.y,
      });

      $(player).listen('x', (value: number) => {
        handlers.onPlayerMove(sessionId, value, player.y);
      });
      $(player).listen('y', (value: number) => {
        handlers.onPlayerMove(sessionId, player.x, value);
      });
      $(player).listen('room', (newRoom: string) => {
        if (sessionId === ownSessionId) {
          handlers.onSelfRoomChange(newRoom, player.x, player.y);
        } else {
          handlers.onPlayerRoomChange(sessionId, newRoom);
        }
      });
    });

    $(this.room.state).players.onRemove((_player: unknown, sessionId: string) => {
      handlers.onPlayerRemove(sessionId);
    });

    this.room.onError((code, message) => {
      handlers.onError(`Room error ${code}: ${message ?? 'unknown'}`);
    });

    this.room.onLeave((code) => {
      if (code !== 1000) {
        handlers.onError(`Disconnected (${code}). Refresh to reconnect.`);
      }
    });
  }
}
