# SF CLI ERROR MESSAGES that we may want to submit a PR for

Backslashes in paths (e.g., force-app\main\default\classes\Foo.cls)
OR paths that include trailing spaces (e.g., `force-app\main\default\classes\Foo.cls`)
───────────────────────────────────────────────────────────────────────
SfError: force-app\\main\\default\\classes\\Foo.cls: File or folder not found
  exitCode: 1  context: DeployMetadata

The SF CLI on Linux treats backslashes as literal characters, not path
separators. It looks for a file literally named "force-app\main\..." which
doesn't exist. The error gives no hint that the backslash is the problem.

Blank lines in source-dir file:
 Error: Flag --source-dir expects a value
   exitCode: 1
   context: DeployMetadata

--------------------------------------------------

BELOW IS OLD STUFF FROM WHEN WE WERE THINKING ABOUT SUBMITTING A PR FOR A NEW "CHECK" COMMAND

--------------------------------------------------

Feature: `sf project deploy check` - Local Validation Command

## Overview

This feature adds a new `sf project deploy check` command to the Salesforce CLI that performs **local, offline validation** of deployment configuration before connecting to an org. This fills a gap in the current CLI where `--dry-run` requires network connectivity and a full deployment attempt.

## Origin / Inspiration

This feature was inspired by validation scripts in the sibling repository:

```bash
../sf-setup-deployment-transactions/setup-scripts/*.mjs
```

That repository contains bash scripts and Node.js modules for managing Salesforce deployments in a "transaction" batch pattern. The local validation logic from those scripts was extracted and adapted for inclusion in the official Salesforce CLI.

### Source Scripts Referenced

| Script | Functionality Extracted |
| ------ | ---------------------- |
| `13-check-source-dir-paths.mjs` | Path existence validation, flags-dir syntax checks |
| `17-check-test-level.mjs` | Test level enum validation |
| `18-check-tests-file-entries.mjs` | Test class existence and @IsTest annotation checks |

### What Was NOT Included (Deferred)

The following concepts from the source repo are workflow-specific and were intentionally excluded:

- Transaction/batch deployment concepts
- Delta detection against production baselines
- Coverage checking across transaction boundaries
- Destructive manifest generation (already exists as `sf project generate manifest`)

## Files Created

All files are in this repository (`sf-plugin-deploy-retrieve`):

| File | Purpose |
| ---- | ------- |
| `src/commands/project/deploy/check.ts` | Main command implementation |
| `src/utils/localValidation.ts` | Core validation logic (8 exported functions) |
| `src/formatters/checkResultFormatter.ts` | Human-readable output formatting |
| `messages/deploy.metadata.check.md` | Command messages, help text, error messages |
| `test/commands/deploy/check.test.ts` | Unit tests (26 tests, all passing) |
| `docs/github-issue-sf-deploy-check.md` | Draft GitHub issue for proposing this feature |

## Command Usage

```bash
# Validate source directory paths exist
sf project deploy check --source-dir force-app --source-dir my-package

# Validate manifest file is well-formed XML
sf project deploy check --manifest manifest/package.xml

# Validate test configuration
sf project deploy check --test-level RunSpecifiedTests --tests MyTestClass

# Validate flags-dir file syntax (CRLF, backslashes, blank lines)
sf project deploy check --flags-dir deploy-config/flags

# Auto-fix issues in flags-dir files
sf project deploy check --flags-dir deploy-config/flags --apply-fixes
```

## Architecture

### Command Class

```typescript
// src/commands/project/deploy/check.ts
export default class DeployCheck extends SfCommand<CheckResultJson> {
  public static readonly requiresProject = false;  // Allow checking metadata-dir format

  public static readonly flags = {
    'source-dir': Flags.directory({ multiple: true, ... }),
    'manifest': Flags.file({ ... }),
    'metadata-dir': Flags.directory({ ... }),
    'test-level': testLevelFlag({ ... }),
    'tests': testsFlag(),
    'flags-dir': Flags.directory({ ... }),
    'apply-fixes': Flags.boolean({ default: false }),
  };
}
```

### Validation Functions

```typescript
// src/utils/localValidation.ts

// Path validation
validateSourceDirPaths(paths: string[]): ValidationResult
validateManifest(manifestPath: string): ValidationResult

// Test configuration validation
validateTestLevel(testLevel: string): ValidationResult
validateTestsRequired(testLevel: string, tests: string[] | undefined): ValidationResult
validateTestClasses(testClasses: string[], classesDir?: string): ValidationResult

// Flags-dir validation
validateFlagsDirSyntax(flagsDir: string): ValidationResult  // Read-only check
applyFlagsDirFixes(flagsDir: string): FixResult            // Only when --apply-fixes

// Utility
combineValidationResults(...results: ValidationResult[]): ValidationResult
```

### Key Design Decisions

1. **No `--target-org` flag** - Purely local validation, no network required
2. **No `requiresProject = true`** - Can validate `--metadata-dir` format outside a project
3. **Read-only by default** - Command only reports issues without modifying files
4. **`--apply-fixes` flag** - Opt-in to auto-fix CRLF→LF, backslashes→forward slashes, blank line removal
5. **Reuses existing flags** - `testLevelFlag()` and `testsFlag()` from `utils/flags.ts`

## Testing

All 26 tests pass:

```bash
cd ../sf-plugin-deploy-retrieve
npm test -- --grep "project deploy check"
```

Test coverage includes:

- Path existence validation (existing and non-existent paths)
- Manifest XML well-formedness checking
- Test level enum validation
- Test class @IsTest annotation detection (case-insensitive)
- Flags-dir syntax detection (CRLF, backslashes, blank lines)
- Fix application (CRLF→LF, backslashes→forward slashes)
- Comment preservation during fixes
- Result combination logic

## Next Steps

1. **Review the GitHub issue draft** at `docs/github-issue-sf-deploy-check.md`
2. **Run full test suite**: `npm test`
3. **Build**: `npm run build`
4. **Manual testing**: `./bin/dev.js project deploy check --help`
5. **When ready**: Create PR to `salesforcecli/plugin-deploy-retrieve`

## Related GitHub Issues

- [#2102](https://github.com/forcedotcom/cli/issues/2102) - Deploy validation without tests
- [#2335](https://github.com/forcedotcom/cli/issues/2335) - Lost feature: validate-only without Apex tests
- [#2727](https://github.com/forcedotcom/cli/issues/2727) - Validate command issues

## Context for Continuing Work

If you're using Claude Code in this repository and want to continue this work:

1. The implementation is complete and tests pass
2. Key files to review:
   - `src/commands/project/deploy/check.ts` - Command entry point
   - `src/utils/localValidation.ts` - Core logic
   - `test/commands/deploy/check.test.ts` - Test patterns
3. The source inspiration repo is at `../sf-setup-deployment-transactions`
4. A detailed plan exists at `C:\Users\10231026\.claude\plans\vivid-hatching-frost.md`

### Useful Commands

```bash
# Run just the check command tests
npm test -- --grep "project deploy check"

# Build TypeScript
npm run build

# Run the command locally
./bin/dev.js project deploy check --help

# Lint
npm run lint
```
