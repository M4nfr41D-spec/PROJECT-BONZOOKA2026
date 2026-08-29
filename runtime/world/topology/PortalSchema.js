// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// PortalSchema.js - W4A.2 launch portal schema
// ============================================================

export const PortalSchema = {
  launchTypes: [
    'paired_portal',
    'shortcut_portal',
    'boss_gate_portal'
  ],
  requiredFields: [
    'portalId',
    'targetPortalId',
    'bidirectional',
    'oneWay',
    'locked',
    'activationType',
    'cooldown',
    'visibilityState',
    'secret',
    'trap',
    'label'
  ],
  create(type, fromNodeId, toNodeId, overrides = {}) {
    const portalId = overrides.portalId || `${type}_${fromNodeId}`;
    return {
      portalType: type,
      portalId,
      targetPortalId: overrides.targetPortalId || `${type}_${toNodeId}`,
      fromNodeId,
      toNodeId,
      bidirectional: overrides.bidirectional ?? (type !== 'boss_gate_portal'),
      oneWay: overrides.oneWay ?? false,
      locked: overrides.locked ?? (type === 'boss_gate_portal'),
      activationType: overrides.activationType || (type === 'boss_gate_portal' ? 'room_clear' : 'proximity'),
      cooldown: overrides.cooldown ?? 0.6,
      visibilityState: overrides.visibilityState || 'visible',
      secret: overrides.secret ?? false,
      trap: overrides.trap ?? false,
      label: overrides.label || type.replace(/_/g, ' ').toUpperCase()
    };
  }
};

export default PortalSchema;
