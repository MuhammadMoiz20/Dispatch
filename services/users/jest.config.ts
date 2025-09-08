import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  testTimeout: 120000,
  moduleNameMapper: {
    '^@dispatch/config$': '<rootDir>/../../packages/config/src',
    '^@dispatch/logger$': '<rootDir>/../../packages/logger/src',
    '^@dispatch/idempotency$': '<rootDir>/../../packages/idempotency/src',
  },
};

export default config;
