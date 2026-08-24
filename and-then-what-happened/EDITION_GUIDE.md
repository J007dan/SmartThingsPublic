# Making an edition

An edition is one JSON file covering one day's news, published fourteen days later.

## The schema

```jsonc
{
  "edition":    "2026-08-24",   // publication date (today)
  "newsDate":   "2026-08-10",   // exactly 14 days earlier
  "compiledAt": "2026-08-24",   // when the follow-ups were verified
  "note":       "one line of editor's framing, optional",
  "stories": [
    {
      "id":       "kebab-case-slug",
      "kicker":   "Public Health",        // section label
      "headline": "How it was reported that day",
      "then":     "2-4 sentences: what was actually announced or reported. Past tense.",
      "noise":    5,                       // 1-5, how loud it got at the time
      "verdict":  "grinding",              // see the table in README.md
      "thenWhat": "The follow-up. This is the product. 3-6 sentences.",
      "sources":  [{ "label": "NBC News", "url": "https://..." }]
    }
  ]
}
```

Run `node tools/validate-edition.mjs data/editions/<date>.json` before shipping.

## The research process

For each candidate story, two passes:

**Pass one — what ran that day.** Search the actual date. Wire summaries,
`site:democracynow.org` headline roundups, and newspaper archives all work.
Capture what was claimed, not what it was framed as.

**Pass two — what came of it.** This is where the app lives, and it is the part
that cannot be guessed. Search the specific thread forward: the case name, the
bill number, the agency, the named official. Then write the follow-up from what
you find.

## Rules

1. **Never write a follow-up you did not verify.** If two weeks of searching
   turns up nothing, that is not a gap — that is a `nothing-yet` verdict, and
   it's often the best card on the page. Say plainly that nothing has been
   announced since. Do not invent developments.

2. **Absence of news is a finding, but state it carefully.** "No resumption of
   talks has been announced" is defensible. "The administration abandoned the
   plan" is not, unless someone reported that.

3. **Include at least one `landed` story when one exists.** The temptation is to
   fill the page with things that fizzled, because that is the soothing version.
   Resist it. The reader's trust depends on the app being willing to say "this
   one was real, and it's done."

4. **Look for the quiet one.** The most valuable card is usually the story that
   got a 2 on the noise meter and a `landed` verdict — the thing that finished
   while the timeline was busy. Go find that one deliberately; it will not be in
   the day's top headlines.

5. **Sources are per-story and mandatory.** Prefer the outlet that did the
   original reporting over the aggregator. Include the follow-up sources, not
   just the day-of ones — the follow-up is the claim that needs backing.

6. **Six stories is the shape.** Enough to feel like a paper, few enough to
   finish over one coffee. Vary the kickers.

## Tone

Calm, dry, and specific. The app is not sarcastic about the news and not smug
about the reader who got worked up — the whole premise is that getting worked up
is a reasonable response to how the news arrives, and that fourteen days is a
cheap fix. Short declarative sentences. Numbers where you have them. Let the
gap between the headline and the follow-up do the work; never editorialize
about what the reader should have felt.
