#!/usr/bin/env bash
#
# Reproducible Armenian (hy) hyphenation pattern build for vankatum.
#
# Pipeline: the engine labels the corpus -> pypatgen learns Liang patterns ->
# TeX \patterns{} + \hyphenation{} exceptions -> verified to reproduce the engine
# exactly on the corpus. This is the keystone artifact; downstream emitters
# (.dic, .hyb, hypher .json) derive from it. See docs/SOURCES.md §F.
#
# Requires: node, pnpm, and pypatgen (pip install pypatgen). Override the binary
# with PYPATGEN=/path/to/pypatgen for CI.
set -euo pipefail
cd "$(dirname "$0")/../.."

PYPATGEN="${PYPATGEN:-playground/.venv/bin/pypatgen}"
OUT_DIR="artifacts"
DICT="playground/corpus/dictionary.txt"
PROJ="playground/patterns/hy-release.proj"
TEX="$OUT_DIR/hyph-hy.tex"

# Training schedule (pattern-length range + good:bad:threshold selector per level).
# Lean 4-level set: ~96% recall / ~99% precision on held-out words, compact size.
# Exceptions guarantee exact reproduction on the corpus regardless.
SCHEDULE=("2-4 1:2:20" "2-4 2:1:8" "2-5 1:3:8" "2-5 2:1:4")

mkdir -p "$OUT_DIR" playground/patterns

echo "[1/4] build engine + label corpus"
pnpm build >/dev/null
node tools/emit/label.mjs

echo "[2/4] train patterns"
rm -f "$PROJ"
"$PYPATGEN" "$PROJ" new "$DICT" -m 1,1 >/dev/null
for spec in "${SCHEDULE[@]}"; do
  read -r range selector <<<"$spec"
  "$PYPATGEN" "$PROJ" train -r "$range" -s "$selector" -c >/dev/null
done

echo "[3/4] export TeX patterns + exceptions"
# mktemp -u: pypatgen export refuses to overwrite an existing file (yet exits 0),
# so the target must not pre-exist; guard against its silent no-output failure.
raw="$(mktemp -u)"
"$PYPATGEN" "$PROJ" export "$raw" >/dev/null
[ -s "$raw" ] || { echo "error: pypatgen export produced no output" >&2; exit 1; }
words="$(grep -c . "$DICT")"
{
  echo "% vankatum -- Armenian (hy) hyphenation patterns"
  echo "% Generated $(date -u +%Y-%m-%d) from the vankatum rule engine over a ${words}-word"
  echo "% corpus (ARLIS legal texts + Wiktionary). DO NOT EDIT -- regenerate with"
  echo "% tools/emit/build-patterns.sh."
  echo "% Recommended minima: \\lefthyphenmin=1 \\righthyphenmin=2"
  echo "% License: MIT (vankatum). Patterns are generated, not derived from hyph-hy."
  echo "%"
  cat "$raw"
} >"$TEX"
rm -f "$raw"

echo "[4/5] verify reproduction vs engine"
node tools/emit/verify.mjs "$TEX" "$DICT"

echo "[5/5] derive downstream artifacts (.dic, hypher .json, .hyb)"
node tools/emit/derive.mjs "$TEX" "$OUT_DIR"
python3 tools/emit/vendor/mk_hyb_file.py "$OUT_DIR/hyph-hy.pat.txt" "$OUT_DIR/hyph-hy.hyb"

echo "artifacts in $OUT_DIR/:"
ls -1 "$OUT_DIR"
