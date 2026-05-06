/**
 * Chat type definitions — mirror the server's ChatMessage schema fields
 * that clients care about. Kept loose (interface, not generated) for now.
 */

export type ChatKind = 'message' | 'system' | 'quote' | 'bump';

export interface ChatReaction {
  emoji: string;
  users: string[];
}

export interface ChatMessage {
  id: string;
  kind: ChatKind;
  scope: string;
  senderUid: string;
  senderName: string;
  senderAvatarId: string;
  text: string;
  timestamp: number;
  replyToId: string;
  quoteText: string;
  quoteSenderName: string;
  quoteTimestamp: number;
  bumpedFromId: string;
  reactions: ChatReaction[];
}

export type ChatScope = 'room' | 'zone';
