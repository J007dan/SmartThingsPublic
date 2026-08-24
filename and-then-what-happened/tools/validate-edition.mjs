#!/usr/bin/env node
/* Validate an edition file: node tools/validate-edition.mjs data/editions/2026-08-24.json */

import { readFileSync } from 'node:fs';

const VERDICTS = ['nothing-yet', 'fizzled', 'grinding', 'landed', 'escalated'];
const DAY = 86400000;

const path = process.argv[2];
if (!path) {
  console.error('usage: validate-edition.mjs <edition.json>');
  process.exit(2);
}

const errors = [];
const warnings = [];
const bad = (msg) => errors.push(msg);

const ed = JSON.parse(readFileSync(path, 'utf8'));

for (const key of ['edition', 'newsDate', 'compiledAt', 'stories']) {
  if (!(key in ed)) bad(`missing top-level "${key}"`);
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '');
for (const key of ['edition', 'newsDate', 'compiledAt']) {
  if (ed[key] && !isDate(ed[key])) bad(`"${key}" must be YYYY-MM-DD, got "${ed[key]}"`);
}

if (isDate(ed.edition) && isDate(ed.newsDate)) {
  const lag = (Date.parse(ed.edition) - Date.parse(ed.newsDate)) / DAY;
  if (lag !== 14) bad(`edition is ${lag} days after newsDate; the whole premise is 14`);
}

if (!Array.isArray(ed.stories) || ed.stories.length === 0) {
  bad('"stories" must be a non-empty array');
} else {
  const seen = new Set();
  ed.stories.forEach((s, i) => {
    const at = `stories[${i}]${s.id ? ` (${s.id})` : ''}`;

    for (const key of ['id', 'kicker', 'headline', 'then', 'thenWhat', 'verdict', 'noise']) {
      if (s[key] === undefined || s[key] === '') bad(`${at}: missing "${key}"`);
    }

    if (s.id) {
      if (seen.has(s.id)) bad(`${at}: duplicate id`);
      seen.add(s.id);
    }

    if (s.verdict && !VERDICTS.includes(s.verdict)) {
      bad(`${at}: verdict "${s.verdict}" not one of ${VERDICTS.join(', ')}`);
    }

    if (!Number.isInteger(s.noise) || s.noise < 1 || s.noise > 5) {
      bad(`${at}: "noise" must be an integer 1-5`);
    }

    if (!Array.isArray(s.sources) || s.sources.length === 0) {
      // A follow-up with no source is the one failure mode that would sink this app.
      bad(`${at}: needs at least one source`);
    } else {
      s.sources.forEach((src, j) => {
        if (!src.label) bad(`${at}.sources[${j}]: missing "label"`);
        if (!/^https?:\/\//.test(src.url ?? '')) bad(`${at}.sources[${j}]: bad url`);
      });
    }

    if (typeof s.thenWhat === 'string' && s.thenWhat.length < 120) {
      warnings.push(`${at}: "thenWhat" is thin (${s.thenWhat.length} chars) — the follow-up is the product`);
    }
  });
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);

if (errors.length) {
  console.error(`\n${path}: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`${path}: ok — ${ed.stories.length} stories, ${warnings.length} warning(s)`);
