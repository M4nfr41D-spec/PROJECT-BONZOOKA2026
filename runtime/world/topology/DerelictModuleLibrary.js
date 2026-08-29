// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// DerelictModuleLibrary.js - W4A.3 structure carrier modules
// ============================================================
// Purpose:
// - define concrete room/corridor carriers for the Derelict vertical slice
// - keep topology generic while giving layout a real structural grammar
// - expose clear module choices that MapGenerator can realize deterministically

function pick(rng, arr) {
  return arr[Math.floor(rng.range(0, arr.length)) % arr.length];
}

const ROOM_MODULES = {
  spawn_room: [
    { id: 'der_spawn_dock_alpha', footprint: 'oval', floorBias: 'stable', structureBias: 'dock', tags: ['entry', 'safe', 'dock'] }
  ],
  room_small: [
    { id: 'der_loot_closet', footprint: 'compact_rect', floorBias: 'stable', structureBias: 'cargo', tags: ['optional', 'loot'] },
    { id: 'der_watch_room', footprint: 'compact_round', floorBias: 'stable', structureBias: 'cover', tags: ['optional', 'guard'] }
  ],
  room_medium: [
    { id: 'der_combat_bay', footprint: 'wide_rect', floorBias: 'combat', structureBias: 'cover', tags: ['combat', 'bay'] },
    { id: 'der_crossfire_chamber', footprint: 'wide_round', floorBias: 'combat', structureBias: 'pillar_ring', tags: ['combat', 'crossfire'] }
  ],
  room_large: [
    { id: 'der_hangar_floor', footprint: 'hangar', floorBias: 'arena', structureBias: 'cargo_cover', tags: ['large', 'hangar'] }
  ],
  arena_room: [
    { id: 'der_lockdown_arena', footprint: 'arena_round', floorBias: 'arena', structureBias: 'pillar_ring', tags: ['arena', 'combat'] }
  ],
  poi_room: [
    { id: 'der_salvage_vault', footprint: 'vault', floorBias: 'poi', structureBias: 'salvage_core', tags: ['poi', 'reward'] },
    { id: 'der_reactor_access', footprint: 'rect_core', floorBias: 'poi', structureBias: 'console_core', tags: ['poi', 'event'] }
  ],
  hub_room: [
    { id: 'der_service_hub', footprint: 'hub_round', floorBias: 'safe', structureBias: 'console_ring', tags: ['hub', 'relief'] }
  ],
  service_room: [
    { id: 'der_maintenance_nexus', footprint: 'service_rect', floorBias: 'service', structureBias: 'console_strip', tags: ['relief', 'service'] }
  ],
  portal_room: [
    { id: 'der_gate_chamber', footprint: 'gate_rect', floorBias: 'portal', structureBias: 'gate_frame', tags: ['portal', 'shortcut'] }
  ],
  secret_room: [
    { id: 'der_false_bulkhead_cache', footprint: 'secret_rect', floorBias: 'secret', structureBias: 'hidden_cache', tags: ['secret', 'reward'] }
  ],
  trap_room: [
    { id: 'der_lockdown_killbox', footprint: 'trap_rect', floorBias: 'trap', structureBias: 'bulkhead_killbox', tags: ['trap', 'lockdown'] }
  ],
  boss_gate_room: [
    { id: 'der_final_bulkhead', footprint: 'gate_rect', floorBias: 'portal', structureBias: 'boss_gate', tags: ['gate', 'finale'] }
  ],
  finale_arena: [
    { id: 'der_command_core', footprint: 'arena_round', floorBias: 'finale', structureBias: 'command_ring', tags: ['boss', 'finale'] }
  ],
  corridor_narrow: [
    { id: 'der_maintenance_corridor', footprint: 'narrow', floorBias: 'corridor', structureBias: 'maintenance', tags: ['corridor', 'maintenance'] }
  ],
  corridor_wide: [
    { id: 'der_transit_corridor', footprint: 'wide', floorBias: 'corridor', structureBias: 'transit', tags: ['corridor', 'transit'] }
  ]
};

const CORRIDOR_MODULES = {
  main_path: [
    { id: 'der_main_bulkhead_run', width: 110, wallSpacing: 112, coverChance: 0.04, tags: ['main', 'readable'] }
  ],
  optional_path: [
    { id: 'der_optional_service_run', width: 92, wallSpacing: 102, coverChance: 0.06, tags: ['optional', 'service'] }
  ],
  danger_path: [
    { id: 'der_danger_crossfire_run', width: 120, wallSpacing: 128, coverChance: 0.11, tags: ['danger', 'crossfire'] }
  ],
  secret_path: [
    { id: 'der_secret_maintenance_run', width: 84, wallSpacing: 96, coverChance: 0.03, tags: ['secret', 'tight'] }
  ],
  shortcut_path: [
    { id: 'der_shortcut_transit_run', width: 100, wallSpacing: 106, coverChance: 0.03, tags: ['shortcut', 'fast'] }
  ],
  portal_link: [
    { id: 'der_portal_link_run', width: 108, wallSpacing: 114, coverChance: 0.02, tags: ['portal', 'clean'] }
  ],
  loopback_path: [
    { id: 'der_loopback_run', width: 98, wallSpacing: 104, coverChance: 0.04, tags: ['loopback'] }
  ]
};

export const DerelictModuleLibrary = {
  roomModules: ROOM_MODULES,
  corridorModules: CORRIDOR_MODULES,

  chooseRoomModule(rng, nodeType, primaryPurpose = 'traversal') {
    const variants = ROOM_MODULES[nodeType] || ROOM_MODULES.room_medium;
    const chosen = pick(rng, variants);
    return {
      ...chosen,
      nodeType,
      primaryPurpose,
      carrierClass: this.resolveCarrierClass(nodeType, primaryPurpose, chosen)
    };
  },

  chooseCorridorModule(rng, pathClass = 'main_path') {
    const variants = CORRIDOR_MODULES[pathClass] || CORRIDOR_MODULES.main_path;
    return { ...pick(rng, variants), pathClass };
  },

  resolveCarrierClass(nodeType, primaryPurpose, module) {
    if (nodeType === 'portal_room' || nodeType === 'boss_gate_room') return 'gate';
    if (nodeType === 'secret_room') return 'secret';
    if (nodeType === 'trap_room') return 'trap';
    if (nodeType === 'service_room' || nodeType === 'hub_room') return 'service';
    if (nodeType === 'poi_room') return 'poi';
    if (nodeType === 'arena_room' || nodeType === 'finale_arena') return 'arena';
    if (nodeType.startsWith('corridor')) return 'corridor';
    if (primaryPurpose === 'combat') return 'combat';
    return module?.tags?.includes('dock') ? 'entry' : 'room';
  }
};

export default DerelictModuleLibrary;
