import { useState } from 'react';
import type { ChatMessage } from '../../game/chat/types';
import { EmojiBadge } from './EmojiBadge';
import { QUICK_REACTIONS } from './emojis';

interface Props {
  message: ChatMessage;
  /** All current messages, so we can resolve replyToId to its target. */
  messages: ChatMessage[];
  myUid: string | null;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: ChatMessage) => void;
  onQuote: (message: ChatMessage) => void;
  onBump: (message: ChatMessage) => void;
  onOpenEmojiPicker: (messageId: string) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m}${ampm}`;
}

export function ChatMessageItem({
  message, messages, myUid,
  onReact, onReply, onQuote, onBump, onOpenEmojiPicker,
}: Props) {
  const [hovered, setHovered] = useState(false);

  if (message.kind === 'system') {
    return (
      <div className="chat-msg chat-msg--system">
        <span>→ {message.text}</span>
      </div>
    );
  }

  const isMe = myUid !== null && message.senderUid === myUid;

  // Resolve reply target if any.
  const replyTarget = message.replyToId
    ? messages.find((m) => m.id === message.replyToId) ?? null
    : null;

  return (
    <article
      className={`chat-msg ${isMe ? 'chat-msg--mine' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {replyTarget && (
        <div className="chat-msg__reply-preview">
          <span className="chat-msg__reply-arrow">↳</span>
          <span className="chat-msg__reply-name">{replyTarget.senderName}</span>
          <span className="chat-msg__reply-text">{replyTarget.text}</span>
        </div>
      )}

      <header className="chat-msg__header">
        <span className="chat-msg__name">{message.senderName}</span>
        <span className="chat-msg__time">{formatTime(message.timestamp)}</span>
        {message.kind === 'bump' && (
          <span className="chat-msg__bump-tag">⚡ bumped</span>
        )}
      </header>

      {message.kind === 'bump' ? (
        <div className="chat-msg__bump-body">
          <div className="chat-msg__quote">
            <div className="chat-msg__quote-meta">
              {message.quoteSenderName} · {formatTime(message.quoteTimestamp)}
            </div>
            <div className="chat-msg__quote-text">{message.text}</div>
          </div>
        </div>
      ) : message.kind === 'quote' ? (
        <>
          <div className="chat-msg__quote">
            <div className="chat-msg__quote-meta">
              {message.quoteSenderName} · {formatTime(message.quoteTimestamp)}
            </div>
            <div className="chat-msg__quote-text">{message.quoteText}</div>
          </div>
          <div className="chat-msg__body">{message.text}</div>
        </>
      ) : (
        <div className="chat-msg__body">{message.text}</div>
      )}

      {message.reactions.length > 0 && (
        <div className="chat-msg__reactions">
          {message.reactions.map((r) => {
            const reactedByMe = myUid !== null && r.users.includes(myUid);
            return (
              <button
                key={r.emoji}
                type="button"
                className={`reaction ${reactedByMe ? 'reaction--mine' : ''}`}
                onClick={() => onReact(message.id, r.emoji)}
                title={reactedByMe ? 'Remove your reaction' : 'Add reaction'}
              >
                <EmojiBadge id={r.emoji} size={14} />
                <span>{r.users.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {hovered && (
        <div className="chat-msg__actions">
          <div className="chat-msg__quick-reacts">
            {QUICK_REACTIONS.map((id) => (
              <button
                key={id}
                type="button"
                className="quick-react"
                onClick={() => onReact(message.id, id)}
                title="React"
              >
                <EmojiBadge id={id} size={16} />
              </button>
            ))}
            <button
              type="button"
              className="quick-react quick-react--more"
              onClick={() => onOpenEmojiPicker(message.id)}
              title="More reactions"
              aria-label="More reactions"
            >+</button>
          </div>
          <div className="chat-msg__buttons">
            <button type="button" onClick={() => onReply(message)} title="Reply">↪</button>
            <button type="button" onClick={() => onQuote(message)} title="Quote">❝</button>
            <button type="button" onClick={() => onBump(message)} title="Bump">⚡</button>
          </div>
        </div>
      )}
    </article>
  );
}
