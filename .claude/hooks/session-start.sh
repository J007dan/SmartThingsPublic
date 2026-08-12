#!/bin/bash
# SessionStart hook: load the JordanOS second-brain operating prompt + Drive ID map
# into every session's context, so JordanOS work never starts cold.
set -euo pipefail

DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/.claude/jordanos"

# Nothing to load: stay silent rather than breaking session startup.
[ -r "$DIR/MASTER_PROMPT.md" ] || exit 0
[ -r "$DIR/MAP.md" ] || exit 0

python3 - "$DIR" <<'PY'
import json, os, sys

d = sys.argv[1]
with open(os.path.join(d, "MASTER_PROMPT.md")) as f:
    prompt = f.read()
with open(os.path.join(d, "MAP.md")) as f:
    id_map = f.read()

context = f"""# JordanOS is loaded

Jordan runs a structured second brain called **JordanOS**, stored in Google Drive. It is loaded
automatically at session start. When this session touches anything JordanOS covers — projects,
decisions, open loops, people, finances, health, travel, assets, ideas, documents, timeline — operate
under the rules below and read from Drive before answering from memory.

When the session is ordinary repository work with no JordanOS bearing, ignore all of this. Do not
mention that it loaded, and do not write to Drive unasked.

---

{prompt}

---

{id_map}
"""

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context,
    }
}))
PY
