import { RoomId, zoneAt } from '../../shared/world';

/** Maximum distance at which someone is audible at all (open-area falloff). */
const HEARING_RADIUS = 320;
/** Distance at which volume starts to drop. Below this, full volume. */
const FALLOFF_START = 120;

interface PeerLike {
  uid: string;
  room: string;
  x: number;
  y: number;
}

interface SelfState {
  room: RoomId;
  x: number;
  y: number;
}

/**
 * Compute audible gain (0..1) for a remote peer, given the local player's
 * position. Returns 0 if the peer should not be heard at all.
 *
 * Hybrid model:
 *   - Different room? Silent. Always.
 *   - Both in the same named zone? Full volume regardless of distance.
 *   - Either in an open area? Distance falloff.
 */
export function computeGain(self: SelfState, peer: PeerLike): number {
  if (peer.room !== self.room) return 0;

  const myZone = zoneAt(self.room, self.x, self.y);
  const theirZone = zoneAt(self.room, peer.x, peer.y);

  // Both in same zone: clean group conversation, full volume.
  if (myZone && myZone === theirZone) return 1;

  // Mixed (one in zone, one not): treat as open-area distance.
  // Pure open: distance falloff.
  const dx = peer.x - self.x;
  const dy = peer.y - self.y;
  const dist = Math.hypot(dx, dy);

  if (dist >= HEARING_RADIUS) return 0;
  if (dist <= FALLOFF_START) return 1;

  // Linear falloff between FALLOFF_START and HEARING_RADIUS.
  const t = (dist - FALLOFF_START) / (HEARING_RADIUS - FALLOFF_START);
  return 1 - t;
}
