// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// SliceLock.js - W4A.1 Vertical Slice routing lock
// ============================================================
// Purpose:
// - freeze the current master into a single-biome validation branch
// - force all zone routing through Derelict Fleet only
// - keep the rest of the architecture multi-biome capable

const DERELICT_SLICE_ENABLED = true;
const DERELICT_SLICE_BIOME = 'derelict';
const DERELICT_SLICE_THEME = 'derelict_plateyard';

function cloneActConfig(actConfig) {
  if (!actConfig) return null;
  return { ...actConfig };
}

export const SliceLock = {
  enabled: DERELICT_SLICE_ENABLED,
  biome: DERELICT_SLICE_BIOME,
  themeId: DERELICT_SLICE_THEME,
  mode: 'single_biome_vertical_slice',
  label: 'W4A Derelict Vertical Slice',

  applyActConfig(actConfig) {
    if (!this.enabled || !actConfig) return actConfig;
    const next = cloneActConfig(actConfig);
    next.biome = this.biome;
    next.surfaceTheme = this.themeId;
    next._sliceLock = {
      enabled: true,
      biome: this.biome,
      themeId: this.themeId,
      mode: this.mode,
      label: this.label
    };
    return next;
  },

  applyZone(zone) {
    if (!this.enabled || !zone) return zone;
    zone.biome = this.biome;
    zone.surfaceTheme = this.themeId;
    zone._sliceLock = {
      enabled: true,
      biome: this.biome,
      themeId: this.themeId,
      mode: this.mode,
      label: this.label
    };
    return zone;
  },

  resolveBiome(zone, actConfig, fallback = 'asteroid') {
    if (this.enabled) return this.biome;
    return zone?.biome || actConfig?.biome || fallback;
  },

  resolveThemeId(zone, actConfig, explicitId = null) {
    if (this.enabled) return this.themeId;
    return explicitId || zone?.surfaceTheme || actConfig?.surfaceTheme || null;
  }
};

export default SliceLock;
