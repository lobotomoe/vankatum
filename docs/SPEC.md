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
an orthographic requirement. Both minima count letters, per word, and must be
non-negative integers (anything else is rejected, not silently coerced).

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

### Ligature և before a vowel

`և` + vowel is pronounced /ev/ + vowel with the `վ` as the onset of the next
syllable (հե-տե-վել, Ե-րե-վան, ա-րե-վելք) — the k=1 rule applied to the
ligature's hidden `վ`. The syllable boundary therefore lies **inside** the
ligature, and the only correct break spells it out as `ե-վ`. That changes
letters, so the letter-preserving core emits **no break** there at all
(`հե-տևել`, `Ե-րևան`): the alternative `հե-տև-ել` would strand the `վ` at the
line end, the same error as `աշակ-երտ`. The Wiktionary gold confirms it — every
`ևV` word is hyphenated as `ե-վ`, never as `և-V`. The `ե-վ` break is delivered
where letters may change: the `.dic` artifact (libhyphen non-standard rules).
`և` before a consonant, or word-final, stays whole and breaks normally
(`թև-ճակ`, `բա-րև-ներ`, `տե-րև`).

## Intra-word marks

Armenian writes its intonation marks inside the word, on the stressed vowel:
`ինչո՞ւ`, `ո՛չ`, `ա՜խ`, and in classical spelling the elision apostrophe
`կ՚ուզեմ`. UAX #29 word segmentation keeps such a token as one word, so the
engine sees through the marks: `ՙ ՚ ՛ ՜ ՞ ՟` (U+0559, U+055A–U+055C, U+055E,
U+055F) are transparent to syllabification and stay attached to the letter they
follow (`ին-չո՞ւ`, `բուր-ժու-ա՞-կան`; the `ու` in `ո՞ւ` is still one nucleus).
The բութ `՝` (U+055D) and the full stop `։` are inter-word punctuation and split
words as usual.

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

**Appendix ք.** A word-final `ք` (the old plural / case suffix) is extrasyllabic:
it closes any coda regardless of sonority and does not count towards the
two-consonant limit — ոտք, գնացք, կռիչք, աշխատանք, ա-ռանցք-ներ — instead of
taking a schwa of its own (`*գը-նա-ցըք`). Empirical basis: in the Wiktionary gold
not one of the 17 non-falling `Cք` finals (ցք, ծք, չք, թք, ջք, …) writes a schwa,
against 84 that do not. A `ք` that is not the outermost consonant is an ordinary
stop (ոտ-քըս).

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
շտապել→`ըշ-տապել` (RA rule: «Զբ, զգ, շտ, սպ, սկ, ստ … ը-ն գրվում է բառի առաջին
բաղաձայնից առաջ»). This overrides the general `C1ə` placement word-initially. It
applies only to an **epenthetic** schwa followed by a syllable that begins with a
stop/affricate — a written `ը` (`շը…`) and a following vowel or sonorant
(սը-րահ) are untouched.

### Output: character-changing breaks — a separate mode (ADR)

A schwa break **writes `ը`** at line end + next-line start (հետաքըր-քըրվել) but the
word carries no `ը` when unbroken (հետաքրքրվել). So it changes characters — it is a
TeX-style **discretionary break** `\discretionary{pre}{post}{nobreak}`, not a plain
break point. The `ե-վ` split of `և` (above) is the second break of this kind.

**Decision:** character-changing breaks are an **additional output mode**, kept out
of the pure core.
- `syllabify` / `hyphenate` / `hyphenateText` stay strictly letter-preserving (the
  conservation invariant is sacred there). They emit only break *positions*; for
  clusters that would require epenthesis, and for `և` before a vowel, they simply
  produce no break (safe under-break).
- `syllabifyWithSchwa` is the orthographic mode: it returns syllables with the
  schwa **materialised** as `ը` (գը-րել), for syllabification, teaching and as the
  engine behind the character-changing rules.
- Downstream, the character-changing breaks ship only where the format can express
  them: libhyphen **non-standard hyphenation** in `hyph_hy_AM.dic` (schwa rules
  from `syllabifyWithSchwa`, plus the seven `և`+vowel → `ե-վ` rules). TeX/hypher
  patterns and soft hyphens cannot change letters and carry neither. A general
  discretionary-break API (`{ index, pre, post, nobreak }`) is future work.

The two modes share the same right-to-left syllabifier; only the rendering differs.

**Validation:** the ~418 schwa words in the Wiktionary gold set
(`playground/reference/wiktionary/`, harness `playground/harness/schwa-validate.mjs`)
are the empirical oracle. The engine reproduces **87.3%** of them exactly. The
residue is dominated by morphology the phonological pass cannot see — compound and
prefix boundaries (բեն-զա-լը-ցա-կա-յան, ան-հը-րա-ժեշտ, հա-տա-պը-տուղ),
reduplicated verbs (կըռ-կը-ռալ) and loanwords pronounced without a schwa
(տրամ-վայ, ֆլեյ-տա) — the morphological layer below is where those belong. The
gold is itself inconsistent on the word-initial sibilant rule (ըզ-գուշացում vs
սը-պաս), so the RA rule stands as written.

## Compounds & prefixes — phase 2 (optional)

Official rules permit **either** syllabic **or** morphological breaking: ան-ուրանալի *or* անու-րանալի; կաթն-ատամ *or* կաթնա-տամ. Phase 1 emits the syllabic break; a morphological exception layer can later prefer morpheme boundaries. The same layer would cover the surname / adjective suffixes `-յան`, `-յա`, `-յալ`, which the Wiktionary gold often divides morphologically (Պետ-րոս-յան) while the syllabic rule keeps `Cյ` together (Պետ-րո-սյան, like կյանք, բյուր, -ու-թյուն).

## Never break

- Letter abbreviations / acronyms: ԽՍՀՄ, ԱՊՀ, ԵԱՍԿ (RA rule: «Տառային և
  վանկատառային հապավումները չեն տողադարձվում»). Implemented as: an all-uppercase
  word of two or more letters is never broken (a capitalised word such as Երևան
  hyphenates normally). All-caps running text is therefore not hyphenated either —
  a wrong break is a visible error, a missed one is not.
- Inside `ու` or `և` (see §Ligature և before a vowel for the `ևV` consequence).

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
(above) would resolve those. The Western gold set (`test/western.gold.ts`) is
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
- UAX #29 Unicode Text Segmentation (word boundaries; Armenian marks are word-internal): https://www.unicode.org/reports/tr29/
