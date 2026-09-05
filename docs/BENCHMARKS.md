# Benchmarks

Head-to-head correctness against the existing Armenian hyphenation engines.

## Why one comparison covers the ecosystem

`hypher` (with `hyphenation.hy`) and `hyphenopoly` both wrap the **same** shared
`hyph-hy` Liang pattern set — the one that also ships in TeX, Chromium, Android,
and LibreOffice. They produce byte-identical output. So comparing against these
two stands in for every existing tool. See [`SOURCES.md`](SOURCES.md) §A.

## Reproduce

```sh
npm run build                      # build the engine (repo root)
cd benchmarks && npm install
node compare.mjs
```

The gold set (`benchmarks/gold.json`) is 14 words, one block per rule category,
with expected hyphenations derived from the documented RA `Տողադարձ` rules.

## Result

```
word        expected      vankatum      hypher        hyphenopoly
------------------------------------------------------------------
կատու       կա-տու        OK            OK            OK            single consonant
սովորել     սո-վո-րել     OK            OK            OK
աթոռ        ա-թոռ         OK            OK            OK
հազիվ       հա-զիվ        OK            OK            OK
քաղաքական   քա-ղա-քա-կան  OK            OK            OK
արձան       ար-ձան        OK            X  արձան      X  արձան       consonant cluster
ընկեր       ըն-կեր        OK            X  ընկեր      X  ընկեր
հաստատ      հաս-տատ       OK            X  հաստատ     X  հաստատ
որդի        որ-դի         OK            X  որդի       X  որդի
մարդիկ      մար-դիկ       OK            X  մարդիկ     X  մարդիկ
աշխատանք    աշ-խա-տանք    OK            X  աշխա-տանք  X  աշխա-տանք   (wrong split)
ուսանող     ու-սա-նող     OK            X  ուսա-նող   X  ուսա-նող    (wrong split)
մարդ        մարդ          OK            OK            OK            monosyllable
գիրք        գիրք          OK            OK            OK
------------------------------------------------------------------
vankatum:    14/14
hypher:       7/14
hyphenopoly:  7/14
```

The reference engines pass every single-consonant and monosyllable case and
**fail every consonant-cluster case** — either leaving the word unbroken
(`արձան`) or breaking it at the wrong point (`աշխա-տանք` instead of `աշ-խա-տանք`).
Clusters are the most common real break type, so this is a systematic gap, not an
edge case.

## Against human-curated syllabifications

`playground/harness/benchmark.mjs` compares the engine with Wiktionary's
hyphenation data (2,204 words): **96.5%** exact on the 1,789 words in the
letter-preserving scope; the schwa mode reproduces **87.3%** of the 418 schwa
words. What remains is morphology (`Պետ-րոս-յան`, compound boundaries) and the
`ե-վ` split of `և` that only the `.dic` can express. Breakdown and the rule
questions this data settled: [`SOURCES.md`](SOURCES.md) §B.

## Generated-pattern quality

The pattern files vankatum emits reproduce the engine **100%** on the training
corpus (87,452 words) and generalise to unseen words at **98.5% recall / 99.6%
precision** — held-out on an 8,687-word split selected by content hash, never
seen in training, with 95.6% of those words broken exactly right. Reproduce with
`node tools/emit/holdout.mjs` (needs pypatgen). The `.dic` non-standard rules
add **0 spurious `ը`** across ~66k non-schwa words while covering 100% of
single-schwa-break words, plus the `և → ե-վ` split before vowels. Methodology
and corpora: [`SOURCES.md`](SOURCES.md).
