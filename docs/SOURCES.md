# Sources & corpora

Provenance ledger for everything `vankatum` has analysed, taken as reference, or
evaluated against. The actual files live under `playground/reference/` which is
**gitignored** — so this document (plus `scripts/fetch-references.sh`) is how we
avoid losing track of them. Re-download everything with:

```sh
./scripts/fetch-references.sh
```

Last verified: 2026-06-08.

---

## A. Existing implementations analysed (prior art)

All Armenian hyphenators in the wild wrap **one** pattern set — Sahak Petrosyan's
Liang patterns (`hyph-hy`), 1428 patterns, encoding only `V·CV` + `և`. We pulled
each to confirm this empirically. See `playground/harness/runner.js` for the
head-to-head (hypher & hyphenopoly both score 7/14, byte-identical output).

| Source | What it is | License | URL | Local path | Finding |
|---|---|---|---|---|---|
| **hyph-utf8 `hyph-hy`** | Canonical TeX Liang patterns (Petrosyan, 2010). Used by TeX/LaTeX, and the upstream of everything else. | LGPL | `https://raw.githubusercontent.com/hyphenation/tex-hyphen/master/hyph-utf8/tex/generic/hyph-utf8/patterns/{tex/hyph-hy.tex,txt/hyph-hy.pat.txt}` | `hyph-utf8/` | 1428 patterns; 1421× `V1CV` + 7× `և`. Zero cluster handling. |
| **Hyphenator.js** `hy.js` | Petrosyan's original artifact (the patterns were written for this first, then adapted to TeX). | LGPL | `https://raw.githubusercontent.com/mnater/Hyphenator/master/patterns/hy.js` | `hyphenator-js/` | Same patterns, hypher format. |
| **hypher** + **hyphenation.hy** | Pure-JS trie engine + the hy pattern package (used by retext etc.). | BSD / MIT | npm `hypher@0.2.5`, `hyphenation.hy@0.2.1` | `npm-hypher/`, `npm-hyphenation.hy/` | Same patterns. One of two engines in our benchmark. |
| **hyphenopoly** | WASM engine (browser polyfill + Node), ships `hy.wasm`. | MIT | npm `hyphenopoly@6.1.0` | `npm-hyphenopoly/` (see `patterns/hy.wasm`) | Same patterns, compiled. Second engine in our benchmark. |
| **Haskell `ekmett/hyphenation`** | Embeds hyph-utf8 data. | BSD-2 | `https://raw.githubusercontent.com/ekmett/hyphenation/master/data/hyph-hy.{pat,hyp}.txt.gz` | `haskell-hyphenation/` | **Byte-identical** to hyph-utf8 `hyph-hy.pat.txt` (verified). |
| **pyphen** | Python hyphenator bundling many Hunspell dicts. | GPL/LGPL/MPL | PyPI `pyphen==0.17.2` | `pyphen/` | **No Armenian dictionary** — confirmed gap in the Python ecosystem. |

Not downloaded, but verified (via research) to reuse the same `hyph-hy` patterns:
**Chromium** (`hyphens:auto`, Chrome/Edge 87+), **Android AOSP**
(`external/hyphenation-patterns`), **LibreOffice** (libhyphen). **Firefox** and
**Safari/WebKit** ship **no** Armenian dictionary at all.

---

## B. Evaluation corpora (gold / reference data)

### In use

| Source | What | License | URL | Local path |
|---|---|---|---|---|
| **English Wiktionary via kaikki.org** | wiktextract JSONL; field `hyphenations[].parts`, `lang_code: hy`. Human-curated `Hyphenation:` lines (full syllabification, Eastern). **Our primary gold.** | CC BY-SA 4.0 + GFDL | `https://kaikki.org/dictionary/Armenian/kaikki.org-dictionary-Armenian.jsonl` (206 MB) | extracted → `wiktionary/wiktionary-hy.tsv` (~2235 rows / 2204 valid words) |

Benchmark harness: `playground/harness/benchmark.mjs`. Compared with
`leftmin=1/rightmin=1`, case-insensitive, `և↔եվ`-normalised, multi-variant =
match-any; rejects corrupt entries where the de-hyphenated form ≠ the word.
Current result: vankatum **96.5%** on the implemented scope (excl. ~415 schwa words).

### Candidates — not yet used (future coverage / differential mining / morphology)

| Source | What | Access | Why it matters |
|---|---|---|---|
| **Eastern Armenian National Corpus (EANC)** | ~110M tokens, morphology + lemmas. | Registration; code on GitHub/Bitbucket. `http://www.eanc.net` · paper `https://aclanthology.org/2022.digitam-1.5.pdf` | Large raw wordlist for differential mining at scale (raw text has **no** hyphenation — coverage only, not an oracle). |
| **Nayiri dictionaries** | 144 Armenian dictionaries incl. orthographic (`ուղղագրական`). | `http://www.nayiri.com/` | Authoritative wordlists; some orthographic dicts may mark division. |
| **Armenian spelling learner's dict (Zangak)** | ~38k entries. | `https://zangak.am/armenian-spelling-learners-dictionary` | Curated headword list. |
| **Universal Dependencies (Armenian)** | 3 treebanks (2 Eastern), morphological segmentation. | `https://universaldependencies.org` | Feeds the future **morphological** break layer (compounds, `-յան`). |

---

## C. Authoritative rule sources (the linguistic spec)

Basis for `docs/SPEC.md` and the algorithm.

| Source | Used for | URL |
|---|---|---|
| **Տողադարձ — Armenian Wikipedia** | Core rule list + examples (single C, ≥2 C → last moves, schwa, compounds, acronyms). | `https://hy.wikipedia.org/wiki/Տողադարձ` |
| **RA Minister of Education order «Տողադարձի մասին»** | Official RA hyphenation rules. | `http://www.irtek.am/views/act.aspx?aid=19824` · `https://iravaban.net/203649.html` |
| **W3C / r12a — Armenian orthography notes** | Line-breaking, `ու` digraph, U+058A hyphen. | `https://r12a.github.io/scripts/armn/hy.html` |
| **Sakayan — Eastern Armenian for the English-Speaking World** | Grammar reference for syllable rules. | (book) |
| **Vaux 1998 — The Phonology of Armenian** | **Schwa (ը) epenthesis** algorithm (planned phase). | (book) |
| **Dum-Tragut 2009 — Armenian: Modern Eastern Armenian** | Modern Eastern phonology/orthography reference. | (book, John Benjamins) |

---

## D. Project tooling

| Dep | Purpose |
|---|---|
| `typescript` (strict) | Core language. |
| `vitest` | Test runner. |
| `fast-check` | Property-based / invariant fuzzing. |

---

## E. Licensing notes (for redistribution)

- **Gold data is CC BY-SA 4.0 + GFDL (Wiktionary).** If any extracted gold ships
  inside the published package/repo, it needs attribution + share-alike. It is
  currently kept out of git (in `playground/`); the package itself ships no
  Wiktionary data.
- The reference pattern files are LGPL/MIT/BSD — used only for *analysis and
  benchmarking*, never vendored into the shipped library. vankatum's algorithm is
  independent (rule-based), not derived from the `hyph-hy` patterns.
