import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Only transform TS; leave JS (e.g., generated Prisma client) as-is to avoid ts-jest warnings
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  moduleNameMapper: {
    '^@dispatch/messaging$': '<rootDir>/../../packages/messaging/src',
  },
};

export default config;
