/**
 * Full-screen rotate hint. Shown only when on a small touch device in
 * portrait orientation. Doesn't block interactions outside its layer
 * (Phaser keeps running underneath); just covers the visible area with
 * an inviting message.
 */
export function RotateHint() {
  return (
    <div className="rotate-hint" role="alert">
      <div className="rotate-hint__panel">
        <div className="rotate-hint__icon" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <rect
              x="6" y="14" width="44" height="28" rx="4"
              stroke="currentColor" strokeWidth="2"
            />
            <circle cx="44" cy="28" r="1.5" fill="currentColor" />
            <path
              d="M28 8 L36 4 L34 12 M28 8 a20 20 0 0 1 18 14"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" fill="none"
            />
          </svg>
        </div>
        <h2 className="rotate-hint__headline">
          <span className="rotate-hint__line">Rotate your</span>
          <span className="rotate-hint__line rotate-hint__line--accent">phone</span>
        </h2>
        <p className="rotate-hint__sub">
          Lumen is best in landscape. Turn your phone sideways to keep going.
        </p>
      </div>
    </div>
  );
}
