/* …And Then What Happened? — renders one edition of two-week-old news. */

const VERDICTS = {
  'nothing-yet': 'Nothing yet',
  'fizzled':     'Fizzled out',
  'grinding':    'Still grinding',
  'landed':      'This one landed',
  'escalated':   'It got bigger',
};

const $ = (sel) => document.querySelector(sel);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** Parse YYYY-MM-DD as a local date, not UTC — otherwise it renders a day early. */
function parseDay(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

const longDate = (iso) => parseDay(iso).toLocaleDateString('en-US',
  { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const shortDate = (iso) => parseDay(iso).toLocaleDateString('en-US',
  { weekday: 'long', month: 'long', day: 'numeric' });

/** Data comes from files over http, or inlined by tools/build-standalone.mjs. */
const BUNDLE = typeof window !== 'undefined' ? window.__ATWH__ : null;

async function loadIndex() {
  if (BUNDLE) return BUNDLE.index;
  const res = await fetch('data/index.json');
  if (!res.ok) throw new Error(`index.json: ${res.status}`);
  return res.json();
}

async function loadEdition(date) {
  if (BUNDLE) return BUNDLE.editions[date];
  const res = await fetch(`data/editions/${date}.json`);
  if (!res.ok) throw new Error(`${date}.json: ${res.status}`);
  return res.json();
}

function noiseMeter(level) {
  const n = Math.max(0, Math.min(5, Number(level) || 0));
  return `<p class="noise">Noise then <b>${'▮'.repeat(n)}</b><i>${'▮'.repeat(5 - n)}</i></p>`;
}

function sourceList(sources) {
  if (!sources || !sources.length) return '';
  const items = sources.map((s) =>
    `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a></li>`
  ).join('');
  return `<details class="sources">
      <summary>${sources.length} source${sources.length === 1 ? '' : 's'}</summary>
      <ul>${items}</ul>
    </details>`;
}

function storyCard(story) {
  const verdict = VERDICTS[story.verdict] ? story.verdict : 'grinding';
  return `<article class="story" data-verdict="${esc(verdict)}">
      <div class="story-head">
        <p class="kicker">${esc(story.kicker)}</p>
        ${noiseMeter(story.noise)}
      </div>
      <h2>${esc(story.headline)}</h2>
      <p class="then">${esc(story.then)}</p>
      <div class="turn"><span>…and then what happened?</span></div>
      <p class="thenwhat">${esc(story.thenWhat)}</p>
      <p class="verdict"><span class="chip">${esc(VERDICTS[verdict])}</span></p>
      ${sourceList(story.sources)}
    </article>`;
}

function renderEdition(edition) {
  $('[data-today]').textContent = longDate(edition.edition);
  $('[data-newsdate]').textContent = shortDate(edition.newsDate);
  document.title = `${shortDate(edition.newsDate)} — …And Then What Happened?`;

  const note = $('[data-note]');
  if (edition.note) {
    note.textContent = edition.note;
    note.hidden = false;
  } else {
    note.hidden = true;
  }

  $('#stories').innerHTML = edition.stories.map(storyCard).join('');
}

function renderNav(dates, current) {
  const nav = $('[data-nav]');
  if (dates.length < 2) return;
  nav.hidden = false;

  const i = dates.indexOf(current);
  const prev = $('[data-prev]');
  const next = $('[data-next]');

  // dates are sorted newest first, so "earlier" is further along the array
  prev.disabled = i >= dates.length - 1;
  next.disabled = i <= 0;
  prev.onclick = () => go(dates[i + 1]);
  next.onclick = () => go(dates[i - 1]);
}

function go(date) {
  const url = new URL(window.location);
  url.searchParams.set('date', date);
  window.history.pushState({}, '', url);
  start();
}

function fail(err) {
  $('#stories').innerHTML = `<p class="error">This edition could not be loaded.<br>
    Opening the file directly from disk will do this — the page reads its stories over HTTP.
    <code>npx serve and-then-what-happened</code></p>`;
  console.error(err);
}

async function start() {
  try {
    const index = await loadIndex();
    const dates = [...index.editions].sort().reverse();
    const wanted = new URL(window.location).searchParams.get('date');
    const current = dates.includes(wanted) ? wanted : dates[0];

    renderEdition(await loadEdition(current));
    renderNav(dates, current);
  } catch (err) {
    fail(err);
  }
}

window.addEventListener('popstate', start);
start();
