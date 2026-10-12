export default [
  {
    files: ['src/**/*.js', 'test/**/*.js', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        URL: 'readonly'
      }
    },
    rules: {
      'no-constant-condition': 'error',
      'no-duplicate-case': 'error',
      'no-duplicate-imports': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-var': 'error',
      'prefer-const': 'error',
      semi: ['error', 'always']
    }
  }
];
