import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');

const STATIC_ENTRIES = [
  'assets',
  'en',
  'investments',
  'pages',
  'index.html',
  '_routes.json'
];

const FORBIDDEN_TOP_LEVEL = new Set([
  'README_FIRST.txt',
  'RONA_Trade_PUBLIC_BILINGUAL_QA_REPORT_v1_0_1.md',
  'SHA256SUMS.txt',
  'SOURCE_VERSIONS.txt',
  'functions',
  'workers',
  'scripts',
  'package.json',
  'package-lock.json',
  'node_modules'
]);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const entry of STATIC_ENTRIES) {
  const source = join(ROOT, entry);
  if (!(await exists(source))) {
    throw new Error(`Required public entry is missing: ${entry}`);
  }
  await cp(source, join(OUT, entry), { recursive: true, force: true });
}

for (const name of FORBIDDEN_TOP_LEVEL) {
  if (await exists(join(OUT, name))) {
    throw new Error(`Forbidden deployment artifact detected: ${name}`);
  }
}

const files = await walk(OUT);
const forbiddenExtensions = /\.(zip|tar|gz|7z|md|txt|log)$/i;
const forbiddenFiles = files
  .map(file => relative(OUT, file).replaceAll('\\', '/'))
  .filter(file => forbiddenExtensions.test(file));

if (forbiddenFiles.length) {
  throw new Error(`Forbidden files in deployment output: ${forbiddenFiles.join(', ')}`);
}

if (!(await exists(join(OUT, 'index.html')))) throw new Error('dist/index.html missing');
if (!(await exists(join(OUT, 'en', 'index.html')))) throw new Error('dist/en/index.html missing');
if (!(await exists(join(OUT, 'investments', 'index.html')))) throw new Error('dist/investments/index.html missing');
if (!(await exists(join(OUT, 'en', 'investments', 'index.html')))) throw new Error('dist/en/investments/index.html missing');
if (!(await exists(join(OUT, '_routes.json')))) throw new Error('dist/_routes.json missing');

console.log(`RONA Pages build PASS: ${files.length} public files copied to dist without source transformation.`);
