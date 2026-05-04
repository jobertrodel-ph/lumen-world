import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { startGame, destroyGame } from '../game/PhaserGame';
import { toggleMic } from '../game/voice/voiceBridge';

export default function GameContainer({ avatarId }: { avatarId: string }) {
  const { user, logout } = useAuth();
  const mountRef = useRef<HTMLDivElement>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);

  useEffect(() => {
    const node = mountRef.current;
    if (!node || !user) return;

    let cancelled = false;
    const boot = async () => {
      try {
        const idToken = await user.getIdToken();
        if (cancelled || !mountRef.current) return;
        startGame(mountRef.current, {
          uid: user.uid,
          displayName: user.displayName || 'Visitor',
          photoURL: user.photoURL ?? undefined,
          avatarId,
        }, idToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start game';
        setBootError(msg);
      }
    };
    boot();

    const onVoiceReady = () => setVoiceReady(true);
    window.addEventListener('lumen:voice-ready', onVoiceReady);

    return () => {
      cancelled = true;
      window.removeEventListener('lumen:voice-ready', onVoiceReady);
      destroyGame();
    };
  }, [user, avatarId]);

  const handleMic = async () => {
    if (!voiceReady || micBusy) return;
    setMicBusy(true);
    try {
      const next = await toggleMic();
      setMicOn(next);
    } finally {
      setMicBusy(false);
    }
  };

  return (
    <div className="game">
      <div className="hud">
        <div className="hud__pill">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="hud__avatar-fallback">
              {(user?.displayName?.[0] ?? '?').toUpperCase()}
            </span>
          )}
          <span>{user?.displayName ?? 'Visitor'}</span>
        </div>

        <div className="hud__right">
          <button
            type="button"
            className={`hud__mic ${micOn ? 'hud__mic--on' : ''}`}
            onClick={handleMic}
            disabled={!voiceReady || micBusy}
            title={!voiceReady ? 'Voice connecting…' : micOn ? 'Mute microphone' : 'Unmute microphone'}
            aria-label={micOn ? 'Mute' : 'Unmute'}
          >
            <MicIcon on={micOn} />
            <span>{micOn ? 'Mic on' : voiceReady ? 'Mic off' : 'Connecting…'}</span>
          </button>

          <button type="button" className="hud__logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      <div ref={mountRef} className="game__canvas" />

      {bootError && <div className="hud-error" role="alert">{bootError}</div>}

      <div className="hud-controls">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
        <span>or arrow keys to move · walk close to hear</span>
      </div>
    </div>
  );
}

function MicIcon({ on }: { on: boolean }) {
  return on ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" fill="currentColor" />
      <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" stroke="currentColor" strokeWidth="2" />
      <path d="M19 11a7 7 0 0 1-14 0M12 18v3M4 4l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
