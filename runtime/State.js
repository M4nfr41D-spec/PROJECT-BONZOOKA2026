// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// State.js - Single Source of Truth
// ============================================================

export const State = {
  // Loaded JSON data
  data: {
    config: null,
    items: null,
    rarities: null,
    affixes: null,
    skills: null,
    pilotStats: null,
    enemies: null,
    runUpgrades: null,
    slots: null,
    acts: {}  // Act configurations
  },
  
  // Module references (set during init)
  modules: {
    UI: null,
    Stats: null,
    Save: null,
    Items: null,
    Enemies: null,
    Bullets: null,
    Particles: null,
    Pickups: null,
    Leveling: null,
    World: null,
    Camera: null,
    SceneManager: null,
    Rewards: null
  },
  
  // Current scene
  scene: 'hub', // 'hub', 'combat', 'loading', 'gameover'
  
  // World state (for exploration mode)
  world: {
    currentZone: null,
    currentAct: null,
    zoneIndex: 0,
    collisionMeta: null,
    navigationMeta: null,
    overlayMeta: null,
    layerProfile: null,
    spatialQueryGrid: null
  },
  
  // Persistent meta progress (saved to localStorage)
  meta: {
    scrap: 0,
    level: 1,
    xp: 0,
    skillPoints: 0,
    statPoints: 0,

    // Endless depth progression (saved)
    depth: {
      bestDepth: 1,
      unlocked: [],
      lastUnlockAt: 0
    },
    skills: {},       // { treeId: { skillId: rank } }
    stats: {},        // { statId: points }
    equipment: {},    // { slotId: itemId }
    stash: [],        // Array of item objects
    highestWave: 0,
    // Per-difficulty highest zones (anti-exploit: each lane tracked separately)
    highestZones: { normal: 0, risk: 0, chaos: 0 },
    totalRuns: 0,
    totalKills: 0,
    totalPlaytime: 0,
    totalBossKills: 0,
    totalEliteKills: 0,
    totalScrapEarned: 0,
    totalItemsCollected: 0,
    totalCrafts: 0,
    totalLegendaries: 0,
    achievements: {},
    actsCompleted: [], // ['act1', 'act2', ...]
    actsUnlocked: ['act1'], // Acts available to play
    
    // ═══ v2.13.0: Endgame Systems ═══
    prestige: {
      level: 0,
      totalResets: 0,
      bonuses: { damage: 0, maxHP: 0, luck: 0, xpRate: 0, startScrap: 0 }
    },
    missions: {
      active: [],        // [{id, type, label, icon, target, progress, reward}]
      completed: 0,
      refreshTimer: 0
    },
    corruption: 0,       // 0-10 stacks (endgame difficulty multiplier)
    leaderboard: [],     // best 10 runs [{depth, kills, dps, time, difficulty, date}]
    
    // ═══ v2.16.3: New persistent fields ═══
    paragon: { unlocked: {}, choicesMade: {} },
    selectedSkin: 'default',
    tutorialComplete: false,
    voidShards: 0,
    cosmicDust: 0,
    pity: {
      killsSinceRare: 0,
      killsSinceLegendary: 0,
      killsSinceUnique: 0,
      dryStreakLuck: 0,
      totalDrops: 0,
      rarityHist: {}
    }
  },
  
  // Current run state (reset each run)
  run: {
    active: false,
    inCombat: false,
    currentAct: null,
    difficulty: 'normal', // 'normal' | 'risk' | 'chaos'
    wave: 0,
    cells: 0,
    scrapEarned: 0,
    xpEarned: 0,
    upgrades: {},     // { upgradeId: tier }
    stats: {
      kills: 0,
      damageDealt: 0,
      damageTaken: 0,
      timeElapsed: 0,
      timeStarted: 0,
      itemsFound: 0,
      eliteKills: 0,
      bossKills: 0,
      bestStreak: 0,
      flawlessZones: 0
    },
    // Kill streak / combo system
    streak: {
      count: 0,       // current kill chain
      timer: 0,       // seconds since last kill (resets on kill)
      best: 0,        // best streak this run
      xpMult: 1,      // calculated from count
      lootMult: 1     // calculated from count
    },
    // Zone objective (set per zone by MapGenerator)
    objective: null,    // { type, label, icon, progress, target, complete, bonusLoot }
    // v2.13.0: active zone modifiers for current zone
    zoneMods: [],       // [{id, name, desc, icon, effect}] - rolled per zone
    corruption: 0       // inherited from meta.corruption at run start
  },
  
  // Player state
  player: {
    x: 0, y: 0,
    vx: 0, vy: 0,
    angle: 0,         // Rotation toward mouse
    radius: 18,
    
    // Active abilities
    abilities: {
      dash:    { cooldown: 0, maxCooldown: 4,  duration: 0, active: false },
      shield:  { cooldown: 0, maxCooldown: 12, duration: 0, active: false },
      orbital: { cooldown: 0, maxCooldown: 18, duration: 0, active: false }
    },
    
    // Stats (calculated by Stats.js)
    maxHP: 100,
    hp: 100,
    maxShield: 0,
    shield: 0,
    damage: 10,
    fireRate: 3,
    speed: 280,
    critChance: 5,
    critDamage: 150,
    projectiles: 1,
    piercing: 0,
    spread: 0,
    bulletSpeed: 600,
    luck: 0,
    pickupRadius: 50,
    
    // Active weapon
    weaponType: 'laser',
    // Weapon definitions (base modifiers applied on switch)
    weaponDefs: {
      laser:   { fireRate: 1.45, damage: 0.62, bulletSpeed: 1.35, spread: 0,   projectiles: 0, piercing: 0, bulletType: 'laser',   label: 'Laser',           color: '#ff3a2d' },
      plasma:  { fireRate: 0.58, damage: 1.0,  bulletSpeed: 1.25, spread: 10,  projectiles: 4, piercing: 0, bulletType: 'plasma',  label: 'Plasma Spreader', color: '#88ff44' },
      railgun: { fireRate: 0.24, damage: 2.8,  bulletSpeed: 2.25, spread: 0,   projectiles: 0, piercing: 0, bulletType: 'railgun', label: 'Railgun Sniper',  color: '#cc88ff' },
      missile: { fireRate: 0.42, damage: 1.85, bulletSpeed: 0.78, spread: 0,   projectiles: 0, piercing: 0, bulletType: 'missile', label: 'Missile Pod',      color: '#ff8800' },
      gatling: { fireRate: 2.4,  damage: 0.28, bulletSpeed: 1.1,  spread: 8.5, projectiles: 2, piercing: 0, bulletType: 'gatling', label: 'Gattling Cannon', color: '#ffee44' },
      nova:    { fireRate: 0.7,  damage: 1.4,  bulletSpeed: 0.45, spread: 360, projectiles: 5, piercing: 0, bulletType: 'nova',    label: 'Nova',             color: '#aa66ff' }
    },
    
    // Cooldowns
    fireCooldown: 0,
    shieldRegenDelay: 0,
    
    // Heat system (autofire with overheat)
    heat: 0,            // 0-100, overheats at 100
    heatMax: 100,
    overheated: false,   // true = can't fire until cooled below threshold
    coolantTimer: 0,     // >0 = coolant active (no heat buildup)
    coolantDuration: 10, // seconds of free fire from coolant pickup

    // Drone companion
    drone: {
      active: true,
      type: 'combat',  // combat, shield, repair
      x: 0, y: 0,
      damagePct: 0.12,
      fireRate: 0.75,
      baseFireRate: 0.75,
      healPct: 0.02
    }
  },
  
  // Input state
  input: {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    // Interaction (portals, terminals, etc.)
    interact: false,
    interactPressed: false,
    // v2.16.3: Target Lock (enemy id or null)
    targetLock: null,
    shift: false,
    // Abilities (Q/R/F or 1/2/3)
    ability1: false, // dash
    ability2: false, // shield burst
    ability3: false, // orbital strike
    mouseX: 0,
    mouseY: 0
  },
  
  // Game objects
  bullets: [],
  enemyBullets: [],
  enemies: [],
  pickups: [],
  particles: [],
  
  // UI state
  ui: {
    paused: false,
    tooltip: null,
    selectedItem: null
  },

  // ═══ v2.15.0: Player Settings (persisted in Save.js) ═══
  settings: {
    sfxVolume: 0.7,
    musicVolume: 0.4,
    screenShake: true,
    damageNumbers: true,
    postEffects: true
  },

  // Ephemeral runtime diagnostics (not persisted)
  debug: {
    enabledChannels: {
      loot: true
    },
    maxEntriesPerChannel: 40,
    channels: {
      loot: []
    }
  },

  pushDebugTrace(channel, event, payload = {}) {
    const dbg = this.debug;
    if (!dbg || !channel || !event) return null;
    if (!dbg.enabledChannels?.[channel]) return null;

    const maxEntries = Math.max(5, dbg.maxEntriesPerChannel || 40);
    if (!dbg.channels[channel]) dbg.channels[channel] = [];

    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

    const entry = {
      ts: now,
      channel,
      event,
      scene: this.scene,
      depth: this.run?.currentDepth || 0,
      ...payload
    };

    dbg.channels[channel].push(entry);
    if (dbg.channels[channel].length > maxEntries) {
      dbg.channels[channel].splice(0, dbg.channels[channel].length - maxEntries);
    }

    return entry;
  },

  getDebugTrace(channel) {
    return this.debug?.channels?.[channel] || [];
  },

  clearDebugTrace(channel) {
    if (!this.debug?.channels) return;
    if (!channel) {
      for (const key of Object.keys(this.debug.channels)) {
        this.debug.channels[key] = [];
      }
      return;
    }
    this.debug.channels[channel] = [];
  }
};

