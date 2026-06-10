# Armenian hyphenation — rule specification

The linguistic contract `vankatum` implements. Source of truth for the algorithm and tests.
Authoritative references at the bottom.

## Scope

Two variants, selectable from one core:

- **eastern** — Eastern Armenian, reformed (Abeghyan) orthography. RA state standard.
- **western** — Western Armenian, classical (Mashtotsian) orthography.

`leftmin = 1`, `rightmin = 2`. Armenian hyphenation is syllable-based and imposes
no minimum-letter rule, so a single vowel may legitimately stand at a line end
(`ա-թոռ`, `ա-շա-կերտ`) — unlike English, which forbids it (see References).
Raising `leftmin` to 2 is a print house-style choice applied at render time, not
an orthographic requirement.

## Nuclei (syllable count = nucleus count)

A syllable carries exactly one nucleus. Nuclei:

- Vowels: `ա ե է ը ի ո օ`
- Digraph `ու` (= `ո`+`ւ`, U+0578 U+0582) — one vowel /u/, **never split**.
- Ligature `և` (U+0587, = `ե`+`ւ`, /jɛv/) — carries a vowel; treated as a nucleus with an inherent `v` coda.

Everything else in the Armenian block is a consonant. In reformed orthography `ւ` (yiwn) occurs **only** inside `ու`; a standalone `ւ` is a classical-mode signal.

## Core rule — consonants between two nuclei

For a gap of `k` consonants between two adjacent nuclei, the break is placed so the **next syllable's onset is exactly one consonant** (or zero). Equivalently:

| k | rule | break position | example |
|---|------|----------------|---------|
| 0 | hiatus | between the two vowels | բուր-ժու-**ա**-կան, լե-գե-ոն |
| 1 | the consonant moves to next line | before that consonant | ա-**շ**ակերտ, նկա-**ր**ել |
| ≥2 | **only the last** consonant moves; the rest stay | before the last consonant | կար-դալ, հաղ-թել, կանգ-նել, հարց-նել, Աստ-ղիկ, թարգ-ման, ա-ռանցք-ներ |

Geminates fall out of the k≥2 rule automatically: բեր-րի.

A word with one nucleus is a monosyllable and never breaks: մարդ, գիրք.

## Unwritten schwa (ը) epenthesis

The schwa /ə/ is pronounced but not written between many consonant clusters; it
appears in the **hyphenated** form (RA orthographic rule) but not when the word
is unbroken. Its position is fully predictable.

**Sources:** Dolatian 2023, *Isomorphism between orthography and underlying forms
in the syllabification of the Armenian schwa* (Phonological Data and Analysis
5(4), open access; + 2021 slides) — schwa placement = **right-to-left directional
syllabification** (Itô 1989 CVCC template). RA orthographic convention
(hy.wikipedia Տողադարձ) for how/where the `ը` is written at a break.

### Syllable template & sonority

Maximal syllable = **(C)(j)V(C)(C)**: onset ≤ 1 consonant (+ optional glide `յ`,
already a nucleus-merge), nucleus, coda ≤ 2 consonants **with falling sonority**.

Sonority, high → low: vowel > glide (`յ ւ`) > liquid (`ր ռ լ`) > nasal (`մ ն`) >
fricative (`վ զ ս ժ շ ղ խ հ ֆ`) > stop/affricate (`բ պ փ գ կ ք դ տ թ ձ ծ ց ջ ճ չ`).
A two-consonant coda `C1C2` (C1 nearer the nucleus) is legal iff
`sonority(C1) > sonority(C2)`.

### Algorithm (right-to-left)

Written vowels (incl. `ու`, `և`, yod nuclei) are nuclei. Parse right-to-left;
maximise onsets; any consonant that cannot attach as an onset (max 1) or inside a
legal falling-sonority coda (max 2) gets an epenthetic `ə` as its own nucleus.
(OT equivalent: `*CC ≫ Onset ≫ Dep`, with `Align-σ-Left`.) All examples below are
attested in Dolatian and reproducible by the procedure:

| context | rule | example |
|---|---|---|
| 2C `C1C2V` | `C1ə·C2V` | տնել→`tə.nel`, քրել→`pə.rel` |
| 3C `C1C2C3V` | `C1əC2·C3V` | կրբան→`kər.ban`, խնտալ→`xən.tal` |
| 4C, C2C3 = legal coda | `C1əC2C3·C4V` (1 schwa) | պնդրել→`pənd.rel` |
| 4C, C2C3 ≠ legal coda | `C1ə·C2əC3·C4V` (2 schwas) | մգրդել→`mə.gər.del` |
| medial 2C `VC1C2V` | `VC1·C2V` (no schwa) | բարգիլ→`bar.gil` |
| medial 3C, C1C2 = coda | `VC1C2·C3V` (no schwa) | անցրեվ→`ants.rev` |
| medial 3C, can't syllabify | `V·C1əC2·C3V` | պեդրվար→`pe.dər.var` |

