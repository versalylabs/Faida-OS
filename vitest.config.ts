import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the pure logic (no database, no network): M-Pesa reading, capture splitting, bills,
// notification planning, the daily planner and time-zone maths. Run with `npm test`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Every test runs as if the server were in UTC (like Vercel), so time-zone bugs show up here.
    env: { TZ: "UTC", APP_TIME_ZONE: "Africa/Nairobi" },
  },
});
