# summary

Check deployment configuration locally without connecting to an org.

# description

Validates that paths, test classes, and flag configurations are correct before attempting deployment. This command runs entirely locally and does not require an org connection.

Use this command to catch common errors before running `<%= config.bin %> project deploy start`:

- Verify `--source-dir` paths exist
- Validate `--test-level` values
- Check that `--tests` classes exist and have the `@IsTest` annotation
- Detect syntax issues in `--flags-dir` files (CRLF line endings, backslashes, blank lines)

By default, this command only reports issues without modifying files. Use the `--apply-fixes` flag to automatically correct fixable issues in flag files.

# examples

- Validate source directory paths exist:

      <%= config.bin %> <%= command.id %> --source-dir force-app

- Validate flags-dir configuration:

      <%= config.bin %> <%= command.id %> --flags-dir deploy-config/flags

- Validate test configuration:

      <%= config.bin %> <%= command.id %> --test-level RunSpecifiedTests --tests MyTestClass

- Validate and auto-fix flag file issues:

      <%= config.bin %> <%= command.id %> --flags-dir deploy-config/flags --apply-fixes

- Validate a manifest file:

      <%= config.bin %> <%= command.id %> --manifest path/to/package.xml

# flags.source-dir.summary

Path to the local source files to check.

# flags.source-dir.description

The supplied path can be to a single file (in which case the operation is applied to only one file) or to a folder (in which case the operation is applied to all metadata types in the directory and its subdirectories).

If you specify this flag, don't specify --metadata or --manifest.

# flags.manifest.summary

Full file path for manifest (package.xml) of components to check.

# flags.manifest.description

Validates that the manifest file exists and is well-formed XML. Does not validate that the metadata components listed in the manifest exist in the project.

# flags.metadata-dir.summary

Root of directory of metadata formatted files to check.

# flags.test-level.summary

Deployment Apex testing level to validate.

# flags.test-level.description

Validates that the test level is one of the allowed values: NoTestRun, RunSpecifiedTests, RunLocalTests, RunAllTestsInOrg, or RunRelevantTests.

If the test level is RunSpecifiedTests, the --tests flag is required.

# flags.tests.summary

Apex test classes to validate.

# flags.tests.description

For each test class specified, validates that:

1. The class file exists in the project (in force-app/main/default/classes or other package directories)
2. The class has the @IsTest annotation

If a test name contains a space, enclose it in double quotes.
For multiple test names, use one of the following formats:

- Repeat the flag for multiple test names: --tests Test1 --tests Test2 --tests "Test With Space"
- Separate the test names with spaces: --tests Test1 Test2 "Test With Space"

# flags.flags-dir.summary

Directory containing flag files to validate.

# flags.flags-dir.description

Validates syntax of files in the flags directory:

- Checks for CRLF line endings (should be LF)
- Checks for backslashes in paths (should be forward slashes)
- Checks for blank lines in file content

Use --apply-fixes to automatically correct these issues.

# flags.apply-fixes.summary

Auto-fix issues in flag files.

# flags.apply-fixes.description

When set, automatically fixes common issues in --flags-dir files:

- Converts CRLF line endings to LF
- Converts backslashes to forward slashes in paths
- Removes blank lines within file content

Without this flag, the command only reports issues without modifying files.

# error.PathNotFound

Path does not exist: %s

# error.PathNotFoundAction

Verify the path is correct and exists in your project.

# error.ClassNotFound

Test class not found: %s

# error.ClassNotFoundAction

Verify the class name is correct and the .cls file exists in your project's classes directory.

# error.NotATestClass

Class %s does not have @IsTest annotation.

# error.NotATestClassAction

Add the @IsTest annotation to the class, or remove it from the --tests list.

# error.InvalidTestLevel

Invalid test-level value: %s

# error.InvalidTestLevelAction

Valid values are: NoTestRun, RunSpecifiedTests, RunLocalTests, RunAllTestsInOrg, RunRelevantTests

# error.TestsRequiredForRunSpecifiedTests

The --tests flag is required when --test-level is RunSpecifiedTests.

# error.ManifestNotWellFormed

Manifest file is not well-formed XML: %s

# error.ManifestNotWellFormedAction

Check the manifest file for XML syntax errors.

# warning.CRLFDetected

File contains CRLF line endings: %s

# warning.CRLFDetectedAction

Use --apply-fixes to convert to LF, or manually convert line endings.

# warning.BackslashDetected

File contains backslashes in paths: %s

# warning.BackslashDetectedAction

Use --apply-fixes to convert to forward slashes, or manually fix the paths.

# warning.BlankLineDetected

File contains blank lines: %s

# warning.BlankLineDetectedAction

Use --apply-fixes to remove blank lines, or manually remove them.

# info.FixApplied

Fixed: %s

# info.ValidationComplete

Validation complete.

# info.AllChecksPassedWithCount

All %s check(s) passed.

# info.ErrorsFound

Found %s error(s).

# info.WarningsFound

Found %s warning(s).

# info.FixesApplied

Applied %s fix(es).
