#!/usr/bin/env node
/* Renders the review checklist for an edition's pull request.
 *   node pipeline/pr-body.mjs 2026-08-24
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
  console.error('usage: pr-body.mjs <YYYY-MM-DD>');
  process.exit(2);
}

const ed = JSON.parse(readFileSync(join(ROOT, `data/editions/${date}.json`), 'utf8'));

const lines = ed.stories.map((s) => {
  const sources = s.sources.map((x) => `[${x.label}](${x.url})`).join(' · ');
  return `- **${LABELS[s.verdict] ?? s.verdict}** · noise ${s.noise}/5 · ${s.kicker}\n`
    + `  ${s.headline}\n`
    + `  ${sources}`;
});

// A story that got little attention and turned out to be real is the thing this
// publication exists to surface — and also the claim most worth checking.
const quiet = ed.stories.filter((s) => s.noise <= 2 && ['landed', 'escalated'].includes(s.verdict));

console.log(`The news of **${ed.newsDate}**, compiled ${ed.compiledAt}.

_${ed.note}_

${lines.join('\n')}

---

### Before merging

**Spot-check the follow-ups.** The \`thenWhat\` field is the product, and it is the
one thing a reader cannot verify for themselves. Open a couple of the linked
sources and confirm the follow-up says what the source says.

Check these first:

- [ ] Every story marked **This one landed** — the claim is that something actually
      took effect, which is the costliest kind of error to publish.
${quiet.length
  ? quiet.map((s) => `- [ ] **${s.headline}** — low noise, real outcome. This is the pattern the app exists to surface, so it is worth being sure about.`).join('\n')
  : '- [ ] No low-noise story landed today. If that keeps happening, the research is probably only reading the top headlines — see rule 4 in EDITION_GUIDE.md.'}
- [ ] No follow-up asserts something no linked source supports.

The validator has already checked the 14-day gap, the verdict values, and that
every story carries at least one source. It cannot check whether any of it is true.

🤖 Generated with [Claude Code](https://claude.com/claude-code)`);
