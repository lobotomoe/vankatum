# vankatum

[![npm](https://img.shields.io/npm/v/vankatum.svg)](https://www.npmjs.com/package/vankatum)
[![license](https://img.shields.io/npm/l/vankatum.svg)](LICENSE)

Reliable Armenian (hy) hyphenation for the web and for print — one rule-based
engine, delivered to every major typesetting tool.

> Status: pre-1.0, published. The TypeScript engine and the generated pattern
> artifacts are complete and tested; the API may still change before 1.0.

## Why

Every existing Armenian hyphenator — TeX (`hyph-hy`), hypher, Hyphenopoly,
Hyphenator.js, Chromium, Android — wraps the **same** pattern set: 1,428 Liang
patterns that encode only two rules (break before a single consonant between
vowels, plus the `և` ligature). They have **zero** handling of consonant
clusters, the `ու` digraph, the `յ` glide, or the epenthetic schwa `ը`. In
practice they fail to hyphenate the most common real break type — clusters
(`կանգնել`, `արձան`, `աշխատանք`).

vankatum is a from-scratch **syllabification engine** built from the Armenian
hyphenation rules (RA `Տողադարձ`), not from those patterns. It hyphenates
clusters correctly, keeps `ու` / `յ`-glides / `և` intact, and inserts the
epenthetic `ը` where Armenian orthography requires it. The same engine emits
pattern files for the whole ecosystem.

## Install

```sh
npm install vankatum
```

ESM-only (Node 18+; from CommonJS use a dynamic `import()`), TypeScript types
included, zero runtime dependencies.

## Usage (JavaScript / TypeScript)

```ts
import { hyphenate, syllabify, hyphenateText, syllabifyWithSchwa } from "vankatum";

hyphenate("կանգնել");        // "կանգ-նել"
hyphenate("բուրժուական");    // "բուր-ժու-ա-կան"   (ու digraph kept whole)
syllabify("աշակերտ");        // ["ա", "շա", "կերտ"]

// Web delivery: insert soft hyphens (U+00AD) at every break in running text, so
// the browser only shows a hyphen when it wraps. Non-Armenian content (Latin,
// digits, punctuation) passes through untouched.
hyphenateText("Հայերենի տողադարձը");  // "Հայերենի տողադարձը" with U+00AD at each break

// Orthographic schwa form (adds ը — for syllabification/teaching, not the
// letter-preserving line-break path):
syllabifyWithSchwa("գրել");  // ["գը", "րել"]
```

### Options

`hyphenate`, `syllabify`, and `breakPoints` take `{ leftmin, rightmin, hyphen, variant }`:

| Option     | Default      | Meaning                                  |
|------------|--------------|------------------------------------------|
| `leftmin`  | `1`          | Minimum characters before the first break |
| `rightmin` | `2`          | Minimum characters after the last break   |
| `hyphen`   | `"-"`        | String inserted at each break (`hyphenate` only) |
| `variant`  | `"eastern"`  | Orthography: `"eastern"` (reformed) or `"western"` (classical) |

`hyphenateText` always uses the soft hyphen and accepts `{ leftmin, rightmin, variant }`.

For `hyphenate`, `syllabify`, and `hyphenateText`, letter conservation is an
enforced invariant: removing the inserted hyphens (or soft hyphens) always yields
the exact original text (verified by property-based fuzzing). `syllabifyWithSchwa`
is the deliberate exception — it inserts the orthographic schwa `ը`, so by design
it does not round-trip.

## Artifacts for typesetting tools

Each tagged release attaches pattern files generated from the engine. TeX Liang
patterns are the keystone; the others derive from them.

| File | Tool | How to use |
|---|---|---|
| `hyph-hy.tex` | TeX / LuaTeX / XeTeX / ConTeXt | Load the `\patterns{}` + `\hyphenation{}` via your language setup (e.g. register with `hyph-utf8` / `babel` / `polyglossia`). |
| `hyph_hy_AM.dic` | **Adobe InDesign**, LibreOffice, OpenOffice, Scribus, Firefox | A libhyphen/Hunspell dictionary. Drop it into the app's hyphenation-dictionary location for `hy`. InDesign: place under the Hunspell `Dictionaries/hy` folder and register it in `Info.plist`, then restart ([Adobe guide](https://helpx.adobe.com/indesign/kb/add_cs_dictionaries.html)). |
| `hyphenation.hy.json` | hypher and the JS ecosystem | `new Hypher(patterns)` — see below. |
| `hyph-hy.{pat,chr,hyp}.txt` | Chromium / Android (Minikin) | The `.hyb` input trio. Build with `mk_hyb_file.py hyph-hy.pat.txt hyph-hy.hyb`. |

The `.dic` is the only artifact that carries the epenthetic schwa (`գրել ->
գը-րել`), because schwa hyphenation changes characters and only libhyphen's
non-standard hyphenation can express it. It is verified to load and hyphenate in
real libhyphen.

### hypher (web)

```ts
import Hypher from "hypher";
// hyphenation.hy.json is attached to each GitHub release (not bundled in npm).
import patterns from "./hyphenation.hy.json" with { type: "json" };

const h = new Hypher(patterns);
h.hyphenate("կանգնել");  // ["կանգ", "նել"]
```

This is a drop-in upgrade for the existing `hyphenation.hy` package, which fails
every cluster word.

### Why a `.hyb` is not attached

Chromium's Minikin `.hyb` packs its trie into 32-bit words and cannot hold a
pattern set as diverse as vankatum's. The `.pat/.chr/.hyp` trio is shipped so a
Chromium/Android build can compile a `.hyb` from whatever pattern subset fits.

## Quality

On a gold set of cluster words, vankatum scores **14/14** where the shared
reference patterns (hypher, Hyphenopoly, and the rest) score **7/14** — they fail
every cluster. Reproduce it: `cd benchmarks && npm install && node compare.mjs`
(details in [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md)). Patterns generated
from the engine reproduce it **100%** on the training corpus and generalise to
unseen words at **98.5% recall / 99.6% precision** (measured on an 8.3k-word
held-out split; 95.6% of those words break exactly right — reproduce with
`node tools/emit/holdout.mjs`). Precision is prioritised — a wrong break is a
visible error, a missed break is invisible.

Schwa in the `.dic`: zero spurious `ը` across ~65k non-schwa words, and 100% of
single-schwa-break words covered (multi-break words fall back to the runtime
engine).

Numbers, corpora, and provenance: [`docs/SOURCES.md`](docs/SOURCES.md). The
linguistic contract: [`docs/SPEC.md`](docs/SPEC.md).

## How it works

The TypeScript engine is the single source of truth. A reproducible pipeline
labels a corpus (Armenian legal texts, the Hunspell lexicon, Wikipedia /
Wikisource, subtitle frequency lists, Wiktionary — ~84k words across six
registers) with the engine, learns Liang patterns with `patgen`, verifies that
the patterns reproduce the engine, and derives the downstream formats.

```
engine  ->  labelled corpus  ->  patgen  ->  hyph-hy.tex  ->  .dic / .json / trio
```

## Variants

Eastern Armenian (reformed orthography) is the default. Western Armenian /
classical (Mashtotsian) orthography is implemented from the same core — select it
with `{ variant: "western" }`:

```ts
hyphenate("Սարգսեան", { variant: "western" });  // "Սարգ-սեան"  (եա = one nucleus)
hyphenate("Սարգսեան");                            // "Սարգ-սե-ան" (eastern: եա is hiatus)
hyphenate("արիւն",    { variant: "western" });    // "ա-րիւն"
```

The variant only changes nucleus recognition (the classical `եա`/`եօ` glide-digraphs
read as one nucleus); the break rule and schwa engine are shared. The Western gold
set is hand-derived and provisional, pending native-speaker review. Western pattern
*artifacts* (the TeX/`.dic`/`.json` files) are not emitted yet — that needs a
classical-orthography training corpus. Details: [`docs/SPEC.md`](docs/SPEC.md).

## Development

```sh
npm install
npm test          # engine + property-based invariants
npm run typecheck # src + test
npm run lint
npm run build
./tools/emit/build-patterns.sh   # regenerate artifacts (needs pypatgen)
```

Cutting a release (npm via OIDC trusted publishing + provenance): see
[`docs/RELEASING.md`](docs/RELEASING.md).

## License

MIT.
