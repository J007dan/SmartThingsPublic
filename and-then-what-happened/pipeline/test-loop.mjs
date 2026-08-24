#!/usr/bin/env node
/* Exercises the research loop's control flow against a scripted client — no API key,
 * no network. Covers the paths that are awkward to reach in a live run: a paused
 * server-tool turn, a rejected edition getting repaired, and the failure modes.
 *
 *   node pipeline/test-loop.mjs
 */

import assert from 'node:assert/strict';
import { research } from './build-edition.mjs';

let passed = 0;
const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok    ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}\n        ${err.message}`);
    process.exitCode = 1;
  }
};

/** A client that replays a scripted list of responses and records what it was sent. */
function fakeClient(responses) {
  const sent = [];
  return {
    sent,
    messages: {
      stream(req) {
        // the loop mutates one messages array in place, so snapshot it per request
        sent.push({ ...req, messages: [...req.messages] });
        const response = responses.shift();
        if (!response) throw new Error('loop asked for more turns than the script has');
        return { finalMessage: async () => response };
      },
    },
  };
}

const story = (i) => ({
  id: `story-${i}`,
  kicker: 'The Courts',
  headline: `Headline number ${i}`,
  then: 'What was reported that day, in a couple of sentences that carry the claim.',
  noise: 3,
  verdict: 'grinding',
  thenWhat: 'The follow-up, written long enough to clear the validator threshold that '
    + 'warns when a follow-up is thin, because the follow-up is the entire product here '
    + 'and a one-line answer is not an edition.',
  sources: [{ label: 'NPR', url: 'https://example.org/a' }],
});

const goodEdition = { note: 'Six things.', stories: [1, 2, 3, 4, 5, 6].map(story) };

const emit = (input, id = 'tu_1') => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id, name: 'emit_edition', input }],
});

console.log('research loop');

await test('returns the edition when the model emits a valid one', async () => {
  const client = fakeClient([emit(goodEdition)]);
  const edition = await research(client);
  assert.equal(edition.stories.length, 6);
  assert.equal(edition.newsDate.length, 10);
  assert.ok(edition.compiledAt, 'stamps compiledAt');
});

await test('resumes a paused server-tool turn without injecting a message', async () => {
  const paused = { stop_reason: 'pause_turn', content: [{ type: 'text', text: 'searching' }] };
  const client = fakeClient([paused, paused, emit(goodEdition)]);
  await research(client);

  assert.equal(client.sent.length, 3, 'sends three requests');
  const roles = client.sent[2].messages.map((m) => m.role);
  assert.deepEqual(roles, ['user', 'assistant', 'assistant'],
    'resends the paused turns as-is with no extra user message');
});

await test('feeds validation errors back and accepts the repair', async () => {
  const unsourced = {
    note: 'Six things.',
    stories: goodEdition.stories.map((s, i) => (i === 0 ? { ...s, sources: [] } : s)),
  };
  const client = fakeClient([emit(unsourced, 'tu_bad'), emit(goodEdition, 'tu_ok')]);
  const edition = await research(client);

  assert.equal(edition.stories[0].sources.length, 1, 'returns the repaired edition');
  const repair = client.sent[1].messages.at(-1);
  assert.equal(repair.role, 'user');
  assert.equal(repair.content[0].type, 'tool_result');
  assert.equal(repair.content[0].tool_use_id, 'tu_bad', 'answers the failed call');
  assert.equal(repair.content[0].is_error, true);
  assert.match(repair.content[0].content, /needs at least one source/,
    'passes the validator’s actual complaint through');
});

await test('gives up after the repair budget', async () => {
  const bad = emit({ note: 'x', stories: [{ ...story(1), verdict: 'made-up-verdict' }] });
  const client = fakeClient([bad, bad, bad]);
  await assert.rejects(() => research(client), /still invalid after 2 repair attempts/);
});

await test('surfaces a turn that ends without emitting', async () => {
  const client = fakeClient([{
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'I could not find enough material for six stories.' }],
  }]);
  await assert.rejects(() => research(client), /finished without calling emit_edition/);
});

await test('surfaces a refusal and a truncated turn', async () => {
  await assert.rejects(
    () => research(fakeClient([{ stop_reason: 'refusal', stop_details: { explanation: 'nope' } }])),
    /model declined: nope/);
  await assert.rejects(
    () => research(fakeClient([{ stop_reason: 'max_tokens', content: [] }])),
    /ran out of output tokens/);
});

await test('declares the tools the research actually needs', async () => {
  const client = fakeClient([emit(goodEdition)]);
  await research(client);
  const req = client.sent[0];

  assert.deepEqual(req.tools.map((t) => t.name), ['web_search', 'web_fetch', 'emit_edition']);
  assert.equal(req.tools[0].type, 'web_search_20260209');
  assert.equal(req.tools[1].type, 'web_fetch_20260209');
  assert.equal(req.tools[2].strict, true, 'emit_edition is a strict tool');
  assert.equal(req.model, 'claude-opus-5');
  assert.deepEqual(req.thinking, { type: 'adaptive' });
  assert.ok(!('budget_tokens' in req.thinking), 'no removed budget_tokens param');
  assert.match(req.system, /never invent a development/i);
});

console.log(`\n${passed} passing`);
