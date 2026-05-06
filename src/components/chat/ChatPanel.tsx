import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  getChatActions,
  getLocation,
  getMessages,
  subscribe,
} from '../../game/chat/chatBridge';
import type { ChatMessage } from '../../game/chat/types';
import { ChatMessageItem } from './ChatMessageItem';
import { EmojiPicker } from './EmojiPicker';

export interface ChatPanelHandle {
  /** Toggle visibility. Called from the keyboard hook. */
  toggle: () => void;
  /** True if the input currently has focus. */
  isInputFocused: () => boolean;
  /** True if the input is empty. Used to detect "press Enter to close". */
  isInputEmpty: () => boolean;
  /** True if the panel is currently open. */
  isOpen: () => boolean;
  /** Submit the current input (if any). */
  submit: () => void;
}

export const ChatPanel = forwardRef<ChatPanelHandle>((_props, ref) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scopeMode, setScopeMode] = useState<'room' | 'zone'>('room');
  const [location, setLocation] = useState(() => getLocation());
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [quoteOf, setQuoteOf] = useState<ChatMessage | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Subscribe to bridge updates.
  useEffect(() => {
    setMessages(getMessages());
    setLocation(getLocation());
    return subscribe(() => {
      setMessages(getMessages());
      setLocation(getLocation());
    });
  }, []);

  // Auto-scroll to bottom on new messages, but only if user is already near
  // the bottom — avoid yanking them away if they're scrolled up reading.
  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const distFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (distFromBottom < 120) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages.length]);

  // When panel opens, scroll to bottom + focus input.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // If user moves into a zone and they had it set, the zone tab becomes
  // available; if they leave a zone, snap back to room.
  useEffect(() => {
    if (!location.zone && scopeMode === 'zone') {
      setScopeMode('room');
    }
  }, [location.zone, scopeMode]);

  // Compute filtered messages based on scope toggle.
  const visibleMessages = useMemo(() => {
    const roomKey = `room:${location.room}`;
    const zoneKey = location.zone ? `zone:${location.zone}` : null;

    return messages.filter((m) => {
      // System messages always visible to everyone in the room they target.
      if (m.kind === 'system') return m.scope === roomKey;
      if (scopeMode === 'zone' && zoneKey) {
        return m.scope === zoneKey;
      }
      // Room mode shows room-scoped messages + your own zone messages,
      // so you can see what you sent without toggling.
      return m.scope === roomKey || m.scope === zoneKey;
    });
  }, [messages, scopeMode, location]);

  // ----- Imperative API exposed to keyboard handler

  useImperativeHandle(ref, () => ({
    toggle: () => setOpen((prev) => !prev),
    isInputFocused: () => document.activeElement === inputRef.current,
    isInputEmpty: () => input.trim().length === 0,
    isOpen: () => open,
    submit: () => sendCurrentInput(),
  }));

  const sendCurrentInput = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const actions = getChatActions();
    if (!actions) return;

    // Determine the scope to send with: must be a real scope id.
    const zoneScope = location.zone ? `zone:${location.zone}` : null;
    const roomScope = `room:${location.room}`;
    const scope = scopeMode === 'zone' && zoneScope ? zoneScope : roomScope;

    actions.send(text, scope, {
      replyToId: replyTo?.id,
      quoteOfId: quoteOf?.id,
    });

    setInput('');
    setReplyTo(null);
    setQuoteOf(null);
  }, [input, scopeMode, location, replyTo, quoteOf]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // The keyboard hook also handles Enter; we let that fire and call submit
      // via the imperative API, so we just stop the event from bubbling here.
      sendCurrentInput();
    }
  };

  const handleReact = (messageId: string, emoji: string) => {
    getChatActions()?.react(messageId, emoji);
    setEmojiPickerFor(null);
  };

  const handleBump = (message: ChatMessage) => {
    getChatActions()?.bump(message.id);
  };

  return (
    <aside
      className={`chat-panel ${open ? 'chat-panel--open' : ''}`}
      aria-hidden={!open}
      onClick={() => emojiPickerFor && setEmojiPickerFor(null)}
    >
      <header className="chat-panel__header">
        <div className="chat-panel__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={scopeMode === 'room'}
            className={`chat-tab ${scopeMode === 'room' ? 'chat-tab--active' : ''}`}
            onClick={() => setScopeMode('room')}
          >
            Room
          </button>
          <button
            role="tab"
            aria-selected={scopeMode === 'zone'}
            className={`chat-tab ${scopeMode === 'zone' ? 'chat-tab--active' : ''}`}
            disabled={!location.zone}
            onClick={() => setScopeMode('zone')}
            title={location.zone ? 'Zone-only chat' : 'Walk into a zone to enable'}
          >
            Zone
          </button>
        </div>
        <button
          className="chat-panel__close"
          type="button"
          aria-label="Close chat"
          onClick={() => setOpen(false)}
        >×</button>
      </header>

      <div className="chat-panel__list" ref={listRef}>
        {visibleMessages.length === 0 ? (
          <div className="chat-panel__empty">
            {scopeMode === 'zone'
              ? 'No messages in this zone yet.'
              : 'No messages yet. Say hi.'}
          </div>
        ) : (
          visibleMessages.map((m) => (
            <ChatMessageItem
              key={m.id}
              message={m}
              messages={messages}
              myUid={user?.uid ?? null}
              onReact={handleReact}
              onReply={(target) => { setReplyTo(target); setQuoteOf(null); inputRef.current?.focus(); }}
              onQuote={(target) => { setQuoteOf(target); setReplyTo(null); inputRef.current?.focus(); }}
              onBump={handleBump}
              onOpenEmojiPicker={(id) => setEmojiPickerFor(id)}
            />
          ))
        )}
      </div>

      {(replyTo || quoteOf) && (
        <div className="chat-composer-meta">
          {replyTo && (
            <>
              <span className="chat-composer-meta__label">↪ Replying to</span>
              <span className="chat-composer-meta__name">{replyTo.senderName}</span>
              <span className="chat-composer-meta__text">{replyTo.text}</span>
            </>
          )}
          {quoteOf && (
            <>
              <span className="chat-composer-meta__label">❝ Quoting</span>
              <span className="chat-composer-meta__name">{quoteOf.senderName}</span>
              <span className="chat-composer-meta__text">{quoteOf.text}</span>
            </>
          )}
          <button
            type="button"
            className="chat-composer-meta__cancel"
            onClick={() => { setReplyTo(null); setQuoteOf(null); }}
            aria-label="Cancel"
          >×</button>
        </div>
      )}

      <div className="chat-panel__compose">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder={
            scopeMode === 'zone' && location.zone
              ? `Message in zone…`
              : `Message in room…`
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          maxLength={500}
        />
        <button
          type="button"
          className="chat-send"
          onClick={sendCurrentInput}
          disabled={input.trim().length === 0}
          aria-label="Send"
        >Send</button>
      </div>

      {emojiPickerFor && (
        <div className="chat-panel__emoji-overlay">
          <EmojiPicker
            onPick={(emojiId) => handleReact(emojiPickerFor, emojiId)}
            onClose={() => setEmojiPickerFor(null)}
          />
        </div>
      )}
    </aside>
  );
});

ChatPanel.displayName = 'ChatPanel';
