import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeMongoInput, sanitizeCsvValue } from '../server/middleware/sanitize.js';
import { CurriculumImporter } from '../server/services/curriculumImporter.js';

test('Security Hardening — NoSQL Injection Defense', async (t) => {
  await t.test('1. Strips keys starting with $ or containing dots from plain objects', () => {
    const maliciousPayload = {
      username: 'student1',
      $where: 'this.password.length > 0',
      nested: {
        $gt: '',
        'config.admin': true,
        safeField: 'valid'
      },
      tags: ['study', { $ne: 'admin' }]
    };

    const sanitized = sanitizeMongoInput(maliciousPayload);

    assert.equal(sanitized.username, 'student1');
    assert.equal(sanitized.$where, undefined);
    assert.equal(sanitized.nested.$gt, undefined);
    assert.equal(sanitized.nested['config.admin'], undefined);
    assert.equal(sanitized.nested.safeField, 'valid');
    assert.equal(sanitized.tags[0], 'study');
    assert.equal(sanitized.tags[1].$ne, undefined);
  });

  await t.test('2. Preserves non-object primitives and arrays safely', () => {
    assert.equal(sanitizeMongoInput(42), 42);
    assert.equal(sanitizeMongoInput('plain string'), 'plain string');
    assert.equal(sanitizeMongoInput(null), null);
    assert.equal(sanitizeMongoInput(undefined), undefined);
    assert.deepEqual(sanitizeMongoInput([1, 2, 3]), [1, 2, 3]);
  });
});

test('Security Hardening — CSV Formula Injection Neutralization', async (t) => {
  await t.test('1. Neutralizes dangerous spreadsheet formula prefixes (=, +, -, @)', () => {
    assert.equal(sanitizeCsvValue('=cmd|"/C calc"!A0'), "'=cmd|\"/C calc\"!A0");
    assert.equal(sanitizeCsvValue('+SUM(A1:B10)'), "'+SUM(A1:B10)");
    assert.equal(sanitizeCsvValue('@HYPERLINK("evil.com")'), "'@HYPERLINK(\"evil.com\")");
    assert.equal(sanitizeCsvValue('-2+3+cmd|'), "'-2+3+cmd|");
  });

  await t.test('2. Preserves normal negative numbers and safe text without modification', () => {
    assert.equal(sanitizeCsvValue(-42), '-42');
    assert.equal(sanitizeCsvValue('-15'), '-15');
    assert.equal(sanitizeCsvValue('-3.1415'), '-3.1415');
    assert.equal(sanitizeCsvValue('Standard Activity Name'), 'Standard Activity Name');
    assert.equal(sanitizeCsvValue('P1 - High Priority'), 'P1 - High Priority');
  });
});

test('Curriculum Management — Universal CSV Importer', async (t) => {
  await t.test('1. Generates valid CSV template with correct column schema', () => {
    const csv = CurriculumImporter.generateCsvTemplate();
    assert.ok(typeof csv === 'string');
    assert.ok(csv.includes('serial_number,activity_name,description,content_duration_minutes,estimated_execution_minutes,activity_type,priority,dependencies,optional_deadline,notes'));
    assert.ok(csv.includes('Binary Search Fundamentals'));
  });

  await t.test('2. Parses clean CSV text into validated records', () => {
    const csvData = [
      'serial_number,activity_name,description,content_duration_minutes,estimated_execution_minutes,activity_type,priority,dependencies,optional_deadline,notes',
      '1,Dynamic Programming Basics,Memoization and Tabulation,60,120,problem,P1,,2026-12-01,LeetCode 70',
      '2,Grid Path Optimization,2D DP problems,45,90,problem,P2,1,2026-12-02,LeetCode 62'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(csvData);
    assert.equal(result.success, true);
    assert.equal(result.records.length, 2);
    assert.equal(result.records[0].serialNumber, 1);
    assert.equal(result.records[0].title, 'Dynamic Programming Basics');
    assert.equal(result.records[0].contentDurationMinutes, 60);
    assert.equal(result.records[0].estimatedExecutionMinutes, 120);
    assert.equal(result.records[0].activityType, 'problem');
    assert.equal(result.records[0].priority, 'P1');
  });

  await t.test('3. Detects duplicate serial numbers and skips duplicate row with warning', () => {
    const duplicateCsv = [
      'serial_number,activity_name,description,content_duration_minutes,estimated_execution_minutes,activity_type,priority,dependencies,optional_deadline,notes',
      '1,Task A,Desc A,30,60,problem,P1,,,',
      '1,Task B Duplicate,Desc B,40,80,lecture,P2,,,'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(duplicateCsv);
    assert.equal(result.success, true);
    assert.equal(result.records.length, 1);
    assert.ok(result.warnings.some(w => w.includes('Duplicate serial number \'1\' detected')));
  });

  await t.test('4. Corrects invalid priorities to safe default P2', () => {
    const invalidTypesCsv = [
      'serial_number,activity_name,description,content_duration_minutes,estimated_execution_minutes,activity_type,priority,dependencies,optional_deadline,notes',
      '1,Invalid Fields Activity,Testing fallback,30,60,exercise,P99,,,'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(invalidTypesCsv);
    assert.equal(result.success, true);
    assert.equal(result.records[0].activityType, 'exercise');
    assert.equal(result.records[0].priority, 'P2');
  });
});
