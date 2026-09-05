/**
 * Post-pack smoke test. ci.yml installs the packed tarball into a scratch
 * project and runs this file from there, so it exercises exactly what npm
 * consumers get: the published `exports` map, the `files` list, and the runtime
 * floor declared in `engines` (it runs on every supported Node line).
 */
import assert from "node:assert/strict";
import { hyphenate, hyphenateText, syllabifyWithSchwa, SOFT_HYPHEN } from "vankatum";

assert.equal(hyphenate("կանգնել"), "կանգ-նել");
assert.equal(hyphenate("բուրժուական"), "բուր-ժու-ա-կան");
assert.equal(hyphenate("Սարգսեան", { variant: "western" }), "Սարգ-սեան");
assert.equal(hyphenate("ԵԱՀԿ"), "ԵԱՀԿ");
assert.equal(hyphenate("Երևան"), "Ե-րևան");
assert.equal(hyphenateText("Ինչո՞ւ ես"), `Ին${SOFT_HYPHEN}չո՞ւ ես`);
assert.deepEqual(syllabifyWithSchwa("գրել"), ["գը", "րել"]);

console.log(`vankatum smoke ok on node ${process.version}`);
