#!/usr/bin/env node
/* Prints the research brief for one edition, with the dates already worked out.
 *
 *   node pipeline/brief.mjs              # today's edition (the news of 14 days ago)
 *   node pipeline/brief.mjs 2026-08-25
 *
 * The dates are computed here rather than left to the researcher: date arithmetic
 * is the one part of this that can be certain, so there is no reason to put it in
 * a prompt.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAG_DAYS = 14;

const iso = (d) => d.toISOString().slice(0, 10);
const editionDate = process.argv[2] ?? iso(new Date());

if (!/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
  console.error(`date must be YYYY-MM-DD, got "${editionDate}"`);
  process.exit(2);
}

const newsDate = iso(new Date(Date.parse(`${editionDate}T00:00:00Z`) - LAG_DAYS * 86400000));
const pretty = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US',
  { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const target = `data/editions/${editionDate}.json`;

if (existsSync(join(ROOT, target))) {
  console.log(`${target} already exists — nothing to research.`);
  console.log('Delete it first if you mean to rebuild this edition.');
  process.exit(3);
}

// EDITION_GUIDE.md is the single home for editorial policy: it is what a person
// reads to write an edition by hand, so it is what the researcher reads too.
const guide = readFileSync(join(ROOT, 'EDITION_GUIDE.md'), 'utf8');

console.log(`# Edition of ${pretty(editionDate)}

Covering the news of **${pretty(newsDate)}** — exactly ${LAG_DAYS} days earlier.

Write the result to \`${target}\` with exactly these three date fields, already correct:

    "edition":    "${editionDate}",
    "newsDate":   "${newsDate}",
    "compiledAt": "${editionDate}",

## The job

Two passes, per the guide below.

**Pass one — what ran that day.** Search for the specific date ${newsDate}. Daily
headline roundups and wire summaries are good entry points. Collect more
candidates than you need. Deliberately include at least one story that got little
attention that day: per rule 4, the quiet story that finished is usually the most
valuable card on the page, and it will never be in the day's top headlines.

**Pass two — what came of it.** For each story you keep, search the thread forward
to ${editionDate}. Search the specific case name, bill number, agency, or named
official — not the general topic. This is the part that cannot be guessed and it
is the entire product. Where a story's status changed after ${newsDate}, that
change is the story.

Then six stories, varied kickers, and a source list on each that includes the
follow-up reporting — not just the day-of reporting.

## The rule that outranks the rest

You are reporting, not generating. Every follow-up must come from something you
actually found. If searching turns up no development, that is a real and valuable
finding — that is the \`nothing-yet\` verdict, and you say plainly that nothing has
been announced since. Never invent a development, a quote, a number, or an
outcome. A fabricated follow-up would destroy the only thing this publication has.

---

${guide}`);
