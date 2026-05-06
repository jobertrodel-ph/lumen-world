import type { ChatMessage } from './types';

/**
 * The chat bridge is a shared module that React and Phaser both touch.
 *
 * - The Colyseus state listener in WorldScene calls applyMessage / clearAll.
 * - WorldScene also keeps `currentRoom` and `currentZone` in sync here so
 *   the React panel knows what scope is currently filterable.
 * - React reads via subscribe() and renders.
 */

interface BridgeState {
  messages: ChatMessage[];
  currentRoom: string;
  currentZone: string;
}

const state: BridgeState = {
  messages: [],
  currentRoom: 'rooftop',
  currentZone: '',
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getMessages(): ChatMessage[] {
  return state.messages;
}

export function getLocation(): { room: string; zone: string } {
  return { room: state.currentRoom, zone: state.currentZone };
}

/**
 * Replace the full message list. Called whenever Colyseus sends a state
 * update for the chat array. We rebuild rather than diff because the
 * array order matters and is small (50 max).
 */
export function setMessages(messages: ChatMessage[]): void {
  state.messages = messages;
  notify();
}

export function setLocation(room: string, zone: string): void {
  if (state.currentRoom === room && state.currentZone === zone) return;
  state.currentRoom = room;
  state.currentZone = zone;
  notify();
}

// ---- Outgoing actions: WorldScene registers handlers, React calls them.

export interface ChatActions {
  send: (text: string, scope: string, options?: { replyToId?: string; quoteOfId?: string }) => void;
  react: (messageId: string, emoji: string) => void;
  bump: (messageId: string) => void;
}

let actions: ChatActions | null = null;

export function registerChatActions(a: ChatActions | null): void {
  actions = a;
}

export function getChatActions(): ChatActions | null {
  return actions;
}
