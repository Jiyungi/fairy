import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Property-based tests use fast-check. Convention for this project:
// each property test should run a minimum of 100 generated cases, e.g.
//   fc.assert(fc.property(...), { numRuns: 100 });
// (see design.md → Testing Strategy → Property-Based Testing).
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
