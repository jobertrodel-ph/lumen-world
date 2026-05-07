import { useEffect, RefObject } from 'react';
import type { ChatPanelHandle } from './ChatPanel';

/**
 * Global Enter behavior for the chat panel:
 *
 *   - Enter while panel is closed → open and focus input.
 *   - Enter while panel is open + input focused → handled by the input's own
 *     keydown listener (which stops propagation), so we should never see it
 *     here. Defensive check anyway: if we do, do nothing.
 *   - Enter while panel is open + input NOT focused → re-focus the input.
 *     (No close from this path; the close-on-empty-Enter happens inside the
 *     input's handler where we know the actual input value.)
 */
export function useChatKeyboard(panelRef: RefObject<ChatPanelHandle | null>): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      const panel = panelRef.current;
      if (!panel) return;

      // Don't hijack Enter when typing in any other input/textarea/contenteditable.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isContentEditable = target.isContentEditable;
        const isOurChatInput = target.classList.contains('chat-input');
        if (isOurChatInput) {
          // The input itself handles this Enter (and stops propagation).
          // If we somehow got here anyway, bail.
          return;
        }
        if (tag === 'INPUT' || tag === 'TEXTAREA' || isContentEditable) {
          return;
        }
      }

      const isOpen = panel.isOpen();

      if (!isOpen) {
        // Open and focus the input.
        e.preventDefault();
        panel.openAndFocus();
        return;
      }

      // Panel open but input not focused — re-focus.
      if (!panel.isInputFocused()) {
        e.preventDefault();
        panel.openAndFocus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panelRef]);
}
