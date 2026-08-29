// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// MapGenerator.js - Procedural Map Generation
// ============================================================
// Generates zones from seed + act config
// Same seed = same map layout

import { SeededRandom } from './SeededRandom.js';
import { State } from '../State.js';
import { SliceLock } from './SliceLock.js';
import { TopologySchema } from './topology/TopologySchema.js';
import { DerelictSliceGraph } from './topology/DerelictSliceGraph.js';
import { DerelictModuleLibrary } from './topology/DerelictModuleLibrary.js';

export const MapGenerator = {
  
  // Generate a zone from act config and seed
  generate(actConfig, zoneSeed, options = {}) {
    const rng = new SeededRandom(zoneSeed);
    const cfg = actConfig.generation || {};
    const pickRange = (v, fallbackMin, fallbackMax) => {
      if (Array.isArray(v) && v.length >= 2) return rng.int(v[0], v[1]);
      if (typeof v === 'number') return v;
      return rng.int(fallbackMin, fallbackMax);
    };


    const depth = options.depth || 1;
    const mods = options.mods || [];

    // Apply depth & modifiers to generation parameters (combinatorial, no run is the same)
    const modSet = new Set(mods);
    const scale = (v, mult) => v * mult;

    // Base depth ramps (gentle; combat scaling handled elsewhere)
    const depthEnemyMult = 1 + Math.min(depth * 0.012, 1.6);  // up to +160%
    const depthEliteMult = 1 + Math.min(depth * 0.010, 1.2);  // up to +120%
    const depthObsMult   = 1 + Math.min(depth * 0.008, 1.0);  // up to +100%

    let enemyDensity = (cfg.enemyDensity || 0.0005) * depthEnemyMult;
    let eliteDensity = (cfg.eliteDensity || 0.00008) * depthEliteMult;
    let obstacleDensity = (cfg.obstacleDensity || 0.0002) * depthObsMult;

    // Modifier effects (kept small but cumulative)
    if (modSet.has('BULLET_HELL')) enemyDensity = scale(enemyDensity, 1.35);
    if (modSet.has('ELITE_PACKS')) eliteDensity = scale(eliteDensity, 1.55);
    if (modSet.has('FAST_ENEMIES')) enemyDensity = scale(enemyDensity, 1.10);
    if (modSet.has('DENSE_OBSTACLES')) obstacleDensity = scale(obstacleDensity, 1.35);
    if (modSet.has('MINEFIELD')) obstacleDensity = scale(obstacleDensity, 1.15);
    let crampedMult = 1.0;
    if (modSet.has('CRAMPED_ZONE')) crampedMult = 0.85;

    // ═══ DIFFICULTY LANE MULTIPLIERS ═══
    const diff = options.difficulty || 'normal';
    if (diff === 'risk') {
      eliteDensity *= 3.0;
    } else if (diff === 'chaos') {
      eliteDensity *= 5.0;
      enemyDensity *= 1.3;
      obstacleDensity *= 1.4;
    }

    // Global exploration tuning overrides (config.json)
    // These exist to keep the engine testable (lower density / calmer combat) without touching act data.
    const tune = State.data.config?.exploration || {};
    if (typeof tune.enemyDensityMult === 'number') enemyDensity *= tune.enemyDensityMult;
    if (typeof tune.eliteDensityMult === 'number') eliteDensity *= tune.eliteDensityMult;
    
    // Zone dimensions
    let width = pickRange(cfg.width, 1500, 3000);
    let height = pickRange(cfg.height, 1500, 3000);
    if (crampedMult !== 1.0) { width = Math.floor(width * crampedMult); height = Math.floor(height * crampedMult); }

    // Map scale (exploration tuning)
    // NOTE: We intentionally scale the *world size* without scaling enemy counts linearly.
    // Density and hard caps (maxEnemySpawnsPerZone) remain the primary knobs to keep zones testable.
    const mapScale = (typeof tune.mapScale === 'number' && isFinite(tune.mapScale) && tune.mapScale > 0)
      ? tune.mapScale
      : 1.0;
    if (mapScale !== 1.0) {
      width = Math.max(600, Math.floor(width * mapScale));
      height = Math.max(600, Math.floor(height * mapScale));
    }

    const sliceTopologyBudget = (SliceLock.enabled && SliceLock.biome === 'derelict')
      ? TopologySchema.getBudget('medium')
      : null;
    
    // Generate zone structure
    const zone = {
      seed: zoneSeed,
      width: width,
      height: height,
      biome: actConfig.biome || 'space',
      
      // Spawn point (usually near edge)
      spawn: this.generateSpawnPoint(rng, width, height, cfg),
      
      // Exit point (opposite side from spawn)
      exit: null,
      
      // Enemy spawn positions
      enemySpawns: [],
      
      // Elite spawn positions  
      eliteSpawns: [],
      
      // Boss spawn (only in boss zones)
      bossSpawn: null,
      
      // Obstacles/Collision
      obstacles: [],
      
      // Decoration (asteroids, debris, etc)
      decorations: [],
      
      // Parallax layers
      parallax: this.generateParallax(rng, actConfig, width, height),
      
      // Pickups placed on map
      pickups: [],
      
      // Portals
      portals: [],
      
      // v2.16.3: Environmental structures (large navigable features)
      structures: []
    };
    
    // Generate exit opposite to spawn
    zone.exit = this.generateExitPoint(rng, zone.spawn, width, height);

    if (sliceTopologyBudget) {
      zone.topologyBudget = sliceTopologyBudget;
      zone.topology = DerelictSliceGraph.build(rng, zone, depth);
      zone.sliceLock = {
        enabled: true,
        biome: SliceLock.biome,
        themeId: SliceLock.themeId,
        mode: SliceLock.mode,
        label: SliceLock.label
      };
    }
    
    // ═══ v2.16.4: ZONE LAYOUT SYSTEM ═══
    let layout = null;
    let layoutWalls = [];
    try {
      layout = this._generateLayout(rng, width, height, zone.spawn, zone.exit, depth, { topology: zone.topology, budget: zone.topologyBudget });
      zone.layout = layout;
      if (layout?.carrierReady) {
        zone.moduleCarrier = {
          biome: SliceLock.biome,
          topologyId: layout.topologyId,
          carrierReady: true,
          roomModules: layout.rooms.map(r => ({ id: r.id, moduleId: r.moduleId, carrierClass: r.carrierClass })),
          corridorModules: layout.corridors.map(c => ({ from: c.fromNodeId, to: c.toNodeId, moduleId: c.module?.id || null, pathClass: c.pathClass }))
        };
      }
      
      if (layout && layout.rooms.length > 1) {
        const exitRoom = layout.rooms[layout.rooms.length - 1];
        zone.exit.x = exitRoom.cx;
        zone.exit.y = exitRoom.cy;
      }
      
      layoutWalls = this._generateLayoutWalls(rng, layout, width, height);
      
      zone.enemySpawns = this._generateRoomEnemies(
        rng, layout, actConfig.enemies?.pool || ['grunt'], enemyDensity, zone.spawn, zone.exit
      );
    } catch (layoutErr) {
      console.warn('[MapGen] Layout generation failed, falling back to classic:', layoutErr);
      zone.layout = null;
      // Fallback: classic enemy spawns
      zone.enemySpawns = this.generateEnemySpawns(
        rng, actConfig.enemies?.pool || ['grunt'], enemyDensity, width, height, zone.spawn, zone.exit
      );
    }

    // Optional: apply pack director (v9A0). Packs consume the existing spawn budget.
    // This keeps density/perf stable while adding composition variety.
    zone.enemySpawns = this.applyPackDirector(
      rng,
      zone.enemySpawns,
      actConfig.enemies?.pool || ['grunt'],
      zone.spawn,
      zone.exit
    );
    
    // Generate elite spawns
    zone.eliteSpawns = this.generateEliteSpawns(
      rng,
      actConfig.enemies?.elitePool || ['commander'],
      eliteDensity,
      width,
      height
    );
    
    // Generate obstacles: layout walls + asteroid clusters inside rooms
    const classicObs = this.generateObstacles(rng, obstacleDensity * (layout ? 0.5 : 1), width, height, { depth, mods, layout });
    zone.obstacles = [...layoutWalls, ...classicObs];
    
    // Generate decorations
    zone.decorations = this.generateDecorations(
      rng,
      actConfig.biome,
      width,
      height
    );
    
    // ========== ENVIRONMENTAL STRUCTURES (v2.16.3) ==========
    // Try to load a zone template first, fall back to procedural
    const template = this._pickZoneTemplate(rng, actConfig.biome);
    if (template) {
      // Use template structures (hand-designed in Map Editor)
      zone.structures = (template.structures || []).map(s => ({
        ...s,
        // Scale template to actual zone size
        x: (s.x / (template.zone?.width || zone.width)) * zone.width,
        y: (s.y / (template.zone?.height || zone.height)) * zone.height,
        segments: (s.segments || []).map(seg => ({
          ...seg,
          x: (seg.x / (template.zone?.width || zone.width)) * zone.width,
          y: (seg.y / (template.zone?.height || zone.height)) * zone.height,
        })),
        colliders: (s.segments || []).filter(seg => seg.collision !== false).map(seg => ({
          x: (seg.x / (template.zone?.width || zone.width)) * zone.width,
          y: (seg.y / (template.zone?.height || zone.height)) * zone.height,
          radius: seg.r || 30
        })),
        material: this._getMaterialPalette(s.material || 'rock', actConfig.biome),
        variant: s.material || 'rock',
        bounds: { x: zone.width / 2, y: zone.height / 2, radius: Math.max(zone.width, zone.height) / 2 }
      }));
      // Template entity markers → POIs / enemy spawns
      for (const ent of (template.entities || [])) {
        const ex = (ent.x / (template.zone?.width || zone.width)) * zone.width;
        const ey = (ent.y / (template.zone?.height || zone.height)) * zone.height;
        if (ent.type === 'elite_spawn') {
          zone.eliteSpawns.push({ x: ex, y: ey, type: rng.pick(actConfig.enemies?.elitePool || ['commander']) });
        } else if (ent.type === 'loot_crate') {
          zone.pois = zone.pois || [];
          zone.pois.push({ type: 'loot_cache', x: ex, y: ey, radius: 30, rarity: ent.rarity || 'rare', triggered: false, cleared: false });
        } else if (ent.type === 'ambush_trigger') {
          zone.pois = zone.pois || [];
          zone.pois.push({ type: 'ambush', x: ex, y: ey, radius: 120, enemyCount: ent.enemyCount || 6, triggered: false, cleared: false });
        }
      }
    } else {
      // Pure procedural structures
      zone.structures = this.generateStructures(rng, zone, actConfig, depth);
    }
    
    // ========== POI SYSTEM ==========
    // Points of Interest give structure and reason to explore
    zone.pois = this.generatePOIs(rng, zone, actConfig, { ...options, topology: zone.topology, topologyBudget: zone.topologyBudget });
    
    // ========== RESOURCE NODES ==========
    // Special destructible asteroids that drop crafting materials
    zone.resourceNodes = this.generateResourceNodes(rng, zone, actConfig, options);
    
    // ========== ZONE OBJECTIVE ==========
    // Gives each zone a purpose beyond "reach exit"
    zone.objective = this.generateObjective(rng, zone, depth, zone.topology);
    
    // ========== BRANCHING EXITS ==========
    // After depth 3, offer route choices at zone end
    if (depth >= 3) {
      zone.branchExits = this.generateBranchExits(rng, zone, depth, zone.topology);
    }
    
    return zone;
  },
  
  // Generate boss zone
  generateBossZone(actConfig, zoneSeed, options = {}) {
    const rng = new SeededRandom(zoneSeed);
    const cfg = actConfig.boss || {};
    
    // Boss arenas are more structured
    const width = cfg.arenaWidth || 1200;
    const height = cfg.arenaHeight || 1000;
    
    const zone = {
      seed: zoneSeed,
      width: width,
      height: height,
      biome: actConfig.biome,
      isBossZone: true,
      
      spawn: { x: width / 2, y: height - 100 },
      exit: null, // Portal appears after boss kill
      
      bossSpawn: { 
        x: width / 2, 
        y: 200,
        type: cfg.type || rng.pick(actConfig.enemies?.bossPool || ['sentinel'])
      },
      
      enemySpawns: [], // Boss spawns adds
      eliteSpawns: [],
      obstacles: this.generateBossArenaObstacles(rng, width, height),
      decorations: [],
      parallax: this.generateParallax(rng, actConfig, width, height),
      pickups: [],
      portals: []
    };
    
    return zone;
  },
  
  // Spawn point generation
  generateSpawnPoint(rng, w, h, cfg) {
    const edge = rng.pick(['bottom', 'left', 'right']);
    const margin = 100;
    
    switch (edge) {
      case 'bottom':
        return { x: rng.range(margin, w - margin), y: h - margin };
      case 'left':
        return { x: margin, y: rng.range(margin, h - margin) };
      case 'right':
        return { x: w - margin, y: rng.range(margin, h - margin) };
      default:
        return { x: w / 2, y: h - margin };
    }
  },
  
  // Exit point (opposite to spawn)
  generateExitPoint(rng, spawn, w, h) {
    const margin = 100;
    
    // If spawn is bottom, exit is top
    if (spawn.y > h / 2) {
      return { x: rng.range(margin, w - margin), y: margin };
    }
    // If spawn is left, exit is right
    if (spawn.x < w / 2) {
      return { x: w - margin, y: rng.range(margin, h - margin) };
    }
    // Otherwise exit is left
    return { x: margin, y: rng.range(margin, h - margin) };
  },
  
  // Enemy spawn positions
  generateEnemySpawns(rng, pool, density, w, h, spawn, exit) {
    const spawns = [];
    // Density is expressed as spawns per pixel^2.
    // We hard-cap the final amount to avoid runaway zones and keep perf + readability stable.
    const tune = State.data.config?.exploration || {};
    const maxSpawns = (typeof tune.maxEnemySpawnsPerZone === 'number') ? tune.maxEnemySpawnsPerZone : 120;
    const countRaw = Math.floor(w * h * density);
    const count = Math.max(0, Math.min(countRaw, maxSpawns));

    const minDistFromSpawn = (typeof tune.enemySpawnMinDistFromSpawn === 'number') ? tune.enemySpawnMinDistFromSpawn : 300;
    const minDistFromExit  = (typeof tune.enemySpawnMinDistFromExit === 'number') ? tune.enemySpawnMinDistFromExit : 200;
    const minDistBetween   = (typeof tune.enemySpawnMinDistBetween === 'number') ? tune.enemySpawnMinDistBetween : 150;
    
    for (let i = 0; i < count * 3 && spawns.length < count; i++) {
      const x = rng.range(100, w - 100);
      const y = rng.range(100, h - 100);
      
      // Check distances
      const distSpawn = Math.hypot(x - spawn.x, y - spawn.y);
      const distExit = Math.hypot(x - exit.x, y - exit.y);
      
      if (distSpawn < minDistFromSpawn) continue;
      if (distExit < minDistFromExit) continue;
      
      // Check distance from other spawns
      let tooClose = false;
      for (const s of spawns) {
        if (Math.hypot(x - s.x, y - s.y) < minDistBetween) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      
      spawns.push({
        x: x,
        y: y,
        type: rng.pick(pool),
        patrol: rng.pick(['static', 'circle', 'line', 'wander']),
        patrolRadius: rng.int(50, 150),
        active: false,
        killed: false
      });
    }
    
    return spawns;
  },

  // ------------------------------------------------------------
  // Pack Director (v9A0)
  // ------------------------------------------------------------
  // Turns a portion of single spawns into small packs (3-5 members)
  // using templates from data/packs.json when available.
  // Invariants:
  // - Does NOT increase total spawn count (consumes existing budget)
  // - Deterministic for a given rng/seed
  // - Keeps spawns away from spawn/exit
  applyPackDirector(rng, spawns, pool, spawnPt, exitPt) {
    const packsData = State.data.packs;
    if (!packsData || !Array.isArray(packsData.templates) || packsData.templates.length === 0) {
      return spawns;
    }

    // Settings (defaults chosen to be safe/testable)
    const packChance = (typeof packsData.packChance === 'number') ? packsData.packChance : 0.7;
    const minSize = (typeof packsData.packSizeMin === 'number') ? packsData.packSizeMin : 3;
    const maxSize = (typeof packsData.packSizeMax === 'number') ? packsData.packSizeMax : 5;
    const maxPacksPerZone = (typeof packsData.maxPacksPerZone === 'number') ? packsData.maxPacksPerZone : 6;
    const spacing = (typeof packsData.memberSpacing === 'number') ? packsData.memberSpacing : 120;
    const minDistFromSpawn = (typeof packsData.minDistFromSpawn === 'number') ? packsData.minDistFromSpawn : 350;
    const minDistFromExit  = (typeof packsData.minDistFromExit === 'number') ? packsData.minDistFromExit : 250;

    if (!Array.isArray(spawns) || spawns.length < minSize) return spawns;

    // Shuffle indices deterministically
    const idx = spawns.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      const tmp = idx[i];
      idx[i] = idx[j];
      idx[j] = tmp;
    }

    // Helpers
    const pickTemplate = () => {
      // weighted pick
      let total = 0;
      for (const t of packsData.templates) total += (typeof t.weight === 'number' ? t.weight : 1);
      let r = rng.range(0, total);
      for (const t of packsData.templates) {
        r -= (typeof t.weight === 'number' ? t.weight : 1);
        if (r <= 0) return t;
      }
      return packsData.templates[0];
    };

    const validAnchor = (p) => {
      const ds = Math.hypot(p.x - spawnPt.x, p.y - spawnPt.y);
      const de = Math.hypot(p.x - exitPt.x,  p.y - exitPt.y);
      return ds >= minDistFromSpawn && de >= minDistFromExit;
    };

    const used = new Set();
    const out = [];
    let packsMade = 0;

    for (let k = 0; k < idx.length && packsMade < maxPacksPerZone; k++) {
      const i = idx[k];
      if (used.has(i)) continue;
      const anchor = spawns[i];
      if (!anchor || !validAnchor(anchor)) continue;

      if (rng.range(0, 1) > packChance) continue;

      const tpl = pickTemplate();

      // If template defines explicit members, build exact composition.
      let memberTypes = null;
      if (tpl && Array.isArray(tpl.members) && tpl.members.length > 0) {
        memberTypes = [];
        for (const mm of tpl.members) {
          const mi = (typeof mm.min === 'number') ? mm.min : 1;
          const ma = (typeof mm.max === 'number') ? mm.max : mi;
          const cnt = rng.int(mi, ma);
          for (let c = 0; c < cnt; c++) memberTypes.push(mm.type);
        }
        // Ensure minimal size
        if (memberTypes.length < 1) memberTypes = null;
      }

      const size = memberTypes ? memberTypes.length : rng.int(minSize, maxSize);

      // consume 'size' spawns from budget (anchor + size-1 additional)
      used.add(i);
      let consumed = 1;
      for (let kk = k + 1; kk < idx.length && consumed < size; kk++) {
        const j = idx[kk];
        if (used.has(j)) continue;
        used.add(j);
        consumed++;
      }

      // Create pack members around anchor
      for (let m = 0; m < size; m++) {
        const angle = rng.range(0, Math.PI * 2);
        const dist = rng.range(30, spacing);
        const px = anchor.x + Math.cos(angle) * dist;
        const py = anchor.y + Math.sin(angle) * dist;

        // Template can force composition via members, or allow random types via tpl.types; otherwise use pool
        let type = null;
        if (memberTypes && memberTypes.length === size) {
          type = memberTypes[m];
        } else if (tpl && Array.isArray(tpl.types) && tpl.types.length > 0) {
          type = rng.pick(tpl.types);
        }
        if (!type) type = rng.pick(pool);

        out.push({
          x: px,
          y: py,
          type,
          patrol: anchor.patrol,
          patrolRadius: anchor.patrolRadius,
          active: false,
          killed: false,
          packId: tpl?.id || 'pack'
        });
      }

      packsMade++;
    }

    // Add remaining singles (not consumed)
    for (let i = 0; i < spawns.length; i++) {
      if (used.has(i)) continue;
      out.push(spawns[i]);
    }

    return out;
  },
  
  // Elite spawn positions
  generateEliteSpawns(rng, pool, density, w, h) {
    const spawns = [];
    const tune = State.data.config?.exploration || {};
    const maxElites = (typeof tune.maxEliteSpawnsPerZone === 'number') ? tune.maxEliteSpawnsPerZone : 8;
    const countRaw = Math.floor(w * h * density);
    const count = Math.max(1, Math.min(countRaw, maxElites));
    
    for (let i = 0; i < count; i++) {
      spawns.push({
        x: rng.range(200, w - 200),
        y: rng.range(200, h - 200),
        type: rng.pick(pool),
        active: false,
        killed: false
      });
    }
    
    return spawns;
  },
  
  // Obstacles (collision)
  generateObstacles(rng, density, w, h, options = {}) {
    const obstacles = [];
    const tune = State.data.config?.exploration || {};
    const maxObs = (typeof tune.maxObstaclesPerZone === 'number') ? tune.maxObstaclesPerZone : 60;
    const depth = options.depth || 1;
    const mods = options.mods || [];
    const modSet = new Set(mods);

    // Budget: much less dense — aim for 30-60 meaningful obstacles, not 1200 noise
    const budgetTotal = Math.min(Math.floor(w * h * density * 0.15), maxObs);
    
    // ── PHASE 1: Corridor walls (25% of budget) ──
    // Sparse asteroid walls along corridors for structure
    const corridorBudget = Math.floor(budgetTotal * 0.25);
    const corridorObs = this._generateCorridorWalls(rng, w, h, corridorBudget, options);
    for (const o of corridorObs) obstacles.push(o);
    
    // ── PHASE 2: Cluster formations (35% of budget) ──
    // A few meaningful clusters, not visual noise
    const clusterBudget = Math.floor(budgetTotal * 0.35);
    const clusterCount = rng.int(2, 4);
    let clusterUsed = 0;
    
    for (let c = 0; c < clusterCount && clusterUsed < clusterBudget; c++) {
      const cx = rng.range(200, w - 200);
      const cy = rng.range(200, h - 200);
      const clusterSize = rng.int(4, 10);
      const clusterRadius = rng.range(60, 150);
      
      for (let i = 0; i < clusterSize && clusterUsed < clusterBudget; i++) {
        const a = rng.range(0, Math.PI * 2);
        const d = rng.range(0, clusterRadius);
        // Mines ONLY in MINEFIELD modifier zones — never in normal pools
        const typePool = modSet.has('MINEFIELD') ? ['asteroid','debris','mine'] : ['asteroid','debris'];
        const type = rng.pick(typePool);
        obstacles.push({
          x: cx + Math.cos(a) * d,
          y: cy + Math.sin(a) * d,
          type: type,
          radius: type === 'asteroid' ? rng.int(20, 60) : rng.int(12, 25),
          rotation: rng.range(0, Math.PI * 2),
          destructible: true,
          hp: type === 'asteroid' ? rng.int(25, 60) : (type === 'mine' ? 6 : 12),
          damage: type === 'mine' ? (8 + Math.floor(depth * 0.25)) : 0
        });
        clusterUsed++;
      }
    }
    
    // ── PHASE 3: Scatter fill (remaining budget) ──
    const scatterBudget = budgetTotal - obstacles.length;
    for (let i = 0; i < scatterBudget; i++) {
      // No mines outside MINEFIELD modifier
      const typePool = modSet.has('MINEFIELD') ? ['asteroid','debris','mine'] : ['asteroid','debris'];
      const type = rng.pick(typePool);
      obstacles.push({
        x: rng.range(100, w - 100),
        y: rng.range(100, h - 100),
        type: type,
        radius: type === 'asteroid' ? rng.int(25, 70) : rng.int(15, 30),
        rotation: rng.range(0, Math.PI * 2),
        destructible: true,
        hp: type === 'asteroid' ? rng.int(25, 60) : (type === 'mine' ? 6 : 12),
        damage: type === 'mine' ? (8 + Math.floor(depth * 0.25)) : 0
      });
    }
    
    // ═══ DIFFICULTY HP SCALING ═══
    const diff = options.difficulty || 'normal';
    if (diff === 'chaos') {
      // Chaos: tougher asteroids, mines become hunting mines
      for (const obs of obstacles) {
        if (obs.hp) obs.hp = Math.ceil(obs.hp * 2.5);
        if (obs.type === 'mine') {
          obs.hunting = true;      // mines track player
          obs.huntSpeed = 40;      // px/s tracking speed
          obs.damage = Math.ceil(obs.damage * 1.5);
        }
      }
      
      // Add poison areas (3-5 toxic zones)
      const poisonCount = rng.int(3, 5);
      for (let i = 0; i < poisonCount; i++) {
        obstacles.push({
          x: rng.range(200, w - 200),
          y: rng.range(200, h - 200),
          type: 'poison_area',
          radius: rng.int(80, 160),
          destructible: false,
          dotDamage: 3 + Math.floor(depth * 0.1),
          rotation: 0,
          glow: '#44ff00'
        });
      }
    }
    
    return obstacles;
  },
  
  // Generate asteroid walls along natural corridors
  _generateCorridorWalls(rng, w, h, budget, options) {
    const walls = [];
    
    // Create 2-4 corridor paths across the zone
    const corridorCount = rng.int(2, 4);
    const perCorridor = Math.floor(budget / corridorCount);
    
    for (let c = 0; c < corridorCount; c++) {
      // Random start/end edges
      const startEdge = rng.pick(['top', 'bottom', 'left', 'right']);
      let sx, sy, ex, ey;
      const m = 150;
      
      switch (startEdge) {
        case 'top': sx = rng.range(m, w - m); sy = m; ex = rng.range(m, w - m); ey = h - m; break;
        case 'bottom': sx = rng.range(m, w - m); sy = h - m; ex = rng.range(m, w - m); ey = m; break;
        case 'left': sx = m; sy = rng.range(m, h - m); ex = w - m; ey = rng.range(m, h - m); break;
        default: sx = w - m; sy = rng.range(m, h - m); ex = m; ey = rng.range(m, h - m); break;
      }
      
      // Generate wall points along the corridor with jitter
      const segments = rng.int(8, 15);
      const corridorWidth = rng.range(100, 200); // gap width
      
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const baseX = sx + (ex - sx) * t;
        const baseY = sy + (ey - sy) * t;
        
        // Perpendicular direction
        const dx = ex - sx;
        const dy = ey - sy;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = -dy / len;
        const perpY = dx / len;
        
        // Add jitter to make it organic
        const jitterX = rng.range(-80, 80);
        const jitterY = rng.range(-80, 80);
        
        // Place asteroids on both sides of the corridor
        const asteroidsPerSide = Math.floor(perCorridor / segments / 2);
        
        for (let side = -1; side <= 1; side += 2) {
          for (let a = 0; a < asteroidsPerSide && walls.length < budget; a++) {
            const offset = corridorWidth * 0.5 + rng.range(20, 120);
            const spread = rng.range(-40, 40);
            const px = baseX + jitterX + perpX * offset * side + rng.range(-20, 20);
            const py = baseY + jitterY + perpY * offset * side + rng.range(-20, 20);
            
            if (px < 50 || px > w - 50 || py < 50 || py > h - 50) continue;
            
            walls.push({
              x: px, y: py,
              type: 'asteroid',
              radius: rng.int(20, 55),
              rotation: rng.range(0, Math.PI * 2),
              destructible: true,
              hp: rng.int(30, 60)
            });
          }
        }
      }
    }
    
    return walls;
  },
  
  // Boss arena obstacles
  generateBossArenaObstacles(rng, w, h) {
    const obstacles = [];
    // Pillars for cover
    const pillarCount = rng.int(2, 4);
    
    for (let i = 0; i < pillarCount; i++) {
      const angle = (i / pillarCount) * Math.PI * 2;
      const dist = rng.range(200, 350);
      obstacles.push({
        x: w / 2 + Math.cos(angle) * dist,
        y: h / 2 + Math.sin(angle) * dist,
        type: 'pillar',
        radius: 40,
        destructible: false
      });
    }
    
    return obstacles;
  },
  
  // Decorations (no collision, just visual)
  generateDecorations(rng, biome, w, h) {
    const decorations = [];
    const tune = State.data.config?.exploration || {};
    const maxDec = (typeof tune.maxDecorationsPerZone === 'number') ? tune.maxDecorationsPerZone : 3000;
    
    // ── LAYER 1: Background dust clouds (large, very faint) ──
    const dustCount = rng.int(4, 8);
    for (let i = 0; i < dustCount; i++) {
      const colors = {
        'space': ['#221144', '#112244', '#110033', '#001122'],
        'asteroid': ['#332211', '#221100', '#1a1a00', '#112211'],
        'station': ['#111122', '#0a0a1a', '#1a1122', '#0a1122']
      };
      decorations.push({
        x: rng.range(0, w),
        y: rng.range(0, h),
        type: 'dust_cloud',
        width: rng.range(400, 900),
        height: rng.range(250, 600),
        color: rng.pick(colors[biome] || colors['space']),
        alpha: rng.range(0.06, 0.15),
        rotation: rng.range(0, Math.PI * 2),
        scale: 1
      });
    }
    
    // ── LAYER 2: Nebula patches (medium, colored, atmospheric) ──
    const nebulaCount = rng.int(2, 5);
    const nebulaColors = {
      'space': ['#4400aa', '#aa0044', '#0044aa', '#006644'],
      'asteroid': ['#664400', '#446600', '#884400', '#226622'],
      'station': ['#004488', '#440088', '#006688', '#880044']
    };
    for (let i = 0; i < nebulaCount; i++) {
      decorations.push({
        x: rng.range(100, w - 100),
        y: rng.range(100, h - 100),
        type: 'nebula_patch',
        radius: rng.range(150, 400),
        color: rng.pick(nebulaColors[biome] || nebulaColors['space']),
        alpha: rng.range(0.04, 0.12),
        rotation: rng.range(0, Math.PI * 2),
        scale: 1
      });
    }
    
    // ── LAYER 3: Landmarks (large, distinctive, non-interactive) ──
    const landmarkCount = rng.int(3, 6);
    const landmarkTypes = this._getLandmarkTypes(biome);
    for (let i = 0; i < landmarkCount; i++) {
      const type = rng.pick(landmarkTypes);
      decorations.push({
        x: rng.range(200, w - 200),
        y: rng.range(200, h - 200),
        type: type,
        scale: rng.range(0.7, 1.5),
        rotation: rng.range(0, Math.PI * 2),
        alpha: rng.range(0.4, 0.8),
        variant: rng.int(0, 3) // visual variant
      });
    }
    
    // ── LAYER 4: Scattered small decorations (stars, rocks, sparkles) ──
    const smallTypes = {
      'space': ['star_bright', 'star_dim', 'star_colored', 'sparkle'],
      'asteroid': ['rock_small', 'rock_tiny', 'ice_shard', 'metal_flake'],
      'station': ['panel_fragment', 'wire_coil', 'light_flicker', 'spark']
    };
    const smallPool = smallTypes[biome] || smallTypes['space'];
    const smallCount = Math.min(maxDec - decorations.length, Math.floor(w * h * 0.0004));
    
    for (let i = 0; i < smallCount; i++) {
      const type = rng.pick(smallPool);
      decorations.push({
        x: rng.range(0, w),
        y: rng.range(0, h),
        type: type,
        scale: rng.range(0.3, 1.2),
        rotation: rng.range(0, Math.PI * 2),
        alpha: type.includes('dim') ? rng.range(0.15, 0.4) : rng.range(0.4, 0.9),
        color: this._getDecoColor(rng, type, biome),
        size: rng.range(1, 4)
      });
    }
    
    return decorations;
  },
  
  // Landmark types per biome
  _getLandmarkTypes(biome) {
    switch (biome) {
      case 'asteroid':
        return ['rock_formation', 'ice_cluster', 'ancient_marker', 'dead_ship', 'mining_rig'];
      case 'station':
        return ['station_hull', 'antenna_array', 'cargo_pod', 'solar_panel', 'dead_ship'];
      default: // space
        return ['gas_cloud', 'dead_ship', 'ancient_marker', 'comet_trail', 'beacon_ruins'];
    }
  },
  
  // Decoration colors per type/biome
  _getDecoColor(rng, type, biome) {
    const palettes = {
      star_bright: ['#ffffff', '#ffffcc', '#ccddff'],
      star_dim: ['#666688', '#556677', '#445566'],
      star_colored: ['#ff8866', '#66aaff', '#ffcc44', '#88ff88', '#ff66aa'],
      sparkle: ['#ffffff', '#aaddff', '#ffddaa'],
      rock_small: ['#667788', '#556677', '#445566'],
      rock_tiny: ['#778899', '#556677', '#445566'],
      ice_shard: ['#88ccff', '#aaddff', '#66bbee'],
      metal_flake: ['#8899aa', '#99aabb', '#778899'],
      panel_fragment: ['#556677', '#667788', '#445566'],
      wire_coil: ['#887744', '#776633', '#665522'],
      light_flicker: ['#ffcc00', '#ff8800', '#00aaff'],
      spark: ['#ffdd44', '#ff8844', '#ffffff']
    };
    return rng.pick(palettes[type] || ['#888888']);
  },
  
  // Parallax layer generation
  generateParallax(rng, actConfig, w, h) {
    const cfg = actConfig.parallax || {};
    const tune = State.data.config?.exploration || {};
    const maxBgStars = (typeof tune.maxStarsBackground === 'number') ? tune.maxStarsBackground : 1800;
    const maxMidStars = (typeof tune.maxStarsMidground === 'number') ? tune.maxStarsMidground : 1200;
    
    return {
      // Layer 0: Deep background (slowest)
      background: {
        color: cfg.bgColor || '#0a0a15',
        stars: this.generateStarfield(rng, w * 1.5, h * 1.5, 0.0003, maxBgStars),
        scrollSpeed: 0.1
      },
      // Layer 1: Mid stars
      midground: {
        stars: this.generateStarfield(rng, w * 1.3, h * 1.3, 0.0002, maxMidStars),
        scrollSpeed: 0.3
      },
      // Layer 2: Near stars/nebula
      foreground: {
        objects: this.generateNebulaWisps(rng, w, h, cfg.nebula),
        scrollSpeed: 0.6
      },
      // Layer 3: Very close particles (fastest, optional)
      particles: {
        scrollSpeed: 0.9
      }
    };
  },
  
  // Generate starfield
  generateStarfield(rng, w, h, density, maxCount = null) {
    const stars = [];
    const countRaw = Math.floor(w * h * density);
    const cap = (typeof maxCount === 'number' && Number.isFinite(maxCount) && maxCount > 0)
      ? Math.floor(maxCount)
      : null;
    const count = cap ? Math.min(countRaw, cap) : countRaw;
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rng.range(0, w),
        y: rng.range(0, h),
        size: rng.range(0.5, 2),
        brightness: rng.range(0.3, 1),
        twinkle: rng.chance(0.3)
      });
    }
    
    return stars;
  },
  
  // Generate nebula wisps
  generateNebulaWisps(rng, w, h, nebulaConfig) {
    if (!nebulaConfig?.enabled) return [];
    
    const wisps = [];
    const count = nebulaConfig.count || rng.int(3, 8);
    const color = nebulaConfig.color || '#4400aa';
    
    for (let i = 0; i < count; i++) {
      wisps.push({
        x: rng.range(0, w),
        y: rng.range(0, h),
        width: rng.range(200, 500),
        height: rng.range(100, 300),
        color: color,
        alpha: rng.range(0.05, 0.15),
        rotation: rng.range(0, Math.PI * 2)
      });
    }
    
    return wisps;
  },
  
  // ============================================================
  // POI SYSTEM - Points of Interest
  // ============================================================
  // Places structured encounters along a path from spawn → exit
  // Each POI type has different gameplay: combat, loot, mining, challenge
  
  generatePOIs(rng, zone, actConfig, options = {}) {
    const pois = [];
    const depth = options.depth || 1;
    const w = zone.width;
    const h = zone.height;
    const spawn = zone.spawn;
    const exit = zone.exit;
    
    // POI budget: 3-4 early → 5-7 endgame
    const area = w * h;
    const basePOIs = Math.max(2, Math.floor(area / 15000000) + 1);
    const depthBonus = Math.floor(depth / 15);
    const maxPOIs = Math.min(7, basePOIs + depthBonus);
    const topology = options.topology || zone.topology || null;
    const topologyPoiBudget = topology?.validation?.counts?.poiCount || topology?.budget?.poiNodes?.[1] || null;
    const poiCount = topologyPoiBudget
      ? Math.max(1, topologyPoiBudget)
      : rng.int(Math.max(2, maxPOIs - 1), maxPOIs);

    // A35: guarantee one deterministic derelict entry near spawn so the isolated
    // tile-instance path is always testable and no longer hidden behind deep RNG.
    const guaranteedDerelictEntry = (options.guaranteedDerelictEntry !== false && !zone.instanceInfo && !zone._isVault)
      ? this._createGuaranteedDerelictEntryPoi(rng, zone, actConfig, depth)
      : null;
    if (guaranteedDerelictEntry) {
      pois.push(guaranteedDerelictEntry);
      this._attachPOIToZone(zone, guaranteedDerelictEntry);
    }
    
    // Generate POI positions along a path from spawn to exit
    // This creates a "journey" through the zone instead of random scatter
    const remainingPoiCount = Math.max(1, poiCount - (guaranteedDerelictEntry ? 1 : 0));
    const pathPoints = this._generatePathPoints(rng, spawn, exit, w, h, remainingPoiCount);
    
    // Available POI types per tier
    const tierPOIs = this._getPOITypesForTier(actConfig, depth).filter(t => t !== 'salvage_wreck');
    
    for (let i = 0; i < pathPoints.length; i++) {
      const pt = pathPoints[i];
      const poiType = rng.pick(tierPOIs);
      const poi = this._createPOI(rng, poiType, pt.x, pt.y, depth, actConfig, i + (guaranteedDerelictEntry ? 1 : 0));
      if (poi) {
        pois.push(poi);
        this._attachPOIToZone(zone, poi);
      }
    }
    
    return pois;
  },

  _attachPOIToZone(zone, poi) {
    if (!poi || !zone) return;
    if (poi.enemies) {
      for (const e of poi.enemies) {
        zone.enemySpawns.push({
          ...e,
          poiId: poi.id,
          active: false,
          killed: false
        });
      }
    }
    if (poi.obstacles) {
      for (const o of poi.obstacles) zone.obstacles.push(o);
    }
  },

  _createGuaranteedDerelictEntryPoi(rng, zone, actConfig, depth) {
    const spawn = zone?.spawn || { x: 0, y: 0 };
    const exit = zone?.exit || { x: zone.width || 2000, y: zone.height || 2000 };
    const margin = 260;
    const dx = exit.x - spawn.x;
    const dy = exit.y - spawn.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const px = -ny;
    const py = nx;
    const forward = Math.min(Math.max(360, len * 0.12), 620);
    const lateral = rng.chance(0.5) ? 180 : -180;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const x = clamp(spawn.x + nx * forward + px * lateral, margin, Math.max(margin, zone.width - margin));
    const y = clamp(spawn.y + ny * forward + py * lateral, margin, Math.max(margin, zone.height - margin));
    const poi = this._createPOI(rng, 'salvage_wreck', x, y, depth, actConfig, 'entry');
    if (!poi) return null;
    const _tierTag = poi.tier === 'chaos' ? ' \u00B7 CHAOS' : (poi.tier === 'risk' ? ' \u00B7 RISK' : '');
    poi.id = 'poi_guaranteed_derelict_entry';
    poi.label = 'Derelict Breach' + _tierTag;
    poi.icon = '🏚️';
    poi.radius = Math.max(poi.radius || 150, 180);
    poi.guaranteedInstanceEntry = true;
    poi.minimapPriority = 100;
    poi.interactPrompt = 'Press E to breach derelict interior' + _tierTag;
    poi.triggered = true;
    poi.cleared = true;
    poi.collected = false;
    return poi;
  },
  
  // Generate waypoints from spawn to exit with jitter for natural pathing
  _generatePathPoints(rng, spawn, exit, w, h, count) {
    const points = [];
    const margin = 200;
    
    for (let i = 0; i < count; i++) {
      // Interpolate along spawn→exit with perpendicular jitter
      const t = (i + 1) / (count + 1);
      const baseX = spawn.x + (exit.x - spawn.x) * t;
      const baseY = spawn.y + (exit.y - spawn.y) * t;
      
      // Perpendicular offset for variety (up to 30% of zone width)
      const perpX = -(exit.y - spawn.y);
      const perpY = exit.x - spawn.x;
      const perpLen = Math.hypot(perpX, perpY) || 1;
      const maxOffset = Math.min(w, h) * 0.3;
      const offset = rng.range(-maxOffset, maxOffset);
      
      let x = baseX + (perpX / perpLen) * offset;
      let y = baseY + (perpY / perpLen) * offset;
      
      // Clamp to zone bounds
      x = Math.max(margin, Math.min(w - margin, x));
      y = Math.max(margin, Math.min(h - margin, y));
      
      points.push({ x, y });
    }
    
    return points;
  },
  
  // POI types available per tier
  _getPOITypesForTier(actConfig, depth) {
    const base = ['guard_post', 'treasure_cache', 'ore_deposit'];
    if (depth >= 5) base.push('ambush_zone', 'salvage_wreck');
    if (depth >= 10) base.push('elite_den', 'crystal_cavern');
    if (depth >= 20) base.push('defense_beacon', 'void_rift');
    if (depth >= 50) base.push('ancient_vault');
    return base;
  },
  
  // Create a specific POI with enemies, obstacles, and rewards
  _createPOI(rng, type, cx, cy, depth, actConfig, index) {
    const pool = actConfig.enemies?.pool || ['grunt'];
    const elitePool = actConfig.enemies?.elitePool || ['commander'];
    const id = `poi_${index}_${type}`;
    
    switch (type) {
      // ── GUARD POST ──
      // 4-6 enemies arranged in a circle guarding a loot container
      case 'guard_post': {
        const guardCount = rng.int(4, 6);
        const enemies = [];
        const radius = rng.int(100, 160);
        for (let i = 0; i < guardCount; i++) {
          const a = (i / guardCount) * Math.PI * 2;
          enemies.push({
            x: cx + Math.cos(a) * radius,
            y: cy + Math.sin(a) * radius,
            type: rng.pick(pool),
            patrol: 'circle',
            patrolRadius: 40
          });
        }
        // Cover obstacles around the loot
        const obstacles = [];
        for (let i = 0; i < 3; i++) {
          const a = rng.range(0, Math.PI * 2);
          obstacles.push({
            x: cx + Math.cos(a) * (radius * 0.5),
            y: cy + Math.sin(a) * (radius * 0.5),
            type: 'debris', radius: rng.int(20, 35),
            destructible: true, hp: 20, rotation: rng.range(0, Math.PI * 2)
          });
        }
        return {
          id, type, x: cx, y: cy, radius: radius + 80,
          icon: '📦', label: 'Guarded Cache',
          reward: { type: 'loot_cache', rarity: depth > 20 ? 'rare' : 'uncommon', scrap: rng.int(30, 60) + depth * 2 },
          enemies, obstacles,
          triggered: false, cleared: false, collected: false
        };
      }
      
      // ── TREASURE CACHE ──
      // Light or no enemies, guaranteed item drop
      case 'treasure_cache': {
        const hasGuard = rng.chance(0.4);
        const enemies = [];
        if (hasGuard) {
          enemies.push({
            x: cx + rng.range(-60, 60), y: cy + rng.range(-60, 60),
            type: rng.pick(pool), patrol: 'static', patrolRadius: 30
          });
        }
        return {
          id, type, x: cx, y: cy, radius: 80,
          icon: '💎', label: 'Hidden Cache',
          reward: { type: 'loot_cache', rarity: rng.chance(0.15) ? 'epic' : 'rare', scrap: rng.int(25, 50) + depth * 2 },
          enemies, obstacles: [],
          triggered: false, cleared: !hasGuard, collected: false
        };
      }
      
      // ── AMBUSH ZONE ──
      // Enemies spawn when player enters radius (not visible beforehand)
      case 'ambush_zone': {
        const count = rng.int(5, 8);
        const enemies = [];
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          const d = rng.range(80, 200);
          enemies.push({
            x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d,
            type: rng.pick(pool), patrol: 'wander', patrolRadius: 60,
            ambush: true, ambushDelay: rng.range(0.2, 1.5) // staggered spawn
          });
        }
        return {
          id, type, x: cx, y: cy, radius: 250,
          icon: '⚠️', label: 'Danger Zone',
          reward: { type: 'cells', value: rng.int(30, 60) + depth * 2, scrap: rng.int(30, 60) + depth * 2 },
          enemies, obstacles: [],
          triggered: false, cleared: false, collected: false,
          hidden: true // not shown on minimap until triggered
        };
      }
      
      // ── ELITE DEN ──
      // Mini-boss + 2-3 minions, guaranteed rare+ drop
      case 'elite_den': {
        const enemies = [];
        // Elite in center
        enemies.push({
          x: cx, y: cy, type: rng.pick(elitePool),
          patrol: 'circle', patrolRadius: 80, isElite: true
        });
        // Minions
        const minionCount = rng.int(2, 3);
        for (let i = 0; i < minionCount; i++) {
          const a = rng.range(0, Math.PI * 2);
          enemies.push({
            x: cx + Math.cos(a) * 120, y: cy + Math.sin(a) * 120,
            type: rng.pick(pool), patrol: 'circle', patrolRadius: 50
          });
        }
        // Arena walls
        const obstacles = [];
        const wallCount = rng.int(4, 6);
        for (let i = 0; i < wallCount; i++) {
          const a = (i / wallCount) * Math.PI * 2 + rng.range(-0.3, 0.3);
          obstacles.push({
            x: cx + Math.cos(a) * 200, y: cy + Math.sin(a) * 200,
            type: 'asteroid', radius: rng.int(35, 55),
            destructible: true, hp: 40, rotation: rng.range(0, Math.PI * 2)
          });
        }
        return {
          id, type, x: cx, y: cy, radius: 220,
          icon: '💀', label: 'Elite Den',
          reward: { type: 'loot_cache', rarity: 'epic', scrap: rng.int(50, 80) + depth * 3, cells: rng.int(20, 40) + depth * 2 },
          enemies, obstacles,
          triggered: false, cleared: false, collected: false
        };
      }
      
      // ── ORE DEPOSIT ──
      // Cluster of rich ore asteroids (3-5) that drop extra crafting mats
      case 'ore_deposit': {
        const nodeCount = rng.int(3, 5);
        const obstacles = [];
        for (let i = 0; i < nodeCount; i++) {
          const a = rng.range(0, Math.PI * 2);
          const d = rng.range(30, 100);
          obstacles.push({
            x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d,
            type: 'ore_rich', radius: rng.int(25, 50),
            destructible: true, hp: rng.int(30, 60),
            rotation: rng.range(0, Math.PI * 2),
            resourceType: 'scrap', resourceMult: 3,
            glow: '#ffaa00'
          });
        }
        return {
          id, type, x: cx, y: cy, radius: 150,
          icon: '⛏️', label: 'Ore Deposit',
          reward: { type: 'cells', value: rng.int(15, 30) + depth, scrap: rng.int(20, 40) + depth }, // mining bonus on clear
          enemies: [], obstacles,
          triggered: true, cleared: true, collected: false
        };
      }
      
      // ── CRYSTAL CAVERN ──
      // Blue crystal nodes that drop cells + chance of void shards
      case 'crystal_cavern': {
        const nodeCount = rng.int(3, 4);
        const obstacles = [];
        for (let i = 0; i < nodeCount; i++) {
          const a = (i / nodeCount) * Math.PI * 2 + rng.range(-0.4, 0.4);
          const d = rng.range(40, 90);
          obstacles.push({
            x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d,
            type: 'crystal_node', radius: rng.int(20, 40),
            destructible: true, hp: rng.int(20, 45),
            rotation: rng.range(0, Math.PI * 2),
            resourceType: 'cells', resourceMult: 4,
            glow: '#00aaff',
            voidShardChance: depth >= 30 ? 0.15 : 0.05
          });
        }
        // Light enemy guard
        const enemies = [];
        if (rng.chance(0.5)) {
          enemies.push({
            x: cx + rng.range(-80, 80), y: cy + rng.range(-80, 80),
            type: rng.pick(pool), patrol: 'circle', patrolRadius: 60
          });
        }
        return {
          id, type, x: cx, y: cy, radius: 140,
          icon: '🔷', label: 'Crystal Cavern',
          reward: null, enemies, obstacles,
          triggered: true, cleared: enemies.length === 0, collected: false
        };
      }
      
      // ── SALVAGE WRECK ──
      // Destroyed ship hull with mixed loot: scrap + cells + chance of item
      case 'salvage_wreck': {
        // Risk tier for this instance (weighted: mostly normal, some risk, rare chaos)
        const tierRoll = rng.range(0, 1);
        const tier = tierRoll < 0.58 ? 'normal' : (tierRoll < 0.88 ? 'risk' : 'chaos');
        const TIER_VIS = {
          normal: { glow: '#88ff44', tag: '',         prompt: 'breach the derelict interior' },
          risk:   { glow: '#ff9933', tag: ' \u00B7 RISK',  prompt: 'breach \u2014 RISK: tougher enemies, richer loot' },
          chaos:  { glow: '#ff2e63', tag: ' \u00B7 CHAOS', prompt: 'breach \u2014 CHAOS: deadly, best loot' }
        };
        const tv = TIER_VIS[tier];
        const obstacles = [];
        // Main hull
        obstacles.push({
          x: cx, y: cy, type: 'salvage_wreck',
          radius: rng.int(40, 65), destructible: true,
          hp: rng.int(50, 90), rotation: rng.range(0, Math.PI * 2),
          resourceType: 'mixed', resourceMult: 2,
          glow: tv.glow, itemChance: 0.3
        });
        // Debris around it
        for (let i = 0; i < rng.int(2, 4); i++) {
          const a = rng.range(0, Math.PI * 2);
          obstacles.push({
            x: cx + Math.cos(a) * rng.range(60, 120),
            y: cy + Math.sin(a) * rng.range(60, 120),
            type: 'debris', radius: rng.int(15, 30),
            destructible: true, hp: 12, rotation: rng.range(0, Math.PI * 2)
          });
        }
        return {
          id, type, x: cx, y: cy, radius: 150,
          icon: '🏚️', label: 'Derelict Airlock' + tv.tag,
          tier, glow: tv.glow,
          reward: null, enemies: [], obstacles,
          interactable: true,
          instanceEntry: { type: 'derelict_tile_instance', family: 'derelict_station_zone1' },
          interactPrompt: 'Press E to ' + tv.prompt,
          triggered: true, cleared: true, collected: false
        };
      }
      
      // ── DEFENSE BEACON ──
      // Interact to start timed wave defense. Reward on survive.
      case 'defense_beacon': {
        return {
          id, type, x: cx, y: cy, radius: 120,
          icon: '📡', label: 'Defense Beacon',
          reward: { type: 'loot_cache', rarity: depth > 40 ? 'legendary' : 'epic', cells: rng.int(30, 60) },
          enemies: [], obstacles: [],
          interactable: true, interactPrompt: 'Press E to activate beacon',
          waveConfig: { count: rng.int(2, 3), enemiesPerWave: rng.int(4, 7), pool },
          triggered: false, cleared: false, collected: false
        };
      }
      
      // ── VOID RIFT ──
      // Dangerous area with cosmic dust drops from void-touched asteroids
      case 'void_rift': {
        const nodeCount = rng.int(2, 3);
        const obstacles = [];
        for (let i = 0; i < nodeCount; i++) {
          const a = rng.range(0, Math.PI * 2);
          const d = rng.range(30, 80);
          obstacles.push({
            x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d,
            type: 'void_crystal', radius: rng.int(20, 35),
            destructible: true, hp: rng.int(40, 70),
            rotation: rng.range(0, Math.PI * 2),
            resourceType: 'voidShard', resourceMult: 1,
            glow: '#aa55ff',
            cosmicDustChance: 0.10
          });
        }
        // Dangerous enemies nearby
        const enemies = [];
        for (let i = 0; i < rng.int(2, 4); i++) {
          const a = rng.range(0, Math.PI * 2);
          enemies.push({
            x: cx + Math.cos(a) * 180, y: cy + Math.sin(a) * 180,
            type: rng.pick(pool), patrol: 'wander', patrolRadius: 100
          });
        }
        return {
          id, type, x: cx, y: cy, radius: 200,
          icon: '🌀', label: 'Void Rift',
          reward: null, enemies, obstacles,
          triggered: false, cleared: false, collected: false
        };
      }
      
      // ── ANCIENT VAULT ──
      // Endgame POI: heavy resistance, guaranteed legendary
      case 'ancient_vault': {
        const enemies = [];
        // 2 elites + 4-6 minions
        for (let i = 0; i < 2; i++) {
          const a = (i === 0 ? -1 : 1) * Math.PI * 0.3;
          enemies.push({
            x: cx + Math.cos(a) * 150, y: cy + Math.sin(a) * 150,
            type: rng.pick(elitePool), patrol: 'circle', patrolRadius: 80, isElite: true
          });
        }
        for (let i = 0; i < rng.int(4, 6); i++) {
          const a = rng.range(0, Math.PI * 2);
          enemies.push({
            x: cx + Math.cos(a) * rng.range(100, 250),
            y: cy + Math.sin(a) * rng.range(100, 250),
            type: rng.pick(pool), patrol: 'wander', patrolRadius: 80
          });
        }
        // Heavy walls
        const obstacles = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          obstacles.push({
            x: cx + Math.cos(a) * 280, y: cy + Math.sin(a) * 280,
            type: 'asteroid', radius: rng.int(40, 60),
            destructible: true, hp: 60, rotation: rng.range(0, Math.PI * 2)
          });
        }
        return {
          id, type, x: cx, y: cy, radius: 300,
          icon: '🏛️', label: 'Ancient Vault',
          reward: { type: 'loot_cache', rarity: 'legendary', scrap: rng.int(50, 100), cells: rng.int(30, 60), voidShards: rng.int(1, 3) },
          enemies, obstacles,
          triggered: false, cleared: false, collected: false
        };
      }
      
      default:
        return null;
    }
  },
  
  // ============================================================
  // RESOURCE NODES - Scattered rare mineable asteroids
  // ============================================================
  // Independent of POIs, these add occasional "ore veins" to zones
  
  generateResourceNodes(rng, zone, actConfig, options = {}) {
    const nodes = [];
    const depth = options.depth || 1;
    const w = zone.width;
    const h = zone.height;
    
    // 3-6 scattered resource nodes per zone (in addition to POI ore deposits)
    const count = rng.int(3, Math.min(6, 3 + Math.floor(depth / 15)));
    
    const nodeTypes = [
      { type: 'ore_rich', weight: 50, glow: '#ffaa00', resource: 'scrap', mult: 3 },
      { type: 'crystal_node', weight: 25, glow: '#00aaff', resource: 'cells', mult: 3 }
    ];
    if (depth >= 30) nodeTypes.push({ type: 'void_crystal', weight: 10, glow: '#aa55ff', resource: 'voidShard', mult: 1 });
    
    const totalWeight = nodeTypes.reduce((s, n) => s + n.weight, 0);
    
    for (let i = 0; i < count; i++) {
      // Random position away from spawn/exit
      let x, y, valid = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        x = rng.range(150, w - 150);
        y = rng.range(150, h - 150);
        if (Math.hypot(x - zone.spawn.x, y - zone.spawn.y) < 300) continue;
        if (Math.hypot(x - zone.exit.x, y - zone.exit.y) < 200) continue;
        valid = true;
        break;
      }
      if (!valid) continue;
      
      // Pick type by weight
      let roll = rng.range(0, totalWeight);
      let picked = nodeTypes[0];
      for (const nt of nodeTypes) {
        roll -= nt.weight;
        if (roll <= 0) { picked = nt; break; }
      }
      
      const node = {
        x, y,
        type: picked.type,
        radius: rng.int(25, 50),
        destructible: true,
        hp: rng.int(25, 55),
        rotation: rng.range(0, Math.PI * 2),
        resourceType: picked.resource,
        resourceMult: picked.mult,
        glow: picked.glow
      };
      
      // Add chance modifiers for rare drops
      if (picked.type === 'crystal_node') {
        node.voidShardChance = depth >= 30 ? 0.12 : 0.03;
      }
      if (picked.type === 'void_crystal') {
        node.cosmicDustChance = 0.08;
      }
      
      nodes.push(node);
      // Also add to zone obstacles for collision/destruction
      zone.obstacles.push(node);
    }
    
    return nodes;
  },

  // ============================================================
  // ZONE OBJECTIVES — give each zone a purpose
  // ============================================================
  generateObjective(rng, zone, depth, topology = null) {
    // First 2 zones: no objective (tutorial buffer)
    if (depth <= 2) return null;
    const finaleChain = topology?.summary?.finaleChain || [];
    
    const objectives = [
      { type: 'exterminate', weight: 30 },  // Kill all enemies
      { type: 'survival',    weight: 20 },  // Survive timer
      { type: 'timetrial',   weight: 15 },  // Speed bonus
      { type: 'corruption',  weight: 15 },  // Escalating danger
      { type: 'lockdown',    weight: 20 }   // Destroy generators
    ];
    // Survival + corruption unlocked at depth 5
    if (depth < 5) {
      objectives[1].weight = 0;
      objectives[3].weight = 0;
    }
    
    const totalW = objectives.reduce((s, o) => s + o.weight, 0);
    let roll = rng.range(0, totalW);
    let picked = objectives[0];
    for (const o of objectives) {
      roll -= o.weight;
      if (roll <= 0) { picked = o; break; }
    }
    
    switch (picked.type) {
      case 'exterminate': {
        // Count total enemies in zone
        const total = zone.enemySpawns.length + zone.eliteSpawns.length;
        const target = Math.max(5, Math.floor(total * 0.5)); // 50% kill requirement (was 80%)
        return {
          type: 'exterminate', label: 'EXTERMINATE', icon: '💀',
          desc: `Kill ${target} enemies to unlock the exit`,
          progress: 0, target, complete: false, exitLocked: true,
          bonusLoot: { scrap: 30 + depth * 5, cells: 10 + depth * 2 }
        };
      }
      case 'survival': {
        const duration = 30 + Math.min(depth, 50); // 30-80 seconds
        return {
          type: 'survival', label: 'SURVIVE', icon: '⏱️',
          desc: `Survive ${duration}s in the arena zone`,
          progress: 0, target: duration, complete: false, exitLocked: true,
          arenaCenter: { x: zone.width / 2, y: zone.height / 2 },
          arenaRadius: 400,
          bonusLoot: { scrap: 40 + depth * 6, cells: 15 + depth * 3 }
        };
      }
      case 'timetrial': {
        const timeLimit = 20 + Math.floor(zone.width / 100); // bigger zone → more time
        return {
          type: 'timetrial', label: 'TIME TRIAL', icon: '⚡',
          desc: `Reach exit within ${timeLimit}s for bonus loot`,
          progress: 0, target: timeLimit, complete: false, exitLocked: false,
          bonusLoot: { scrap: 60 + depth * 8, cells: 20 + depth * 4 },
          failed: false
        };
      }
      case 'corruption': {
        return {
          type: 'corruption', label: 'CORRUPTION', icon: '☠️',
          desc: 'Zone grows deadlier over time. Exit when you dare.',
          progress: 0, target: 100, complete: false, exitLocked: false,
          corruptionRate: 1.0 + depth * 0.02, // % per second
          currentMult: 1.0, // enemy damage/speed mult grows
          bonusLoot: { scrap: 20 + depth * 3, cells: 5 + depth }
        };
      }
      case 'lockdown': {
        // Place 3 generator obstacles that must be destroyed
        const genCount = 3;
        const generators = [];
        for (let i = 0; i < genCount; i++) {
          const a = (i / genCount) * Math.PI * 2 + rng.range(-0.4, 0.4);
          const dist = Math.min(zone.width, zone.height) * 0.3;
          const gx = zone.width / 2 + Math.cos(a) * dist;
          const gy = zone.height / 2 + Math.sin(a) * dist;
          const gen = {
            x: gx, y: gy,
            type: 'generator', radius: 30,
            destructible: true, hp: 50 + depth * 5,
            rotation: 0, glow: '#ff4444',
            isGenerator: true
          };
          generators.push(gen);
          zone.obstacles.push(gen);
        }
        return {
          type: 'lockdown', label: 'LOCKDOWN', icon: '🔒',
          desc: `Destroy ${genCount} generators to unlock the exit`,
          progress: 0, target: genCount, complete: false, exitLocked: true,
          generators,
          bonusLoot: { scrap: 50 + depth * 7, cells: 15 + depth * 3 }
        };
      }
    }
    return null;
  },

  // ============================================================
  // BRANCHING EXITS — route choice at zone end
  // ============================================================
  generateBranchExits(rng, zone, depth, topology = null) {
    const exit = zone.exit;
    if (!exit) return null;
    if (topology?.mode === 'vertical_slice') return null;
    
    // 3 portals spread around the exit area
    const branches = [];
    const types = [
      { id: 'safe',  label: 'SAFE ROUTE',  icon: '🟢', color: '#00ff88', 
        desc: 'Standard zone',          modifiers: 0, lootMult: 1.0 },
      { id: 'risky', label: 'RISKY ROUTE', icon: '🟡', color: '#ffcc00',
        desc: '+1 modifier, +50% loot',  modifiers: 1, lootMult: 1.5 },
      { id: 'vault', label: 'VAULT',       icon: '🔴', color: '#ff4444',
        desc: 'Dead end, guaranteed rare+', modifiers: 2, lootMult: 2.0,
        isVault: true }
    ];
    
    // Remove vault sometimes (60% chance at depth < 10)
    if (depth < 10 && rng.chance(0.4)) {
      types.splice(2, 1);
    }
    
    const spacing = 120;
    const totalW = (types.length - 1) * spacing;
    
    for (let i = 0; i < types.length; i++) {
      const t = types[i];
      const offsetX = -totalW / 2 + i * spacing;
      branches.push({
        ...t,
        x: exit.x + offsetX,
        y: exit.y + (Math.abs(offsetX) * 0.3), // slight arc
        radius: 35
      });
    }
    
    return branches;
  },

  // Create zone seed from act + zone index
  createZoneSeed(actSeed, zoneIndex) {
    const a = (actSeed >>> 0);
    const z = ((zoneIndex + 1) >>> 0);
    return (a ^ Math.imul(z, 0x9E3779B9)) >>> 0;
  },

  // ═══ ZONE TEMPLATE SYSTEM ═══
  // Templates are loaded from State.data.zoneTemplates (fetched by DataLoader)
  // If none available, returns null → procedural generation
  _templates: null,

  _pickZoneTemplate(rng, biome) {
    // Templates stored in State.data.zoneTemplates as { templateName: {...} }
    const templates = State.data?.zoneTemplates;
    if (!templates || typeof templates !== 'object') return null;
    
    // Filter templates matching this biome (or universal ones)
    const candidates = [];
    for (const [name, tmpl] of Object.entries(templates)) {
      if (name.startsWith('_')) continue;
      const tmplBiome = tmpl.zone?.biome;
      if (!tmplBiome || tmplBiome === biome || tmplBiome === 'any') {
        candidates.push(tmpl);
      }
    }
    if (candidates.length === 0) return null;
    
    // 40% chance to use a template (mix with procedural)
    if (rng.range(0, 1) > 0.4) return null;
    
    return rng.pick(candidates);
  },

  _getMaterialPalette(material, biome) {
    const MAT = {
      rock:    { primary: '#4a4035', secondary: '#6b5d4f', accent: '#887766', glow: null, edge: '#3a3025' },
      metal:   { primary: '#3a3a40', secondary: '#555560', accent: '#778899', glow: 'rgba(255,200,100,0.08)', edge: '#2a2a30' },
      crystal: { primary: '#2a3555', secondary: '#4a5580', accent: '#7088bb', glow: 'rgba(100,140,255,0.15)', edge: '#1a2540' },
      gas:     { primary: '#1a2040', secondary: '#304060', accent: '#5080cc', glow: 'rgba(80,120,255,0.2)', edge: '#0a1020' },
      debris:  { primary: '#2a2520', secondary: '#4a4035', accent: '#6a5545', glow: null, edge: '#1a1510' },
      alien:   { primary: '#1a1030', secondary: '#302050', accent: '#6644aa', glow: 'rgba(120,80,200,0.2)', edge: '#0a0820' },
      ice:     { primary: '#2a4555', secondary: '#4a7590', accent: '#80b8dd', glow: 'rgba(120,200,255,0.15)', edge: '#1a3040' }
    };
    return MAT[material] || MAT.rock;
  },

  // ═══════════════════════════════════════════════════════════════
  // ENVIRONMENTAL STRUCTURES (v2.16.3)
  // Large navigable features that give zones spatial character.
  // Data is renderer-neutral: Canvas gradients today, tile textures tomorrow.
  // ═══════════════════════════════════════════════════════════════

  generateStructures(rng, zone, actConfig, depth) {
    const biome = actConfig.biome || 'asteroid';
    const w = zone.width, h = zone.height;
    const count = rng.int(3, 7);
    const structures = [];
    const margin = 300;
    const spawnSafe = 400;

    // Biome → available structure types
    const POOL = {
      asteroid:  ['asteroid_arch', 'boulder_wall', 'rock_ring'],
      nebula:    ['gas_column', 'crystal_bridge', 'nebula_rift'],
      void:      ['void_rift', 'crystal_spire', 'dark_monolith'],
      derelict:  ['wreck_hull', 'station_arm', 'cargo_array'],
      blackhole: ['debris_stream', 'gravity_wall', 'singularity_ring']
    };
    const pool = POOL[biome] || POOL.asteroid;

    // Tile PNG pools per biome
    const TILES = {
      asteroid:  ['asteroid_chunk', 'asteroid_small', 'rock_crystal_floor', 'rock_crystal_med', 'darkstone_rough', 'darkstone_wall', 'rock_pile_sm'],
      nebula:    ['energy_panel_green', 'energy_panel_wide', 'gem_barrel', 'gem_crate', 'rock_crystal_large'],
      void:      ['darkstone_column', 'darkstone_tall', 'darkstone_wide', 'darkstone_mossy', 'concrete_slab_dark'],
      derelict:  ['metal_floor', 'metal_floor_dark', 'cross_junction', 'brick_wall_med', 'crate_hazard', 'crate_locked', 'crate_green', 'barrier_damaged'],
      blackhole: ['concrete_pillar', 'concrete_pillar_cracked', 'darkstone_rough', 'chainlink_fence']
    };
    const tilePool = TILES[biome] || TILES.asteroid;

    for (let i = 0; i < count; i++) {
      const type = rng.pick(pool);
      
      // Find placement that doesn't block spawn→exit line
      let x, y, attempts = 0;
      do {
        x = rng.range(margin, w - margin);
        y = rng.range(margin, h - margin);
        attempts++;
      } while (attempts < 20 && (
        Math.hypot(x - zone.spawn.x, y - zone.spawn.y) < spawnSafe ||
        Math.hypot(x - zone.exit.x, y - zone.exit.y) < spawnSafe
      ));

      const angle = rng.range(0, Math.PI * 2);
      const scale = rng.range(0.8, 1.3);
      const struct = this._buildStructure(rng, type, x, y, angle, scale, biome);
      if (struct) {
        // v2.16.3: Assign tile PNG from biome pool
        const tileName = rng.pick(tilePool);
        struct.tileReady = { materialId: struct.variant || 'rock', tileset: `assets/tiles/${tileName}.png` };
        structures.push(struct);
      }
    }
    return structures;
  },

  _buildStructure(rng, type, cx, cy, angle, scale, biome) {
    // Material palette per biome
    const MAT = {
      asteroid:  { primary: '#4a4035', secondary: '#6b5d4f', accent: '#887766', glow: null, edge: '#3a3025' },
      nebula:    { primary: '#2a3555', secondary: '#4a5580', accent: '#7088bb', glow: 'rgba(100,140,255,0.15)', edge: '#1a2540' },
      void:      { primary: '#1a1030', secondary: '#302050', accent: '#6644aa', glow: 'rgba(120,80,200,0.2)', edge: '#0a0820' },
      derelict:  { primary: '#3a3a40', secondary: '#555560', accent: '#778899', glow: 'rgba(255,200,100,0.08)', edge: '#2a2a30' },
      blackhole: { primary: '#181420', secondary: '#2a2035', accent: '#554466', glow: 'rgba(200,100,255,0.1)', edge: '#0e0a15' }
    };
    const mat = MAT[biome] || MAT.asteroid;
    const s = scale;

    // Each generator returns: { segments[], colliders[], openings[] }
    switch (type) {
      case 'asteroid_arch':
        return this._structArch(rng, cx, cy, angle, s, mat, 'rock');
      case 'boulder_wall':
        return this._structWall(rng, cx, cy, angle, s, mat, 'rock');
      case 'rock_ring':
        return this._structRing(rng, cx, cy, angle, s, mat, 'rock');
      case 'gas_column':
        return this._structColumn(rng, cx, cy, angle, s, mat, 'gas');
      case 'crystal_bridge':
        return this._structArch(rng, cx, cy, angle, s, mat, 'crystal');
      case 'nebula_rift':
        return this._structRift(rng, cx, cy, angle, s, mat, 'gas');
      case 'void_rift':
        return this._structRift(rng, cx, cy, angle, s, mat, 'void');
      case 'crystal_spire':
        return this._structColumn(rng, cx, cy, angle, s, mat, 'crystal');
      case 'dark_monolith':
        return this._structMonolith(rng, cx, cy, angle, s, mat);
      case 'wreck_hull':
        return this._structHull(rng, cx, cy, angle, s, mat);
      case 'station_arm':
        return this._structArm(rng, cx, cy, angle, s, mat);
      case 'cargo_array':
        return this._structWall(rng, cx, cy, angle, s, mat, 'metal');
      case 'debris_stream':
        return this._structWall(rng, cx, cy, angle, s, mat, 'debris');
      case 'gravity_wall':
        return this._structRift(rng, cx, cy, angle, s, mat, 'gravity');
      case 'singularity_ring':
        return this._structRing(rng, cx, cy, angle, s, mat, 'void');
      default:
        return null;
    }
  },

  // ── Arch: curved wall with fly-through gap at apex ──
  _structArch(rng, cx, cy, angle, scale, mat, variant) {
    const r = (250 + rng.range(0, 150)) * scale;
    const arcSpan = Math.PI * 0.6 + rng.range(0, 0.4);
    const gapAngle = rng.range(-0.15, 0.15); // gap near top
    const gapWidth = 0.25 + rng.range(0, 0.15);
    const thickness = (35 + rng.range(0, 25)) * scale;
    const segments = [];
    const colliders = [];
    const steps = 16;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = angle - arcSpan / 2 + arcSpan * t;
      // Skip gap region
      const gapStart = angle + gapAngle - gapWidth / 2;
      const gapEnd = angle + gapAngle + gapWidth / 2;
      if (a > gapStart && a < gapEnd) continue;

      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      colliders.push({ x, y, radius: thickness });
      segments.push({ x, y, r: thickness, a });
    }

    return {
      type: variant === 'crystal' ? 'crystal_bridge' : 'asteroid_arch',
      x: cx, y: cy, angle, scale,
      material: mat, variant,
      segments, colliders,
      bounds: { x: cx, y: cy, radius: r + thickness },
      tileReady: { materialId: variant === 'crystal' ? 'ice_crystal' : 'asteroid_rock', tileset: null }
    };
  },

  // ── Wall: linear chain of large objects with 1-2 gaps ──
  _structWall(rng, cx, cy, angle, scale, mat, variant) {
    const length = (400 + rng.range(0, 300)) * scale;
    const nodeCount = rng.int(5, 9);
    const gapIdx = rng.int(1, nodeCount - 2); // one gap
    const gapIdx2 = nodeCount > 6 ? rng.int(gapIdx + 2, nodeCount - 1) : -1;
    const segments = [];
    const colliders = [];
    const dx = Math.cos(angle), dy = Math.sin(angle);

    for (let i = 0; i < nodeCount; i++) {
      if (i === gapIdx || i === gapIdx2) continue;
      const t = (i / (nodeCount - 1) - 0.5) * length;
      const jx = rng.range(-30, 30) * scale;
      const jy = rng.range(-30, 30) * scale;
      const x = cx + dx * t + jx - dy * jy * 0.3;
      const y = cy + dy * t + jy + dx * jy * 0.3;
      const r = (30 + rng.range(0, 40)) * scale;
      colliders.push({ x, y, radius: r });
      segments.push({ x, y, r, variant: rng.int(0, 3) });
    }

    return {
      type: variant + '_wall',
      x: cx, y: cy, angle, scale,
      material: mat, variant,
      segments, colliders,
      bounds: { x: cx, y: cy, radius: length / 2 + 60 },
      tileReady: { materialId: variant, tileset: null }
    };
  },

  // ── Ring: circular formation with 2 openings ──
  _structRing(rng, cx, cy, angle, scale, mat, variant) {
    const r = (180 + rng.range(0, 120)) * scale;
    const nodeCount = rng.int(10, 16);
    const gap1 = rng.int(0, nodeCount - 1);
    const gap2 = (gap1 + Math.floor(nodeCount / 2)) % nodeCount;
    const segments = [];
    const colliders = [];

    for (let i = 0; i < nodeCount; i++) {
      if (i === gap1 || i === gap2) continue;
      const a = (i / nodeCount) * Math.PI * 2 + angle;
      const x = cx + Math.cos(a) * r + rng.range(-15, 15) * scale;
      const y = cy + Math.sin(a) * r + rng.range(-15, 15) * scale;
      const nr = (25 + rng.range(0, 30)) * scale;
      colliders.push({ x, y, radius: nr });
      segments.push({ x, y, r: nr, a });
    }

    return {
      type: variant + '_ring',
      x: cx, y: cy, angle, scale,
      material: mat, variant,
      segments, colliders,
      bounds: { x: cx, y: cy, radius: r + 60 },
      tileReady: { materialId: variant, tileset: null }
    };
  },

  // ── Column/Spire: vertical cluster ──
  _structColumn(rng, cx, cy, angle, scale, mat, variant) {
    const height = (300 + rng.range(0, 200)) * scale;
    const stacks = rng.int(3, 6);
    const segments = [];
    const colliders = [];

    for (let i = 0; i < stacks; i++) {
      const t = (i / (stacks - 1) - 0.5) * height;
      const x = cx + Math.cos(angle) * t + rng.range(-20, 20) * scale;
      const y = cy + Math.sin(angle) * t + rng.range(-20, 20) * scale;
      const r = (35 + rng.range(0, 35)) * scale * (1 - Math.abs(i / stacks - 0.5) * 0.6);
      colliders.push({ x, y, radius: r });
      segments.push({ x, y, r, variant: rng.int(0, 2) });
    }

    return {
      type: variant + '_column',
      x: cx, y: cy, angle, scale,
      material: mat, variant,
      segments, colliders,
      bounds: { x: cx, y: cy, radius: height / 2 + 60 },
      tileReady: { materialId: variant, tileset: null }
    };
  },

  // ── Rift: torn space / energy wall with shimmer ──
  _structRift(rng, cx, cy, angle, scale, mat, variant) {
    const length = (350 + rng.range(0, 250)) * scale;
    const waveCount = rng.int(5, 10);
    const segments = [];
    const colliders = []; // Rifts: no collision, visual + hazard only

    for (let i = 0; i <= waveCount; i++) {
      const t = (i / waveCount - 0.5) * length;
      const wave = Math.sin(i * 0.8) * 40 * scale;
      const x = cx + Math.cos(angle) * t + Math.sin(angle) * wave;
      const y = cy + Math.sin(angle) * t - Math.cos(angle) * wave;
      const r = (20 + rng.range(0, 25)) * scale;
      segments.push({ x, y, r, wave: true });
      // Rifts are pass-through but deal DOT (handled by hazard system)
    }

    return {
      type: variant + '_rift',
      x: cx, y: cy, angle, scale,
      material: mat, variant,
      segments, colliders,
      isHazard: variant === 'void' || variant === 'gravity',
      hazardDPS: variant === 'gravity' ? 3 : 5,
      bounds: { x: cx, y: cy, radius: length / 2 + 60 },
      tileReady: { materialId: variant + '_energy', tileset: null }
    };
  },

  // ── Hull: broken ship hull section (derelict-specific) ──
  _structHull(rng, cx, cy, angle, scale, mat) {
    const length = (350 + rng.range(0, 200)) * scale;
    const curve = rng.range(-0.3, 0.3);
    const segments = [];
    const colliders = [];
    const steps = rng.int(6, 10);
    const thickness = (30 + rng.range(0, 20)) * scale;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps - 0.5) * length;
      const bend = curve * t * t * 0.001;
      const x = cx + Math.cos(angle) * t + Math.sin(angle) * bend;
      const y = cy + Math.sin(angle) * t - Math.cos(angle) * bend;
      colliders.push({ x, y, radius: thickness });
      segments.push({
        x, y, r: thickness,
        hasWindow: rng.range(0, 1) < 0.3,
        hasPanel: rng.range(0, 1) < 0.5,
        hasDamage: rng.range(0, 1) < 0.4
      });
    }

    return {
      type: 'wreck_hull',
      x: cx, y: cy, angle, scale,
      material: mat, variant: 'metal',
      segments, colliders,
      bounds: { x: cx, y: cy, radius: length / 2 + thickness },
      tileReady: { materialId: 'hull_metal', tileset: null }
    };
  },

  // ── Station Arm: L-shaped station fragment ──
  _structArm(rng, cx, cy, angle, scale, mat) {
    const len1 = (200 + rng.range(0, 150)) * scale;
    const len2 = (150 + rng.range(0, 100)) * scale;
    const segments = [];
    const colliders = [];
    const thickness = (28 + rng.range(0, 15)) * scale;
    const dx1 = Math.cos(angle), dy1 = Math.sin(angle);
    const dx2 = Math.cos(angle + Math.PI / 2), dy2 = Math.sin(angle + Math.PI / 2);

    // Arm 1
    for (let i = 0; i < 5; i++) {
      const t = (i / 4) * len1;
      const x = cx + dx1 * t;
      const y = cy + dy1 * t;
      colliders.push({ x, y, radius: thickness });
      segments.push({ x, y, r: thickness, arm: 1 });
    }
    // Arm 2 (perpendicular from end of arm 1)
    const jx = cx + dx1 * len1, jy = cy + dy1 * len1;
    for (let i = 1; i <= 4; i++) {
      const t = (i / 4) * len2;
      const x = jx + dx2 * t;
      const y = jy + dy2 * t;
      colliders.push({ x, y, radius: thickness });
      segments.push({ x, y, r: thickness, arm: 2 });
    }

    return {
      type: 'station_arm',
      x: cx, y: cy, angle, scale,
      material: mat, variant: 'metal',
      segments, colliders,
      bounds: { x: cx + dx1 * len1 / 2, y: cy + dy1 * len1 / 2, radius: Math.max(len1, len2) + thickness },
      tileReady: { materialId: 'station_panel', tileset: null }
    };
  },

  // ── Monolith: single large alien structure ──
  _structMonolith(rng, cx, cy, angle, scale, mat) {
    const height = (120 + rng.range(0, 80)) * scale;
    const width = (40 + rng.range(0, 30)) * scale;
    const segments = [{
      x: cx, y: cy, w: width, h: height, angle,
      hasGlyph: true, glyphColor: 'rgba(120,80,255,0.4)'
    }];
    const colliders = [{ x: cx, y: cy, radius: Math.max(width, height) * 0.6 }];

    return {
      type: 'dark_monolith',
      x: cx, y: cy, angle, scale,
      material: mat, variant: 'alien',
      segments, colliders,
      bounds: { x: cx, y: cy, radius: height + 30 },
      tileReady: { materialId: 'alien_stone', tileset: null }
    };
  },

  // ═══════════════════════════════════════════════════════════════
  // ZONE LAYOUT SYSTEM (v2.16.4)
  // Generates connected rooms + corridors for meaningful topology
  // ═══════════════════════════════════════════════════════════════

  _generateLayout(rng, w, h, spawn, exit, depth, options = {}) {
    const margin = 300;
    if (options.topology?.launchReadiness && Array.isArray(options.topology.nodes) && options.topology.nodes.length) {
      return this._generateTopologyLayout(rng, w, h, spawn, exit, options.topology);
    }
    const roomCount = rng.int(7, Math.min(14, 7 + Math.floor(depth / 8)));
    const rooms = [];
    
    // Room 0: spawn room (safe, medium)
    rooms.push({
      cx: spawn.x, cy: spawn.y,
      rx: rng.int(250, 400), ry: rng.int(250, 400),
      type: 'spawn', enemies: 0
    });
    
    // Plan the main path from spawn to exit
    const dx = exit.x - spawn.x;
    const dy = exit.y - spawn.y;
    
    // Main path rooms (60% of budget)
    const mainCount = Math.ceil(roomCount * 0.6);
    // Side/hidden rooms (40% of budget)  
    const sideCount = roomCount - mainCount;
    
    // Generate main path rooms
    for (let i = 1; i <= mainCount; i++) {
      const progress = i / mainCount;
      const scatter = Math.max(0.1, 0.3 - progress * 0.15); // less scatter near exit
      const bx = spawn.x + dx * progress + rng.range(-w * scatter, w * scatter);
      const by = spawn.y + dy * progress + rng.range(-h * scatter, h * scatter);
      const cx = Math.max(margin, Math.min(w - margin, bx));
      const cy = Math.max(margin, Math.min(h - margin, by));
      
      let type, rx, ry;
      if (i === mainCount) {
        // Last room = boss arena
        type = 'boss'; rx = rng.int(350, 500); ry = rng.int(350, 500);
      } else if (i === 1) {
        // First combat room after spawn
        type = 'combat'; rx = rng.int(200, 300); ry = rng.int(200, 300);
      } else {
        const roll = rng.range(0, 1);
        if (roll < 0.25) {
          type = 'ambush'; rx = rng.int(280, 420); ry = rng.int(280, 420);
        } else if (roll < 0.45) {
          type = 'gauntlet'; // long narrow, enemies on both sides
          rx = rng.int(100, 160); ry = rng.int(350, 600);
          if (rng.chance(0.5)) { const t = rx; rx = ry; ry = t; }
        } else if (roll < 0.55) {
          type = 'junction'; // hub connecting multiple paths
          rx = rng.int(300, 450); ry = rng.int(300, 450);
        } else {
          type = 'combat'; rx = rng.int(220, 380); ry = rng.int(220, 380);
        }
      }
      rooms.push({ cx, cy, rx, ry, type, enemies: 0, mainPath: true });
    }
    
    // Generate side/hidden rooms (branching off main path rooms)
    for (let i = 0; i < sideCount; i++) {
      // Pick a random main path room to branch from
      const parentIdx = rng.int(1, mainCount); // skip spawn
      const parent = rooms[parentIdx];
      const angle = rng.range(0, Math.PI * 2);
      const dist = rng.range(400, 900);
      const bx = parent.cx + Math.cos(angle) * dist;
      const by = parent.cy + Math.sin(angle) * dist;
      const cx = Math.max(margin, Math.min(w - margin, bx));
      const cy = Math.max(margin, Math.min(h - margin, by));
      
      const roll = rng.range(0, 1);
      let type, rx, ry;
      if (roll < 0.4) {
        type = 'treasure'; // hidden loot room
        rx = rng.int(130, 220); ry = rng.int(130, 220);
      } else if (roll < 0.7) {
        type = 'hidden'; // secret room with rare reward
        rx = rng.int(150, 250); ry = rng.int(150, 250);
      } else {
        type = 'ambush'; // side ambush
        rx = rng.int(200, 320); ry = rng.int(200, 320);
      }
      rooms.push({ cx, cy, rx, ry, type, enemies: 0, mainPath: false, parentIdx });
    }
    
    // Connect main path rooms sequentially
    const corridors = [];
    for (let i = 0; i < mainCount; i++) {
      corridors.push({ from: i, to: i + 1 });
    }
    
    // Connect side rooms to their parent
    for (let i = mainCount + 1; i < rooms.length; i++) {
      const parent = rooms[i].parentIdx || 1;
      corridors.push({ from: parent, to: i });
    }
    
    // Extra shortcut corridors for loops (1-3)
    const extras = rng.int(1, 3);
    for (let e = 0; e < extras; e++) {
      const a = rng.int(0, mainCount);
      const b = rng.int(0, mainCount);
      if (a === b) continue;
      const exists = corridors.some(c => (c.from === a && c.to === b) || (c.from === b && c.to === a));
      if (!exists && Math.hypot(rooms[a].cx - rooms[b].cx, rooms[a].cy - rooms[b].cy) < 2000) {
        corridors.push({ from: a, to: b });
      }
    }
    
    return { rooms, corridors };
  },


  _generateTopologyLayout(rng, w, h, spawn, exit, topology) {
    const rooms = [];
    const corridors = [];
    const nodes = topology?.nodes || [];
    const edges = topology?.edges || [];
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const mainNodes = nodes.filter(n => n.isMainPath).sort((a, b) => (a.routeIndex ?? 999) - (b.routeIndex ?? 999));
    const margin = 320;
    const dx = exit.x - spawn.x;
    const dy = exit.y - spawn.y;
    const mainCount = Math.max(2, mainNodes.length - 1);

    const sizeFor = (node) => {
      switch (node.nodeType) {
        case 'spawn_room': return { rx: 260, ry: 260, type: 'spawn' };
        case 'room_small': return { rx: 170, ry: 170, type: 'treasure' };
        case 'room_medium': return { rx: 280, ry: 260, type: 'combat' };
        case 'room_large': return { rx: 380, ry: 330, type: 'combat' };
        case 'corridor_narrow': return { rx: 130, ry: 420, type: 'gauntlet' };
        case 'corridor_wide': return { rx: 180, ry: 420, type: 'junction' };
        case 'arena_room': return { rx: 400, ry: 360, type: 'arena' };
        case 'poi_room': return { rx: 220, ry: 220, type: 'treasure' };
        case 'hub_room': return { rx: 260, ry: 240, type: 'junction' };
        case 'service_room': return { rx: 240, ry: 220, type: 'junction' };
        case 'portal_room': return { rx: 240, ry: 220, type: 'junction' };
        case 'secret_room': return { rx: 180, ry: 180, type: 'hidden' };
        case 'trap_room': return { rx: 220, ry: 220, type: 'ambush' };
        case 'boss_gate_room': return { rx: 220, ry: 200, type: 'junction' };
        case 'finale_arena': return { rx: 450, ry: 410, type: 'boss' };
        default: return { rx: 250, ry: 220, type: 'combat' };
      }
    };

    const placeMain = () => {
      for (let i = 0; i < mainNodes.length; i++) {
        const node = mainNodes[i];
        if (node.id === 'spawn_room') {
          const s = sizeFor(node);
          rooms.push({ id: node.id, cx: spawn.x, cy: spawn.y, rx: s.rx, ry: s.ry, type: s.type, nodeType: node.nodeType, primaryPurpose: node.primaryPurpose, secondaryPurpose: node.secondaryPurpose, mainPath: true, eventCapacity: node.eventCapacity, encounterCapacity: node.encounterCapacity });
          continue;
        }
        const progress = i / mainCount;
        const scatter = node.nodeType.startsWith('corridor') ? 0.08 : 0.16;
        const bx = spawn.x + dx * progress + rng.range(-w * scatter, w * scatter);
        const by = spawn.y + dy * progress + rng.range(-h * scatter, h * scatter);
        const cx = Math.max(margin, Math.min(w - margin, bx));
        const cy = Math.max(margin, Math.min(h - margin, by));
        const s = sizeFor(node);
        let rx, ry = s.ry;
        rx = s.rx;
        if (node.nodeType === 'corridor_narrow' || node.nodeType === 'corridor_wide') {
          const horizontal = Math.abs(dx) >= Math.abs(dy);
          if (horizontal) {
            const t = rx; rx = ry; ry = t;
          }
        }
        rooms.push({ id: node.id, cx, cy, rx, ry, type: s.type, nodeType: node.nodeType, primaryPurpose: node.primaryPurpose, secondaryPurpose: node.secondaryPurpose, mainPath: true, eventCapacity: node.eventCapacity, encounterCapacity: node.encounterCapacity });
      }
    };

    placeMain();
    const roomById = new Map(rooms.map((r, idx) => [r.id, { room: r, idx }]));

    const sideNodes = nodes.filter(n => !n.isMainPath);
    for (const node of sideNodes) {
      const parent = roomById.get(node.parentId) || roomById.get('service_relief') || roomById.get('combat_room_a');
      if (!parent) continue;
      const base = parent.room;
      const angleBase = node.pathClass === 'secret_path' ? -Math.PI * 0.65 : (node.pathClass === 'danger_path' ? Math.PI * 0.55 : Math.PI * 0.25);
      const angle = angleBase + rng.range(-0.28, 0.28);
      const dist = node.nodeType.startsWith('corridor') ? rng.range(520, 760) : rng.range(440, 700);
      const cx = Math.max(margin, Math.min(w - margin, base.cx + Math.cos(angle) * dist));
      const cy = Math.max(margin, Math.min(h - margin, base.cy + Math.sin(angle) * dist));
      const s = sizeFor(node);
      let rx = s.rx, ry = s.ry;
      if (node.nodeType === 'corridor_narrow' || node.nodeType === 'corridor_wide') {
        const horizontal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
        if (horizontal) { const t = rx; rx = ry; ry = t; }
      }
      const room = { id: node.id, cx, cy, rx, ry, type: s.type, nodeType: node.nodeType, primaryPurpose: node.primaryPurpose, secondaryPurpose: node.secondaryPurpose, mainPath: false, parentIdx: parent.idx, pathClass: node.pathClass, eventCapacity: node.eventCapacity, encounterCapacity: node.encounterCapacity };
      rooms.push(room);
      roomById.set(node.id, { room, idx: rooms.length - 1 });
    }

    for (const edge of edges) {
      const a = roomById.get(edge.from);
      const b = roomById.get(edge.to);
      if (!a || !b) continue;
      corridors.push({
        from: a.idx,
        to: b.idx,
        pathClass: edge.pathClass,
        portalLink: edge.pathClass === 'portal_link',
        module: DerelictModuleLibrary.chooseCorridorModule(rng, edge.pathClass),
        fromNodeId: edge.from,
        toNodeId: edge.to
      });
    }

    for (const room of rooms) {
      room.module = DerelictModuleLibrary.chooseRoomModule(rng, room.nodeType || 'room_medium', room.primaryPurpose || 'traversal');
      room.moduleId = room.module.id;
      room.carrierClass = room.module.carrierClass;
      room.moduleTags = room.module.tags || [];
    }

    return { rooms, corridors, topologyId: topology.id, budgetId: topology.budgetId, summary: topology.summary, validation: topology.validation, carrierReady: true };
  },

  _generateLayoutWalls(rng, layout, w, h) {
    const walls = [];
    if (layout?.topologyId && layout?.carrierReady && SliceLock.enabled && SliceLock.biome === 'derelict') {
      return this._generateDerelictCarrierStructures(rng, layout, w, h);
    }
    
    // Corridor walls: place indestructible obstacles along corridor edges
    for (const cor of layout.corridors) {
      const a = layout.rooms[cor.from];
      const b = layout.rooms[cor.to];
      const cdx = b.cx - a.cx;
      const cdy = b.cy - a.cy;
      const len = Math.hypot(cdx, cdy);
      if (len < 1) continue;
      const nx = cdx / len, ny = cdy / len;
      const px = -ny, py = nx;
      const corridorWidth = 100 + rng.int(0, 60);
      
      const segCount = Math.floor(len / 70);
      for (let i = 1; i < segCount - 1; i++) {
        const t = i / segCount;
        const wx = a.cx + cdx * t;
        const wy = a.cy + cdy * t;
        
        // Skip if inside a room
        const inRoom = layout.rooms.some(r => 
          Math.abs(wx - r.cx) < r.rx + 40 && Math.abs(wy - r.cy) < r.ry + 40
        );
        if (inRoom) continue;
        
        const r = 30 + rng.int(0, 20);
        // Left wall
        if (rng.chance(0.75)) {
          walls.push({ x: wx + px * corridorWidth, y: wy + py * corridorWidth,
            type: 'asteroid', radius: r, rotation: rng.range(0, Math.PI * 2),
            destructible: false, hp: 999, grounded: true, castsShadow: true, shadowClass: 'asteroid' });
        }
        // Right wall
        if (rng.chance(0.75)) {
          walls.push({ x: wx - px * corridorWidth, y: wy - py * corridorWidth,
            type: 'asteroid', radius: r, rotation: rng.range(0, Math.PI * 2),
            destructible: false, hp: 999, grounded: true, castsShadow: true, shadowClass: 'asteroid' });
        }
        // Occasional obstacle IN the corridor (chokepoint)
        if (rng.chance(0.08)) {
          walls.push({ x: wx + rng.range(-30, 30), y: wy + rng.range(-30, 30),
            type: 'debris', radius: rng.int(15, 25), rotation: rng.range(0, Math.PI * 2),
            destructible: true, hp: rng.int(20, 40), grounded: true, castsShadow: false, shadowClass: 'debris' });
        }
      }
    }
    
    // Room-specific features
    for (const room of layout.rooms) {
      // Combat rooms: cover rocks
      if (room.type === 'combat') {
        const count = rng.int(3, 6);
        for (let i = 0; i < count; i++) {
          const angle = rng.range(0, Math.PI * 2);
          const dist = rng.range(room.rx * 0.2, room.rx * 0.65);
          walls.push({ x: room.cx + Math.cos(angle) * dist, y: room.cy + Math.sin(angle) * dist,
            type: 'asteroid', radius: rng.int(25, 45), rotation: rng.range(0, Math.PI * 2),
            destructible: true, hp: rng.int(40, 80), grounded: true, castsShadow: true, shadowClass: 'asteroid' });
        }
      }
      
      // Arena / boss arena: pillars in ring formation
      if (room.type === 'boss' || room.type === 'arena') {
        const pillarCount = rng.int(4, 8);
        const ringR = Math.min(room.rx, room.ry) * 0.55;
        for (let i = 0; i < pillarCount; i++) {
          const angle = (i / pillarCount) * Math.PI * 2 + rng.range(-0.2, 0.2);
          walls.push({ x: room.cx + Math.cos(angle) * ringR, y: room.cy + Math.sin(angle) * ringR,
            type: 'asteroid', radius: rng.int(30, 50), rotation: rng.range(0, Math.PI * 2),
            destructible: false, hp: 999, grounded: true, castsShadow: true, shadowClass: 'asteroid' });
        }
      }
      
      // Ambush rooms: clustered obstacles that enemies hide behind
      if (room.type === 'ambush') {
        const clusterCount = rng.int(2, 4);
        for (let c = 0; c < clusterCount; c++) {
          const clX = room.cx + rng.range(-room.rx * 0.5, room.rx * 0.5);
          const clY = room.cy + rng.range(-room.ry * 0.5, room.ry * 0.5);
          for (let i = 0; i < rng.int(2, 4); i++) {
            walls.push({ x: clX + rng.range(-40, 40), y: clY + rng.range(-40, 40),
              type: 'asteroid', radius: rng.int(20, 35), rotation: rng.range(0, Math.PI * 2),
              destructible: true, hp: rng.int(30, 60), grounded: true, castsShadow: true, shadowClass: 'asteroid' });
          }
        }
      }
      
      // Gauntlet: walls on sides creating a channel
      if (room.type === 'gauntlet') {
        const isHoriz = room.rx > room.ry;
        const longAxis = isHoriz ? room.rx : room.ry;
        const shortAxis = isHoriz ? room.ry : room.rx;
        const steps = Math.floor(longAxis * 2 / 80);
        for (let i = 0; i < steps; i++) {
          const t = (i / steps - 0.5) * longAxis * 2;
          const x = isHoriz ? room.cx + t : room.cx + (rng.chance(0.5) ? shortAxis * 0.7 : -shortAxis * 0.7);
          const y = isHoriz ? room.cy + (rng.chance(0.5) ? shortAxis * 0.7 : -shortAxis * 0.7) : room.cy + t;
          if (rng.chance(0.6)) {
            walls.push({ x, y, type: 'asteroid', radius: rng.int(25, 40),
              rotation: rng.range(0, Math.PI * 2), destructible: false, hp: 999, grounded: true, castsShadow: true, shadowClass: 'asteroid' });
          }
        }
      }
      
      // Treasure: destructible crates
      if (room.type === 'treasure') {
        for (let i = 0; i < rng.int(3, 6); i++) {
          walls.push({
            x: room.cx + rng.range(-room.rx * 0.5, room.rx * 0.5),
            y: room.cy + rng.range(-room.ry * 0.5, room.ry * 0.5),
            type: 'debris', radius: rng.int(15, 28), rotation: rng.range(0, Math.PI * 2),
            destructible: true, hp: rng.int(10, 20), lootOnDestroy: true, grounded: true, castsShadow: false, shadowClass: 'crate' });
        }
      }
      
      // Hidden: narrow entrance + reward inside
      if (room.type === 'hidden') {
        // Guard rocks near entrance
        for (let i = 0; i < rng.int(2, 4); i++) {
          const angle = rng.range(0, Math.PI * 2);
          const dist = Math.max(room.rx, room.ry) * 0.8;
          walls.push({ x: room.cx + Math.cos(angle) * dist, y: room.cy + Math.sin(angle) * dist,
            type: 'asteroid', radius: rng.int(30, 50), rotation: rng.range(0, Math.PI * 2),
            destructible: true, hp: rng.int(50, 80), grounded: true, castsShadow: true, shadowClass: 'asteroid' });
        }
      }
    }
    
    // Zone boundary walls (solid perimeter)
    const bw = 55;
    for (let x = 0; x <= w; x += bw) {
      walls.push({ x, y: 0, type: 'asteroid', radius: 35, destructible: false, hp: 999, rotation: 0, grounded: true, castsShadow: true, shadowClass: 'asteroid' });
      walls.push({ x, y: h, type: 'asteroid', radius: 35, destructible: false, hp: 999, rotation: 0, grounded: true, castsShadow: true, shadowClass: 'asteroid' });
    }
    for (let y = bw; y < h; y += bw) {
      walls.push({ x: 0, y, type: 'asteroid', radius: 35, destructible: false, hp: 999, rotation: 0, grounded: true, castsShadow: true, shadowClass: 'asteroid' });
      walls.push({ x: w, y, type: 'asteroid', radius: 35, destructible: false, hp: 999, rotation: 0, grounded: true, castsShadow: true, shadowClass: 'asteroid' });
    }
    
    return walls;
  },


  _generateDerelictCarrierStructures(rng, layout, w, h) {
    const walls = [];
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const pushBulkhead = (x, y, a = 0, opts = {}) => {
      walls.push({
        x, y,
        type: 'bulkhead',
        radius: opts.radius || 30,
        rotation: a,
        destructible: !!opts.destructible,
        hp: opts.hp || (opts.destructible ? 80 : 999),
        grounded: true,
        castsShadow: true,
        shadowClass: 'bulkhead',
        moduleRole: opts.moduleRole || 'wall'
      });
    };
    const pushCargo = (x, y, a = 0, opts = {}) => {
      walls.push({
        x, y,
        type: 'cargo_stack',
        radius: opts.radius || 24,
        rotation: a,
        destructible: opts.destructible !== false,
        hp: opts.hp || 36,
        grounded: true,
        castsShadow: true,
        shadowClass: 'crate',
        lootOnDestroy: !!opts.lootOnDestroy,
        moduleRole: opts.moduleRole || 'cover'
      });
    };
    const pushConsole = (x, y, a = 0, opts = {}) => {
      walls.push({
        x, y,
        type: 'console_bank',
        radius: opts.radius || 20,
        rotation: a,
        destructible: !!opts.destructible,
        hp: opts.hp || (opts.destructible ? 30 : 999),
        grounded: true,
        castsShadow: false,
        shadowClass: 'console',
        moduleRole: opts.moduleRole || 'console'
      });
    };
    const pushPillar = (x, y, a = 0, opts = {}) => {
      walls.push({
        x, y,
        type: 'pillar',
        radius: opts.radius || 28,
        rotation: a,
        destructible: !!opts.destructible,
        hp: opts.hp || (opts.destructible ? 60 : 999),
        grounded: true,
        castsShadow: true,
        shadowClass: 'pillar',
        moduleRole: opts.moduleRole || 'pillar'
      });
    };
    const pushGate = (x, y, a = 0, opts = {}) => {
      walls.push({
        x, y,
        type: 'gate_pylon',
        radius: opts.radius || 26,
        rotation: a,
        destructible: false,
        hp: 999,
        grounded: true,
        castsShadow: true,
        shadowClass: 'gate',
        moduleRole: opts.moduleRole || 'gate'
      });
    };
    const pushSalvage = (x, y, a = 0, opts = {}) => {
      walls.push({
        x, y,
        type: 'salvage_wreck',
        radius: opts.radius || 34,
        rotation: a,
        destructible: opts.destructible !== false,
        hp: opts.hp || 55,
        grounded: true,
        castsShadow: true,
        shadowClass: 'salvage',
        glow: opts.glow || '#88ff44',
        moduleRole: opts.moduleRole || 'salvage'
      });
    };

    for (const cor of (layout.corridors || [])) {
      const a = layout.rooms[cor.from];
      const b = layout.rooms[cor.to];
      if (!a || !b) continue;
      const cdx = b.cx - a.cx;
      const cdy = b.cy - a.cy;
      const len = Math.hypot(cdx, cdy);
      if (len < 1) continue;
      const nx = cdx / len, ny = cdy / len;
      const px = -ny, py = nx;
      const cm = cor.module || DerelictModuleLibrary.chooseCorridorModule(rng, cor.pathClass || 'main_path');
      const width = cm.width || 108;
      const wallSpacing = cm.wallSpacing || (width + 6);
      const step = 92;
      const segCount = Math.max(3, Math.floor(len / step));

      for (let i = 1; i < segCount - 1; i++) {
        const t = i / segCount;
        const wx = a.cx + cdx * t;
        const wy = a.cy + cdy * t;
        const inRoom = layout.rooms.some(r => Math.abs(wx - r.cx) < r.rx + 36 && Math.abs(wy - r.cy) < r.ry + 36);
        if (inRoom) continue;
        if (i % 2 === 0) {
          pushBulkhead(wx + px * wallSpacing, wy + py * wallSpacing, Math.atan2(cdy, cdx), { moduleRole: 'corridor_wall' });
          pushBulkhead(wx - px * wallSpacing, wy - py * wallSpacing, Math.atan2(cdy, cdx), { moduleRole: 'corridor_wall' });
        }
        if (cm.coverChance && rng.chance(cm.coverChance)) {
          const offset = rng.chance(0.5) ? 0.35 : -0.35;
          pushCargo(wx + px * (width * offset), wy + py * (width * offset), rng.range(0, Math.PI * 2), { radius: rng.int(18, 24), destructible: true, hp: 26, moduleRole: 'corridor_cover' });
        }
        if ((cor.pathClass === 'danger_path' || cor.pathClass === 'portal_link') && i % 4 === 0) {
          pushConsole(wx + px * (wallSpacing - 22), wy + py * (wallSpacing - 22), Math.atan2(cdy, cdx), { moduleRole: 'corridor_console' });
        }
      }
    }

    for (const room of (layout.rooms || [])) {
      const rx = room.rx, ry = room.ry;
      const className = room.carrierClass || room.module?.carrierClass || 'room';
      const addPerimeter = (count = 6, type = 'bulkhead') => {
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const px = room.cx + Math.cos(a) * (rx * 0.78);
          const py = room.cy + Math.sin(a) * (ry * 0.78);
          const rot = a + Math.PI * 0.5;
          if (type === 'pillar') pushPillar(px, py, rot, { radius: 24 });
          else pushBulkhead(px, py, rot, { radius: 28 });
        }
      };

      switch (className) {
        case 'entry':
          addPerimeter(4, 'bulkhead');
          pushConsole(room.cx - rx * 0.35, room.cy, 0, { moduleRole: 'spawn_console' });
          pushConsole(room.cx + rx * 0.35, room.cy, Math.PI, { moduleRole: 'spawn_console' });
          break;
        case 'combat':
          addPerimeter(4, 'bulkhead');
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + rng.range(-0.3, 0.3);
            pushCargo(room.cx + Math.cos(a) * rx * 0.38, room.cy + Math.sin(a) * ry * 0.32, rng.range(0, Math.PI * 2), { radius: rng.int(20, 28), destructible: true, hp: 34, moduleRole: 'combat_cover' });
          }
          break;
        case 'arena':
          addPerimeter(6, 'pillar');
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + rng.range(-0.2, 0.2);
            pushCargo(room.cx + Math.cos(a) * rx * 0.28, room.cy + Math.sin(a) * ry * 0.25, rng.range(0, Math.PI * 2), { radius: 22, destructible: true, hp: 36, moduleRole: 'arena_cover' });
          }
          break;
        case 'poi':
          addPerimeter(4, 'bulkhead');
          pushSalvage(room.cx, room.cy, rng.range(0, Math.PI * 2), { radius: 38, hp: 70, moduleRole: 'poi_core', glow: '#88ff44' });
          pushConsole(room.cx - rx * 0.28, room.cy + ry * 0.18, 0, { moduleRole: 'poi_console' });
          break;
        case 'service':
          addPerimeter(4, 'bulkhead');
          pushConsole(room.cx - rx * 0.3, room.cy, 0, { moduleRole: 'service_console' });
          pushConsole(room.cx + rx * 0.3, room.cy, Math.PI, { moduleRole: 'service_console' });
          pushCargo(room.cx, room.cy + ry * 0.24, rng.range(0, Math.PI * 2), { radius: 18, destructible: true, hp: 24, moduleRole: 'service_storage' });
          break;
        case 'gate':
          pushGate(room.cx - rx * 0.42, room.cy, 0, { moduleRole: 'gate_left' });
          pushGate(room.cx + rx * 0.42, room.cy, Math.PI, { moduleRole: 'gate_right' });
          pushConsole(room.cx, room.cy + ry * 0.24, 0, { moduleRole: 'gate_console' });
          addPerimeter(2, 'bulkhead');
          break;
        case 'secret':
          addPerimeter(3, 'bulkhead');
          pushCargo(room.cx, room.cy, rng.range(0, Math.PI * 2), { radius: 24, destructible: true, hp: 20, lootOnDestroy: true, moduleRole: 'secret_cache' });
          pushConsole(room.cx + rx * 0.18, room.cy - ry * 0.12, 0, { moduleRole: 'secret_scanner' });
          break;
        case 'trap':
          pushBulkhead(room.cx - rx * 0.45, room.cy, 0, { moduleRole: 'trap_lock_left' });
          pushBulkhead(room.cx + rx * 0.45, room.cy, 0, { moduleRole: 'trap_lock_right' });
          pushConsole(room.cx, room.cy - ry * 0.28, 0, { moduleRole: 'trap_console' });
          for (let i = 0; i < 2; i++) {
            pushCargo(room.cx + (i === 0 ? -1 : 1) * rx * 0.2, room.cy + ry * 0.14, rng.range(0, Math.PI * 2), { radius: 20, destructible: true, hp: 30, moduleRole: 'trap_cover' });
          }
          break;
        case 'corridor':
          break;
        default:
          addPerimeter(4, 'bulkhead');
          break;
      }
    }

    // Derelict border hull pieces instead of asteroid ring.
    for (let x = 0; x <= w; x += 320) {
      pushBulkhead(clamp(x, 0, w), 0, 0, { radius: 26, moduleRole: 'border' });
      pushBulkhead(clamp(x, 0, w), h, 0, { radius: 26, moduleRole: 'border' });
    }
    for (let y = 0; y <= h; y += 320) {
      pushBulkhead(0, clamp(y, 0, h), Math.PI * 0.5, { radius: 26, moduleRole: 'border' });
      pushBulkhead(w, clamp(y, 0, h), Math.PI * 0.5, { radius: 26, moduleRole: 'border' });
    }

    return walls;
  },

  _generateRoomEnemies(rng, layout, pool, density, spawn, exit) {
    const enemies = [];
    const spawnSafe = 350;
    
    for (const room of layout.rooms) {
      if (room.type === 'spawn') continue;
      
      let count;
      if (typeof room.encounterCapacity === 'number' && room.encounterCapacity > 0) {
        const base = Math.max(0, room.encounterCapacity);
        count = base === 0 ? 0 : rng.int(Math.max(0, base - 1), Math.max(base, base + 2));
      } else {
        switch (room.type) {
          case 'boss': count = rng.int(4, 7); break;
          case 'arena': count = rng.int(8, 12); break;
          case 'ambush': count = rng.int(8, 14); break;
          case 'combat': count = rng.int(5, 9); break;
          case 'gauntlet': count = rng.int(6, 10); break;
          case 'junction': count = rng.int(4, 7); break;
          case 'treasure': count = rng.int(2, 4); break;
          case 'hidden': count = rng.int(3, 5); break;
          default: count = rng.int(4, 7);
        }
      }
      if (count <= 0) continue;
      
      for (let i = 0; i < count; i++) {
        const angle = rng.range(0, Math.PI * 2);
        const dist = rng.range(0, Math.min(room.rx, room.ry) * 0.65);
        const ex = room.cx + Math.cos(angle) * dist;
        const ey = room.cy + Math.sin(angle) * dist;
        
        if (Math.hypot(ex - spawn.x, ey - spawn.y) < spawnSafe) continue;
        
        const type = rng.pick(pool);
        enemies.push({
          x: ex, y: ey, type, active: false, killed: false,
          homeX: ex, homeY: ey, patrolRadius: 80
        });
      }
    }
    
    return enemies;
  }
};

export default MapGenerator;