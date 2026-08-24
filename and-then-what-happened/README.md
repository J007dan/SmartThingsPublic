# …And Then What Happened?

A news reader that runs exactly fourteen days behind, on purpose.

Every edition takes the headlines from two weeks ago — the ones that filled the
timeline, the ones everybody had a take about — and prints them next to the only
thing that was ever actually missing: what came of them.

It doesn't pretend to be today's news. The dateline says today's date and tells
you plainly that you're reading August 10th. The premise isn't a trick, it's the
product.

## What it is right now

A static, mobile-first web page. No build step, no framework, no server, no keys.
Editions are JSON files. The page reads one and renders it.

```
index.html               the page
styles.css               ink-on-paper, light + dark
app.js                   loads an edition, renders the cards
manifest.webmanifest     Add to Home Screen on iPhone
data/index.json          which editions exist
data/editions/*.json     one file per day
tools/validate-edition.mjs   schema + sourcing check
tools/build-standalone.mjs   bundles everything into one file
```

## Run it

The page fetches its data, so it needs to be served over HTTP — opening
`index.html` off the disk will show you a "could not be loaded" message.

```sh
npx serve and-then-what-happened     # then open the printed URL
```

Or skip the server entirely and open the bundled single file:

```sh
node tools/build-standalone.mjs
open dist/standalone.html
```

To put it on a phone: any static host (GitHub Pages, Netlify, Vercel) will serve
this directory as-is. On iPhone, Share → Add to Home Screen gives you a
full-screen icon with no browser chrome, which is as close to an app as a web
page gets. When it earns being a real app, the JSON contract here is what the
native client would read.

## The verdicts

Each story ends in one of five states. This taxonomy is the whole editorial
position of the app:

| verdict | means |
|---|---|
| `nothing-yet` | Fourteen days later there is still no development. The story was a sentence. |
| `fizzled` | Walked back, dropped, quietly abandoned, or overtaken. |
| `grinding` | Real, unresolved, moving through courts or negotiations at institutional speed. |
| `landed` | It took effect. Someone's life changed. Usually this got *less* attention than the noisy ones. |
| `escalated` | It got bigger than the original story suggested. |

`landed` matters most. An app that only ever said "relax, nothing happened"
would be lying, and would be useless within a month. The value is in telling the
difference between the outrage that evaporated and the thing that quietly became
true while everyone was arguing about something else — which is why every card
carries a **Noise then** meter next to its verdict. A story with five bars of
noise and a `nothing-yet` verdict is the pattern the app exists to show you.
A story with two bars and a `landed` verdict is the one you actually missed.

## Adding an edition

1. Write `data/editions/YYYY-MM-DD.json` — see `EDITION_GUIDE.md` for the
   schema and the research process.
2. Add the date to `editions` in `data/index.json`.
3. `node tools/validate-edition.mjs data/editions/YYYY-MM-DD.json`
4. `node tools/build-standalone.mjs`

The validator enforces the two rules that keep this honest: the edition must be
exactly 14 days after its news date, and no follow-up ships without a source.
