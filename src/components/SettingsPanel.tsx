import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  loadSettings,
  saveSettings,
  setActiveSettings,
  type MovementMode,
} from '../shared/settings';

/**
 * Settings panel. Opens from a gear icon in the HUD; closes when you click
 * outside or pick a value. Currently only contains movement mode.
 */
export function SettingsPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [movementMode, setMovementMode] = useState<MovementMode>('click');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Load on user change.
  useEffect(() => {
    if (!user) return;
    const s = loadSettings(user.uid);
    setMovementMode(s.movementMode);
    setActiveSettings(s);
  }, [user]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const updateMode = (mode: MovementMode) => {
    setMovementMode(mode);
    if (user) {
      const next = { movementMode: mode };
      saveSettings(user.uid, next);
      setActiveSettings(next);
    }
  };

  return (
    <div className="settings" ref={wrapRef}>
      <button
        type="button"
        className="settings__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
        title="Settings"
      >
        <GearIcon />
      </button>

      {open && (
        <div className="settings__panel" role="dialog" aria-label="Settings">
          <div className="settings__section">
            <div className="settings__label">Movement</div>
            <div className="settings__choices">
              <button
                type="button"
                className={`settings__choice ${movementMode === 'click' ? 'settings__choice--active' : ''}`}
                onClick={() => updateMode('click')}
              >
                Right-click
                <span className="settings__hint">click to move</span>
              </button>
              <button
                type="button"
                className={`settings__choice ${movementMode === 'arrows' ? 'settings__choice--active' : ''}`}
                onClick={() => updateMode('arrows')}
              >
                Arrow keys
                <span className="settings__hint">hold to move</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
