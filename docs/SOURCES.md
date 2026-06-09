# Sources & corpora

Provenance ledger for everything `vankatum` has analysed, taken as reference, or
evaluated against. The actual files live under `playground/reference/` which is
**gitignored** — so this document (plus `scripts/fetch-references.sh`) is how we
avoid losing track of them. Re-download everything with:

```sh
./scripts/fetch-references.sh
```

Last verified: 2026-06-09.

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
| **ARLIS — Armenian Legal Information System** | Official RA legislation (~208k acts), modern Eastern Armenian formal prose. **Raw text wordlist source** (no hyphenation — used for vocabulary coverage in pattern generation + as a real-text regression corpus, NOT an oracle). | RA government works (public legal acts) | `https://www.arlis.am/DocumentView.aspx?DocID=<id>` — server-rendered HTML, scrapeable via plain `curl` (strip tags → `[Ա-Ֆա-ֆ]+` tokens). One act ≈ 1k+ unique words. | harvester `tools/corpus/fetch-arlis.mjs`; raw → `playground/corpus/arlis/` |

Additional **wordlist coverage** sources (different registers → better pattern generalisation; words only, no hyphenation):

| Source | Register | License | URL | Harvester |
|---|---|---|---|---|
| **Hunspell hy_AM (martakert/hyspell)** | Curated spell-check lexicon (~63k root words) — the single biggest vocabulary source | GPL/LGPL/MPL | `https://raw.githubusercontent.com/martakert/hyspell/master/hy_AM.dic` (first line = count; `root/AFFIXFLAGS`) | `tools/corpus/fetch-wordlists.mjs` |
| **Wikipedia (hy)** | Encyclopedic, all domains | CC BY-SA | `https://hy.wikipedia.org/w/api.php` (`generator=random&prop=extracts&explaintext`) | `tools/corpus/fetch-wiki.mjs` |
| **Wikisource (hy)** | Literary / classical | CC BY-SA / PD | `https://hy.wikisource.org/w/api.php` (same API) | `tools/corpus/fetch-wiki.mjs` |
| **FrequencyWords (hermitdave)** | Spoken/subtitle (OpenSubtitles) | CC-by-sa-4.0 | `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/hy/hy_full.txt` (`word count`) | `tools/corpus/fetch-wordlists.mjs` |

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

## F. Artifact emitter targets (release pipeline)

vankatum's engine is the single source of truth; at release we emit pattern
files/plugins for the popular hyphenation-consuming tools. **TeX Liang patterns
are the keystone interchange format** — every other target is generated from them
by existing, battle-tested converters. The engine labels a corpus wordlist →
`patgen` learns patterns → downstream formats derive. All formats verified
2026-06-09.

| Target | Format / file | Consumed by | How it's produced | Reference |
|---|---|---|---|---|
| **TeX / LaTeX** | `hyph-hy.tex` (`\patterns{…}` + `\hyphenation{…}` exceptions) | TeX, LuaTeX, XeTeX, ConTeXt; upstream of all others | `patgen` / `pypatgen` over engine-labelled wordlist | `https://ctan.org/pkg/patgen` · `https://github.com/pgmmpk/pypatgen` |
| **Hunspell / libhyphen** | `hyph_hy_AM.dic` (first line = `UTF-8`, then patterns) | **Adobe InDesign** (Hunspell dict provider), LibreOffice, OpenOffice, Scribus, Firefox | derive from TeX patterns (hyph-utf8 `substrings` route) | `https://github.com/hunspell/hyphen` · `https://helpx.adobe.com/indesign/kb/add_cs_dictionaries.html` |
| **Chromium / Minikin** | `hyph-hy.hyb` (packed trie binary; alphabet + suffix-compressed trie) | Chrome, Edge, Chromium, Android | `mk_hyb_file.py` (AOSP Minikin, Apache-2.0, vendorable) over TeX patterns | `https://android.googlesource.com/platform/frameworks/minikin/+/master/doc/hyb_file_format.md` · `https://chromium.googlesource.com/chromium/src/+/main/third_party/hyphenation-patterns/build-hyb.sh` |
| **JS web ecosystem** | `hyphenation.hy.json` (`{id, leftmin, rightmin, patterns, exceptions}`) | hypher, Hyphenator.js, retext, 11ty, Prince-style toolchains | transform TeX patterns → hypher trie object | `https://github.com/bramstein/hypher` |
| **Runtime (no file)** | `hyphenateText()` soft-hyphen — already shipped in the TS package | any JS/web app directly | the engine itself | `src/text.ts` |

**Fidelity is measured, not assumed.** Liang patterns are a lossy compression of
the engine. The pipeline diffs emitted-pattern output against the engine over the
corpus and publishes the agreement %; residual mismatches go into the TeX
`\hyphenation{}` exception list for exact reproduction. The TS engine remains the
authoritative reference for anyone who can run it.

**Schwa (ը) hyphenation — `.dic` only.** Liang patterns are letter-preserving,
so the epenthetic ը that Armenian writes at a break inside a vowelless cluster
(`գրել → գը-րել`, `սկսել → սըկ-սել`) can only be expressed by libhyphen's
**non-standard hyphenation** (character-changing breaks). `tools/emit/schwa-dic.mjs`
appends these to `hyph_hy_AM.dic` (verified in real libhyphen via pyphen). Rules
are **whole-word anchored** (`.word.`) at priority 9 — local/substring rules
interfere across words and can't be made mutually exclusive without patgen (which
has no non-standard mode); whole-word anchoring collides on a word with two schwa
breaks, so only single-schwa-break words are emitted. Result over the 84k corpus:
**0 spurious ը on 64,696 non-schwa words; 100% of 18,155 single-break schwa words
covered; 1,354 multi-break words (6.9%) defer to the runtime engine** (safe
under-hyphenation). Schwa correctness is bounded by the engine's schwa syllabifier
(~86.6% vs gold). `.tex` / `.json` / `.hyb` carry no schwa.

**.hyb is best-effort.** Chromium's Minikin trie packs each node into a 32-bit
word, so it cannot hold a pattern set as diverse as the one our ~84k-word corpus
produces (even ~7.5k patterns overflow it — the limit is distinct-pattern
diversity, not raw count). The release therefore skips `.hyb` and instead always
ships the **Minikin trio** (`hyph-hy.pat.txt` / `.chr.txt` / `.hyp.txt`) so a
Chrome/Android builder can run `mk_hyb_file.py` against whatever corpus subset
fits their build. The trio + `mk_hyb_file.py` are vendored under `tools/emit/`.

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
- **`mk_hyb_file.py`** (AOSP Minikin) is vendored at `tools/emit/vendor/` under
  **Apache-2.0** (license header preserved) — it converts our generated patterns
  to the Chromium `.hyb` binary; it is a build tool, not shipped in the package.
- **`corpus/wordlist.txt`** (committed) holds only bare lowercase words (ARLIS +
  Wiktionary headwords) — facts, no hyphenations or act text — so it is safe to
  commit and is the reproducible input for CI pattern builds. Generated artifacts
  (`artifacts/`) are gitignored release outputs.
