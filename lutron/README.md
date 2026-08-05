# Lutron RA3 control & programming app

A self-hosted replacement for the Lutron app, for RadioRA 3 systems. Runs on a
Raspberry Pi, NAS, or any always-on machine on your LAN, and serves a fast,
customizable interface to every phone, tablet, and desktop in the house.

Two halves:

- **Control** — rooms, dimmers, shades (including tilt), fans. Drag anywhere on
  a row to set a level, tap to toggle. Live state pushed over a WebSocket, so
  every device stays in sync with the wall keypads in real time.
- **Program** — your own scenes, schedules (including sunrise/sunset triggers
  with offsets), and motion rules driven by your occupancy sensors. No limits,
  no truck roll.

## Read this first: what can and cannot be built

You asked for something that programs the system the way Lutron Designer does.
That half is not achievable, and it's worth being precise about why, because the
reason is not effort.

1. **Lutron Designer is gated.** It is not publicly downloadable. Access requires
   passing Lutron's RA3 Qualification Training exam, after which it unlocks
   against your myLutron account.
2. **LEAP has no write-configuration API.** This is the decisive one. LEAP — the
   only third-party integration protocol RA3 supports — is a *control and
   monitor* protocol. It reads the configuration and drives loads. It cannot
   create scenes, assign loads, or program keypad buttons on the processor.
   `pylutron-caseta`, the most complete open implementation, exposes zero
   methods that write programming, because there are none to expose.

So this app cannot change **what a physical wall button does**. That still
requires Designer.

What it *can* do is own a programming layer of its own: scenes and schedules
that live here and drive the processor over LEAP. In practice this is less
restrictive than what Lutron gives a homeowner — their app won't let you create
a new scene at all, and won't let a scheduled event trigger one. Here there is
no such limit.

If you do have Designer access (or your dealer does), set up a batch of
**phantom buttons** once. They appear in this app under "Processor scenes" and
can be triggered from any app-side scene, which gets you processor-native
execution with app-side authoring.

### Motion sensors

LEAP *does* report occupancy, so this one works. RA3 rolls every sensor in a
room up into one per-area status, which the processor pushes on change. The
Motion panel lets you fire one scene when a room becomes occupied and another
when it goes vacant, optionally only between sunset and sunrise.

One caveat worth understanding: your installer has probably already programmed
those same sensors in Designer to control the room's lights directly. A rule
here runs *in addition to* that, not instead of it — two things reacting to one
event. If the native behaviour is what you want to change, that part is
Designer's job.

### Default on-levels

If a light was programmed to come on at 80% and you want something else, the
processor-side default is Designer-only — LEAP cannot write it. Three options,
in increasing order of hassle:

1. **Set a default in this app** (Program → Default on-levels). Tapping that
   light on here uses your level instead of 100%. Wall keypads are unaffected.
2. **Check the dimmer itself.** Lutron's Sunnata dimmers support a preset
   personalization set at the device — a "locked preset" comes on at a level you
   choose, an "unlocked preset" returns to its last level. Whether this is
   reachable on a processor-driven RA3 zone depends on your hardware, so treat
   it as a lead to verify, not a promise: see Lutron application note
   [#734](https://assets.lutron.com/a/documents/048734.pdf).
3. **Ask your dealer** to change the programmed level in Designer. This is the
   only option that changes what the wall controls actually do.

## Install

```bash
cd lutron
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Pair with the processor

LEAP authenticates with client certificates, not a password. Pairing proves
physical access and only has to happen once.

```bash
.venv/bin/python -m lutron_app pair 192.168.1.50   # your processor's IP
```

Press the small black button on the front of the RA3 processor when prompted.
The key/cert/CA triple is written to `~/.config/lutron_app/certs/` and reused
from then on.

Set your location so sunrise/sunset schedules are correct:

```bash
.venv/bin/python -m lutron_app config --latitude 40.0379 --longitude -75.4855 \
                                      --timezone America/New_York
```

## Run

```bash
.venv/bin/python -m lutron_app serve
```

Then open `http://<host>:8080` and add it to your home screen — it's configured
as a standalone web app, so it opens without browser chrome.

For an always-on install, see `deploy/lutron-app.service`.

### No hardware? Demo mode

With no processor paired, the app runs a simulated six-room house so you can try
the interface and build scenes against it:

```bash
.venv/bin/python -m lutron_app serve --demo
```

## How it fits together

```
  browser  ──REST + WebSocket──▶  FastAPI (api.py)
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
              engine.py         store.py         bridge.py
          scenes + schedules   programming.json    │
                                                   ▼
                                        pylutron-caseta ──TLS──▶ RA3 processor
```

| File | Role |
| --- | --- |
| `bridge.py` | LEAP connection, normalized inventory, live state, occupancy, plus the demo backend |
| `engine.py` | Scene execution, the schedule runner, and occupancy automations (sun times via `astral`) |
| `store.py` | JSON persistence for scenes, schedules, and layout |
| `api.py` | REST + WebSocket endpoints, serves the UI |
| `static/` | The interface — plain ES modules, no build step |

Your programming lives in a single file, `~/.config/lutron_app/programming.json`.
Back it up, diff it, hand-edit it.

## Customizing

The interface is deliberately buildless — edit and refresh.

- **Colors, spacing, row height**: the custom properties at the top of
  `static/style.css`. Lights read warm and shades read cool; change `--accent`
  and `--shade` to retheme the whole app.
- **Layout and behavior**: `static/app.js`. Device rows are built once and
  patched in place, so re-rendering never fights a drag in progress.

## Tests

```bash
.venv/bin/python -m pytest tests -q
```

62 tests covering scene execution, schedule due-time logic (including the
fire-once-per-day guard and the grace window), occupancy automations (both
edges, the after-dark condition, and the no-refire-on-repeat guard), every API
endpoint, WebSocket delivery, and persistence across restart. They run entirely
against the simulated house, so no processor is needed.

The simulated house includes occupancy sensors. In demo mode the sensor chips
on the Program tab are clickable, so you can fake motion and watch a rule fire.

## Notes

- Everything stays on your LAN. There is no cloud dependency and no account.
- The private key in `certs/` is a credential — it is written `0600`, and
  `.gitignore` excludes the whole directory along with `programming.json`.
- The app never writes processor configuration, so it cannot damage your
  installer's programming. The worst it can do is turn lights on and off.
