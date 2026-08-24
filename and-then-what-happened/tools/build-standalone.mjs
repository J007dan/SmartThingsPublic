#!/usr/bin/env node
/* Bundle the app into two single-file builds:
 *   dist/standalone.html — a complete page, works opened straight off disk
 *   dist/artifact.html   — the same page as a fragment for the Artifact publisher,
 *                          which supplies its own doctype/head/body wrapper
 * Run: node tools/build-standalone.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const html = read('index.html');
const css = read('styles.css');
const app = read('app.js');
const index = JSON.parse(read('data/index.json'));

const editions = Object.fromEntries(
  index.editions.map((d) => [d, JSON.parse(read(`data/editions/${d}.json`))])
);

// </script> inside inlined JSON would close the tag early.
const bundle = `<script>window.__ATWH__ = ${
  JSON.stringify({ index, editions }).replace(/</g, '\\u003c')
};</script>`;

const body = html.match(/<body>\n([\s\S]*?)\n<script src="app\.js"><\/script>/)?.[1];
if (!body) throw new Error('could not find the page body in index.html');

const iconUri = 'data:image/svg+xml;base64,' +
  Buffer.from(read('icon.svg')).toString('base64');

const scripts = `${bundle}\n<script>\n${app}\n</script>`;

const standalone = html
  .replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
  .replace(/<link rel="(icon|apple-touch-icon)"[^>]*>/g,
    (m) => m.replace(/href="icon\.svg"/, `href="${iconUri}"`))
  .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`)
  .replace('<script src="app.js"></script>', scripts);

const artifact = [
  '<title>…And Then What Happened?</title>',
  `<style>\n${css}\n</style>`,
  body,
  scripts,
].join('\n');

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/standalone.html'), standalone);
writeFileSync(join(root, 'dist/artifact.html'), artifact);

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
console.log(`dist/standalone.html  ${kb(standalone)}`);
console.log(`dist/artifact.html    ${kb(artifact)}`);
console.log(`editions bundled:     ${index.editions.join(', ')}`);
