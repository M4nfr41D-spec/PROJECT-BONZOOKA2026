// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// SpatialHash.js - Grid-based spatial partitioning
// ============================================================
// Converts O(n²) collision checks to O(n) by bucketing entities
// into a fixed-size grid. Only entities sharing a cell (or
// adjacent cells) are tested against each other.
//
// Usage:
//   const grid = SpatialHash.create(128);    // cell size in px
//   SpatialHash.clear(grid);
//   SpatialHash.insert(grid, entity);        // entity needs x, y, radius
//   const nearby = SpatialHash.query(grid, x, y, radius);

export const SpatialHash = {

  /**
   * Create a new spatial hash grid.
   * @param {number} cellSize - Pixel size of each cell (power-of-2 recommended)
   * @returns {object} grid state
   */
  create(cellSize = 128) {
    return {
      cellSize,
      invCell: 1 / cellSize,
      cells: new Map(),   // "cx,cy" → Set<entity>
      entityCells: new Map()  // entity → [cellKeys]
    };
  },

  /**
   * Clear all entities from the grid.
   */
  clear(grid) {
    grid.cells.clear();
    grid.entityCells.clear();
  },

  /**
   * Hash world position to cell key.
   */
  _key(grid, wx, wy) {
    const cx = Math.floor(wx * grid.invCell);
    const cy = Math.floor(wy * grid.invCell);
    return (cx << 16) ^ cy;  // Fast integer key instead of string concat
  },

  /**
   * Get the cell keys an entity occupies (can span multiple cells).
   */
  _entityCells(grid, entity) {
    const r = entity.radius || entity.size || entity.r || 16;
    const x = entity.x;
    const y = entity.y;
    const cs = grid.cellSize;
    const inv = grid.invCell;

    const minCX = Math.floor((x - r) * inv);
    const maxCX = Math.floor((x + r) * inv);
    const minCY = Math.floor((y - r) * inv);
    const maxCY = Math.floor((y + r) * inv);

    const keys = [];
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        keys.push((cx << 16) ^ cy);
      }
    }
    return keys;
  },

  /**
   * Insert an entity into the grid.
   * Entity must have { x, y } and optionally { radius }.
   */
  insert(grid, entity) {
    const keys = this._entityCells(grid, entity);
    grid.entityCells.set(entity, keys);

    for (const key of keys) {
      let bucket = grid.cells.get(key);
      if (!bucket) {
        bucket = new Set();
        grid.cells.set(key, bucket);
      }
      bucket.add(entity);
    }
  },

  /**
   * Remove an entity from the grid.
   */
  remove(grid, entity) {
    const keys = grid.entityCells.get(entity);
    if (!keys) return;

    for (const key of keys) {
      const bucket = grid.cells.get(key);
      if (bucket) {
        bucket.delete(entity);
        if (bucket.size === 0) grid.cells.delete(key);
      }
    }
    grid.entityCells.delete(entity);
  },

  /**
   * Update an entity's position (remove + re-insert).
   * Call this when entity moves.
   */
  update(grid, entity) {
    this.remove(grid, entity);
    this.insert(grid, entity);
  },

  /**
   * Query all entities near a point within a radius.
   * Returns a Set of unique entities (no duplicates).
   */
  query(grid, x, y, radius) {
    const inv = grid.invCell;
    const minCX = Math.floor((x - radius) * inv);
    const maxCX = Math.floor((x + radius) * inv);
    const minCY = Math.floor((y - radius) * inv);
    const maxCY = Math.floor((y + radius) * inv);

    const result = new Set();
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = (cx << 16) ^ cy;
        const bucket = grid.cells.get(key);
        if (bucket) {
          for (const ent of bucket) {
            result.add(ent);
          }
        }
      }
    }
    return result;
  },

  /**
   * Query and filter by actual distance (circle check).
   * More precise than raw query which returns AABB matches.
   */
  queryCircle(grid, x, y, radius) {
    const candidates = this.query(grid, x, y, radius);
    const r2 = radius * radius;
    const result = [];

    for (const ent of candidates) {
      const dx = ent.x - x;
      const dy = ent.y - y;
      const er = ent.radius || ent.size || ent.r || 0;
      const dist2 = dx * dx + dy * dy;
      const maxDist = radius + er;
      if (dist2 <= maxDist * maxDist) {
        result.push(ent);
      }
    }
    return result;
  },

  /**
   * Check collision between two specific entities.
   */
  checkCollision(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const ra = a.radius || a.r || 16;
    const rb = b.radius || b.r || 16;
    const dist2 = dx * dx + dy * dy;
    const minDist = ra + rb;
    return dist2 <= minDist * minDist;
  },

  /**
   * Batch insert an array of entities.
   */
  insertAll(grid, entities) {
    for (let i = 0; i < entities.length; i++) {
      this.insert(grid, entities[i]);
    }
  },

  /**
   * Get grid stats for debugging / perf monitoring.
   */
  getStats(grid) {
    let totalEntities = 0;
    let maxBucketSize = 0;
    let occupiedCells = grid.cells.size;

    for (const bucket of grid.cells.values()) {
      totalEntities += bucket.size;
      if (bucket.size > maxBucketSize) maxBucketSize = bucket.size;
    }

    return {
      occupiedCells,
      totalEntities: grid.entityCells.size,
      totalCellEntries: totalEntities,   // may be > entities due to overlap
      maxBucketSize,
      avgBucketSize: occupiedCells > 0 ? (totalEntities / occupiedCells).toFixed(1) : 0
    };
  }
};

export default SpatialHash;
