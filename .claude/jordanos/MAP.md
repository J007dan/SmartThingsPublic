# JordanOS — Drive ID Map

Structure created 2026-07-08/09. Use these IDs directly instead of searching Drive.

Root: **JordanOS** — `1FOU0cOGnP0HJzMTfTAH8aP-2khUncNjz`

## Core docs (root level)

| Doc | ID |
|---|---|
| Master Prompt | `1pHK7NzSIq0Hv-y7p9mui-_mD3m0-7FqVV4NG0G_H5TE` |
| Index | `1RbxRFxjCCe5EQwqXPGJhLnm6WDhzPtvPiePCWHE2xVs` |
| Inbox | `1QJdZQV6RJrgO1ueAQk9wVpaFqNVJ034pkOTFNWM6Wh4` |
| Current Focus | `1QXWCYRdJK9XKkNjLW4otf-0YeLRvc5AGE7jTTqVM2I8` |
| Weekly Review | `1p-bE9zGIOseouXwm5IteNaGP6pzWy2JFjCwHni8s9fE` |

## Registers (canonical)

| Register | Doc ID | Lives in folder |
|---|---|---|
| Decision Log | `14DiDUKjb4cmqOfz3ErnXFoahliu3nMe99-ClTiE5OhE` | Knowledge/Decisions |
| Open Loops Register | `15vZf2YM-ASY7UcKroFjAAY4PxRWQV3TytyA_Y17FB80` | Knowledge/OpenLoops |
| Projects Register | `1Kv3uxYPYthGQuZwTnGhIUX553GDIaSA-YfFD1nnEXFM` | Knowledge/Projects |
| Timeline Log | `1rBfnxAG2QLa4BPq97-EFHX7xu0pesaGL03XxhzYqv44` | Knowledge/Timeline |
| Claude Export Seed Entries | `1Kb-xeu60ix7pa_lcA-sTc9Mtv2K5jMC9ref7NqKXGEI` | Knowledge/Documents |

## Folders

**Daily** — `1BOBvBxWYuvEMQ5Um1pLq50zRbQNBOErQ`
- Captain's Log `1QnuMK2ETDfQarWWf2p1MCqa6Xw5iVTT4`
- Journal `14ypft04tU58ZUIO4bSd1r0DlmkhzmPac`
- Meetings `1uhlSSAZqS2q8hSe00qb6BIX_MmzxvlvQ`
- Notes `1nzHtGSi7j1R7MpI0ZauBw1Hkaenp59bw`

**Knowledge** — `1kryqjKZpwgM5qb6iCxX5LlEIRntbysgi`
- People `1TMw7ydjEJXLzlycEtMg6xs5B0d4ALAAW`
- Projects `1QhIf0hYeKT8GMoZLOapR1z6P0mrRgoLT`
- Decisions `1F54tdNN8DIrZEgI3WmCq0K52czpZFueE`
- Timeline `1PtCgy5lsIn2Pa_EHd48jrfV0EiiP4Tn1`
- Assets `1Vp5dW3bYAOay-pq8DrU3XNMDwt5Z_V68`
- Documents `133JxIpsKXI-stnfZmQc6fJjJZTx-k2q1`
- Ideas `1t-1Ru0kcEnPHD1UN2nm1SkAhbD5y8Wxb`
- Preferences `1_UiAotIKvuS690q559eWUVDyJqzMGFw_`
- OpenLoops `1zsL9-X_Z1zf-jEXaCsjTpc0YaSIQ9I38`

**Finance** — `11yzYmAVyDxv5vORG06lXHnDqHcRYTNzT`
- Net Worth `1S2vhafo5R_fViHcdxjKNV27bfxOuhnn7` · Retirement `1ZZ-4pM-6LCvWDrlPSq7gKiFuicpedekW` ·
  Investments `1FVoEd2VuD4ktFRpd_yUJFam4s67dbHhY` · Spending `1g669LNgV_5ztXNJ1BctkM6K7LjeWRY6-` ·
  Taxes `1jSpbsRX91YemfDj5ee54fNJ3pA49NGkF`

**Work** — `1wkAhYgFRINxYAzoEx8VJCh3cUxW7uLdF`
- Meta `1TzB5HeYodoPsparHyV1C26tV8dlMN_Ku` · Anthropic `1YP0diOMBazFZN_aYLGHkUeUvEuFyZVgU` ·
  Legal AI `1iGiIbgTY5dh1PxJmnlselVvOAexJ3ehZ` · Career `1ikJlyd7vsJ1346W3HpUZ1SdP2Dq6UroW`

**Personal** — `1Fiut5KxVtvWiKLJYr3WcEHHwHHBwX25Y`
- Health `1KHl4cYcu6HP6kj7TFg-4y4wgyOaMyLIE` · Relationships `1hOcHv4pwDAFKIIa5y13HObYLbQXoeTeT` ·
  Travel `1Vo6XcgeW8QM5v1rI-kiZcWG-fAPVtnNY` · Houseboat `1_jMPCiT0VpvqQMXkHud9HQeogQ0JZoYk` ·
  Boston Whaler `15VxvDCjV2hKXlXoWRg0YuJDx4SQmRvdd` · Home Projects `19uy_rAqDF_bcV1wXRZlGqUtWB0wHW6u_`

**Templates** — `1BH2XSY32_fwIeWf8qvSYa1R_bijWM2PH` (empty)
**Archive** — `1oa5ZN4MF-Ruu3N-e2l2DAPLa_L8PH_b4`

## Automation

Two Routines write here on a schedule. Times assume America/Los_Angeles; cron is stored in UTC.

| Routine | Trigger ID | Cron (UTC) | Local | Writes to |
|---|---|---|---|---|
| JordanOS Nightly Capture | `trig_017Ha3bwMNCNg8XgXJoATfKC` | `0 4 * * *` | 9:00 PM daily | Daily/Captain's Log |
| JordanOS Weekly Review | `trig_01QvqwocYYxq6fRTHLkLo35a` | `0 0 * * 1` | Sun 5:00 PM | JordanOS root |

Both fire fresh sessions. They create dated docs; they never edit existing ones (connector
limitation), so register updates flow through the weekly review's FOLD-IN QUEUE.

Both are currently **disabled** — see ROUTINES.md for why and how to enable them properly.

## Connector capability note

`update_file` exists but changes only a file's **title and parent** (rename / move). There is no
tool that edits document *content*. Writing into JordanOS therefore always means creating a new
file. Verified 2026-08-24.

## Daily entries

- Captain's Log 2026-08-24 `1fcckRoCWOFCrk99pSRNr5YWAED_clbgJGo62g6MOyFY` — first entry; backfills
  2026-07-09 through 2026-08-24 from Drive evidence only.
