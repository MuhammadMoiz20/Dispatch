module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: [
    'dist',
    'node_modules',
    '**/generated/**',
    '**/src/generated/**',
    '**/*.d.ts',
    '**/test/**',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    'no-empty': ['error', { allowEmptyCatch: true }],
    '@typescript-eslint/no-var-requires': 'off',
  },
};
