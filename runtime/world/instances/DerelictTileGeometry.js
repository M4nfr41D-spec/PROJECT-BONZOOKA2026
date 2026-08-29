// v2166A29 — geometry + collision helper for direct tile-bound derelict instances

const BASE_GRID = 8;

const GRID_SHAPES = Object.freeze({
  'Corridor H': [
    [0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]
  ],
  'Corridor V': [
    [0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],
    [0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0]
  ],
  'Cross': [
    [0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],
    [1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],
    [0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0]
  ],
  'T-North': [
    [0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],[0,0,0,1,1,0,0,0],
    [1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]
  ],
  'L-NorthEast': [
    [0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],
    [0,0,0,0,0,1,1,1],[0,0,0,0,0,1,1,1],[0,0,0,0,0,1,1,1],[0,0,0,0,0,1,1,1]
  ]
});

function deepCopyGrid(grid) {
  return grid.map(row => row.slice());
}

function circleMask() {
  const m = Array.from({ length: BASE_GRID }, () => Array(BASE_GRID).fill(0));
  for (let y = 0; y < BASE_GRID; y++) {
    for (let x = 0; x < BASE_GRID; x++) {
      if (Math.hypot(x - 3.5, y - 3.5) <= 3.1) m[y][x] = 1;
    }
  }
  return m;
}

function baseGridForShape(shape) {
  if (shape === 'Round Room') return circleMask();
  return deepCopyGrid(GRID_SHAPES[shape] || GRID_SHAPES['Cross']);
}

function rotateGrid90CW(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const out = Array.from({ length: w }, () => Array(h).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out[x][h - 1 - y] = grid[y][x];
  }
  return out;
}

function normalizeRotation(rotationDeg = 0) {
  const rot = ((Math.round(rotationDeg / 90) % 4) + 4) % 4;
  return rot * 90;
}

function rotateExits(exits, exitWidths, rotationDeg = 0) {
  const rot = normalizeRotation(rotationDeg);
  if (!rot) return { exits: { ...exits }, exitWidths: { ...exitWidths } };
  const dirs = ['N','E','S','W'];
  const steps = rot / 90;
  const outExits = { N: false, E: false, S: false, W: false };
  const outWidths = { N: 2, E: 2, S: 2, W: 2 };
  for (let i = 0; i < dirs.length; i++) {
    const from = dirs[i];
    const to = dirs[(i + steps) % dirs.length];
    outExits[to] = !!exits[from];
    outWidths[to] = exitWidths[from] || 2;
  }
  return { exits: outExits, exitWidths: outWidths };
}

function exitSpan(width) {
  const w = Math.max(2, Math.min(BASE_GRID, Number(width) || 2));
  const start = Math.floor((BASE_GRID - w) / 2);
  return { start, end: start + w - 1, width: w };
}

function applyExits(base, exits, exitWidths) {
  const g = deepCopyGrid(base);
  for (const dir of ['N','S','E','W']) {
    if (!exits[dir]) continue;
    const span = exitSpan(exitWidths[dir]);
    if (dir === 'N') {
      for (let y = 0; y < BASE_GRID; y++) {
        for (let x = span.start; x <= span.end; x++) g[y][x] = 1;
        let hit = false;
        for (let x = span.start; x <= span.end; x++) if (base[y][x]) hit = true;
        if (hit && y > 0) break;
      }
    }
    if (dir === 'S') {
      for (let y = BASE_GRID - 1; y >= 0; y--) {
        for (let x = span.start; x <= span.end; x++) g[y][x] = 1;
        let hit = false;
        for (let x = span.start; x <= span.end; x++) if (base[y][x]) hit = true;
        if (hit && y < BASE_GRID - 1) break;
      }
    }
    if (dir === 'W') {
      for (let x = 0; x < BASE_GRID; x++) {
        for (let y = span.start; y <= span.end; y++) g[y][x] = 1;
        let hit = false;
        for (let y = span.start; y <= span.end; y++) if (base[y][x]) hit = true;
        if (hit && x > 0) break;
      }
    }
    if (dir === 'E') {
      for (let x = BASE_GRID - 1; x >= 0; x--) {
        for (let y = span.start; y <= span.end; y++) g[y][x] = 1;
        let hit = false;
        for (let y = span.start; y <= span.end; y++) if (base[y][x]) hit = true;
        if (hit && x < BASE_GRID - 1) break;
      }
    }
  }
  return g;
}

