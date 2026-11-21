import js from "@eslint/js";
import lit from "eslint-plugin-lit";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  lit.configs["flat/recommended"],
  {
    rules: {
      // Home Assistant's objects are typed only as far as the card reads them
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
