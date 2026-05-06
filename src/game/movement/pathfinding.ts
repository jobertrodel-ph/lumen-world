import { ROOMS, RoomId, isBlocked } from '../../shared/world-helpers';

/**
 * A* pathfinding on a coarse grid.
 *
 * For each room we precompute a walkable grid: each cell is GRID_SIZE pixels
 * wide; a cell is "blocked" if a circle of AVATAR_RADIUS centered at the cell
 * center collides with any wall. We then run standard A* with 8-way movement
 * and a Euclidean heuristic.
 *
 * Path simplification: after A* returns a list of cells, we apply a "string
 * pulling" pass — walk from the current waypoint and skip ahead as far as we
 * can see (line-of-sight clear of walls). This gives smooth diagonal paths
 * instead of grid-stepped ones.
 *
 * GRID_SIZE = 24 was tuned for these rooms — large enough to keep the grid
 * small (rooftop @ 1700x1200 = ~3500 cells), small enough that the avatar
 * (radius 20) can fit through any gap the level designer intended.
 */

const GRID_SIZE = 24;
const AVATAR_RADIUS = 20;

interface NavGrid {
  cols: number;
  rows: number;
  /** Flat array, length cols*rows. true = walkable. */
  walkable: Uint8Array;
}

const gridCache = new Map<RoomId, NavGrid>();

function getGrid(roomId: RoomId): NavGrid {
  const cached = gridCache.get(roomId);
  if (cached) return cached;

  const room = ROOMS[roomId];
  const cols = Math.ceil(room.width / GRID_SIZE);
  const rows = Math.ceil(room.height / GRID_SIZE);
  const walkable = new Uint8Array(cols * rows);

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const px = cx * GRID_SIZE + GRID_SIZE / 2;
      const py = cy * GRID_SIZE + GRID_SIZE / 2;
      // Cell is walkable if our avatar can stand at its center.
      walkable[cy * cols + cx] = isBlocked(roomId, px, py, AVATAR_RADIUS) ? 0 : 1;
    }
  }

  const grid: NavGrid = { cols, rows, walkable };
  gridCache.set(roomId, grid);
  return grid;
}

function worldToCell(x: number, y: number): { cx: number; cy: number } {
  return {
    cx: Math.floor(x / GRID_SIZE),
    cy: Math.floor(y / GRID_SIZE),
  };
}

function cellToWorld(cx: number, cy: number): { x: number; y: number } {
  return {
    x: cx * GRID_SIZE + GRID_SIZE / 2,
    y: cy * GRID_SIZE + GRID_SIZE / 2,
  };
}

function inBounds(g: NavGrid, cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < g.cols && cy < g.rows;
}

function isWalkable(g: NavGrid, cx: number, cy: number): boolean {
  return inBounds(g, cx, cy) && g.walkable[cy * g.cols + cx] === 1;
}

/**
 * Find the nearest walkable cell to (cx, cy) within `maxRadius` cells.
 * Used when the destination click lands on a wall — snap to the closest
 * legal spot.
 */
function findNearestWalkable(
  g: NavGrid, cx: number, cy: number, maxRadius = 8
): { cx: number; cy: number } | null {
  if (isWalkable(g, cx, cy)) return { cx, cy };
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = cx + dx, ny = cy + dy;
        if (isWalkable(g, nx, ny)) return { cx: nx, cy: ny };
      }
    }
  }
  return null;
}

interface Node {
  cx: number;
  cy: number;
  g: number;       // cost from start
  f: number;       // g + heuristic
  parentIdx: number;
}

/**
 * 8-way A*. Diagonal moves cost 1.4 (≈√2), cardinal moves cost 1.
 * Diagonals can only happen if BOTH adjacent cardinals are walkable —
 * prevents cutting through wall corners.
 */
