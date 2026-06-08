#!/usr/bin/env bash
#
# Re-download every reference implementation and gold corpus into
# playground/reference/ (gitignored). Provenance documented in docs/SOURCES.md.
#
# Idempotent: safe to re-run. Requires curl, jq, node/npm, python3/pip.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF="$ROOT/playground/reference"
mkdir -p "$REF"
cd "$REF"

note() { printf '\n==> %s\n' "$1"; }

note "1/7 hyph-utf8 canonical Liang patterns (LGPL, Sahak Petrosyan)"
mkdir -p hyph-utf8
B="https://raw.githubusercontent.com/hyphenation/tex-hyphen/master/hyph-utf8/tex/generic/hyph-utf8/patterns"
curl -fsSL "$B/tex/hyph-hy.tex"     -o hyph-utf8/hyph-hy.tex
curl -fsSL "$B/txt/hyph-hy.pat.txt" -o hyph-utf8/hyph-hy.pat.txt

note "2/7 Hyphenator.js — Petrosyan's original hy.js (LGPL)"
mkdir -p hyphenator-js
curl -fsSL "https://raw.githubusercontent.com/mnater/Hyphenator/master/patterns/hy.js" -o hyphenator-js/hy.js

note "3/7 Haskell ekmett/hyphenation hy data (BSD-2) — expect byte-identical to hyph-utf8"
mkdir -p haskell-hyphenation
for f in hyph-hy.pat.txt hyph-hy.hyp.txt; do
  curl -fsSL "https://raw.githubusercontent.com/ekmett/hyphenation/master/data/$f.gz" -o "haskell-hyphenation/$f.gz"
  gunzip -kf "haskell-hyphenation/$f.gz"
done

note "4/7 npm engines (hypher trie + hyphenopoly wasm) and the hy pattern package"
for p in hyphenation.hy hypher hyphenopoly; do
  d="npm-$p"; mkdir -p "$d"
  ( cd "$d" && npm pack "$p" >/dev/null 2>&1 && for t in *.tgz; do tar xzf "$t"; done )
done

note "5/7 pyphen (PyPI) — expect NO Armenian dictionary"
mkdir -p pyphen
( cd pyphen && pip download pyphen --no-deps -d . >/dev/null 2>&1 && for w in *.whl; do unzip -oq "$w" -d extracted; done )
ls pyphen/extracted/pyphen/dictionaries/ | grep -q 'hyph_hy' \
  && echo "   WARNING: pyphen now ships hyph_hy (previously absent)" \
  || echo "   confirmed: no hyph_hy dictionary in pyphen"

note "6/7 Wiktionary gold via kaikki.org (CC BY-SA) — stream + extract word -> hyphenation"
mkdir -p wiktionary
curl -fsSL "https://kaikki.org/dictionary/Armenian/kaikki.org-dictionary-Armenian.jsonl" \
  | grep -F '"hyphenations"' \
  | jq -rc 'select(.lang_code=="hy") | .word as $w | (.hyphenations[]?.parts) | select(type=="array" and length>1) | [$w, join("-")] | @tsv' \
  | sort -u > wiktionary/wiktionary-hy.tsv
echo "   wiktionary-hy.tsv rows: $(wc -l < wiktionary/wiktionary-hy.tsv)"

note "7/7 done — see docs/SOURCES.md for provenance and findings"
