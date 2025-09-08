import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  moduleNameMapper: {
    '^@dispatch/messaging$': '<rootDir>/../../packages/messaging/src',
    '^@dispatch/webhooks-core$': '<rootDir>/../../packages/webhooks-core/src',
  },
};

export default config;

