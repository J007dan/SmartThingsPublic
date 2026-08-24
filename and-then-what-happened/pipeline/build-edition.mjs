#!/usr/bin/env node
/* Research and write one edition.
 *
 *   node pipeline/build-edition.mjs                # today's edition (news of 14 days ago)
 *   node pipeline/build-edition.mjs --date 2026-08-25
 *   node pipeline/build-edition.mjs --dry-run      # print the brief, call nothing
 *
 * Claude does the research with the server-side web search and fetch tools, then
 * hands back the edition by calling emit_edition. The dates are computed here
 * rather than asked for — date arithmetic is the one part of this we can be sure
 * of, so there's no reason to put it in the prompt.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAG_DAYS = 14;
const MODEL = 'claude-opus-5';
const MAX_REPAIRS = 2;

const VERDICTS = ['nothing-yet', 'fizzled', 'grinding', 'landed', 'escalated'];

/* ---------- dates ---------- */

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : process.argv[i + 1];
};

const iso = (d) => d.toISOString().slice(0, 10);
const minusDays = (d, n) => new Date(d.getTime() - n * 86400000);

const editionDate = arg('--date') ?? iso(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
  console.error(`--date must be YYYY-MM-DD, got "${editionDate}"`);
  process.exit(2);
}
const newsDate = iso(minusDays(new Date(`${editionDate}T00:00:00Z`), LAG_DAYS));

const pretty = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US',
  { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/* ---------- the brief ---------- */

// EDITION_GUIDE.md is the single source of editorial policy: it's what a person
// reads to write an edition by hand, so it's what the model reads too. Editing
// the guide changes the pipeline.
const guide = readFileSync(join(ROOT, 'EDITION_GUIDE.md'), 'utf8');

const SYSTEM = `You are the desk editor for "…And Then What Happened?", a news reader that runs exactly fourteen days behind on purpose.

Each edition takes the headlines from one day two weeks ago and prints them next to the only thing that was missing at the time: what actually came of them.

The editorial guide for this publication follows. Treat it as binding.

<editorial_guide>
${guide}
</editorial_guide>

The rule that matters more than any other: you are reporting, not generating. Every follow-up must come from something you actually found in a search. If two weeks of searching turns up no development, that is a real and valuable finding — report it as the "nothing-yet" verdict and say plainly that nothing has been announced since. Never invent a development, a quote, a number, or an outcome. A fabricated follow-up would destroy the only thing this publication has.

When you are done researching, call emit_edition exactly once. Do not summarize your work in prose first.`;

const USER = `Build the edition for ${pretty(editionDate)}.

It covers the news of **${pretty(newsDate)}** — exactly fourteen days earlier.

Work in two passes, as the guide describes.

Pass one: find what actually ran on ${newsDate}. Search for that specific date. Wire roundups and daily headline summaries are good entry points. Collect more candidates than you need, and deliberately include at least one story that got little attention that day — per the guide, the quiet story that finished is usually the most valuable card on the page.

Pass two: for each candidate you keep, search the thread forward to today, ${editionDate}. Search the specific case name, bill number, agency, or named official — not the general topic. This is the part that cannot be guessed and it is the entire product. Where a story's status changed after ${newsDate}, that change is the story.

Then call emit_edition with six stories, varied kickers, and a source list on every one that includes the follow-up reporting, not just the day-of reporting.`;

/* ---------- the shape we want back ---------- */

const sourceSchema = {
  type: 'object',
  properties: {
    label: { type: 'string', description: 'Outlet name, e.g. "NPR"' },
    url: { type: 'string', description: 'Direct https URL to the reporting' },
  },
  required: ['label', 'url'],
  additionalProperties: false,
};

const storySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'kebab-case slug, unique within the edition' },
    kicker: { type: 'string', description: 'Short section label, e.g. "Immigration", "The Courts"' },
    headline: { type: 'string', description: 'The story as it ran that day' },
    then: { type: 'string', description: '2-4 sentences on what was actually announced or reported. Past tense.' },
    noise: { type: 'integer', enum: [1, 2, 3, 4, 5], description: 'How loud it got at the time' },
    verdict: { type: 'string', enum: VERDICTS },
    thenWhat: { type: 'string', description: 'The follow-up, 3-6 sentences. Verified only. This is the product.' },
    sources: { type: 'array', items: sourceSchema, description: 'At least one; include follow-up sources' },
  },
  required: ['id', 'kicker', 'headline', 'then', 'noise', 'verdict', 'thenWhat', 'sources'],
  additionalProperties: false,
};

