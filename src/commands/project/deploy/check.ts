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

import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { testLevelFlag, testsFlag } from '../../../utils/flags.js';
import {
  validateSourceDirPaths,
  validateManifest,
  validateTestLevel,
  validateTestsRequired,
  validateTestClasses,
  validateFlagsDirSyntax,
  applyFlagsDirFixes,
  combineValidationResults,
  CheckError,
  CheckWarning,
  CheckFix,
  ValidationResult,
} from '../../../utils/localValidation.js';
import { CheckResultFormatter } from '../../../formatters/checkResultFormatter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-deploy-retrieve', 'deploy.metadata.check');

const exclusiveFlags = ['manifest', 'source-dir', 'metadata-dir'];

export type CheckResultJson = {
  valid: boolean;
  errors: CheckError[];
  warnings: CheckWarning[];
  fixes?: CheckFix[];
  checksPerformed: number;
};

export default class DeployCheck extends SfCommand<CheckResultJson> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  // Do not require a project - allow checking metadata-dir format
  public static readonly requiresProject = false;

  public static readonly flags = {
    'source-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.source-dir.summary'),
      description: messages.getMessage('flags.source-dir.description'),
      multiple: true,
      exclusive: exclusiveFlags.filter((f) => f !== 'source-dir'),
    }),
    manifest: Flags.file({
      char: 'x',
      summary: messages.getMessage('flags.manifest.summary'),
      description: messages.getMessage('flags.manifest.description'),
      exclusive: exclusiveFlags.filter((f) => f !== 'manifest'),
    }),
    'metadata-dir': Flags.directory({
      summary: messages.getMessage('flags.metadata-dir.summary'),
      exclusive: exclusiveFlags.filter((f) => f !== 'metadata-dir'),
    }),
    'test-level': testLevelFlag({
      summary: messages.getMessage('flags.test-level.summary'),
      description: messages.getMessage('flags.test-level.description'),
    }),
    tests: testsFlag(),
    'flags-dir': Flags.directory({
      summary: messages.getMessage('flags.flags-dir.summary'),
      description: messages.getMessage('flags.flags-dir.description'),
    }),
    'apply-fixes': Flags.boolean({
      summary: messages.getMessage('flags.apply-fixes.summary'),
      description: messages.getMessage('flags.apply-fixes.description'),
      default: false,
    }),
  };

  public async run(): Promise<CheckResultJson> {
    const { flags } = await this.parse(DeployCheck);

    const results: ValidationResult[] = [];
    let checksPerformed = 0;

    // Validate source-dir paths
    if (flags['source-dir']?.length) {
      this.log(`Checking ${flags['source-dir'].length} source directory path(s)...`);
      results.push(validateSourceDirPaths(flags['source-dir']));
      checksPerformed += flags['source-dir'].length;
    }

    // Validate manifest
    if (flags.manifest) {
      this.log('Checking manifest file...');
      results.push(validateManifest(flags.manifest));
      checksPerformed++;
    }

    // Validate metadata-dir
    if (flags['metadata-dir']) {
      this.log('Checking metadata directory...');
      results.push(validateSourceDirPaths([flags['metadata-dir']]));
      checksPerformed++;
    }

    // Validate test-level
    if (flags['test-level']) {
      this.log('Checking test level...');
      results.push(validateTestLevel(flags['test-level']));
      checksPerformed++;

      // Check if tests are required
      results.push(validateTestsRequired(flags['test-level'], flags.tests));
    }

    // Validate test classes
    if (flags.tests?.length) {
      this.log(`Checking ${flags.tests.length} test class(es)...`);
      results.push(validateTestClasses(flags.tests));
      checksPerformed += flags.tests.length;
    }

    // Validate flags-dir syntax
    let fixes: CheckFix[] | undefined;
    if (flags['flags-dir']) {
      this.log('Checking flags directory syntax...');
      results.push(validateFlagsDirSyntax(flags['flags-dir']));
      checksPerformed++;

      // Apply fixes if requested
      if (flags['apply-fixes']) {
        const fixResult = applyFlagsDirFixes(flags['flags-dir']);
        fixes = fixResult.fixesApplied;
        if (fixes.length > 0) {
          this.log(`Applied ${fixes.length} fix(es).`);
        }
      }
    }

    // Combine all results
    const combined = combineValidationResults(...results);

    // Prepare output
    const output: CheckResultJson = {
      valid: combined.valid,
      errors: combined.errors,
      warnings: combined.warnings,
      fixes,
      checksPerformed,
    };

    // Display results if not JSON mode
    if (!this.jsonEnabled()) {
      const formatter = new CheckResultFormatter(output);
      formatter.display();
    }

    // Set exit code based on validity
    if (!combined.valid) {
      process.exitCode = 1;
    }

    return output;
  }
}
