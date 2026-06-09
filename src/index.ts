export { hyphenate, syllabify, breakPoints, type HyphenateOptions } from "./hyphenate.js";
export { hyphenateText, SOFT_HYPHEN, type TextOptions } from "./text.js";
export { tokenize, isArmenianLetter, type Unit, type UnitKind } from "./alphabet.js";
export { syllabifyWithSchwa } from "./syllabify-schwa.js";
export {
  EASTERN,
  WESTERN,
  resolveOrthography,
  type Variant,
  type Orthography,
} from "./orthography.js";
