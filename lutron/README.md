# Lutron RA3 control & programming app

A self-hosted replacement for the Lutron app, for RadioRA 3 systems. Runs on a
Raspberry Pi, NAS, or any always-on machine on your LAN, and serves a fast,
customizable interface to every phone, tablet, and desktop in the house.

Two halves:

- **Control** — rooms, dimmers, shades (including tilt), fans. Drag anywhere on
  a row to set a level, tap to toggle. Live state pushed over a WebSocket, so
  every device stays in sync with the wall keypads in real time.
- **Program** — your own scenes and schedules, including sunrise/sunset triggers
  with offsets. No limits, no truck roll.

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
| `bridge.py` | LEAP connection, normalized inventory, live state, plus the demo backend |
| `engine.py` | Scene execution and the schedule runner (sun times via `astral`) |
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

44 tests covering scene execution, schedule due-time logic (including the
fire-once-per-day guard and the grace window), every API endpoint, WebSocket
delivery, and persistence across restart. They run entirely against the
simulated house, so no processor is needed.

## Notes

- Everything stays on your LAN. There is no cloud dependency and no account.
- The private key in `certs/` is a credential — it is written `0600`, and
  `.gitignore` excludes the whole directory along with `programming.json`.
- The app never writes processor configuration, so it cannot damage your
  installer's programming. The worst it can do is turn lights on and off.
