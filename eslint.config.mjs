import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

// Lints the shipped engine and its tests with full type information.
// tools/ and benchmarks/ are plain-JS build tooling, exercised by their own
// verify/holdout gates; playground/ and dist/ are not source.
export default tseslint.config(
  { ignores: ["dist/", "tools/", "benchmarks/", "playground/", "eslint.config.mjs"] },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // String spread is the engine's documented indexing contract: every
      // offset (Unit.start, breakPoints) is a codepoint index, i.e. the
      // indexing of [...word]. Armenian has no multi-codepoint graphemes the
      // engine could mishandle, and grapheme segmentation (Intl.Segmenter)
      // would change the contract, not make it safer. See docs/SPEC.md.
      "@typescript-eslint/no-misused-spread": [
        "error",
        { allow: [{ from: "lib", name: "string" }] },
      ],
    },
  },
);
