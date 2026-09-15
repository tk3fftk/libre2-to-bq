export default [
  {
    files: ['Code.gs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        BigQuery: 'readonly',
        LockService: 'readonly',
        PropertiesService: 'readonly',
        ScriptApp: 'readonly',
        UrlFetchApp: 'readonly',
        Utilities: 'readonly'
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
