import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Disable overly strict rules that flag common React patterns
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party packages
    "packages/**",
    // Generated docs assets
    "packages/iztro/docs/**",
    // Scripts (development utilities)
    "scripts/**",
    // Test utilities
    "test-patterns.ts",
    // Temp folder (moved legacy code)
    "temp/**",
  ]),
]);

export default eslintConfig;