// Reset run state
export function resetRun() {
  State.run = {
    active: false,
    inCombat: false,
    currentAct: null,
    difficulty: 'normal',
    wave: 0,
    cells: 0,
    scrapEarned: 0,
    xpEarned: 0,
    upgrades: {},
    currentDepth: 0,
    stats: { 
      kills: 0, 
      damageDealt: 0, 
      damageTaken: 0, 
      timeElapsed: 0,
      timeStarted: 0,
      itemsFound: 0,
      eliteKills: 0,
      bossKills: 0,
      bestStreak: 0,
      flawlessZones: 0
    },
    streak: { count: 0, timer: 0, best: 0, xpMult: 1, lootMult: 1 },
    objective: null,
    zoneMods: [],
    corruption: State.meta?.corruption || 0
  };
  State.bullets = [];
  State.enemyBullets = [];
  State.enemies = [];
  State.pickups = [];
  State.particles = [];
  State.world = {
    currentZone: null,
    currentAct: null,
    zoneIndex: 0
  };
  State.clearDebugTrace?.('loot');
}

// Reset player position
export function resetPlayer(canvasW, canvasH) {
  State.player.x = canvasW / 2;
  State.player.y = canvasH * 0.7;
  State.player.vx = 0;
  State.player.vy = 0;
  State.player.angle = -Math.PI / 2; // Point up
  State.player.fireCooldown = 0;
  State.player.shieldRegenDelay = 0;
  State.player.heat = 0;
  State.player.overheated = false;
  State.player.coolantTimer = 0;
}

export default State;
