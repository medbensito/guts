#!/bin/sh
# Assemble la page : insère le dessin du renard dans page.html
cd "$(dirname "$0")"
python3 - <<'PY'
s = open('src/page.html', encoding='utf8').read()
r = open('src/renard.js', encoding='utf8').read()
assert '/*@RENARD@*/' in s
open('index.html', 'w', encoding='utf8').write(s.replace('/*@RENARD@*/', r.rstrip()))
PY
