import { FLUENT_EMOJI, FluentEmoji } from './emojis';
import { EmojiBadge } from './EmojiBadge';

interface Props {
  /** Called with the emoji's id when picked. */
  onPick: (emojiId: string) => void;
  onClose: () => void;
  title?: string;
}

export function EmojiPicker({ onPick, onClose, title = 'Pick an emoji' }: Props) {
  return (
    <div
      className="emoji-picker"
      role="dialog"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="emoji-picker__header">
        <span>{title}</span>
        <button
          className="emoji-picker__close"
          type="button"
          onClick={onClose}
          aria-label="Close picker"
        >×</button>
      </div>
      <div className="emoji-picker__grid" role="list">
        {FLUENT_EMOJI.map((e) => (
          <EmojiButton key={e.id} emoji={e} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function EmojiButton({ emoji, onPick }: { emoji: FluentEmoji; onPick: (id: string) => void }) {
  return (
    <button
      type="button"
      className="emoji-picker__item"
      role="listitem"
      title={emoji.name}
      onClick={() => onPick(emoji.id)}
    >
      <EmojiBadge id={emoji.id} size={32} />
    </button>
  );
}
