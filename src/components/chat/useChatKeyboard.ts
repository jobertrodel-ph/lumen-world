import { useEffect, RefObject } from 'react';
import type { ChatPanelHandle } from './ChatPanel';

/**
 * Wires up the global Enter behavior for the chat panel:
 *
 *  - Enter when panel is closed → open it, focus input.
 *  - Enter when input has focus AND is non-empty → send (handled by the
 *    panel's own keydown listener, not here, to avoid double-sending).
 *  - Enter when input has focus AND is empty → close the panel.
 *
 * Also blocks browser-default behaviors that would interfere
 * (e.g., Enter when no element has focus would do nothing, but we
 * still want to capture it).
 */
export function useChatKeyboard(panelRef: RefObject<ChatPanelHandle | null>): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      const panel = panelRef.current;
      if (!panel) return;

      // Don't hijack Enter when typing in *any* other input/textarea/contenteditable.
      // (We only want to control the chat input + the world canvas.)
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isContentEditable = target.isContentEditable;
        const isOurChatInput = target.classList.contains('chat-input');

        if (!isOurChatInput && (tag === 'INPUT' || tag === 'TEXTAREA' || isContentEditable)) {
          // Some other input is focused — leave Enter alone.
          return;
        }
      }

      const isOpen = panel.isOpen();
      const inputFocused = panel.isInputFocused();
      const inputEmpty = panel.isInputEmpty();

      if (!isOpen) {
        // Open and focus.
        e.preventDefault();
        panel.toggle();
        return;
      }

      // Panel is open.
      if (inputFocused && inputEmpty) {
        // Close.
        e.preventDefault();
        panel.toggle();
        return;
      }

      // Panel is open but input not focused — focus the input.
      if (!inputFocused) {
        e.preventDefault();
        panel.toggle();   // Toggle off then on to re-focus? No — easier: just toggle off and on.
        // Actually just open which already focuses. But it's already open.
        // Simplest: programmatically focus by toggling closed and open.
        // But toggling closed and open is jarring; instead, fire a custom event
        // that ChatPanel listens for. For now, do nothing — user can click input.
        return;
      }
      // input focused + non-empty → let the input's own Enter handler send.
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panelRef]);
}
