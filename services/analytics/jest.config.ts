import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  moduleNameMapper: {
    '^@dispatch/logger$': '<rootDir>/../../packages/logger/src',
    '^@dispatch/messaging$': '<rootDir>/../../packages/messaging/src',
  },
};

export default config;
