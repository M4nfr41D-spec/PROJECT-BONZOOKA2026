// v2166A28 — isolated derelict dungeon subsystem scaffold
// IMPORTANT: intentionally not imported by runtime yet.
// Goal: future POI/instance interiors use tile-first assembly without touching overworld generation.

export const DerelictDungeonInstanceSpec = Object.freeze({
  id: 'derelict_dungeon_instance_scaffold',
  enabled: true,
  mode: 'isolated_instance_only',
  entryKinds: ['salvage_wreck', 'station_breach', 'signal_echo'],
  semantics: {
    transparent: 'walkable_floor',
    blackBackground: 'solid_void'
  },
  assemblyRules: {
    overworldUntouched: true,
    tileFirstInsideInstance: true,
    noLegacyCorridorPaint: true,
    noGlobalWorldReplacement: true
  },
  requiredModuleFamilies: [
    'corridor_straight','corridor_corner','corridor_tjunction','corridor_cross',
    'room_small','room_medium','room_reward','room_anchor'
  ],
  futureHooks: {
    poiResolver: 'salvage_wreck -> enterDerelictInstance',
    instanceAssembler: 'DerelictDungeonAssembler.buildFromPoi',
    rewardRouter: 'TODO',
    returnPortal: 'portal.destination=return_instance'
  }
});
