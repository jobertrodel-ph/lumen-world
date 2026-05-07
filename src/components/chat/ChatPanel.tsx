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
  /** Open if closed, focus the input either way. */
  openAndFocus: () => void;
  /** Close and blur. */
  closeAndBlur: () => void;
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
  const [lastSeenIds, setLastSeenIds] = useState<{
    collapsed: string | null;
    room: string | null;
    zone: string | null;
  }>({ collapsed: null, room: null, zone: null });

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ----- Subscribe to bridge updates.
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

  // ----- Compute filtered message lists per scope (does NOT cause unread changes).
  const { roomMessages, zoneMessages, visibleMessages, allVisibleToUser } = useMemo(() => {
    const roomKey = `room:${location.room}`;
    const zoneKey = location.zone ? `zone:${location.zone}` : null;

    const room: ChatMessage[] = [];
    const zone: ChatMessage[] = [];
    const allVisible: ChatMessage[] = [];

    for (const m of messages) {
      const inRoom = m.scope === roomKey || (m.kind === 'system' && m.scope === roomKey);
      const inZone = zoneKey != null && m.scope === zoneKey;

      if (inRoom) room.push(m);
      if (inZone) zone.push(m);
      if (inRoom || inZone) allVisible.push(m);
    }

    const visible = scopeMode === 'zone' && zoneKey ? zone : room;
    return {
      roomMessages: room,
      zoneMessages: zone,
      visibleMessages: visible,
      allVisibleToUser: allVisible,
    };
  }, [messages, scopeMode, location]);

  // ----- Snap back to room tab if user leaves their zone.
  useEffect(() => {
    if (!location.zone && scopeMode === 'zone') {
      setScopeMode('room');
    }
  }, [location.zone, scopeMode]);

  // ----- Click outside the panel: blur the input but keep panel open.
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

  // ----- Mark messages as read.
  //
  // The collapsed badge should match what the user has actually seen:
  //   - When the panel is closed, messages arriving are unread.
  //   - When the panel is open (regardless of which tab), all messages
  //     visible-to-user are considered "seen" — we keep collapsed.lastSeen
  //     pinned to the latest visible message.
  //
  // Per-tab badges: marked read when the tab is active. So the room tab
  // updates only while it's selected; switching to zone freezes room's
  // unread counter at whatever it's at and starts updating zone's.
  useEffect(() => {
    if (!open) return;
    const lastVisible = allVisibleToUser[allVisibleToUser.length - 1];
    if (!lastVisible) return;
    setLastSeenIds((prev) => {
      const next = { ...prev };
      // Always pin collapsed when panel is open.
      next.collapsed = lastVisible.id;
      // Pin the active tab.
      if (scopeMode === 'room') {
        const lastRoom = roomMessages[roomMessages.length - 1];
        if (lastRoom) next.room = lastRoom.id;
      } else if (scopeMode === 'zone') {
        const lastZone = zoneMessages[zoneMessages.length - 1];
        if (lastZone) next.zone = lastZone.id;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scopeMode, allVisibleToUser.length, roomMessages.length, zoneMessages.length]);

  // ----- When opening: scroll to bottom + focus input.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        inputRef.current?.focus();
      });
    }
  }, [open]);

  /** Count messages in a list after lastSeenId, excluding the user's own. */
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

  const collapsedUnread = countUnread(allVisibleToUser, lastSeenIds.collapsed);
  const roomUnread = countUnread(roomMessages, lastSeenIds.room);
  const zoneUnread = location.zone ? countUnread(zoneMessages, lastSeenIds.zone) : 0;

  // ----- Imperative API
  // Important: openAndFocus and closeAndBlur are explicit because the global
  // keyboard hook uses them. `toggle()` is kept for the visible button.
  useImperativeHandle(ref, () => ({
    toggle: () => setOpen((prev) => !prev),
    isInputFocused: () => document.activeElement === inputRef.current,
    isInputEmpty: () => input.trim().length === 0,
    isOpen: () => open,
    submit: () => sendCurrentInput(),
    openAndFocus: () => {
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    closeAndBlur: () => {
      setOpen(false);
      // Blur immediately so movement keys re-enable on the very next frame.
      inputRef.current?.blur();
    },
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

  /**
   * Local Enter handler on the input. We MUST stopPropagation here so that
   * the global window-level Enter handler doesn't ALSO fire — otherwise after
   * sending (which empties the input), the global handler would see "input
   * focused + empty" and close the panel.
   */
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      const hasText = input.trim().length > 0;
      if (hasText) {
        sendCurrentInput();
        // Stay open, stay focused.
      } else {
        // Empty input + Enter → close panel and blur input.
        setOpen(false);
        inputRef.current?.blur();
      }
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
    // Marking-as-read happens via the open+scope effect above.
  };

  const handleClose = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <>
      {/* Floating side handle. Always visible. Direction reflects open state. */}
      <button
        type="button"
        className={`chat-tab-handle ${open ? 'chat-tab-handle--open' : ''}`}
        aria-label={open ? 'Close chat' : `Open chat${collapsedUnread > 0 ? `, ${collapsedUnread} new` : ''}`}
        aria-expanded={open}
        onClick={() => (open ? handleClose() : setOpen(true))}
        // When the panel is open, position the handle on its left edge.
        style={open ? { right: 'min(360px, 90vw)' } : undefined}
      >
        <span className="chat-tab-handle__arrow" aria-hidden="true">
          {open ? '›' : '‹'}
        </span>
        {!open && collapsedUnread > 0 && (
          <span className="chat-tab-handle__badge" aria-hidden="true">
            {collapsedUnread > 99 ? '99+' : collapsedUnread}
          </span>
        )}
      </button>

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
            onClick={handleClose}
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

        {reactionPickerFor && (
          <div className="chat-panel__emoji-overlay">
            <EmojiPicker
              title="React with…"
              onPick={(emojiId) => handleReact(reactionPickerFor, emojiId)}
              onClose={() => setReactionPickerFor(null)}
            />
          </div>
        )}

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
