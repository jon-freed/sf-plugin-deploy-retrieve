/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SfProject } from '@salesforce/core';
import { TestLevel } from './types.js';

/**
 * Types for local validation results
 */
export type CheckErrorType =
  | 'PathNotFound'
  | 'ClassNotFound'
  | 'NotATestClass'
  | 'InvalidTestLevel'
  | 'TestsRequiredForRunSpecifiedTests'
  | 'ManifestNotWellFormed';

export type CheckWarningType = 'CRLFDetected' | 'BackslashDetected' | 'BlankLineDetected';

export type CheckError = {
  type: CheckErrorType;
  message: string;
  path?: string;
  className?: string;
};

export type CheckWarning = {
  type: CheckWarningType;
  message: string;
  filePath: string;
};

export type CheckFix = {
  type: CheckWarningType;
  filePath: string;
  description: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: CheckError[];
  warnings: CheckWarning[];
};

export type FixResult = {
  fixesApplied: CheckFix[];
};

/**
 * Validate that source-dir paths exist.
 *
 * @param paths - Array of paths to validate
 * @returns ValidationResult with any errors found
 */
export function validateSourceDirPaths(paths: string[]): ValidationResult {
  const errors: CheckError[] = [];

  for (const p of paths) {
    const resolvedPath = path.resolve(p);
    if (!fs.existsSync(resolvedPath)) {
      errors.push({
        type: 'PathNotFound',
        message: `Path does not exist: ${p}`,
        path: p,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

/**
 * Validate that a manifest file exists and is well-formed XML.
 *
 * @param manifestPath - Path to the manifest file
 * @returns ValidationResult with any errors found
 */
export function validateManifest(manifestPath: string): ValidationResult {
  const errors: CheckError[] = [];

  const resolvedPath = path.resolve(manifestPath);
  if (!fs.existsSync(resolvedPath)) {
    errors.push({
      type: 'PathNotFound',
      message: `Manifest file does not exist: ${manifestPath}`,
      path: manifestPath,
    });
    return { valid: false, errors, warnings: [] };
  }

  // Check if XML is well-formed (basic check)
  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    // Basic XML well-formedness check: must have XML declaration or root element
    if (!content.trim().startsWith('<?xml') && !content.trim().startsWith('<')) {
      errors.push({
        type: 'ManifestNotWellFormed',
        message: `Manifest file is not well-formed XML: ${manifestPath}`,
        path: manifestPath,
      });
    }
    // Check for matching opening/closing Package tag
    if (!content.includes('<Package') || !content.includes('</Package>')) {
      errors.push({
        type: 'ManifestNotWellFormed',
        message: `Manifest file is missing Package element: ${manifestPath}`,
        path: manifestPath,
      });
    }
  } catch (e) {
    errors.push({
      type: 'ManifestNotWellFormed',
      message: `Failed to read manifest file: ${manifestPath}`,
      path: manifestPath,
    });
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

/**
 * Validate that test-level is a valid enum value.
 *
 * @param testLevel - The test level string to validate
 * @returns ValidationResult with any errors found
 */
export function validateTestLevel(testLevel: string): ValidationResult {
  const errors: CheckError[] = [];
  const validLevels = Object.values(TestLevel);

  if (!validLevels.includes(testLevel as TestLevel)) {
    errors.push({
      type: 'InvalidTestLevel',
      message: `Invalid test-level value: ${testLevel}. Valid values: ${validLevels.join(', ')}`,
    });
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

/**
 * Validate that --tests is provided when test-level is RunSpecifiedTests.
 *
 * @param testLevel - The test level
 * @param tests - Array of test class names (may be undefined/empty)
 * @returns ValidationResult with any errors found
 */
export function validateTestsRequired(testLevel: string, tests: string[] | undefined): ValidationResult {
  const errors: CheckError[] = [];

  if (testLevel === TestLevel.RunSpecifiedTests && (!tests || tests.length === 0)) {
    errors.push({
      type: 'TestsRequiredForRunSpecifiedTests',
      message: 'The --tests flag is required when --test-level is RunSpecifiedTests.',
    });
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

/**
 * Find the classes directory in the project.
 * Checks common locations: force-app/main/default/classes and package directories.
 *
 * @param projectRoot - Root directory of the project (defaults to cwd)
 * @returns Path to classes directory, or null if not found
 */
export function findClassesDirectory(projectRoot?: string): string | null {
  const root = projectRoot ?? process.cwd();

  // Try standard location first
  const standardPath = path.join(root, 'force-app', 'main', 'default', 'classes');
  if (fs.existsSync(standardPath)) {
    return standardPath;
  }

  // Try to read package directories from sfdx-project.json
  try {
    const project = SfProject.getInstance(root);
    const packageDirs = project.getPackageDirectories();
    for (const pkgDir of packageDirs) {
      const classesPath = path.join(root, pkgDir.path, 'main', 'default', 'classes');
      if (fs.existsSync(classesPath)) {
        return classesPath;
      }
      // Also try without main/default
      const altClassesPath = path.join(root, pkgDir.path, 'classes');
      if (fs.existsSync(altClassesPath)) {
        return altClassesPath;
      }
    }
  } catch {
    // Not in a project or can't read project config
  }

  return null;
}

/**
 * Validate that test classes exist and have @IsTest annotation.
 *
 * @param testClasses - Array of test class names to validate
 * @param classesDir - Optional path to classes directory (will be auto-detected if not provided)
 * @returns ValidationResult with any errors found
 */
export function validateTestClasses(testClasses: string[], classesDir?: string): ValidationResult {
  const errors: CheckError[] = [];

  const resolvedClassesDir = classesDir ?? findClassesDirectory();

  if (!resolvedClassesDir) {
    // Can't find classes directory - skip validation but don't error
    // The test classes might be in the org already
    return { valid: true, errors: [], warnings: [] };
  }

  for (const cls of testClasses) {
    const clsPath = path.join(resolvedClassesDir, `${cls}.cls`);

    if (!fs.existsSync(clsPath)) {
      errors.push({
        type: 'ClassNotFound',
        message: `Test class not found: ${cls}`,
        className: cls,
        path: clsPath,
      });
      continue;
    }

    // Check for @IsTest annotation (case-insensitive)
    const content = fs.readFileSync(clsPath, 'utf8');
    if (!/@IsTest\b/i.test(content)) {
      errors.push({
        type: 'NotATestClass',
        message: `Class ${cls} does not have @IsTest annotation.`,
        className: cls,
        path: clsPath,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

/**
 * Validate flags-dir file syntax (CRLF, backslashes, blank lines).
 * This is a read-only check that reports issues without modifying files.
 *
 * @param flagsDir - Path to the flags directory
 * @returns ValidationResult with any warnings found
 */
export function validateFlagsDirSyntax(flagsDir: string): ValidationResult {
  const warnings: CheckWarning[] = [];

  const resolvedDir = path.resolve(flagsDir);
  if (!fs.existsSync(resolvedDir)) {
    return {
      valid: false,
      errors: [{ type: 'PathNotFound', message: `Flags directory does not exist: ${flagsDir}`, path: flagsDir }],
      warnings: [],
    };
  }

  // Get all files in the directory (non-recursive, flags-dir is flat)
  const files = fs.readdirSync(resolvedDir);

  for (const file of files) {
    const filePath = path.join(resolvedDir, file);
    const stat = fs.statSync(filePath);

    if (!stat.isFile()) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Check for CRLF
    if (content.includes('\r\n')) {
      warnings.push({
        type: 'CRLFDetected',
        message: `File contains CRLF line endings: ${file}`,
        filePath,
      });
    }

    // Check for backslashes (likely Windows paths)
    // Only check in content that looks like a path (has slashes or starts with a drive letter)
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        continue;
      }
      // Check for backslashes in non-comment lines
      if (trimmed.includes('\\')) {
        warnings.push({
          type: 'BackslashDetected',
          message: `File contains backslashes in paths: ${file}`,
          filePath,
        });
        break; // Only report once per file
      }
    }

    // Check for blank lines in the middle of content
    const nonEmptyLines = lines.filter((l) => l.trim());
    const hasContentBefore = nonEmptyLines.length > 0;
    let hasBlankInMiddle = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prevLine = i > 0 ? lines[i - 1] : null;
      const nextLine = i < lines.length - 1 ? lines[i + 1] : null;

      // Blank line in the middle = empty line with non-empty lines before and after
      if (line.trim() === '' && prevLine?.trim() && nextLine?.trim()) {
        hasBlankInMiddle = true;
        break;
      }
    }

    if (hasBlankInMiddle && hasContentBefore) {
      warnings.push({
        type: 'BlankLineDetected',
        message: `File contains blank lines in content: ${file}`,
        filePath,
      });
    }
  }

  return { valid: true, errors: [], warnings };
}

/**
 * Apply fixes to flags-dir files (CRLF → LF, backslashes → forward slashes, remove blank lines).
 * Only call this when --apply-fixes is set.
 *
 * @param flagsDir - Path to the flags directory
 * @returns FixResult with list of fixes applied
 */
export function applyFlagsDirFixes(flagsDir: string): FixResult {
  const fixesApplied: CheckFix[] = [];

  const resolvedDir = path.resolve(flagsDir);
  if (!fs.existsSync(resolvedDir)) {
    return { fixesApplied };
  }

  const files = fs.readdirSync(resolvedDir);

  for (const file of files) {
    const filePath = path.join(resolvedDir, file);
    const stat = fs.statSync(filePath);

    if (!stat.isFile()) {
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Fix CRLF → LF
    if (content.includes('\r\n')) {
      content = content.replace(/\r\n/g, '\n');
      modified = true;
      fixesApplied.push({
        type: 'CRLFDetected',
        filePath,
        description: `Converted CRLF to LF in ${file}`,
      });
    }

    // Fix backslashes → forward slashes (only in non-comment lines)
    const lines = content.split('\n');
    let backslashFixed = false;
    const fixedLines = lines.map((line) => {
      const trimmed = line.trim();
      // Skip comments
      if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
        return line;
      }
      if (line.includes('\\')) {
        backslashFixed = true;
        return line.replace(/\\/g, '/');
      }
      return line;
    });

    if (backslashFixed) {
      content = fixedLines.join('\n');
      modified = true;
      fixesApplied.push({
        type: 'BackslashDetected',
        filePath,
        description: `Converted backslashes to forward slashes in ${file}`,
      });
    }

    // Remove blank lines in the middle of content
    const contentLines = content.split('\n');
    const filteredLines: string[] = [];
    let inContent = false;
    let blankLinesRemoved = false;

    for (const line of contentLines) {
      const isEmpty = line.trim() === '';

      if (!inContent && !isEmpty) {
        // First non-empty line - start of content
        inContent = true;
      }

      if (inContent) {
        if (isEmpty) {
          // Check if there's more content after this
          const remaining = contentLines.slice(contentLines.indexOf(line) + 1);
          const hasMoreContent = remaining.some((l) => l.trim() !== '');
          if (hasMoreContent) {
            // Blank line in middle - skip it
            blankLinesRemoved = true;
            continue;
          }
        }
        filteredLines.push(line);
      } else {
        // Before content (header comments) - keep as-is
        filteredLines.push(line);
      }
    }

    if (blankLinesRemoved) {
      content = filteredLines.join('\n');
      modified = true;
      fixesApplied.push({
        type: 'BlankLineDetected',
        filePath,
        description: `Removed blank lines in ${file}`,
      });
    }

    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, content);
    }
  }

  return { fixesApplied };
}

/**
 * Combine multiple ValidationResults into one.
 *
 * @param results - Array of ValidationResults to combine
 * @returns Combined ValidationResult
 */
export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const errors: CheckError[] = [];
  const warnings: CheckWarning[] = [];

  for (const result of results) {
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