function aStar(
  g: NavGrid,
  startX: number, startY: number,
  endX: number, endY: number
): Array<{ cx: number; cy: number }> | null {
  const cellCount = g.cols * g.rows;
  const open: Node[] = [];
  const nodes: Node[] = [];      // index into nodes via cellIndex map
  const cellToNode = new Int32Array(cellCount).fill(-1);
  const closed = new Uint8Array(cellCount);

  const startIdx = startY * g.cols + startX;
  const endIdx = endY * g.cols + endX;

  const heuristic = (cx: number, cy: number) => {
    const dx = cx - endX, dy = cy - endY;
    return Math.hypot(dx, dy);
  };

  nodes.push({ cx: startX, cy: startY, g: 0, f: heuristic(startX, startY), parentIdx: -1 });
  cellToNode[startIdx] = 0;
  open.push(nodes[0]);

  // Standard 8-direction offsets with movement costs.
  const dirs: Array<[number, number, number]> = [
    [-1,  0, 1.0], [1,  0, 1.0], [0, -1, 1.0], [0, 1, 1.0],
    [-1, -1, 1.4], [1, -1, 1.4], [-1, 1, 1.4], [1, 1, 1.4],
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 8000; // safety cap

  while (open.length > 0 && iterations++ < MAX_ITERATIONS) {
    // Pop the node with lowest f. Linear scan is fine for grids this size.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const currentNodeIdx = nodes.indexOf(current);
    const currentCellIdx = current.cy * g.cols + current.cx;

    if (currentCellIdx === endIdx) {
      // Reconstruct path.
      const path: Array<{ cx: number; cy: number }> = [];
      let n: Node | null = current;
      while (n) {
        path.unshift({ cx: n.cx, cy: n.cy });
        n = n.parentIdx >= 0 ? nodes[n.parentIdx] : null;
      }
      return path;
    }

    closed[currentCellIdx] = 1;

    for (const [dx, dy, cost] of dirs) {
      const nx = current.cx + dx;
      const ny = current.cy + dy;
      if (!isWalkable(g, nx, ny)) continue;
      const neighborIdx = ny * g.cols + nx;
      if (closed[neighborIdx]) continue;

      // Prevent diagonal corner-cutting.
      if (dx !== 0 && dy !== 0) {
        if (!isWalkable(g, current.cx + dx, current.cy)) continue;
        if (!isWalkable(g, current.cx, current.cy + dy)) continue;
      }

      const tentativeG = current.g + cost;
      const existingNodeIdx = cellToNode[neighborIdx];
      if (existingNodeIdx >= 0) {
        const existing = nodes[existingNodeIdx];
        if (tentativeG >= existing.g) continue;
        existing.g = tentativeG;
        existing.f = tentativeG + heuristic(nx, ny);
        existing.parentIdx = currentNodeIdx;
      } else {
        const newNode: Node = {
          cx: nx, cy: ny,
          g: tentativeG,
          f: tentativeG + heuristic(nx, ny),
          parentIdx: currentNodeIdx,
        };
        nodes.push(newNode);
        cellToNode[neighborIdx] = nodes.length - 1;
        open.push(newNode);
      }
    }
  }

  return null;
}

/**
 * Line-of-sight check between two world points: walks in small steps
 * checking each step is unblocked. Used for path simplification.
 */
function hasLineOfSight(
  roomId: RoomId, x1: number, y1: number, x2: number, y2: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const steps = Math.ceil(dist / (GRID_SIZE / 2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (isBlocked(roomId, x1 + dx * t, y1 + dy * t, AVATAR_RADIUS)) {
      return false;
    }
  }
  return true;
}

/**
 * String-pulling: walk through the grid path and skip waypoints that have
 * line-of-sight from the previous kept waypoint. Result is much smoother.
 */
function simplifyPath(
  roomId: RoomId,
  cells: Array<{ cx: number; cy: number }>
): Array<{ x: number; y: number }> {
  if (cells.length === 0) return [];
  const worldPoints = cells.map((c) => cellToWorld(c.cx, c.cy));

  const result: Array<{ x: number; y: number }> = [worldPoints[0]];
  let anchor = 0;
  for (let i = 1; i < worldPoints.length; i++) {
    if (i === worldPoints.length - 1) {
      result.push(worldPoints[i]);
      break;
    }
    // Try to skip i: can we still see i+1 from anchor?
    const next = worldPoints[i + 1];
    if (!hasLineOfSight(roomId, worldPoints[anchor].x, worldPoints[anchor].y, next.x, next.y)) {
      // Need to keep this waypoint.
      result.push(worldPoints[i]);
      anchor = i;
    }
  }
  return result;
}

/**
 * Public entry point. Returns a list of world-space waypoints to walk
 * through, ending at the target (snapped to nearest walkable). Returns
 * null if no path exists.
 */
export function findPath(
  roomId: RoomId,
  startX: number, startY: number,
  targetX: number, targetY: number
): Array<{ x: number; y: number }> | null {
  const g = getGrid(roomId);
  const start = worldToCell(startX, startY);
  const target = worldToCell(targetX, targetY);

  // Snap start to walkable (avatar might overlap a wall edge slightly).
  const startCell = isWalkable(g, start.cx, start.cy)
    ? start
    : findNearestWalkable(g, start.cx, start.cy);
  if (!startCell) return null;

  // Snap target to walkable.
  const targetCell = isWalkable(g, target.cx, target.cy)
    ? target
    : findNearestWalkable(g, target.cx, target.cy);
  if (!targetCell) return null;

  // Same cell — no path needed; return target world point.
  if (startCell.cx === targetCell.cx && startCell.cy === targetCell.cy) {
    return [{ x: targetX, y: targetY }];
  }

  const cells = aStar(g, startCell.cx, startCell.cy, targetCell.cx, targetCell.cy);
  if (!cells) return null;

  const path = simplifyPath(roomId, cells);

  // Replace last waypoint with the actual click target if it's reachable —
  // makes movement feel more responsive ("you go where you click", not
  // "you go to the cell containing where you click").
  if (path.length > 0) {
    const last = path[path.length - 1];
    if (hasLineOfSight(roomId, last.x, last.y, targetX, targetY)) {
      path[path.length - 1] = { x: targetX, y: targetY };
    }
  }

  return path;
}

/** Force a re-bake of the grid for a room. Call when the world changes. */
export function invalidateGrid(roomId: RoomId): void {
  gridCache.delete(roomId);
}
