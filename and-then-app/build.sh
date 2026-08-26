#!/bin/sh
# Inline the content layer into the template, twice:
#   index.html       artifact format — no <html>/<head>, the host supplies them
#   site/index.html  a complete standalone document for the public web
set -e
cd "$(dirname "$0")"
python3 - <<'PY'
import io, re

tpl  = io.open("template.html", encoding="utf-8").read()
data = io.open("data.js", encoding="utf-8").read()
marker = "/*__DATA__*/"
assert marker in tpl, "data marker missing from template.html"
body = tpl.replace(marker, data)
io.open("index.html", "w", encoding="utf-8").write(body)

# the standalone build carries its own <head>; the artifact host injects one, so
# the title/meta live only here to avoid duplicating them in the artifact page.
title = "And then . . .?"
desc  = "The news from two weeks ago, plus the only part that was ever going to matter: what actually came of it."
site  = "https://j007dan.github.io/SmartThingsPublic/"

stripped = re.sub(r'^<title>.*?</title>\s*', '', body, count=1, flags=re.S)
stripped = re.sub(r'^<meta name="viewport"[^>]*>\s*', '', stripped, count=1)

head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">

<link rel="icon" href="./icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<link rel="manifest" href="./manifest.webmanifest">

<meta name="theme-color" content="#F4F4F2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141618" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="And then…?">
<meta name="apple-mobile-web-app-status-bar-style" content="default">

<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{site}">
<meta property="og:image" content="{site}og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{site}og.png">
</head>
<body>
'''
io.open("site/index.html", "w", encoding="utf-8").write(head + stripped + "\n</body>\n</html>\n")
print("built index.html and site/index.html")
PY
