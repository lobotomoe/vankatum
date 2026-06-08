# Armenian hyphenation — rule specification

The linguistic contract `vankatum` implements. Source of truth for the algorithm and tests.
Authoritative references at the bottom.

## Scope

Two variants, selectable from one core:

- **eastern** — Eastern Armenian, reformed (Abeghyan) orthography. RA state standard.
- **western** — Western Armenian, classical (Mashtotsian) orthography.

`leftmin = 1`, `rightmin = 2` (a single vowel may be left at line end — Armenian-specific, unlike English).

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

## Unwritten schwa (ը) — phase 2

The schwa /ə/ is pronounced but not written between many consonant clusters. When such a word is broken, `ը` **is written** at the line end and the next line start; when unbroken it is not written:

- հե-տաքրքրվել (unbroken) → հետաքըր-քըրվել (broken)
- կըն-քահայր
- initial clusters `զբ զգ շտ սպ սկ ստ …`: `ը` precedes the first consonant — ըզ-բոսանք, ըշ-տապել, ըս-կիզբ, ըս-տանալ

Phase 1 does **not** insert schwa: words whose only break would require schwa epenthesis are left unbroken (safe under-break, never a wrong break).

## Compounds & prefixes — phase 2 (optional)

Official rules permit **either** syllabic **or** morphological breaking: ան-ուրանալի *or* անու-րանալի; կաթն-ատամ *or* կաթնա-տամ. Phase 1 emits the syllabic break; a morphological exception layer can later prefer morpheme boundaries.

## Never break

- Acronyms / all-caps letter abbreviations: ԽՍՀՄ, ԱՊՀ.
- Inside `ու` or `և`.

## Western / classical deltas — phase 2

`ւ` is an independent letter; classical diphthongs (`եւ իւ ոյ ...`) and the `ու` digraph need variant-specific nucleus handling. Implemented as a separate variant config over the same engine.

## References

- Տողադարձ — Armenian Wikipedia: https://hy.wikipedia.org/wiki/Տողադարձ
- «Տողադարձի մասin» կանոնները (RA Minister of Education order): http://www.irtek.am/views/act.aspx?aid=19824
- W3C Armenian orthography notes: https://r12a.github.io/scripts/armn/hy.html