### Word-initial sibilant + stop — exception

`#[ս զ շ ժ] + stop` puts `ə` **before** the sibilant (the sibilant syllabifies as
a coda, not an onset): սկիզբ→`ըս-կիզբ`, ստանալ→`ըս-տանալ`, զբոսանք→`ըզ-բոսանք`,
շտապել→`ըշ-տապել`. This overrides the general `C1ə` placement word-initially.

### Output: discretionary breaks — a separate mode (ADR)

A schwa break **writes `ը`** at line end + next-line start (հետաքըր-քըրվել) but the
word carries no `ը` when unbroken (հետաքրքրվել). So it changes characters — it is a
TeX-style **discretionary break** `\discretionary{pre}{post}{nobreak}`, not a plain
break point.

**Decision:** schwa is an **additional output mode**, kept out of the pure core.
- `syllabify` / `hyphenate` stay strictly letter-preserving (the conservation
  invariant is sacred there). They emit only break *positions*; for clusters that
  would require epenthesis they simply produce no break (safe under-break).
- A separate `hyphenateOrthographic` (name TBD) returns **discretionary breaks**
  `{ index, pre, post, nobreak }`, where the schwa is materialised in `pre`/`post`.
  This is what TeX patterns and justified print need; soft-hyphen/CSS consumers
  use the pure mode.

The two modes share the same right-to-left syllabifier; only the rendering differs.

**Validation:** the 415 schwa words in the Wiktionary gold set
(`playground/reference/wiktionary/`) are the empirical oracle — implement the
procedure, then confirm/adjust the sonority classes and the sibilant rule against
them before claiming correctness.

## Compounds & prefixes — phase 2 (optional)

Official rules permit **either** syllabic **or** morphological breaking: ան-ուրանալի *or* անու-րանալի; կաթն-ատամ *or* կաթնա-տամ. Phase 1 emits the syllabic break; a morphological exception layer can later prefer morpheme boundaries.

## Never break

- Acronyms / all-caps letter abbreviations: ԽՍՀՄ, ԱՊՀ.
- Inside `ու` or `և`.

## Western / classical orthography variant

Selectable with `{ variant: "western" }` (default `"eastern"`). It is the **same
core** — same break rule, same schwa sonority — over a different nucleus config
(`src/orthography.ts`). The investigation behind it found the tokenizer delta is
much smaller than it first appears:

- **Standalone `ւ` and `յ` are already consonants**, so the classical sequences
  `իւ` (ի + ւ-coda), `եւ` (ե + ւ-coda) and `ոյ` (ո + յ-coda) syllabify correctly
  with **no** special casing — they fall out of the shared core. E.g. classical
  `արիւն → ա-րիւն` (matching reformed `ա-րյուն`), `քոյր → քոյր` (monosyllable),
  `միութիւն → մի-ու-թիւն`. The `ու` digraph and `և` ligature are unchanged.
- **The one genuine delta** is the vowel+vowel glide-digraphs `եա` (/ja/, reformed
  `յա`) and `եօ` (/jo/, reformed `յո`). Western reads each as **one nucleus that
  never splits**; the Eastern engine reads the same two letters as hiatus. So
  `ատեան → ա-տեան` and `Սարգսեան → Սարգ-սեան` in Western, vs `ա-տե-ան` /
  `Սարգ-սե-ան` in Eastern. The `եա`/`եօ` digraph outranks the `յ`-glide
  (`յեա` = `յ`-onset + `եա`-nucleus, one syllable).

Single vowels are the same inventory in both (`ա ե է ը ի ո օ`); the Eastern/Western
consonant voicing shift does not change manner of articulation, so the schwa
sonority classes are shared unchanged.

**Caveat (provisional).** `եա`/`եօ` are merged whenever the two letters are
adjacent. Across a morpheme boundary they can be genuine hiatus (`/e.a/`), which
this purely-orthographic pass cannot detect; the optional morphological layer
(below) would resolve those. The Western gold set (`test/western.gold.ts`) is
hand-derived from the rules and **pending native-speaker review**. Reformed
↔ classical *transliteration* is out of scope: the engine hyphenates classical
text as written, it does not convert orthographies.

**Out of scope for now:** Western pattern *artifacts* (`hyph-hyw.tex` / `.dic` /
`.json`). They need a classical-orthography training corpus, which does not exist
yet; the whole `tools/emit/*` pipeline remains Eastern-only.

Sources for the classical↔reformed correspondences: en.wikipedia.org/wiki/Armenian_orthography_reform.

## References

- Տողադարձ — Armenian Wikipedia: https://hy.wikipedia.org/wiki/Տողադարձ
- «Տողադարձի մասին» կանոնները (RA Minister of Education order): http://www.irtek.am/views/act.aspx?aid=19824
- W3C Armenian orthography notes: https://r12a.github.io/scripts/armn/hy.html
