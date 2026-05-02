import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { startGame, destroyGame } from '../game/PhaserGame';

export default function GameContainer() {
  const { user, logout } = useAuth();
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = mountRef.current;
    if (!node || !user) return;

    startGame(node, {
      uid: user.uid,
      displayName: user.displayName || 'Visitor',
      photoURL: user.photoURL ?? undefined,
    });

    return () => destroyGame();
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

      <div className="hud-controls">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
        <span>or arrow keys to move</span>
      </div>
    </div>
  );
}
