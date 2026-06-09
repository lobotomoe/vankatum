/**
 * Western Armenian / classical (Mashtotsian) orthography — provisional gold set.
 *
 * STATUS: provisional. Each expected hyphenation is derived by hand from the
 * documented syllabification rules (docs/SPEC.md) applied to classical
 * orthography, NOT read back from the engine. It is the independent oracle the
 * engine is checked against. Pending review by a native Western Armenian reader.
 *
 * Provenance of the classical spellings & the classical→reformed correspondences
 * (եա→յա /ja/, եօ→յո /jo/, ոյ→ույ /uj/, իւ→յու /ju/, standalone ւ→վ /v/):
 *   en.wikipedia.org/wiki/Armenian_orthography_reform
 *
 * Why these words: they exercise every Western-relevant path —
 *   - standalone ւ as a /v/ consonant (արիւն, աւետարան, գիւղ): handled by the
 *     shared core because ւ is already a consonant; never special-cased.
 *   - the ո+ւ = /u/ digraph alongside classical ւ (միութիւն, ազատութիւն).
 *   - ոյ = ո + յ-coda (քոյր, լոյս): one nucleus, never split — shared core.
 *   - the genuine Western delta: the εα / εօ glide-digraphs read as ONE nucleus
 *     (կեանք, ատեան, Սարգսեան, եօթ) where the Eastern engine would wrongly split
 *     them as hiatus.
 *   - shared-core regression: cluster / monosyllable / hiatus words that must
 *     hyphenate identically to Eastern (կարդալ, աշխատանք, մարդ, ուսանող).
 */

/** [classical word, expected Western hyphenation, gloss]. */
export const WESTERN_GOLD: ReadonlyArray<readonly [string, string, string]> = [
  // standalone ւ /v/ — falls out of the shared core (ւ is a consonant)
  ["արիւն", "ա-րիւն", "blood (reformed արյուն)"],
  ["արիւնոտ", "ա-րիւ-նոտ", "bloody"],
  ["գիւղ", "գիւղ", "village — monosyllable (reformed գյուղ)"],
  ["գիւղական", "գիւ-ղա-կան", "rural"],
  ["աւետարան", "ա-ւե-տա-րան", "gospel (reformed ավետարան)"],
  ["եւ", "եւ", "and — monosyllable, ե nucleus + ւ coda (reformed և)"],
  ["հայր", "հայր", "father — monosyllable"],

  // ո+ւ digraph /u/ together with classical ւ and the -ութիւն suffix
  ["տուն", "տուն", "house — monosyllable (ու digraph)"],
  ["գարուն", "գա-րուն", "spring"],
  ["ուսանող", "ու-սա-նող", "student"],
  ["միութիւն", "մի-ու-թիւն", "union (reformed միություն)"],
  ["ազատութիւն", "ա-զա-տու-թիւն", "freedom (reformed ազատություն)"],
  ["խաղաղութիւն", "խա-ղա-ղու-թիւն", "peace"],
  ["հանրապետութիւն", "հան-րա-պե-տու-թիւն", "republic"],
  ["ճշմարտութիւն", "ճշմար-տու-թիւն", "truth — heavy initial cluster"],

  // ոյ = ո + յ-coda /uj/ — one nucleus, never split (shared core)
  ["քոյր", "քոյր", "sister — monosyllable (reformed քույր)"],
  ["լոյս", "լոյս", "light — monosyllable (reformed լույս)"],
  ["քոյրեր", "քոյ-րեր", "sisters"],

  // the Western delta: εα / εօ glide-digraphs = ONE nucleus
  ["կեանք", "կեանք", "life — monosyllable, εα intact (reformed կյանք)"],
  ["ատեան", "ա-տեան", "tribunal (reformed ատյան)"],
  ["Սարգսեան", "Սարգ-սեան", "Sargsyan — surname, k=3 cluster + εα"],
  ["Պետրոսեան", "Պետ-րո-սեան", "Petrosyan — surname"],
  ["եօթ", "եօթ", "seven — monosyllable, εօ intact (reformed յոթ)"],
  ["եօթը", "եօ-թը", "the seven (reformed յոթը)"],

  // shared-core regression: must match Eastern exactly (no Western delta present)
  ["կարդալ", "կար-դալ", "to read — cluster, last consonant moves"],
  ["աշխատանք", "աշ-խա-տանք", "work"],
  ["բարեկամ", "բա-րե-կամ", "friend — single intervocalic consonants"],
  ["որդի", "որ-դի", "son"],
  ["ընկեր", "ըն-կեր", "friend/comrade"],
  ["մարդ", "մարդ", "man — monosyllable"],
  ["գիրք", "գիրք", "book — monosyllable"],
];
