/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/test/integration/**/*.test.ts"],
  globalSetup: "<rootDir>/test/setup/global-setup.ts",
  // 20s was tuned for local Postgres+Redis. Bumped for headroom when running
  // against remote services (e.g. Supabase/Upstash) — chained round trips
  // (sign up two users, create a circle, approve a membership) add up over
  // real network latency. Note: if SOS/location tests specifically hang near
  // whatever timeout is set here, check REDIS_URL is reachable first — SOS
  // trigger enqueues a BullMQ job, and a dead Redis manifests as a timeout
  // here, not a clear connection error.
  testTimeout: 45000,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
