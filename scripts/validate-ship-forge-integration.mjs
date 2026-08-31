import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const required = [
  'tools/ship-forge/index.html',
  'tools/ship-forge/bonzooka-contract.mjs',
  'tools/ship-forge/README.md',
  'assets/sprite_manifest.json',
  'runtime/SpriteManager.js',
];

function fail(message) {
  failures.push(message);
}

for (const file of required) {
  if (!existsSync(join(root, file))) fail(`missing ${file}`);
}

const htmlPath = join(root, 'tools/ship-forge/index.html');
const contractPath = join(root, 'tools/ship-forge/bonzooka-contract.mjs');
const html = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf8') : '';
const contract = existsSync(contractPath) ? readFileSync(contractPath, 'utf8') : '';

for (const [label, source, pattern] of [
  ['local BONZOOKA contract import', html, /from ['"]\.\/bonzooka-contract\.mjs['"]/],
  ['canonical physical path', contract, /assets\/\$\{canonicalSpriteFile/],
  ['authoritative manifest target', html, /zip\.file\(BONZOOKA_MANIFEST_PATH/],
  ['manifest baseline guard', html, /requireProjectManifest\(\)/],
  ['manifest baseline structure validation', html, /assertSpriteManifestBaseline\(manifest\)/],
  ['manifest merge', html, /mergeSpriteManifest\(baseline,generatedManifest\)/],
  ['multi-frame sequence metadata', contract, /entry\.sequenceSpec/],
  ['deterministic micro-detail seed', html, /fixed M4NF seed/],
]) {
  if (!pattern.test(source)) fail(`missing ${label}`);
}

if (/sprite_manifest_shipforge_fragment\.json/.test(html)) {
  fail('parallel Ship Forge runtime manifest export is still present');
}
if (/Math\.random\s*\(/.test(html)) {
  fail('unseeded Math.random() remains in Ship Forge authoring output');
}

const moduleMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!moduleMatch) {
  fail('inline module script was not found');
} else {
  const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: moduleMatch[1],
    encoding: 'utf8',
  });
  if (syntax.status !== 0) fail(`Ship Forge module syntax failed: ${syntax.stderr.trim()}`);
}

const runtimeDirectory = join(root, 'runtime');
if (existsSync(runtimeDirectory)) {
  for (const name of readdirSync(runtimeDirectory)) {
    if (!name.endsWith('.js')) continue;
    const source = readFileSync(join(runtimeDirectory, name), 'utf8');
    if (/ship-forge|M4NFROID SHIP FORGE|from ['"]three/.test(source)) {
      fail(`runtime dependency points to Ship Forge or Three.js: runtime/${name}`);
    }
  }
}

if (failures.length) {
  console.error('Ship Forge integration validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Ship Forge integration validation passed');
console.log('- canonical assets/sprites/<category>/<entity>/<state>.png contract');
console.log('- authoritative assets/sprite_manifest.json merge');
console.log('- deterministic authoring inputs and multi-frame metadata');
console.log('- no game runtime dependency on Ship Forge or Three.js');
