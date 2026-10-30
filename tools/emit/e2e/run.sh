#!/usr/bin/env bash
#
# End-to-end gate: run the generated artifacts through the real consumers and
# require each to reproduce the engine on every corpus word.
#
#   hyph_hy_AM.dic        real libhyphen (the C library behind LibreOffice,
#                         Scribus and InDesign's Hunspell provider)
#   hyph-hy.tex           LuaTeX's own hyphenation routine
#   hyphenation.hy.json   hypher
#
# The project's own Liang applier (verify.mjs) cannot catch a format a consumer
# reads differently; this can. Requires: node, a C compiler, git, luatex.
#
# Usage: tools/emit/e2e/run.sh [artifacts-dir]
set -euo pipefail
cd "$(dirname "$0")/../../.."

ARTIFACTS="${1:-artifacts}"
WORDS="corpus/wordlist.txt"
WORK="playground/e2e"
HERE="tools/emit/e2e"
# libhyphen as LibreOffice ships it; pinned so a library change cannot move the gate.
HYPHEN_REPO="https://github.com/hunspell/hyphen.git"
HYPHEN_COMMIT="476ccbe1f1388e7007c4d4143ee41a063156bf88"

mkdir -p "$WORK"

echo "[e2e] libhyphen $HYPHEN_COMMIT"
if [ "$(git -C "$WORK/hyphen" rev-parse HEAD 2>/dev/null || true)" != "$HYPHEN_COMMIT" ]; then
  rm -rf "$WORK/hyphen"
  git init -q "$WORK/hyphen"
  git -C "$WORK/hyphen" fetch -q --depth 1 "$HYPHEN_REPO" "$HYPHEN_COMMIT"
  git -C "$WORK/hyphen" checkout -q FETCH_HEAD
fi
cc -O2 -I"$WORK/hyphen" -o "$WORK/libhyphen" \
  "$HERE/libhyphen.c" "$WORK/hyphen/hyphen.c" "$WORK/hyphen/hnjalloc.c"
"$WORK/libhyphen" "$ARTIFACTS/hyph_hy_AM.dic" "$WORDS" >"$WORK/libhyphen.txt"

echo "[e2e] luatex"
E2E_LUA="$HERE/luatex.lua" E2E_TEX="$ARTIFACTS/hyph-hy.tex" E2E_WORDS="$WORDS" \
  E2E_OUT="$WORK/luatex.txt" \
  luatex --interaction=nonstopmode --halt-on-error --output-directory="$WORK" "$HERE/luatex.tex" >/dev/null

echo "[e2e] hypher"
node "$HERE/hypher.mjs" "$ARTIFACTS/hyphenation.hy.json" "$WORDS" "$WORK/hypher.txt"

node "$HERE/score.mjs" "$WORDS" \
  "dic:libhyphen:$WORK/libhyphen.txt" \
  "plain:luatex:$WORK/luatex.txt" \
  "plain:hypher:$WORK/hypher.txt"
