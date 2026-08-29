// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// DerelictSliceGraph.js - W4A.2 authored vertical-slice graph
// ============================================================

import { TopologySchema } from './TopologySchema.js';
import { EventSocketSchema } from './EventSocketSchema.js';
import { PortalSchema } from './PortalSchema.js';

function node(id, nodeType, primaryPurpose, options = {}) {
  return {
    id,
    nodeType,
    primaryPurpose,
    secondaryPurpose: options.secondaryPurpose || null,
    pathClass: options.pathClass || 'main_path',
    encounterCapacity: options.encounterCapacity ?? 0,
    eventCapacity: options.eventCapacity ?? 0,
    rewardRole: options.rewardRole || 'none',
    threatRole: options.threatRole || 'none',
    visibilityProfile: options.visibilityProfile || 'clear',
    portalAllowed: !!options.portalAllowed,
    secretAllowed: !!options.secretAllowed,
    trapAllowed: !!options.trapAllowed,
    isMainPath: options.isMainPath ?? (options.pathClass === 'main_path'),
    parentId: options.parentId || null,
    routeIndex: options.routeIndex ?? null
  };
}

export const DerelictSliceGraph = {
  budgetId: 'medium',

  build(rng, zone, depth = 1) {
    const nodes = [];
    const edges = [];

    nodes.push(node('spawn_room', 'spawn_room', 'traversal', {
      secondaryPurpose: 'hub', visibilityProfile: 'safe', encounterCapacity: 0, eventCapacity: 0, rewardRole: 'entry', threatRole: 'none', routeIndex: 0
    }));
    nodes.push(node('main_corridor_a', 'corridor_narrow', 'traversal', {
      secondaryPurpose: 'combat', encounterCapacity: 2, eventCapacity: 1, rewardRole: 'none', threatRole: 'pressure', visibilityProfile: 'strong_route', routeIndex: 1
    }));
    nodes.push(node('combat_room_a', 'room_medium', 'combat', {
      encounterCapacity: 3, eventCapacity: 1, rewardRole: 'micro', threatRole: 'frontline', visibilityProfile: 'stable', routeIndex: 2
    }));
    nodes.push(node('poi_room', 'poi_room', 'reward', {
      secondaryPurpose: 'event', encounterCapacity: 2, eventCapacity: 2, rewardRole: 'poi', threatRole: 'guarded', visibilityProfile: 'poi', routeIndex: 3
    }));
    nodes.push(node('service_relief', 'service_room', 'hub', {
      secondaryPurpose: 'event', encounterCapacity: 1, eventCapacity: 2, rewardRole: 'relief', threatRole: 'low', visibilityProfile: 'service', routeIndex: 4
    }));
    nodes.push(node('danger_corridor', 'corridor_wide', 'combat', {
      secondaryPurpose: 'traversal', encounterCapacity: 3, eventCapacity: 1, rewardRole: 'none', threatRole: 'crossfire', visibilityProfile: 'danger', routeIndex: 5
    }));
    nodes.push(node('arena_room', 'arena_room', 'combat', {
      secondaryPurpose: 'event', encounterCapacity: 5, eventCapacity: 2, rewardRole: 'major', threatRole: 'arena', visibilityProfile: 'arena', routeIndex: 6
    }));
    nodes.push(node('portal_room', 'portal_room', 'portal', {
      secondaryPurpose: 'traversal', encounterCapacity: 1, eventCapacity: 1, rewardRole: 'shortcut', threatRole: 'low', visibilityProfile: 'portal', portalAllowed: true, routeIndex: 7
    }));
    nodes.push(node('boss_gate_room', 'boss_gate_room', 'portal', {
      secondaryPurpose: 'finale', encounterCapacity: 2, eventCapacity: 1, rewardRole: 'gate', threatRole: 'checkpoint', visibilityProfile: 'boss_gate', portalAllowed: true, routeIndex: 8
    }));
    nodes.push(node('finale_arena', 'finale_arena', 'finale', {
      secondaryPurpose: 'combat', encounterCapacity: 6, eventCapacity: 2, rewardRole: 'finale', threatRole: 'boss', visibilityProfile: 'finale', routeIndex: 9
    }));

    const optionalParent = rng.chance(0.5) ? 'combat_room_a' : 'service_relief';
    nodes.push(node('optional_loot', 'room_small', 'reward', {
      secondaryPurpose: 'combat', pathClass: 'optional_path', encounterCapacity: 2, eventCapacity: 1, rewardRole: 'optional_loot', threatRole: 'medium', visibilityProfile: 'optional', parentId: optionalParent
    }));
    nodes.push(node('secret_room', 'secret_room', 'secret', {
      secondaryPurpose: 'reward', pathClass: 'secret_path', encounterCapacity: 1, eventCapacity: 2, rewardRole: 'secret_spike', threatRole: 'ambush_possible', visibilityProfile: 'secret', secretAllowed: true, parentId: 'optional_loot'
    }));
    nodes.push(node('trap_room', 'trap_room', 'trap', {
      secondaryPurpose: 'combat', pathClass: 'danger_path', encounterCapacity: 3, eventCapacity: 2, rewardRole: 'risk_reward', threatRole: 'lockdown', visibilityProfile: 'trap', trapAllowed: true, parentId: 'danger_corridor'
    }));
    nodes.push(node('shortcut_room', 'corridor_wide', 'traversal', {
      secondaryPurpose: 'portal', pathClass: 'shortcut_path', encounterCapacity: 1, eventCapacity: 1, rewardRole: 'compression', threatRole: 'low', visibilityProfile: 'shortcut', portalAllowed: true, parentId: 'portal_room'
    }));

    const edge = (from, to, pathClass = 'main_path', extra = {}) => edges.push({ from, to, pathClass, ...extra });
    edge('spawn_room', 'main_corridor_a');
    edge('main_corridor_a', 'combat_room_a');
    edge('combat_room_a', 'poi_room');
    edge('poi_room', 'service_relief');
    edge('service_relief', 'danger_corridor');
    edge('danger_corridor', 'arena_room');
    edge('arena_room', 'portal_room');
    edge('portal_room', 'boss_gate_room');
    edge('boss_gate_room', 'finale_arena');
    edge(optionalParent, 'optional_loot', 'optional_path');
    edge('optional_loot', 'secret_room', 'secret_path');
    edge('danger_corridor', 'trap_room', 'danger_path');
    edge('portal_room', 'shortcut_room', 'shortcut_path');
    edge('shortcut_room', 'service_relief', 'loopback_path');

    const portals = [
      PortalSchema.create('shortcut_portal', 'portal_room', 'shortcut_room', { label: 'SERVICE BYPASS' }),
      PortalSchema.create('boss_gate_portal', 'boss_gate_room', 'finale_arena', { bidirectional: false, oneWay: true, locked: true, label: 'BOSS GATE' })
    ];

    const nodesWithSockets = nodes.map((n) => ({
      ...n,
      sockets: EventSocketSchema.nodeSocketMap[n.nodeType] || [],
      triggers: EventSocketSchema.triggersForNode(n.nodeType, n.primaryPurpose)
    }));

    const graph = {
      id: `derelict_slice_${zone.seed || depth}`,
      biome: 'derelict',
      themeId: 'derelict_plateyard',
      budgetId: this.budgetId,
      mode: 'vertical_slice',
      nodes: nodesWithSockets,
      edges,
      portals,
      summary: {
        mainRouteReadable: true,
        optionalDeviationCount: 1,
        secretBranchCount: 1,
        trapBranchCount: 1,
        shortcutCount: 1,
        finaleChain: ['boss_gate_room', 'finale_arena']
      }
    };

    const validation = TopologySchema.validateGraph(graph, this.budgetId);
    graph.validation = validation;
    graph.launchReadiness = validation.ok;
    return graph;
  }
};

export default DerelictSliceGraph;
