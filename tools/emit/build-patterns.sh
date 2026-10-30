#!/usr/bin/env bash
#
# Reproducible Armenian (hy) hyphenation pattern build for vankatum.
#
# Pipeline: the engine labels the corpus -> pypatgen learns Liang patterns ->
# TeX \patterns{} + \hyphenation{} exceptions -> verified to reproduce the engine
# exactly on the corpus. This is the keystone artifact; downstream emitters
# (.dic, .hyb, hypher .json) derive from it, and the last step runs every
# artifact through its real consumer. See docs/SOURCES.md §F.
#
# Requires: node, npm, perl, zip, a C compiler, git, luatex, and pypatgen
# (pip install pypatgen). Override the binary
# with PYPATGEN=/path/to/pypatgen for CI.
set -euo pipefail
cd "$(dirname "$0")/../.."

PYPATGEN="${PYPATGEN:-playground/.venv/bin/pypatgen}"
OUT_DIR="artifacts"
DICT="playground/corpus/dictionary.txt"
PROJ="playground/patterns/hy-release.proj"
TEX="$OUT_DIR/hyph-hy.tex"

# Training schedule (pattern-length range + good:bad:threshold selector per level).
# 6 levels, lengths to 8. patgen alternates hyphenating/inhibiting levels, so an
# EVEN count ends on an inhibiting pass that removes false breaks -> precision is
# prioritised over recall (a wrong break is a visible error; a missed break is
# invisible). Held-out generalisation (tools/emit/holdout.mjs, 10% content-hash
# split): recall ~98.5% / precision ~99.6% / 95.6% of words broken exactly right.
# (.hyb overflows Chromium's 32-bit trie at any size for this corpus, so the
# larger pattern set costs nothing there; exceptions give exact corpus reproduction.)
SCHEDULE=("2-4 1:2:20" "2-4 2:1:8" "2-6 1:4:8" "2-6 3:2:4" "2-8 1:2:3" "2-8 3:1:1")

mkdir -p "$OUT_DIR" playground/patterns

echo "[1/6] build engine + label corpus"
npm run build >/dev/null
node tools/emit/label.mjs

echo "[2/6] train patterns"
rm -f "$PROJ"
"$PYPATGEN" "$PROJ" new "$DICT" -m 1,1 >/dev/null
for spec in "${SCHEDULE[@]}"; do
  read -r range selector <<<"$spec"
  "$PYPATGEN" "$PROJ" train -r "$range" -s "$selector" -c >/dev/null
done

echo "[3/6] export TeX patterns + exceptions"
# mktemp -u: pypatgen export refuses to overwrite an existing file (yet exits 0),
# so the target must not pre-exist; guard against its silent no-output failure.
raw="$(mktemp -u)"
"$PYPATGEN" "$PROJ" export "$raw" >/dev/null
[ -s "$raw" ] || { echo "error: pypatgen export produced no output" >&2; exit 1; }
words="$(grep -c . "$DICT")"
node tools/emit/write-tex.mjs "$raw" "$words" "$TEX"
rm -f "$raw"

echo "[4/6] verify reproduction vs engine"
node tools/emit/verify.mjs "$TEX" "$DICT"

echo "[5/6] derive downstream artifacts (.json, Minikin trio, .dic, .oxt, .hyb)"
node tools/emit/derive.mjs "$TEX" "$OUT_DIR"
# The libhyphen .dic: patterns + exceptions as whole-word patterns + the
# character-changing breaks (written schwa, և -> ե-վ before a vowel) as
# non-standard rules, run through upstream's substrings.pl. See
# tools/emit/dic/build.mjs and docs/SOURCES.md §F.
node tools/emit/dic/build.mjs "$TEX" "$OUT_DIR/hyph_hy_AM.dic"
# The same .dic as a LibreOffice extension: official LibreOffice builds load
# hyphenation dictionaries only from extensions.
node tools/emit/oxt.mjs "$OUT_DIR/hyph_hy_AM.dic" "$OUT_DIR/vankatum-hy.oxt"
# .hyb is best-effort: Chromium's Minikin trie packs into 32-bit words, so a very
# large pattern set legitimately overflows it. Skip (don't fail the release) when
# it does — .tex/.json/.dic carry the full set regardless.
if python3 tools/emit/vendor/mk_hyb_file.py "$OUT_DIR/hyph-hy.pat.txt" "$OUT_DIR/hyph-hy.hyb" 2>/dev/null; then
  echo "  .hyb: ok"
else
  rm -f "$OUT_DIR/hyph-hy.hyb"
  echo "  warning: .hyb skipped (pattern set exceeds Chromium 32-bit Minikin trie capacity)"
fi

echo "[6/6] end-to-end: the artifacts in real libhyphen, LuaTeX and hypher"
tools/emit/e2e/run.sh "$OUT_DIR"

echo "artifacts in $OUT_DIR/:"
ls -1 "$OUT_DIR"
