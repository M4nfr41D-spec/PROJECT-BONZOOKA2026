// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// TopologySchema.js - W4A.2 topology budgets and validation
// ============================================================

export const TopologySchema = {
  version: 'w4a2',
  allowedNodeTypes: [
    'spawn_room',
    'room_small',
    'room_medium',
    'room_large',
    'corridor_narrow',
    'corridor_wide',
    'arena_room',
    'poi_room',
    'hub_room',
    'service_room',
    'portal_room',
    'secret_room',
    'trap_room',
    'boss_gate_room',
    'finale_arena'
  ],
  allowedPathTypes: [
    'main_path',
    'optional_path',
    'danger_path',
    'secret_path',
    'loopback_path',
    'shortcut_path',
    'portal_link'
  ],
  allowedPurposes: [
    'traversal',
    'combat',
    'reward',
    'event',
    'portal',
    'secret',
    'trap',
    'hub',
    'finale'
  ],
  budgets: {
    small: {
      id: 'small',
      nodeCount: [8, 12],
      mainPathNodes: [5, 7],
      optionalNodes: [1, 3],
      poiNodes: [1, 2],
      arenaNodes: [1, 1],
      secretBranches: [0, 1],
      trapBranches: [0, 1],
      deadEndsMax: 1,
      portalsMax: 1,
      reliefNodes: [0, 1]
    },
    medium: {
      id: 'medium',
      nodeCount: [12, 16],
      mainPathNodes: [7, 9],
      optionalNodes: [2, 3],
      poiNodes: [2, 2],
      arenaNodes: [1, 1],
      secretBranches: [1, 1],
      trapBranches: [1, 1],
      deadEndsMax: 2,
      portalsMax: 2,
      reliefNodes: [1, 1]
    },
    large: {
      id: 'large',
      nodeCount: [18, 28],
      mainPathNodes: [10, 15],
      optionalNodes: [4, 7],
      poiNodes: [2, 4],
      arenaNodes: [2, 3],
      secretBranches: [1, 2],
      trapBranches: [1, 2],
      deadEndsMax: 2,
      portalsMax: 3,
      reliefNodes: [1, 1]
    }
  },

  getBudget(id = 'medium') {
    return this.budgets[id] || this.budgets.medium;
  },

  validateGraph(graph, budgetId = 'medium') {
    const budget = this.getBudget(budgetId);
    const errors = [];
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return { ok: false, errors: ['Graph missing nodes/edges'], budget };
    }
    const nodeCount = graph.nodes.length;
    if (nodeCount < budget.nodeCount[0] || nodeCount > budget.nodeCount[1]) {
      errors.push(`nodeCount ${nodeCount} outside budget ${budget.nodeCount[0]}-${budget.nodeCount[1]}`);
    }
    const countIf = (fn) => graph.nodes.filter(fn).length;
    const mainCount = countIf(n => n.pathClass === 'main_path' || n.isMainPath);
    const optionalCount = countIf(n => n.pathClass === 'optional_path');
    const poiCount = countIf(n => n.primaryPurpose === 'reward' || n.nodeType === 'poi_room');
    const arenaCount = countIf(n => n.nodeType === 'arena_room' || n.nodeType === 'finale_arena');
    const secretCount = countIf(n => n.primaryPurpose === 'secret' || n.nodeType === 'secret_room');
    const trapCount = countIf(n => n.primaryPurpose === 'trap' || n.nodeType === 'trap_room');
    const portalCount = countIf(n => n.primaryPurpose === 'portal' || n.nodeType === 'portal_room' || n.nodeType === 'boss_gate_room');
    const reliefCount = countIf(n => n.primaryPurpose === 'hub' || n.nodeType === 'hub_room' || n.nodeType === 'service_room');

    const within = (val, range, label) => {
      if (val < range[0] || val > range[1]) errors.push(`${label} ${val} outside budget ${range[0]}-${range[1]}`);
    };
    within(mainCount, budget.mainPathNodes, 'mainPathNodes');
    within(optionalCount, budget.optionalNodes, 'optionalNodes');
    within(poiCount, budget.poiNodes, 'poiNodes');
    within(arenaCount, budget.arenaNodes, 'arenaNodes');
    within(secretCount, budget.secretBranches, 'secretBranches');
    within(trapCount, budget.trapBranches, 'trapBranches');
    within(reliefCount, budget.reliefNodes, 'reliefNodes');
    if (portalCount > budget.portalsMax) errors.push(`portals ${portalCount} exceeds max ${budget.portalsMax}`);

    for (const node of graph.nodes) {
      if (!this.allowedNodeTypes.includes(node.nodeType)) errors.push(`invalid nodeType ${node.nodeType}`);
      if (!this.allowedPurposes.includes(node.primaryPurpose)) errors.push(`invalid primaryPurpose ${node.primaryPurpose}`);
      if (node.secondaryPurpose && !this.allowedPurposes.includes(node.secondaryPurpose)) errors.push(`invalid secondaryPurpose ${node.secondaryPurpose}`);
    }
    for (const edge of graph.edges) {
      if (!this.allowedPathTypes.includes(edge.pathClass)) errors.push(`invalid pathClass ${edge.pathClass}`);
    }

    return {
      ok: errors.length === 0,
      errors,
      budget,
      counts: { nodeCount, mainCount, optionalCount, poiCount, arenaCount, secretCount, trapCount, portalCount, reliefCount }
    };
  }
};

export default TopologySchema;
