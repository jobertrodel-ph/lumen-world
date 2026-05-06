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
import { getEmoji } from './emojis';

export interface ChatPanelHandle {
  toggle: () => void;
  isInputFocused: () => boolean;
  isInputEmpty: () => boolean;
  isOpen: () => boolean;
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
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [composerPickerOpen, setComposerPickerOpen] = useState(false);

  // Last-seen-id tracker, used to compute unread counters per scope.
  // We track separately for room and zone, plus an overall (collapsed) counter.
  const [lastSeenIds, setLastSeenIds] = useState<{ collapsed: string | null; room: string | null; zone: string | null }>({
    collapsed: null, room: null, zone: null,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Subscribe to bridge updates.
  useEffect(() => {
    setMessages(getMessages());
    setLocation(getLocation());
    return subscribe(() => {
      setMessages(getMessages());
      setLocation(getLocation());
    });
  }, []);

  // Auto-scroll to bottom on new messages, only if user is already near bottom.
  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const distFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (distFromBottom < 120) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages.length]);

  // When panel opens, mark "collapsed unread" as read, scroll, focus input.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        inputRef.current?.focus();
      });
      // Mark all current visible-scope messages as read for the active tab.
      markScopeAsRead(scopeMode);
      // Mark collapsed as read entirely.
      const lastMsg = messages[messages.length - 1];
      setLastSeenIds((prev) => ({ ...prev, collapsed: lastMsg ? lastMsg.id : null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Mark active tab as read whenever it changes (or new messages arrive in it).
  // Effect below; depends on filtered messages.

  // Snap back to room tab if user leaves their zone.
  useEffect(() => {
    if (!location.zone && scopeMode === 'zone') {
      setScopeMode('room');
    }
  }, [location.zone, scopeMode]);

  // Click outside: if the user clicks anywhere outside the panel
  // while the input has focus, blur the input (keeping panel open).
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target as Node)) return;
      // Click outside the panel: blur input if focused.
      if (document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // Compute filtered messages per scope, plus unread counts.
  const { roomMessages, zoneMessages, visibleMessages } = useMemo(() => {
    const roomKey = `room:${location.room}`;
    const zoneKey = location.zone ? `zone:${location.zone}` : null;

    const room: ChatMessage[] = [];
    const zone: ChatMessage[] = [];

    for (const m of messages) {
      if (m.kind === 'system') {
        if (m.scope === roomKey) room.push(m);
        continue;
      }
      if (m.scope === roomKey) room.push(m);
      if (zoneKey && m.scope === zoneKey) zone.push(m);
    }

    const visible = scopeMode === 'zone' && zoneKey ? zone : room;
    return { roomMessages: room, zoneMessages: zone, visibleMessages: visible };
  }, [messages, scopeMode, location]);

  /**
   * Count messages in a scope that came after the last-seen id, excluding
   * the current user's own messages.
   */
  const countUnread = useCallback(
    (list: ChatMessage[], lastSeenId: string | null): number => {
      if (list.length === 0) return 0;
      let startIdx = 0;
      if (lastSeenId) {
        const idx = list.findIndex((m) => m.id === lastSeenId);
        startIdx = idx >= 0 ? idx + 1 : 0;
      }
      let count = 0;
      for (let i = startIdx; i < list.length; i++) {
        const m = list[i];
        if (m.kind === 'system') { count++; continue; }
        if (user && m.senderUid === user.uid) continue;
        count++;
      }
      return count;
    },
    [user]
  );

  const collapsedUnread = countUnread(messages.filter((m) => {
    // Only messages that *would* be visible to the user count toward collapsed.
    if (m.kind === 'system') return m.scope === `room:${location.room}`;
    return m.scope === `room:${location.room}` ||
      (location.zone && m.scope === `zone:${location.zone}`);
  }), lastSeenIds.collapsed);

  const roomUnread = countUnread(roomMessages, lastSeenIds.room);
  const zoneUnread = location.zone ? countUnread(zoneMessages, lastSeenIds.zone) : 0;

  // Mark scope as read when active.
  function markScopeAsRead(scope: 'room' | 'zone') {
    const list = scope === 'zone' ? zoneMessages : roomMessages;
    const last = list[list.length - 1];
    setLastSeenIds((prev) => ({ ...prev, [scope]: last ? last.id : prev[scope] }));
  }

  // Whenever new messages arrive while the panel is open, mark the current
  // active tab as read.
  useEffect(() => {
    if (!open) return;
    markScopeAsRead(scopeMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scopeMode, visibleMessages.length]);

  // ----- Imperative API

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
      sendCurrentInput();
    }
  };

  const handleReact = (messageId: string, emoji: string) => {
    getChatActions()?.react(messageId, emoji);
    setReactionPickerFor(null);
  };

  const handleBump = (message: ChatMessage) => {
    getChatActions()?.bump(message.id);
  };

  const handleInsertEmoji = (emojiId: string) => {
    const emoji = getEmoji(emojiId);
    if (!emoji) return;
    setInput((prev) => prev + emoji.char);
    setComposerPickerOpen(false);
    inputRef.current?.focus();
  };

  const switchScope = (mode: 'room' | 'zone') => {
    setScopeMode(mode);
    markScopeAsRead(mode);
  };

  return (
    <>
      {/* Collapsed-state floating arrow with unread badge. Only shows when panel is closed. */}
      {!open && (
        <button
          type="button"
          className="chat-tab-handle"
          aria-label={`Open chat${collapsedUnread > 0 ? `, ${collapsedUnread} new` : ''}`}
          onClick={() => setOpen(true)}
        >
          <span className="chat-tab-handle__arrow" aria-hidden="true">‹</span>
          {collapsedUnread > 0 && (
            <span className="chat-tab-handle__badge" aria-hidden="true">
              {collapsedUnread > 99 ? '99+' : collapsedUnread}
            </span>
          )}
        </button>
      )}

      <aside
        ref={panelRef}
        className={`chat-panel ${open ? 'chat-panel--open' : ''}`}
        aria-hidden={!open}
        onClick={() => {
          if (reactionPickerFor) setReactionPickerFor(null);
          if (composerPickerOpen) setComposerPickerOpen(false);
        }}
      >
        <header className="chat-panel__header">
          <div className="chat-panel__tabs" role="tablist">
            <button
              role="tab"
              aria-selected={scopeMode === 'room'}
              className={`chat-tab ${scopeMode === 'room' ? 'chat-tab--active' : ''}`}
              onClick={() => switchScope('room')}
            >
              Room
              {scopeMode !== 'room' && roomUnread > 0 && (
                <span className="chat-tab__badge">{roomUnread > 99 ? '99+' : roomUnread}</span>
              )}
            </button>
            <button
              role="tab"
              aria-selected={scopeMode === 'zone'}
              className={`chat-tab ${scopeMode === 'zone' ? 'chat-tab--active' : ''}`}
              disabled={!location.zone}
              onClick={() => switchScope('zone')}
              title={location.zone ? 'Zone-only chat' : 'Walk into a zone to enable'}
            >
              Zone
              {scopeMode !== 'zone' && zoneUnread > 0 && (
                <span className="chat-tab__badge">{zoneUnread > 99 ? '99+' : zoneUnread}</span>
              )}
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
              {scopeMode === 'zone' ? 'No messages in this zone yet.' : 'No messages yet. Say hi.'}
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
                onOpenEmojiPicker={(id) => setReactionPickerFor(id)}
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
              scopeMode === 'zone' && location.zone ? 'Message in zone…' : 'Message in room…'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            maxLength={500}
          />
          <button
            type="button"
            className="chat-emoji-btn"
            onClick={(e) => { e.stopPropagation(); setComposerPickerOpen((o) => !o); }}
            title="Insert emoji"
            aria-label="Insert emoji"
          >
            <SmileyIcon />
          </button>
          <button
            type="button"
            className="chat-send"
            onClick={sendCurrentInput}
            disabled={input.trim().length === 0}
            aria-label="Send"
          >Send</button>
        </div>

        {/* Reaction picker (overlays the panel for picking a reaction emoji) */}
        {reactionPickerFor && (
          <div className="chat-panel__emoji-overlay">
            <EmojiPicker
              title="React with…"
              onPick={(emojiId) => handleReact(reactionPickerFor, emojiId)}
              onClose={() => setReactionPickerFor(null)}
            />
          </div>
        )}

        {/* Composer emoji picker (inserts into input text) */}
        {composerPickerOpen && (
          <div className="chat-panel__emoji-overlay">
            <EmojiPicker
              title="Insert emoji"
              onPick={handleInsertEmoji}
              onClose={() => setComposerPickerOpen(false)}
            />
          </div>
        )}
      </aside>
    </>
  );
});

ChatPanel.displayName = 'ChatPanel';

function SmileyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path d="M8 14a4 4 0 0 0 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
