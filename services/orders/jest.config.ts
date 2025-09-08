import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  moduleNameMapper: {
    '^@dispatch/config$': '<rootDir>/../../packages/config/src',
    '^@dispatch/logger$': '<rootDir>/../../packages/logger/src',
    '^@dispatch/messaging$': '<rootDir>/../../packages/messaging/src',
    '^@dispatch/idempotency$': '<rootDir>/../../packages/idempotency/src',
    '^@dispatch/webhooks-core$': '<rootDir>/../../packages/webhooks-core/src',
    '^@dispatch/workflows$': '<rootDir>/../../packages/workflows/src',
    // Avoid mapping generic relative names like './storage' to prevent conflicts with third-party packages
  },
};

export default config;

