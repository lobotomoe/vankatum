# vankatum

[![npm](https://img.shields.io/npm/v/vankatum.svg)](https://www.npmjs.com/package/vankatum)
[![license](https://img.shields.io/npm/l/vankatum.svg)](LICENSE)

Armenian hyphenation that gets consonant clusters right, for websites, LibreOffice
and LaTeX.

| Word                 | Existing patterns (via hypher) | vankatum       |
| -------------------- | ------------------------------ | -------------- |
| կանգնել              | կանգնել (no break)             | կանգ-նել       |
| աշխատանք             | աշխա-տանք                      | աշ-խա-տանք     |
| բուրժուական          | բուրժուա-կան                   | բուր-ժու-ա-կան |
| Երևան                | Երև-ան (wrong)                 | Ե-րևան         |
| գրել, in LibreOffice | գրել (no break)                | գը-րել         |

Every Armenian hyphenator in use today (TeX, hypher, Hyphenopoly, Chromium,
Android) runs on the same 1,428 patterns, which know two rules: break before a
single consonant between vowels, and the `և` ligature. They never break inside a
consonant cluster, the most common case in real text. vankatum is a
syllabification engine built from the rules of the RA Ministry of Education
(order N 22-Ն, 2003); every file below is generated from it and tested in the
program it is meant for.

## Pick your tool

| You use                            | What to get                                                                                                            | Status                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| A website or web app               | the npm package, or `hyphenation.hy.json` for hypher                                                                   | tested in Chromium, Firefox, WebKit on macOS             |
| LibreOffice Writer                 | [`vankatum-hy.oxt`](https://github.com/lobotomoe/vankatum/releases/latest/download/vankatum-hy.oxt)                    | tested in LibreOffice 26.8                               |
| LaTeX (LuaLaTeX)                   | [`hyph-hy.tex`](https://github.com/lobotomoe/vankatum/releases/latest/download/hyph-hy.tex)                            | tested with babel                                        |
| Adobe InDesign (macOS)             | the install script + [`hyph_hy_AM.dic`](https://github.com/lobotomoe/vankatum/releases/latest/download/hyph_hy_AM.dic) | **not yet tested in InDesign**                           |
| Microsoft Word, Pages, Google Docs | nothing yet                                                                                                            | these apps do not accept a custom hyphenation dictionary |

All files are attached to every [release](https://github.com/lobotomoe/vankatum/releases/latest).

### Website

```sh
npm install vankatum
```

```ts
import { hyphenateText } from "vankatum";

element.textContent = hyphenateText("Հայերենի տողադարձը");
```

`hyphenateText` puts invisible soft hyphens (U+00AD) at every allowed break; the
browser shows a hyphen only where a line actually wraps. Latin text, digits and
punctuation pass through unchanged. Do this once on the server or at build time
rather than on every render. Leave CSS `hyphens` at its default (`manual`):
browsers' own Armenian hyphenation is the old pattern set or none at all.

If you already use [hypher](https://github.com/bramstein/hypher), swap in our
patterns. This is a drop-in replacement for the `hyphenation.hy` package:

```ts
import Hypher from "hypher";
import patterns from "./hyphenation.hy.json" with { type: "json" };

new Hypher(patterns).hyphenate("կանգնել"); // ["կանգ", "նել"]
```

### LibreOffice

1. Download [`vankatum-hy.oxt`](https://github.com/lobotomoe/vankatum/releases/latest/download/vankatum-hy.oxt)
   and open it (double click, or Tools > Extensions > Add). Restart LibreOffice.
2. Mark the text as Armenian: Format > Character > Font > Language > Armenian.
3. Turn hyphenation on for the paragraphs: Format > Paragraph > Text Flow >
   Hyphenation > Automatically.

This is the only place the written `ը` appears at a break (`գը-րել`,
`ըս-կիզբ`), as the spelling rules require. Two known limits: a word with `և`
before a vowel is not broken at that point (`Երևան` cannot become `Ե-րե-վան`,
because LibreOffice cannot draw a break that changes the letters on the next
line), and since LibreOffice lowercases words before hyphenating, a name like
`Ստեփան` can come out as `Ըս-տեփան` where the rules want `Ստե-փան`.

### LaTeX

With LuaLaTeX and babel. Save
[`hyph-hy.tex`](https://github.com/lobotomoe/vankatum/releases/latest/download/hyph-hy.tex)
next to your document as `hyph-hy-vankatum.tex` (a different name, so TeX does
not pick up the old `hyph-hy.tex` from your TeX distribution), then:

```latex
\documentclass{article}
\usepackage[armenian]{babel}
\babelprovide[import, hyphenrules=+]{armenian}
\begingroup
  \language=\csname l@armenian\endcsname
  \input hyph-hy-vankatum.tex
\endgroup
\babelhyphenmins[armenian]{1}{2}
\babelfont{rm}{Noto Sans Armenian} % or any installed font with Armenian letters
\begin{document}
կանգնել աշխատանք բուրժուական
\end{document}
```

`\showhyphens{կանգնել}` in the document prints the breaks to the log
(`կանգ-նել`). The TeX patterns keep letters as they are, so there is no `ը` at
the break. XeLaTeX and pdfLaTeX load patterns only when the format is built, so
the recipe above does not apply to them.

### Adobe InDesign (macOS)

InDesign ships no Armenian hyphenation. Its Hunspell component can load one, and
the script below registers ours with it. **We have not yet been able to try
this in a running InDesign**, so treat it as an experiment and tell us how it
goes.

1. Quit InDesign.
2. In Terminal:
   ```sh
   curl -fsSLO https://raw.githubusercontent.com/lobotomoe/vankatum/main/install/indesign/macos.sh
   sudo bash macos.sh
   ```
   It downloads the latest `hyph_hy_AM.dic`, adds Armenian to the Hunspell
   component of the newest InDesign in `/Applications` and keeps a backup of the
   file it changes. `sudo bash macos.sh --uninstall` puts everything back.
3. Start InDesign, set Character > Language to Armenian and the hyphenation
   vendor to Hunspell (Preferences > Dictionary).

An InDesign update replaces its own files, so run the script again after one.

### Other programs

`hyph_hy_AM.dic` is a standard libhyphen dictionary; programs built on
libhyphen (Scribus, OpenOffice) should accept it, but we have not tested them.
For Chromium and Android builds, `hyph-hy.{pat,chr,hyp}.txt` are the inputs of
Minikin's `mk_hyb_file.py`; the full pattern set does not fit Minikin's packed
trie, so a `.hyb` is not shipped.

## JavaScript API

ESM only, Node 18+, TypeScript types included, no runtime dependencies. From
CommonJS, `require("vankatum")` works on Node 20.19+ / 22.12+; older Node needs
`import()`.

```ts
import {
  hyphenate,
  syllabify,
  hyphenateText,
  syllabifyWithSchwa,
} from "vankatum";

hyphenate("կանգնել"); // "կանգ-նել"
hyphenate("բուրժուական"); // "բուր-ժու-ա-կան"  (ու kept whole)
syllabify("աշակերտ"); // ["ա", "շա", "կերտ"]
hyphenateText("Ինչո՞ւ ես"); // soft hyphen in Ին|չո՞ւ, the mark stays on its vowel
syllabifyWithSchwa("գրել"); // ["գը", "րել"]  (spelling form, adds ը)
```

`hyphenate`, `syllabify` and `breakPoints` take `{ leftmin, rightmin, hyphen, variant }`:

| Option     | Default     | Meaning                                                    |
| ---------- | ----------- | ---------------------------------------------------------- |
| `leftmin`  | `1`         | Minimum letters before the first break                     |
| `rightmin` | `2`         | Minimum letters after the last break                       |
| `hyphen`   | `"-"`       | String inserted at each break (`hyphenate` only)           |
| `variant`  | `"eastern"` | `"eastern"` (reformed spelling) or `"western"` (classical) |

`hyphenateText` always uses the soft hyphen and takes `{ leftmin, rightmin, variant }`.
Invalid options throw a `RangeError`. Removing the inserted hyphens always gives
back the original text (checked by property-based tests); `syllabifyWithSchwa` is
the one function that adds letters, by design.

## What the engine does

- **Consonant clusters**: only the last consonant moves to the next line
  (`կանգ-նել`, `հարց-նել`, `ա-ռանցք-ներ`).
- **`ու`, `յ`-glides and `և`** are single sounds and never split (`կա-տու`,
  `ա-ծան-ցյալ`, `բա-րև-ներ`).
- **`և` before a vowel**: the syllable boundary falls inside the ligature
  (`Ե-րե-վան`), which no letter-preserving break can express, so there is no
  break there (`Ե-րևան`, never `Ե-րև-ան`).
- **Marks** `՞ ՛ ՜ ՚` inside a word are skipped over and stay on their vowel.
- **Abbreviations** in capitals (`ԵԱՀԿ`, `ՆԱՍԱ`) are never hyphenated.
- **The epenthetic `ը`** is predicted by right-to-left syllabification
  (`Հըն-դըս-տան`, `ըս-կիզբ`, `գը-նացք`). Proper names keep an initial `ստ`,
  `սպ`, `շտ` cluster (`Ստե-փան`), as the rules require.

## Quality

- On a gold set of cluster words vankatum gets **14/14**; the patterns everyone
  else uses get **7/14**. Reproduce with `cd benchmarks && npm install && node compare.mjs`
  ([details](docs/BENCHMARKS.md)).
- Against Wiktionary's hand-made syllable divisions the engine matches **96.5%**
  of 1,789 words; most of the rest are morphological divisions (`Պետ-րոս-յան`)
  and the `ե-վ` split of `և`, which it deliberately leaves out.
- The generated patterns reproduce the engine on all ~87k corpus words, and on
  unseen words reach **98.5% recall, 99.6% precision**
  (`node tools/emit/holdout.mjs`). A wrong break is a visible error and a missed
  one is not, so precision comes first.
- Every build runs each file through the program that will read it: the `.dic`
  through libhyphen (the library inside LibreOffice), the `.tex` through LuaTeX,
  the `.json` through hypher. The build fails unless all three reproduce the
  engine on the whole corpus.

Corpora and numbers: [`docs/SOURCES.md`](docs/SOURCES.md). The rules as
implemented: [`docs/SPEC.md`](docs/SPEC.md).

## Western Armenian

Classical (Mashtotsian) spelling is supported by the engine with
`{ variant: "western" }`:

```ts
hyphenate("Սարգսեան", { variant: "western" }); // "Սարգ-սեան"  (եա is one sound)
hyphenate("Սարգսեան"); // "Սարգ-սե-ան"
```

The Western test set is provisional until a native speaker reviews it, and there
are no Western files for LibreOffice or LaTeX yet: those need a corpus in
classical spelling.

## Development

```sh
npm install
npm test          # engine + property-based invariants
npm run typecheck
npm run lint
npm run build
npm run check:pack

# regenerate the files for other programs (needs pypatgen, perl, zip, a C compiler, luatex)
python3 -m venv playground/.venv && playground/.venv/bin/pip install pypatgen
PYPATGEN=playground/.venv/bin/pypatgen ./tools/emit/build-patterns.sh
```

Pipeline: the engine labels a corpus (legal texts, the Hunspell word list,
Wikipedia and Wikisource, subtitles, Wiktionary; ~87k words), patgen learns
Liang patterns from it, and the other formats are derived from those patterns.
Releasing: [`docs/RELEASING.md`](docs/RELEASING.md).

## License

MIT.
