// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// EventSocketSchema.js - W4A.2 launch event/trigger socket schema
// ============================================================

export const EventSocketSchema = {
  triggerClasses: [
    'enter_room_trigger',
    'proximity_trigger',
    'cleanup_trigger',
    'interaction_trigger',
    'portal_trigger',
    'secret_reveal_trigger',
    'trap_trigger'
  ],
  launchSockets: [
    'event_beacon',
    'scanner_node',
    'lockdown_door',
    'room_clear_reward',
    'vault_lock',
    'trap_trigger',
    'portal_in',
    'portal_out',
    'secret_door'
  ],
  nodeSocketMap: {
    poi_room: ['event_beacon', 'room_clear_reward'],
    arena_room: ['event_beacon', 'room_clear_reward'],
    service_room: ['event_beacon'],
    hub_room: ['event_beacon'],
    portal_room: ['portal_in', 'portal_out'],
    secret_room: ['scanner_node', 'secret_door', 'room_clear_reward'],
    trap_room: ['trap_trigger', 'lockdown_door'],
    boss_gate_room: ['portal_in', 'portal_out', 'vault_lock'],
    finale_arena: ['event_beacon', 'room_clear_reward']
  },
  triggersForNode(nodeType, primaryPurpose) {
    const out = [];
    if (nodeType !== 'spawn_room') out.push('enter_room_trigger');
    if (primaryPurpose === 'combat' || nodeType === 'arena_room' || nodeType === 'finale_arena') {
      out.push('cleanup_trigger');
      out.push('proximity_trigger');
    }
    if (primaryPurpose === 'secret' || nodeType === 'secret_room') out.push('secret_reveal_trigger');
    if (primaryPurpose === 'trap' || nodeType === 'trap_room') out.push('trap_trigger');
    if (primaryPurpose === 'portal' || nodeType === 'portal_room' || nodeType === 'boss_gate_room') out.push('portal_trigger');
    if (primaryPurpose === 'event' || nodeType === 'poi_room' || nodeType === 'service_room') out.push('interaction_trigger');
    return [...new Set(out)];
  }
};

export default EventSocketSchema;
