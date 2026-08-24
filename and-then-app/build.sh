#!/bin/sh
# Inline the content layer into the template to produce the publishable page.
# The artifact host serves a single file, so data.js is folded in at build time.
set -e
cd "$(dirname "$0")"
python3 - <<'PY'
tpl = open("template.html", encoding="utf-8").read()
data = open("data.js", encoding="utf-8").read()
marker = "/*__DATA__*/"
assert marker in tpl, "data marker missing from template.html"
open("index.html", "w", encoding="utf-8").write(tpl.replace(marker, data))
print("built index.html")
PY