const emitEdition = {
  name: 'emit_edition',
  description: 'Hand back the finished edition. Call this exactly once, after the research is done.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      note: { type: 'string', description: "One line of editor's framing for the top of the page." },
      stories: { type: 'array', items: storySchema },
    },
    required: ['note', 'stories'],
    additionalProperties: false,
  },
};

/* ---------- validation, fed back to the model on failure ---------- */

function validate(edition) {
  const path = join(ROOT, '.edition-check.json');
  writeFileSync(path, JSON.stringify(edition, null, 2));
  try {
    // capture both streams rather than letting the validator's output leak into the run log
    execFileSync('node', [join(ROOT, 'tools/validate-edition.mjs'), path],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true };
  } catch (err) {
    return { ok: false, report: `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() };
  } finally {
    rmSync(path, { force: true });
  }
}

/* ---------- the loop ---------- */

export async function research(client) {
  const messages = [{ role: 'user', content: USER }];
  let repairs = 0;

  for (let turn = 1; ; turn++) {
    process.stderr.write(`  turn ${turn}…\n`);

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 40 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 20 },
        emitEdition,
      ],
      messages,
    });

    const response = await stream.finalMessage();
    messages.push({ role: 'assistant', content: response.content });

    // The server-side search loop caps at 10 iterations per request and hands back
    // pause_turn. Re-send as-is; the API resumes. Do NOT add a "continue" message.
    if (response.stop_reason === 'pause_turn') continue;

    if (response.stop_reason === 'refusal') {
      throw new Error(`model declined: ${response.stop_details?.explanation ?? 'no explanation given'}`);
    }

    if (response.stop_reason === 'max_tokens') {
      throw new Error('ran out of output tokens mid-edition');
    }

    const call = response.content.find(
      (b) => b.type === 'tool_use' && b.name === 'emit_edition'
    );

    if (!call) {
      const said = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      throw new Error(`finished without calling emit_edition.\n${said.slice(0, 800)}`);
    }

    const edition = {
      edition: editionDate,
      newsDate,
      compiledAt: iso(new Date()),
      note: call.input.note,
      stories: call.input.stories,
    };

    const check = validate(edition);
    if (check.ok) return edition;

    if (++repairs > MAX_REPAIRS) {
      throw new Error(`edition still invalid after ${MAX_REPAIRS} repair attempts:\n${check.report}`);
    }

    process.stderr.write(`  validation failed, asking for a fix (${repairs}/${MAX_REPAIRS})\n`);
    messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: call.id,
        is_error: true,
        content: `The edition failed validation:\n\n${check.report}\n\nFix only what is listed and call emit_edition again. Do not drop a story to make an error go away — if a story is short on sources, go find them.`,
      }],
    });
  }
}

/* ---------- write it out ---------- */

function publish(edition) {
  const editionPath = join(ROOT, `data/editions/${editionDate}.json`);
  writeFileSync(editionPath, `${JSON.stringify(edition, null, 2)}\n`);

  const indexPath = join(ROOT, 'data/index.json');
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  if (!index.editions.includes(editionDate)) {
    index.editions = [...index.editions, editionDate].sort();
    writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  }

  execFileSync('node', [join(ROOT, 'tools/build-standalone.mjs')], { stdio: 'inherit' });
  return editionPath;
}

/* ---------- main ---------- */

// importing this module (the loop test does) must not kick off a run
const invokedDirectly = process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (!invokedDirectly) {
  // exported for pipeline/test-loop.mjs
} else {

const target = join(ROOT, `data/editions/${editionDate}.json`);
if (existsSync(target) && !process.argv.includes('--force')) {
  console.log(`${editionDate} already exists — nothing to do. Use --force to rebuild it.`);
  process.exit(0);
}

console.log(`Edition ${editionDate} — covering the news of ${newsDate}`);

if (process.argv.includes('--dry-run')) {
  console.log(`\n--- system ---\n${SYSTEM}\n\n--- user ---\n${USER}`);
  console.log(`\n--- emit_edition schema ---\n${JSON.stringify(emitEdition.input_schema, null, 2)}`);
  process.exit(0);
}

const edition = await research(new Anthropic());
const written = publish(edition);

const counts = edition.stories.reduce((acc, s) => ({ ...acc, [s.verdict]: (acc[s.verdict] ?? 0) + 1 }), {});
console.log(`\nWrote ${written}`);
console.log(`${edition.stories.length} stories — ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);

}
