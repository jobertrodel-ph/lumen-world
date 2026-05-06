import { Client, Room, getStateCallbacks } from 'colyseus.js';
import type { ChatMessage } from '../chat/types';

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
  onSelfZoneChange: (zone: string) => void;
  onChatChanged: (messages: ChatMessage[]) => void;
  onError: (message: string) => void;
}

interface JoinOptions {
  serverUrl: string;
  idToken: string;
  avatarId: string;
  handlers: NetworkHandlers;
}

interface SendChatOptions {
  replyToId?: string;
  quoteOfId?: string;
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
    // Push initial chat snapshot to client.
    handlers.onChatChanged(this.snapshotChat());
  }

  sendMove(x: number, y: number): void {
    this.room?.send('move', { x, y });
  }

  setAvatar(avatarId: string): void {
    this.room?.send('setAvatar', { avatarId });
  }

  // --- chat ---

  sendChat(text: string, scope: string, options?: SendChatOptions): void {
    this.room?.send('chat:send', {
      text,
      scope,
      replyToId: options?.replyToId,
      quoteOfId: options?.quoteOfId,
    });
  }

  reactChat(messageId: string, emoji: string): void {
    this.room?.send('chat:react', { messageId, emoji });
  }

  bumpChat(messageId: string): void {
    this.room?.send('chat:bump', { messageId });
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

  /**
   * Convert the live ArraySchema of chat messages into plain JS objects
   * the React layer can consume.
   */
  private snapshotChat(): ChatMessage[] {
    if (!this.room) return [];
    const out: ChatMessage[] = [];
    for (const m of this.room.state.chat) {
      out.push({
        id: m.id,
        kind: m.kind,
        scope: m.scope,
        senderUid: m.senderUid,
        senderName: m.senderName,
        senderAvatarId: m.senderAvatarId,
        text: m.text,
        timestamp: m.timestamp,
        replyToId: m.replyToId,
        quoteText: m.quoteText,
        quoteSenderName: m.quoteSenderName,
        quoteTimestamp: m.quoteTimestamp,
        bumpedFromId: m.bumpedFromId,
        reactions: m.reactions.map((r: { emoji: string; users: string[] }) => ({
          emoji: r.emoji,
          users: [...r.users],
        })),
      });
    }
    return out;
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
      // Track our own zone changes for chat scope.
      if (sessionId === ownSessionId) {
        $(player).listen('zone', (newZone: string) => {
          handlers.onSelfZoneChange(newZone);
        });
      }
    });

    $(this.room.state).players.onRemove((_player: unknown, sessionId: string) => {
      handlers.onPlayerRemove(sessionId);
    });

    // Chat — re-snapshot whenever the array or any nested message field changes.
    // Cheap because it's bounded to 50 entries.
    const refreshChat = () => handlers.onChatChanged(this.snapshotChat());

    $(this.room.state).chat.onAdd((msg: any) => {
      refreshChat();
      // Also listen for in-place changes on this specific message.
      $(msg).listen('text', refreshChat);
      $(msg).reactions.onAdd((reaction: any) => {
        refreshChat();
        $(reaction).users.onAdd(refreshChat);
        $(reaction).users.onRemove(refreshChat);
      });
      $(msg).reactions.onRemove(refreshChat);
    });
    $(this.room.state).chat.onRemove(refreshChat);

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
