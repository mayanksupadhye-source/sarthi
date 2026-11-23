import test from 'node:test';
import assert from 'node:assert/strict';
import { CurriculumImporter } from '../server/services/curriculumImporter.js';

test('Universal Curriculum & CSV Importer — Parsing & Normalization', async (t) => {
  await t.test('1. Parses valid custom course CSV with full metadata', () => {
    const csvData = [
      'serial_number,activity_name,description,content_duration_minutes,estimated_execution_minutes,activity_type,priority,dependencies,optional_deadline,notes',
      '1,System Design Basics,High-level design principles,45,90,lecture,P1,,2026-12-01,Follow syllabus',
      '2,Consistent Hashing,Distributed cache partitioning,30,60,problem,P2,1,2026-12-03,Implement ring in C++',
      '3,Rate Limiter Design,Token bucket algorithm,60,120,project,P1,2,2026-12-10,Production-grade test'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(csvData);
    assert.equal(result.success, true);
    assert.equal(result.totalRows, 3);
    assert.equal(result.records[0].serialNumber, 1);
    assert.equal(result.records[0].title, 'System Design Basics');
    assert.equal(result.records[0].priority, 'P1');
    assert.equal(result.records[0].activityType, 'lecture');
    assert.equal(result.records[1].serialNumber, 2);
    assert.equal(result.records[1].estimatedExecutionMinutes, 60);
    assert.equal(result.records[2].activityType, 'project');
  });

  await t.test('2. Universal 2x Learning Effort Rule: Calculates 2x execution effort when omitted, and allows custom multipliers', () => {
    const csvData = [
      'serial_number,activity_name,content_duration_minutes',
      '10,Machine Learning Cost Functions,50'
    ].join('\n');

    // Default 2.0 multiplier
    const resultDefault = CurriculumImporter.parseCsv(csvData);
    assert.equal(resultDefault.success, true);
    assert.equal(resultDefault.records[0].contentDurationMinutes, 50);
    // 50 * 2.0 = 100 min
    assert.equal(resultDefault.records[0].estimatedExecutionMinutes, 100);

    // Custom 1.5 multiplier override
    const resultCustom = CurriculumImporter.parseCsv(csvData, 1.5);
    assert.equal(resultCustom.records[0].estimatedExecutionMinutes, 75);
  });

  await t.test('3. Rejects invalid CSV missing required header columns', () => {
    const invalidCsv = 'name,duration\nTest,40';
    assert.throws(() => {
      CurriculumImporter.parseCsv(invalidCsv);
    }, /Missing required CSV header column/);
  });

  await t.test('4. Skips rows with duplicate serial numbers with explicit warnings', () => {
    const csvData = [
      'serial_number,activity_name',
      '1,Initial Topic',
      '1,Duplicate Topic',
      '2,Second Topic'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(csvData);
    assert.equal(result.records.length, 2);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /Duplicate serial number '1' detected/);
  });

  await t.test('5. Supports flat exploration rows and preserves fractional configured effort', () => {
    const result = CurriculumImporter.parseCsv('serial_number,activity_name,content_duration_minutes,activity_type\n1,Explore finance,45,exploration', 1.5, { category: 'exploration' });
    assert.equal(result.records[0].contentDurationMinutes, 45);
    assert.equal(result.records[0].estimatedExecutionMinutes, 67.5);
    assert.equal(result.records[0].sectionName, 'Activities');
    assert.equal(result.records[0].subsectionName, null);
  });

  await t.test('6. Activity multiplier overrides configured course multiplier', () => {
    const result = CurriculumImporter.parseCsv('serial_number,activity_name,content_duration_minutes,activity_multiplier_override\n1,Override,45,1.25', 1.5);
    assert.equal(result.records[0].estimatedExecutionMinutes, 56.25);
    assert.equal(result.records[0].effortSource, 'activity-override');
  });
});

test('Universal Curriculum — Progress & Statistics Calculation', async (t) => {
  await t.test('1. Accurately calculates completion metrics across curriculum activities', () => {
    const mockActivities = [
      { activityNumber: 1, totalEffortMinutes: 90, actualMinutes: 90, status: 'completed' },
      { activityNumber: 2, totalEffortMinutes: 60, actualMinutes: 60, status: 'completed' },
      { activityNumber: 3, totalEffortMinutes: 120, actualMinutes: 40, status: 'in-progress' },
      { activityNumber: 4, totalEffortMinutes: 90, actualMinutes: 0, status: 'pending' }
    ];

    const totalActs = mockActivities.length;
    const completedActs = mockActivities.filter(a => a.status === 'completed').length;
    const totalMin = mockActivities.reduce((sum, a) => sum + a.totalEffortMinutes, 0);
    const completedMin = mockActivities
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + (a.actualMinutes || a.totalEffortMinutes), 0);
    const percent = Math.round((completedActs / totalActs) * 100);

    assert.equal(totalActs, 4);
    assert.equal(completedActs, 2);
    assert.equal(totalMin, 360);
    assert.equal(completedMin, 150);
    assert.equal(percent, 50);
  });
});
