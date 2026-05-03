/**
 * Thin wrapper over the shared world module. Re-exports the data and adds
 * client-side conveniences (zone-id -> display name lookup).
 */
export * from './world';
import { ROOMS } from './world';

const _zoneNames: Record<string, string> = {};
for (const room of Object.values(ROOMS)) {
  for (const z of room.zones) {
    _zoneNames[z.id] = z.name;
  }
}
export const ZONE_NAMES = _zoneNames;
