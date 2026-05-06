import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AVATAR_STYLES } from '../shared/avatars';
import { saveProfile } from '../shared/profile';
import { AvatarPreview } from './AvatarPreview';

interface Props {
  initialAvatarId: string;
  onConfirm: (avatarId: string) => void;
}

export default function AvatarPicker({ initialAvatarId, onConfirm }: Props) {
  const { user, logout } = useAuth();
  const [selected, setSelected] = useState(initialAvatarId);

  const enter = () => {
    if (!user) return;
    saveProfile(user.uid, { avatarId: selected });
    onConfirm(selected);
  };

  return (
    <div className="picker">
      <div className="picker__atmosphere" aria-hidden="true">
        <span className="blob blob--jade" />
        <span className="blob blob--crimson" />
        <span className="blob blob--gold" />
      </div>

      <main className="picker__panel">
        <div className="brand">
          <span className="brand__dot" />
          <span className="brand__name">九霄 · NINTH SKY</span>
        </div>

        <h1 className="picker__headline">
          <span className="headline__line">Pick your</span>
          <span className="headline__line headline__line--accent">presence.</span>
        </h1>

        <p className="picker__sub">
          Hi {user?.displayName?.split(' ')[0] ?? 'friend'}. Six paths, no wrong choice.
        </p>

        <div className="picker__grid">
          {AVATAR_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`picker__tile ${selected === style.id ? 'picker__tile--selected' : ''}`}
              onClick={() => setSelected(style.id)}
              aria-pressed={selected === style.id}
            >
              <AvatarPreview style={style} size={84} />
              <span className="picker__name">{style.name}</span>
              <span className="picker__subtitle">{style.subtitle}</span>
            </button>
          ))}
        </div>

        <div className="picker__actions">
          <button className="picker__back" onClick={logout} type="button">
            Sign out
          </button>
          <button className="picker__enter" onClick={enter} type="button">
            Enter Ninth Sky →
          </button>
        </div>
      </main>
    </div>
  );
}