export function buildWalkGrid(moduleDef, rotationDeg = 0) {
  let grid = baseGridForShape(moduleDef.shape);
  const rotated = rotateExits(moduleDef.exits || {}, moduleDef.exitWidths || {}, rotationDeg);
  grid = applyExits(grid, rotated.exits, rotated.exitWidths);
  const rot = normalizeRotation(rotationDeg);
  for (let i = 0; i < rot / 90; i++) grid = rotateGrid90CW(grid);
  return grid;
}

export function buildBoundaryColliders(moduleDef, placement, rotationDeg = 0) {
  const grid = buildWalkGrid(moduleDef, rotationDeg);
  const size = placement.size || moduleDef.worldSize || 1024;
  const cell = size / BASE_GRID;
  const half = size / 2;
  const colliders = [];
  const seen = new Set();
  const isWalk = (x, y) => x >= 0 && x < BASE_GRID && y >= 0 && y < BASE_GRID && grid[y][x] === 1;
  for (let y = 0; y < BASE_GRID; y++) {
    for (let x = 0; x < BASE_GRID; x++) {
      if (grid[y][x] === 1) continue;
      const nearWalk = isWalk(x + 1, y) || isWalk(x - 1, y) || isWalk(x, y + 1) || isWalk(x, y - 1);
      if (!nearWalk) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      colliders.push({
        x: placement.x - half + x * cell + cell / 2,
        y: placement.y - half + y * cell + cell / 2,
        radius: Math.max(26, cell * 0.56)
      });
    }
  }
  return colliders;
}

export function moduleConnectionAnchor(placement, dir) {
  const size = placement.size || 1024;
  const half = size / 2;
  switch (dir) {
    case 'N': return { x: placement.x, y: placement.y - half };
    case 'S': return { x: placement.x, y: placement.y + half };
    case 'E': return { x: placement.x + half, y: placement.y };
    case 'W': return { x: placement.x - half, y: placement.y };
    default: return { x: placement.x, y: placement.y };
  }
}

export function connectionPointInside(placement, dir, inset = 130) {
  const size = placement.size || 1024;
  const half = size / 2;
  switch (dir) {
    case 'N': return { x: placement.x, y: placement.y - half + inset };
    case 'S': return { x: placement.x, y: placement.y + half - inset };
    case 'E': return { x: placement.x + half - inset, y: placement.y };
    case 'W': return { x: placement.x - half + inset, y: placement.y };
    default: return { x: placement.x, y: placement.y };
  }
}

export function normalizeRotationDeg(rotationDeg = 0) {
  return normalizeRotation(rotationDeg);
}

// ── Unified instance grid (v2166A38) ───────────────────────────────────────
// Stamps every module's 8x8 walk grid into ONE global cell grid. This is the
// single source of truth for both collision and rendering — killing the old
// art-vs-collider mismatch. Cells: 1 = floor (walkable), 0 = solid.
export function buildInstanceGrid(modules) {
  if (!modules || !modules.length) return null;
  const gxs = modules.map(m => m.gx ?? 0);
  const gys = modules.map(m => m.gy ?? 0);
  const gxMin = Math.min(...gxs), gxMax = Math.max(...gxs);
  const gyMin = Math.min(...gys), gyMax = Math.max(...gys);
  const cols = (gxMax - gxMin + 1) * BASE_GRID;
  const rows = (gyMax - gyMin + 1) * BASE_GRID;
  const cells = Array.from({ length: rows }, () => new Uint8Array(cols)); // 0 = solid
  const cellSize = (modules[0].size || 1024) / BASE_GRID;

  // World position of the top-left corner of global cell (0,0), derived from a
  // reference module (the module lattice is regular, so any module works).
  const ref = modules[0];
  const refSize = ref.size || 1024;
  const originX = (ref.x - refSize / 2) - ((ref.gx ?? 0) - gxMin) * BASE_GRID * cellSize;
  const originY = (ref.y - refSize / 2) - ((ref.gy ?? 0) - gyMin) * BASE_GRID * cellSize;

  for (const m of modules) {
    const wg = buildWalkGrid(m, m.rotationDeg || 0);
    const cOff = ((m.gx ?? 0) - gxMin) * BASE_GRID;
    const rOff = ((m.gy ?? 0) - gyMin) * BASE_GRID;
    for (let y = 0; y < BASE_GRID; y++) {
      for (let x = 0; x < BASE_GRID; x++) {
        if (wg[y][x] === 1) cells[rOff + y][cOff + x] = 1;
      }
    }
  }
  return { cells, cols, rows, cellSize, originX, originY };
}

