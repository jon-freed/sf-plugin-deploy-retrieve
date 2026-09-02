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

import ansis from 'ansis';
import { Ux } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Formatter } from '../utils/types.js';
import { CheckError, CheckWarning, CheckFix } from '../utils/localValidation.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-deploy-retrieve', 'deploy.metadata.check');

const ux = new Ux();

export type CheckResultJson = {
  valid: boolean;
  errors: CheckError[];
  warnings: CheckWarning[];
  fixes?: CheckFix[];
  checksPerformed: number;
};

export class CheckResultFormatter implements Formatter<CheckResultJson> {
  public constructor(private result: CheckResultJson) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  public async getJson(): Promise<CheckResultJson> {
    return this.result;
  }

  public display(): void {
    ux.log();

    // Display errors
    if (this.result.errors.length > 0) {
      ux.log(ansis.red.bold(`Errors (${this.result.errors.length}):`));
      for (const error of this.result.errors) {
        ux.log(ansis.red(`  ✗ ${error.message}`));
        // Display action hint if available
        const actionKey = `error.${error.type}Action`;
        try {
          const action = messages.getMessage(actionKey);
          ux.log(ansis.dim(`    ${action}`));
        } catch {
          // No action message available
        }
      }
      ux.log();
    }

    // Display warnings
    if (this.result.warnings.length > 0) {
      ux.log(ansis.yellow.bold(`Warnings (${this.result.warnings.length}):`));
      for (const warning of this.result.warnings) {
        ux.log(ansis.yellow(`  ⚠ ${warning.message}`));
        // Display action hint if available
        const actionKey = `warning.${warning.type}Action`;
        try {
          const action = messages.getMessage(actionKey);
          ux.log(ansis.dim(`    ${action}`));
        } catch {
          // No action message available
        }
      }
      ux.log();
    }

    // Display fixes applied
    if (this.result.fixes && this.result.fixes.length > 0) {
      ux.log(ansis.green.bold(`Fixes Applied (${this.result.fixes.length}):`));
      for (const fix of this.result.fixes) {
        ux.log(ansis.green(`  ✓ ${fix.description}`));
      }
      ux.log();
    }

    // Display summary
    ux.log(messages.getMessage('info.ValidationComplete'));

    if (this.result.valid && this.result.errors.length === 0) {
      if (this.result.warnings.length === 0) {
        ux.log(ansis.green(`✓ ${messages.getMessage('info.AllChecksPassedWithCount', [this.result.checksPerformed])}`));
      } else {
        ux.log(ansis.green(`✓ All checks passed with ${this.result.warnings.length} warning(s).`));
      }
    } else {
      ux.log(ansis.red(`✗ ${messages.getMessage('info.ErrorsFound', [this.result.errors.length])}`));
    }
  }
}
