import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function relative(file) {
  return file.slice(root.length + 1).replaceAll('\\', '/');
}

function fail(scope, detail) {
  failures.push(`${scope}: ${detail}`);
}

const files = walk(root);
const jsFiles = files.filter((file) => ['.js', '.mjs'].includes(extname(file)));
const jsonFiles = files.filter((file) => extname(file) === '.json');

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) fail('JavaScript syntax', `${relative(file)}\n${result.stderr.trim()}`);
}

for (const file of jsonFiles) {
  try {
    JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail('JSON parse', `${relative(file)} — ${error.message}`);
  }
}

let importCount = 0;
const importPattern = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;
for (const file of jsFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(importPattern)) {
    importCount += 1;
    const specifier = match[1].split(/[?#]/, 1)[0];
    const target = resolve(dirname(file), specifier);
    if (!existsSync(target)) fail('Module import', `${relative(file)} -> ${specifier}`);
  }
}

const spriteManifestPath = join(root, 'assets', 'sprite_manifest.json');
let spriteCount = 0;
if (!existsSync(spriteManifestPath)) {
  fail('Sprite manifest', 'assets/sprite_manifest.json is missing');
} else {
  const manifest = JSON.parse(readFileSync(spriteManifestPath, 'utf8'));
  const inspect = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.file === 'string') {
      spriteCount += 1;
      const target = join(root, 'assets', value.file);
      if (!existsSync(target)) fail('Sprite asset', value.file);
    }
    for (const child of Object.values(value)) inspect(child);
  };
  inspect(manifest);
}

const indexPath = join(root, 'index.html');
if (!existsSync(indexPath)) {
  fail('Browser entry', 'index.html is missing');
} else {
  const html = readFileSync(indexPath, 'utf8');
  const moduleSources = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1]);
  if (moduleSources.length === 0) fail('Browser entry', 'no module script found in index.html');
  for (const source of moduleSources) {
    const target = resolve(root, source.split(/[?#]/, 1)[0]);
    if (!existsSync(target)) fail('Browser entry', `missing ${source}`);
  }
}

for (const required of [
  'LICENSE.txt',
  'main.js',
  'runtime/Director.js',
  'runtime/ObjectPool.js',
  'runtime/world/SeededRandom.js',
  'data/director.json',
]) {
  if (!existsSync(join(root, required))) fail('Architecture contract', `missing ${required}`);
}

const githubMaximum = 100 * 1024 * 1024;
for (const file of files) {
  const bytes = statSync(file).size;
  if (bytes >= githubMaximum) fail('GitHub file size', `${relative(file)} is ${bytes} bytes`);
}

if (failures.length > 0) {
  console.error('BONZOOKA baseline validation failed:\n');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('BONZOOKA baseline validation passed');
console.log(`- JavaScript syntax: ${jsFiles.length} files`);
console.log(`- JSON integrity: ${jsonFiles.length} files`);
console.log(`- Relative module imports: ${importCount}`);
console.log(`- Sprite assets referenced: ${spriteCount}`);
console.log(`- Repository files inspected: ${files.length}`);

