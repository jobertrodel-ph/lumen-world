import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { startGame, destroyGame } from '../game/PhaserGame';

export default function GameContainer() {
  const { user, logout } = useAuth();
  const mountRef = useRef<HTMLDivElement>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const node = mountRef.current;
    if (!node || !user) return;

    let cancelled = false;

    const boot = async () => {
      try {
        // forceRefresh=false — Firebase auto-refreshes when needed.
        const idToken = await user.getIdToken();
        if (cancelled || !mountRef.current) return;

        startGame(
          mountRef.current,
          {
            uid: user.uid,
            displayName: user.displayName || 'Visitor',
            photoURL: user.photoURL ?? undefined,
          },
          idToken
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start game';
        setBootError(msg);
      }
    };

    boot();

    return () => {
      cancelled = true;
      destroyGame();
    };
  }, [user]);

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

        <button type="button" className="hud__logout" onClick={logout}>
          Sign out
        </button>
      </div>

      <div ref={mountRef} className="game__canvas" />

      {bootError && (
        <div className="hud-error" role="alert">
          {bootError}
        </div>
      )}

      <div className="hud-controls">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
        <span>or arrow keys to move</span>
      </div>
    </div>
  );
}
