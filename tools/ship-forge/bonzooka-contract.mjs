// Copyright (c) Manfred Foissner. All rights reserved.
// License: See ../../LICENSE.txt in the project root.

export const BONZOOKA_MANIFEST_PATH = 'assets/sprite_manifest.json';

const PROFILE_DEFINITIONS = {
  runtime1: {
    key: 'runtime1',
    label: 'Runtime Static',
    axis: 'bank',
    angles: [0],
    cols: 1,
    lockPose: { head: 0, pitch: 0, bank: 0 },
    directRuntime: true,
  },
  heading8: {
    key: 'heading8',
    label: 'Heading 8',
    axis: 'head',
    angles: [0, 45, 90, 135, 180, 225, 270, 315],
    cols: 4,
    lockPose: { bank: 0, pitch: 0 },
    directRuntime: true,
  },
  bank4: {
    key: 'bank4',
    label: 'Bank Left 4',
    axis: 'bank',
    angles: [0, 14, 28, 42],
    cols: 4,
    lockPose: { head: 0, pitch: 0 },
    directRuntime: true,
  },
  bank7: {
    key: 'bank7',
    label: 'Bank Full 7',
    axis: 'bank',
    angles: [-42, -28, -14, 0, 14, 28, 42],
    cols: 7,
    lockPose: { head: 0, pitch: 0 },
    directRuntime: true,
  },
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function slugSegment(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'asset';
}

export function canonicalSpriteFile(category, entity, state) {
  return `sprites/${slugSegment(category)}/${slugSegment(entity)}/${slugSegment(state)}.png`;
}

export function canonicalPhysicalFile(category, entity, state) {
  return `assets/${canonicalSpriteFile(category, entity, state)}`;
}

export function getProfileDefinition(profileKey = 'runtime1') {
  const source = PROFILE_DEFINITIONS[profileKey];
  if (!source) throw new Error(`Unknown Ship Forge production profile: ${profileKey}`);
  const result = clone(source);
  result.frames = result.angles.length;
  result.rows = Math.ceil(result.frames / result.cols);
  return result;
}

export function buildManifestState({
  category,
  entity,
  state,
  profileKey = 'runtime1',
  fps = 1,
  loop = true,
}) {
  const profile = getProfileDefinition(profileKey);
  const entry = {
    file: canonicalSpriteFile(category, entity, state),
    cols: profile.cols,
    rows: profile.rows,
    frames: profile.frames,
    fps: Math.max(1, Number.parseInt(fps, 10) || 1),
    loop: Boolean(loop),
  };

  if (profile.frames > 1) {
    entry.sequenceSpec = `0-${profile.frames - 1}`;
    entry.sequence = Array.from({ length: profile.frames }, (_, index) => index);
  }

  return entry;
}

export function buildManifestFragment({ category, entity, state, size, stateEntry }) {
  const categoryId = slugSegment(category);
  const entityId = slugSegment(entity);
  const stateId = slugSegment(state);
  if (!isRecord(stateEntry)) throw new Error('Ship Forge stateEntry must be an object');

  return {
    [categoryId]: {
      [entityId]: {
        size: Math.max(1, Number.parseInt(size, 10) || 1),
        [stateId]: clone(stateEntry),
      },
    },
  };
}

export function assertSpriteManifestBaseline(manifest) {
  if (!isRecord(manifest)) {
    throw new Error(`Load ${BONZOOKA_MANIFEST_PATH} before producing project assets`);
  }

  let spriteStateCount = 0;
  for (const [category, entities] of Object.entries(manifest)) {
    if (category.startsWith('_')) continue;
    if (!isRecord(entities)) {
      throw new Error(`Invalid sprite manifest category: ${category}`);
    }
    for (const [entity, states] of Object.entries(entities)) {
      if (!isRecord(states)) {
        throw new Error(`Invalid sprite manifest entity: ${category}/${entity}`);
      }
      for (const [state, definition] of Object.entries(states)) {
        if (state === 'size') continue;
        if (isRecord(definition) && typeof definition.file === 'string') spriteStateCount += 1;
      }
    }
  }

  if (spriteStateCount === 0) {
    throw new Error(`${BONZOOKA_MANIFEST_PATH} contains no existing sprite states`);
  }
  return true;
}

export function mergeSpriteManifest(baseManifest, generatedFragment) {
  assertSpriteManifestBaseline(baseManifest);
  if (!isRecord(generatedFragment)) throw new Error('Generated sprite manifest fragment is invalid');

  const merged = clone(baseManifest);
  for (const [category, entities] of Object.entries(generatedFragment)) {
    if (category.startsWith('_')) continue;
    if (!isRecord(entities)) throw new Error(`Invalid generated category: ${category}`);
    merged[category] ??= {};

    for (const [entity, generatedEntity] of Object.entries(entities)) {
      if (!isRecord(generatedEntity)) throw new Error(`Invalid generated entity: ${category}/${entity}`);
      const existingEntity = isRecord(merged[category][entity]) ? merged[category][entity] : {};
      const nextEntity = { ...existingEntity };

      for (const [state, value] of Object.entries(generatedEntity)) {
        if (state === 'size') {
          // Existing entity size is runtime-owned and must not change merely because
          // an author chose a different source/export resolution in Ship Forge.
          nextEntity.size = Math.max(
            1,
            Number.parseInt(existingEntity.size, 10) || Number.parseInt(value, 10) || 1,
          );
          continue;
        }
        if (!isRecord(value) || typeof value.file !== 'string') {
          throw new Error(`Invalid generated state: ${category}/${entity}/${state}`);
        }
        const expectedFile = canonicalSpriteFile(category, entity, state);
        if (value.file !== expectedFile) {
          throw new Error(`Non-canonical sprite path for ${category}/${entity}/${state}: ${value.file}`);
        }
        nextEntity[state] = clone(value);
      }

      merged[category][entity] = nextEntity;
    }
  }
  return merged;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

export function generationFingerprint(value) {
  const input = stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `sf-${hash.toString(16).padStart(8, '0')}`;
}

export const SHIP_FORGE_PROFILE_KEYS = Object.freeze(Object.keys(PROFILE_DEFINITIONS));
