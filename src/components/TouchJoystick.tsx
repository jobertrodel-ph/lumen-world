import { useEffect, useRef, useState } from 'react';
import { setJoystick, clearJoystick } from '../game/input/inputBridge';

/**
 * Touch-driven joystick.
 *
 * - Pointer-down anywhere on the base activates it; the knob jumps to the
 *   touch position so the user feels in control immediately.
 * - Drag the knob; the magnitude+angle gets written to the input bridge.
 * - Lift to release; the knob springs back to center.
 * - Constrained to a circular range; no diagonal speed boost.
 */

const BASE_RADIUS = 56;
const KNOB_RADIUS = 32;
const ACTIVE_RANGE = BASE_RADIUS - KNOB_RADIUS / 2; // how far the knob can travel

export function TouchJoystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const pointerIdRef = useRef<number | null>(null);
  const baseCenterRef = useRef({ x: 0, y: 0 });

  // Recompute base center on every pointer-down (covers layout changes).
  const cacheCenter = () => {
    const rect = baseRef.current?.getBoundingClientRect();
    if (rect) {
      baseCenterRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
  };

  // Update both visual knob position AND input bridge from a screen point.
  const updateFromPoint = (clientX: number, clientY: number) => {
    const cx = baseCenterRef.current.x;
    const cy = baseCenterRef.current.y;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    // Constrain to active range.
    if (dist > ACTIVE_RANGE) {
      dx = (dx / dist) * ACTIVE_RANGE;
      dy = (dy / dist) * ACTIVE_RANGE;
    }
    setKnob({ x: dx, y: dy });
    setJoystick(dx / ACTIVE_RANGE, dy / ACTIVE_RANGE);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== null) return; // already tracking another pointer
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    cacheCenter();
    updateFromPoint(e.clientX, e.clientY);
    setActive(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    updateFromPoint(e.clientX, e.clientY);
  };

  const release = () => {
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    setActive(false);
    clearJoystick();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return;
    release();
  };

  // Safety: if user drags off-screen and lifts elsewhere, ensure we still clear.
  useEffect(() => {
    const onLost = () => release();
    window.addEventListener('blur', onLost);
    window.addEventListener('pointercancel', onLost);
    return () => {
      window.removeEventListener('blur', onLost);
      window.removeEventListener('pointercancel', onLost);
    };
  }, []);

  return (
    <div
      ref={baseRef}
      className={`joystick ${active ? 'joystick--active' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="presentation"
    >
      <div className="joystick__base" />
      <div
        className="joystick__knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
}
