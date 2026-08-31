import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BONZOOKA_MANIFEST_PATH,
  assertSpriteManifestBaseline,
  buildManifestFragment,
  buildManifestState,
  canonicalPhysicalFile,
  canonicalSpriteFile,
  generationFingerprint,
  getProfileDefinition,
  mergeSpriteManifest,
} from '../tools/ship-forge/bonzooka-contract.mjs';

test('canonical paths resolve category + entity + state', () => {
  assert.equal(BONZOOKA_MANIFEST_PATH, 'assets/sprite_manifest.json');
  assert.equal(
    canonicalSpriteFile('Player', 'Player Ship', 'Bank Left'),
    'sprites/player/player_ship/bank_left.png',
  );
  assert.equal(
    canonicalPhysicalFile('enemies', 'grunt', 'patrol'),
    'assets/sprites/enemies/grunt/patrol.png',
  );
});

test('production profiles create SpriteManager-compatible grid metadata', () => {
  const expectations = {
    runtime1: { cols: 1, rows: 1, frames: 1, sequenceSpec: undefined },
    heading8: { cols: 4, rows: 2, frames: 8, sequenceSpec: '0-7' },
    bank4: { cols: 4, rows: 1, frames: 4, sequenceSpec: '0-3' },
    bank7: { cols: 7, rows: 1, frames: 7, sequenceSpec: '0-6' },
  };

  for (const [profileKey, expected] of Object.entries(expectations)) {
    const profile = getProfileDefinition(profileKey);
    const state = buildManifestState({
      category: 'player',
      entity: 'ship',
      state: 'bank_left',
      profileKey,
      fps: 8,
      loop: true,
    });
    assert.equal(profile.frames, expected.frames);
    assert.equal(state.cols, expected.cols);
    assert.equal(state.rows, expected.rows);
    assert.equal(state.frames, expected.frames);
    assert.equal(state.sequenceSpec, expected.sequenceSpec);
    if (expected.frames > 1) {
      assert.deepEqual(state.sequence, Array.from({ length: expected.frames }, (_, index) => index));
    } else {
      assert.equal(state.sequence, undefined);
    }
  }
});

test('manifest merge preserves existing identities and replaces only the generated state', () => {
  const base = {
    _comment: 'authoritative baseline',
    player: {
      ship: {
        size: 256,
        idle: {
          file: 'sprites/player/ship/idle.png',
          cols: 1,
          rows: 1,
          frames: 1,
          fps: 1,
          loop: true,
        },
      },
    },
    enemies: {
      grunt: {
        size: 128,
        patrol: {
          file: 'sprites/enemies/grunt/patrol.png',
          cols: 1,
          rows: 1,
          frames: 1,
          fps: 1,
          loop: true,
        },
      },
    },
  };
  const bankLeft = buildManifestState({
    category: 'player',
    entity: 'ship',
    state: 'bank_left',
    profileKey: 'bank4',
    fps: 8,
    loop: true,
  });
  const fragment = buildManifestFragment({
    category: 'player',
    entity: 'ship',
    state: 'bank_left',
    size: 512,
    stateEntry: bankLeft,
  });
  const merged = mergeSpriteManifest(base, fragment);

  assert.deepEqual(merged.player.ship.idle, base.player.ship.idle);
  assert.deepEqual(merged.enemies, base.enemies);
  assert.deepEqual(merged.player.ship.bank_left, bankLeft);
  assert.equal(merged.player.ship.size, 256, 'existing runtime entity size must be preserved');
  assert.equal(base.player.ship.bank_left, undefined, 'base manifest must not be mutated');
});

test('manifest merge rejects a non-canonical generated file', () => {
  assert.throws(
    () => mergeSpriteManifest(
      {
        player: {
          ship: {
            size: 256,
            idle: {
              file: 'sprites/player/ship/idle.png',
              cols: 1,
              rows: 1,
              frames: 1,
              fps: 1,
              loop: true,
            },
          },
        },
      },
      {
        player: {
          ship: {
            size: 256,
            idle: {
              file: 'ship_idle.png', cols: 1, rows: 1, frames: 1, fps: 1, loop: true,
            },
          },
        },
      },
    ),
    /Non-canonical sprite path/,
  );
});

test('production baseline rejects an empty or structurally invalid manifest', () => {
  assert.throws(() => assertSpriteManifestBaseline({}), /contains no existing sprite states/);
  assert.throws(
    () => assertSpriteManifestBaseline({ player: { ship: null } }),
    /Invalid sprite manifest entity/,
  );
});

test('generation fingerprints are stable across object key order', () => {
  assert.equal(
    generationFingerprint({ seed: 42, components: { wing: 'delta', hull: 'reference' } }),
    generationFingerprint({ components: { hull: 'reference', wing: 'delta' }, seed: 42 }),
  );
});
