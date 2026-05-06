import { FLUENT_EMOJI, FluentEmoji } from './emojis';

interface Props {
  onPick: (emojiId: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onPick, onClose }: Props) {
  return (
    <div
      className="emoji-picker"
      role="dialog"
      aria-label="Pick an emoji"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="emoji-picker__header">
        <span>Pick an emoji</span>
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
      <img src={emoji.url} alt={emoji.name} loading="lazy" draggable={false} />
    </button>
  );
}
