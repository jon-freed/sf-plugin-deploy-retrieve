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
import * as os from 'node:os';
import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import {
  validateSourceDirPaths,
  validateManifest,
  validateTestLevel,
  validateTestsRequired,
  validateTestClasses,
  validateFlagsDirSyntax,
  applyFlagsDirFixes,
  combineValidationResults,
} from '../../../src/utils/localValidation.js';
import { TestLevel } from '../../../src/utils/types.js';

describe('project deploy check', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  describe('validateSourceDirPaths', () => {
    it('should return valid when all paths exist', () => {
      // Use a path that definitely exists
      const result = validateSourceDirPaths([process.cwd()]);
      expect(result.valid).to.be.true;
      expect(result.errors).to.have.length(0);
    });

    it('should return error when path does not exist', () => {
      const result = validateSourceDirPaths(['nonexistent-path-12345']);
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.length(1);
      expect(result.errors[0].type).to.equal('PathNotFound');
    });

    it('should return multiple errors for multiple missing paths', () => {
      const result = validateSourceDirPaths(['nonexistent-1', 'nonexistent-2']);
      expect(result.valid).to.be.false;
      expect(result.errors).to.have.length(2);
    });
  });

  describe('validateManifest', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return error when manifest does not exist', () => {
      const result = validateManifest('nonexistent-manifest.xml');
      expect(result.valid).to.be.false;
      expect(result.errors[0].type).to.equal('PathNotFound');
    });

    it('should return valid for well-formed manifest', () => {
      const manifestPath = path.join(tempDir, 'package.xml');
      fs.writeFileSync(
        manifestPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <version>62.0</version>
</Package>`
      );
      const result = validateManifest(manifestPath);
      expect(result.valid).to.be.true;
    });

    it('should return error for malformed manifest', () => {
      const manifestPath = path.join(tempDir, 'bad-package.xml');
      fs.writeFileSync(manifestPath, 'not xml at all');
      const result = validateManifest(manifestPath);
      expect(result.valid).to.be.false;
      expect(result.errors[0].type).to.equal('ManifestNotWellFormed');
    });
  });

  describe('validateTestLevel', () => {
    it('should return valid for all valid test levels', () => {
      for (const level of Object.values(TestLevel)) {
        const result = validateTestLevel(level);
        expect(result.valid).to.be.true;
      }
    });

    it('should return error for invalid test level', () => {
      const result = validateTestLevel('InvalidLevel');
      expect(result.valid).to.be.false;
      expect(result.errors[0].type).to.equal('InvalidTestLevel');
    });
  });

  describe('validateTestsRequired', () => {
    it('should return valid when test-level is not RunSpecifiedTests', () => {
      const result = validateTestsRequired(TestLevel.NoTestRun, undefined);
      expect(result.valid).to.be.true;
    });

    it('should return valid when tests are provided for RunSpecifiedTests', () => {
      const result = validateTestsRequired(TestLevel.RunSpecifiedTests, ['TestClass']);
      expect(result.valid).to.be.true;
    });

    it('should return error when tests are missing for RunSpecifiedTests', () => {
      const result = validateTestsRequired(TestLevel.RunSpecifiedTests, undefined);
      expect(result.valid).to.be.false;
      expect(result.errors[0].type).to.equal('TestsRequiredForRunSpecifiedTests');
    });

    it('should return error when tests array is empty for RunSpecifiedTests', () => {
      const result = validateTestsRequired(TestLevel.RunSpecifiedTests, []);
      expect(result.valid).to.be.false;
    });
  });

  describe('validateTestClasses', () => {
    let tempDir: string;
    let classesDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-test-'));
      classesDir = path.join(tempDir, 'classes');
      fs.mkdirSync(classesDir);
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return valid when test class exists and has @IsTest', () => {
      const clsPath = path.join(classesDir, 'MyTest.cls');
      fs.writeFileSync(clsPath, '@IsTest\npublic class MyTest {}');
      const result = validateTestClasses(['MyTest'], classesDir);
      expect(result.valid).to.be.true;
    });

    it('should return valid when test class has @isTest (lowercase)', () => {
      const clsPath = path.join(classesDir, 'MyTest.cls');
      fs.writeFileSync(clsPath, '@isTest\npublic class MyTest {}');
      const result = validateTestClasses(['MyTest'], classesDir);
      expect(result.valid).to.be.true;
    });

    it('should return error when test class does not exist', () => {
      const result = validateTestClasses(['NonExistent'], classesDir);
      expect(result.valid).to.be.false;
      expect(result.errors[0].type).to.equal('ClassNotFound');
    });

    it('should return error when class does not have @IsTest', () => {
      const clsPath = path.join(classesDir, 'NotATest.cls');
      fs.writeFileSync(clsPath, 'public class NotATest {}');
      const result = validateTestClasses(['NotATest'], classesDir);
      expect(result.valid).to.be.false;
      expect(result.errors[0].type).to.equal('NotATestClass');
    });
  });

  describe('validateFlagsDirSyntax', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flags-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return error when flags dir does not exist', () => {
      const result = validateFlagsDirSyntax('nonexistent-dir');
      expect(result.valid).to.be.false;
      expect(result.errors[0].type).to.equal('PathNotFound');
    });

    it('should return valid with no warnings for clean files', () => {
      const filePath = path.join(tempDir, 'source-dir');
      fs.writeFileSync(filePath, 'force-app/main/default/classes\n');
      const result = validateFlagsDirSyntax(tempDir);
      expect(result.valid).to.be.true;
      expect(result.warnings).to.have.length(0);
    });

    it('should warn about CRLF line endings', () => {
      const filePath = path.join(tempDir, 'source-dir');
      fs.writeFileSync(filePath, 'force-app\r\nforce-app2\r\n');
      const result = validateFlagsDirSyntax(tempDir);
      expect(result.warnings.some((w) => w.type === 'CRLFDetected')).to.be.true;
    });

    it('should warn about backslashes', () => {
      const filePath = path.join(tempDir, 'source-dir');
      fs.writeFileSync(filePath, 'force-app\\main\\default\n');
      const result = validateFlagsDirSyntax(tempDir);
      expect(result.warnings.some((w) => w.type === 'BackslashDetected')).to.be.true;
    });

    it('should not warn about backslashes in comments', () => {
      const filePath = path.join(tempDir, 'source-dir');
      fs.writeFileSync(filePath, '# This is a comment with \\ backslash\nforce-app/main/default\n');
      const result = validateFlagsDirSyntax(tempDir);
      expect(result.warnings.filter((w) => w.type === 'BackslashDetected')).to.have.length(0);
    });
  });

  describe('applyFlagsDirFixes', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flags-fix-test-'));
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should convert CRLF to LF', () => {
      const filePath = path.join(tempDir, 'source-dir');
      fs.writeFileSync(filePath, 'line1\r\nline2\r\n');
      const result = applyFlagsDirFixes(tempDir);
      expect(result.fixesApplied.some((f) => f.type === 'CRLFDetected')).to.be.true;
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).to.not.include('\r\n');
      expect(content).to.include('\n');
    });

    it('should convert backslashes to forward slashes', () => {
      const filePath = path.join(tempDir, 'source-dir');
      fs.writeFileSync(filePath, 'force-app\\main\\default\n');
      const result = applyFlagsDirFixes(tempDir);
      expect(result.fixesApplied.some((f) => f.type === 'BackslashDetected')).to.be.true;
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).to.not.include('\\');
      expect(content).to.equal('force-app/main/default\n');
    });

    it('should not modify comments', () => {
      const filePath = path.join(tempDir, 'source-dir');
      fs.writeFileSync(filePath, '# Comment with \\ backslash\nforce-app/main\n');
      applyFlagsDirFixes(tempDir);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).to.include('# Comment with \\ backslash');
    });
  });

  describe('combineValidationResults', () => {
    it('should combine multiple results', () => {
      const result1 = { valid: true, errors: [], warnings: [] };
      const result2 = {
        valid: false,
        errors: [{ type: 'PathNotFound' as const, message: 'test', path: '/test' }],
        warnings: [],
      };
      const combined = combineValidationResults(result1, result2);
      expect(combined.valid).to.be.false;
      expect(combined.errors).to.have.length(1);
    });

    it('should be valid when all inputs are valid', () => {
      const result1 = { valid: true, errors: [], warnings: [] };
      const result2 = { valid: true, errors: [], warnings: [] };
      const combined = combineValidationResults(result1, result2);
      expect(combined.valid).to.be.true;
    });
  });
});
