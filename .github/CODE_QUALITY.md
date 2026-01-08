# Code Quality Standards

This project enforces strict code quality standards through automated tooling and Git hooks.

## Automated Checks

### Pre-Commit Hooks

Every commit automatically runs:

1. **Lint-Staged** - Runs on staged files only (fast!)
   - Auto-fixes linting issues with Biome
   - Type checks with TypeScript
   - Formats code

2. **Tests** - All unit tests must pass

### Commit Message Validation

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system or dependencies
- `ci`: CI configuration changes
- `chore`: Other changes (maintenance)
- `revert`: Revert a previous commit

**Examples:**
```bash
git commit -m "feat: add WebSocket reconnection logic"
git commit -m "fix: resolve timezone parsing bug"
git commit -m "docs: update API documentation"
git commit -m "test: add coverage for geo utilities"
```

### Linting Rules (Biome)

**Enforced:**
- ❌ No `any` types
- ❌ No unused variables or imports
- ❌ No non-null assertions
- ❌ No `debugger` statements
- ⚠️  Warn on `console.log` (except in server code)
- ✅ Use `const` over `let` when possible
- ✅ Use template literals over string concatenation
- ✅ No parameter reassignment

**Configuration:** [biome.json](../biome.json)

### TypeScript Checking

**Two separate checks:**

1. **Source Code** (`npm run typecheck`)
   - Validates src/**/*.ts and src/**/*.tsx
   - Excludes test files

2. **Test Files** (`npm run typecheck:tests`)
   - Validates src/**/*.spec.ts
   - Uses separate tsconfig for test-specific types

**Configuration:**
- [tsconfig.json](../tsconfig.json) - Main config
- [tsconfig.test.json](../tsconfig.test.json) - Test config

### Test Coverage

- **97%** line coverage required
- **95%** function coverage required
- **85%** branch coverage required
- **97%** statement coverage required

**Run tests:**
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Manual Validation

Before pushing, you can run all checks manually:

```bash
npm run validate
```

This runs:
1. Linting
2. Type checking (source)
3. Type checking (tests)
4. All tests

## Bypassing Hooks (Not Recommended)

In rare cases, you may need to bypass hooks:

```bash
git commit --no-verify -m "emergency fix"
```

**⚠️ Warning:** Only use this in emergencies. The CI will still run all checks.

## CI/CD Validation

All checks also run in CI:
- ✅ Linting
- ✅ Type checking
- ✅ Tests
- ✅ Build verification

Pull requests cannot merge if any check fails.

## Tools Used

- **[Husky](https://typicode.github.io/husky/)** - Git hooks
- **[lint-staged](https://github.com/okonet/lint-staged)** - Run linters on staged files
- **[commitlint](https://commitlint.js.org/)** - Enforce commit message format
- **[Biome](https://biomejs.dev/)** - Fast linter and formatter
- **[TypeScript](https://www.typescriptlang.org/)** - Type checking
- **[Vitest](https://vitest.dev/)** - Unit testing

## Configuration Files

- `.husky/pre-commit` - Pre-commit hook
- `.husky/commit-msg` - Commit message validation
- `commitlint.config.js` - Commit message rules
- `biome.json` - Linting and formatting rules
- `tsconfig.json` - TypeScript configuration
- `tsconfig.test.json` - Test-specific TypeScript config
- `vitest.config.ts` - Test configuration
- `package.json` → `lint-staged` - Staged files configuration

## Best Practices

1. **Commit Often** - Small, focused commits are easier to review
2. **Write Good Messages** - Follow conventional commits format
3. **Fix Issues Locally** - Don't rely on CI to catch problems
4. **Run Tests** - Before committing, ensure tests pass
5. **Keep It Clean** - No commented-out code, no TODOs without issues

## Getting Help

If hooks fail:
1. Read the error message carefully
2. Fix the issue locally
3. Stage the fixes: `git add .`
4. Try committing again

Common issues:
- **Type errors**: Run `npm run typecheck` to see details
- **Lint errors**: Run `npm run lint` to see all issues
- **Test failures**: Run `npm test` for detailed output
- **Commit message**: Follow the format examples above
