import { defineConfig } from "vitest/config"

// `.mts` because the nearest package.json has no `"type": "module"`, and
// tsconfig paths resolve natively rather than through a plugin — both are
// what Vite 7 asks for.
//
// Unit tests only, for the pure decision functions in `lib/social/`:
// `scoreTweet()` and the reply guard. Both are places where a wrong answer is
// silent and expensive — a missed `critical`, or a card number reaching a
// public timeline — so they get real tests while the rest of the unit is
// verified by behaviour.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
})