// Exact circle-vs-tilemap resolution. Out-of-grid cells are treated as solid,
// so the instance is fully enclosed. Flat walls, no bulge, no corner leak.
export function resolveCircleInGrid(ent, radius, grid) {
  if (!ent || !grid) return;
  const { cells, cols, rows, cellSize, originX, originY } = grid;
  // Skip entities that are not inside the instance area at all (e.g. the player
  // back in the hub/overworld while a stale instanceGrid is still attached).
  // Without this, a far-away entity lands in a virtual out-of-grid cell and the
  // buried branch dereferences cells[gy] (undefined) — the loop-crash bug.
  const maxX = originX + cols * cellSize;
  const maxY = originY + rows * cellSize;
  if (ent.x < originX - radius || ent.x > maxX + radius ||
      ent.y < originY - radius || ent.y > maxY + radius) return;
  const inB = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  for (let pass = 0; pass < 2; pass++) {
    const span = Math.ceil(radius / cellSize) + 1;
    const ccx = Math.floor((ent.x - originX) / cellSize);
    const ccy = Math.floor((ent.y - originY) / cellSize);
    let moved = false;
    for (let gy = ccy - span; gy <= ccy + span; gy++) {
      for (let gx = ccx - span; gx <= ccx + span; gx++) {
        const solid = gy < 0 || gx < 0 || gy >= rows || gx >= cols || cells[gy][gx] === 0;
        if (!solid) continue;
        const rx = originX + gx * cellSize;
        const ry = originY + gy * cellSize;
        const nxp = Math.max(rx, Math.min(ent.x, rx + cellSize));
        const nyp = Math.max(ry, Math.min(ent.y, ry + cellSize));
        const dx = ent.x - nxp, dy = ent.y - nyp;
        const d2 = dx * dx + dy * dy;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = radius - d;
          const nx = dx / d, ny = dy / d;
          ent.x += nx * push; ent.y += ny * push;
          if (ent.vx != null && ent.vy != null) {
            const dot = ent.vx * nx + ent.vy * ny;
            if (dot < 0) { ent.vx -= nx * dot; ent.vy -= ny * dot; }
          }
        } else {
          // Center buried in a solid cell: eject toward an adjacent floor cell
          // if one exists, otherwise out the shallowest axis.
          const fL = inB(gx - 1, gy) && cells[gy][gx - 1] === 1;
          const fR = inB(gx + 1, gy) && cells[gy][gx + 1] === 1;
          const fU = inB(gx, gy - 1) && cells[gy - 1][gx] === 1;
          const fD = inB(gx, gy + 1) && cells[gy + 1][gx] === 1;
          let nx = 0, ny = 0;
          if (fL) { ent.x = rx - radius; nx = -1; }
          else if (fR) { ent.x = rx + cellSize + radius; nx = 1; }
          else if (fU) { ent.y = ry - radius; ny = -1; }
          else if (fD) { ent.y = ry + cellSize + radius; ny = 1; }
          else {
            const left = ent.x - rx, right = rx + cellSize - ent.x;
            const top = ent.y - ry, bot = ry + cellSize - ent.y;
            const m = Math.min(left, right, top, bot);
            if (m === left) { ent.x = rx - radius; nx = -1; }
            else if (m === right) { ent.x = rx + cellSize + radius; nx = 1; }
            else if (m === top) { ent.y = ry - radius; ny = -1; }
            else { ent.y = ry + cellSize + radius; ny = 1; }
          }
          if (ent.vx != null && ent.vy != null) {
            const dot = ent.vx * nx + ent.vy * ny;
            if (dot < 0) { ent.vx -= nx * dot; ent.vy -= ny * dot; }
          }
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

export default {
  buildWalkGrid,
  buildBoundaryColliders,
  buildInstanceGrid,
  resolveCircleInGrid,
  moduleConnectionAnchor,
  connectionPointInside,
  normalizeRotationDeg
};
