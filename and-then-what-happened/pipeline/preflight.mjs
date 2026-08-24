#!/usr/bin/env node
/* The self-check that runs in place of a human reviewer.
 *
 *   node pipeline/preflight.mjs 2026-08-25
 *
 * This cannot tell whether a follow-up is true — nothing automated can. What it
 * does is rank the claims by how expensive they'd be to get wrong and hand back a
 * short list to re-verify against the sources before publishing.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const LABELS = {
  'nothing-yet': 'Nothing yet',
  'fizzled': 'Fizzled out',
  'grinding': 'Still grinding',
  'landed': 'This one landed',
  'escalated': 'It got bigger',
};

const date = process.argv[2];
if (!date) {
  console.error('usage: preflight.mjs <YYYY-MM-DD>');
  process.exit(2);
}

const ed = JSON.parse(readFileSync(join(ROOT, `data/editions/${date}.json`), 'utf8'));

/** Pull a date out of a URL — most news URLs carry one, as /2026/08/21/ or 2026-08-21. */
function urlDate(url) {
  const slash = url.match(/\/(20\d{2})\/(\d{1,2})\/(\d{1,2})(\/|$)/);
  if (slash) return `${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}`;
  const dashed = url.match(/(20\d{2}-\d{2}-\d{2})/);
  return dashed ? dashed[1] : null;
}

const checks = [];
const flag = (story, why) => checks.push({ story, why });

console.log(`Edition ${ed.edition} — the news of ${ed.newsDate}\n`);

const counts = {};
for (const s of ed.stories) counts[s.verdict] = (counts[s.verdict] ?? 0) + 1;

for (const s of ed.stories) {
  const dated = s.sources.map((x) => urlDate(x.url)).filter(Boolean);
  const after = dated.filter((d) => d > ed.newsDate);
  console.log(`  ${LABELS[s.verdict] ?? s.verdict}  ·  noise ${s.noise}/5  ·  ${s.kicker}`);
  console.log(`  ${s.headline}`);
  console.log(`  ${s.sources.length} sources${after.length ? `, ${after.length} dated after ${ed.newsDate}` : ''}\n`);

  // Claiming something took effect is the costliest error this publication can make.
  if (s.verdict === 'landed' || s.verdict === 'escalated') {
    flag(s, `claims a real outcome (${LABELS[s.verdict]}) — re-read the sources and confirm`);
  }
  // The pattern the app exists to surface, and the one most worth being sure about.
  if (s.noise <= 2 && (s.verdict === 'landed' || s.verdict === 'escalated')) {
    flag(s, 'quiet story with a real outcome — the highest-value card and the easiest to overstate');
  }
  if (s.sources.length < 2) {
    flag(s, 'only one source — a follow-up resting on a single link is thin');
  }
  // A "nothing yet" follow-up reports an absence, which by definition has no
  // later coverage to cite — only claims of change need a post-dated source.
  if (s.verdict !== 'nothing-yet' && dated.length && after.length === 0) {
    flag(s, `no source is dated after ${ed.newsDate} — a claim of change resting on day-of reporting`);
  }
}

console.log('Verdicts:', Object.entries(counts).map(([k, v]) => `${v} ${LABELS[k]}`).join(', '));

// If nothing quiet ever lands, the research is only reading the top headlines.
const quietLanded = ed.stories.some((s) => s.noise <= 2 && ['landed', 'escalated'].includes(s.verdict));
if (!quietLanded) {
  console.log('\nNote: no low-noise story landed today. If that repeats across editions, the');
  console.log('research is probably only reading the top headlines — see rule 4 in EDITION_GUIDE.md.');
}

if (checks.length) {
  console.log(`\nRe-verify before publishing (${checks.length}):\n`);
  for (const { story, why } of checks) {
    console.log(`  - ${story.id}: ${why}`);
  }
  console.log('\nOpen the linked sources for each and confirm the follow-up says what they say.');
  console.log('Fix the edition, or drop the claim, before pushing.');
} else {
  console.log('\nNothing flagged for re-verification.');
}
