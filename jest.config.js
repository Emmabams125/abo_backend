/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/test/integration/**/*.test.ts"],
  globalSetup: "<rootDir>/test/setup/global-setup.ts",
  testTimeout: 20000,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
