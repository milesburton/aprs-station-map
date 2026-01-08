export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation changes
        'style', // Code style changes (formatting, etc.)
        'refactor', // Code refactoring
        'perf', // Performance improvements
        'test', // Adding or updating tests
        'build', // Build system or dependencies
        'ci', // CI configuration changes
        'chore', // Other changes (maintenance)
        'revert', // Revert a previous commit
      ],
    ],
    'subject-case': [0], // Allow any case for subject
    'body-max-line-length': [0], // No limit on body line length
  },
}
