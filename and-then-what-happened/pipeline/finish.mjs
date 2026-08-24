#!/usr/bin/env node
/* Validate a written edition, add it to the index, and rebuild the bundles.
 *
 *   node pipeline/finish.mjs 2026-08-25
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const date = process.argv[2];
if (!date) {
  console.error('usage: finish.mjs <YYYY-MM-DD>');
  process.exit(2);
}

const editionPath = join(ROOT, `data/editions/${date}.json`);
if (!existsSync(editionPath)) {
  console.error(`${editionPath} does not exist — research it first.`);
  process.exit(1);
}

// Fails loudly and stops here if the edition is malformed.
execFileSync('node', [join(ROOT, 'tools/validate-edition.mjs'), editionPath], { stdio: 'inherit' });

const indexPath = join(ROOT, 'data/index.json');
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
if (!index.editions.includes(date)) {
  index.editions = [...index.editions, date].sort();
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`Added ${date} to data/index.json (${index.editions.length} editions)`);
}

execFileSync('node', [join(ROOT, 'tools/build-standalone.mjs')], { stdio: 'inherit' });
