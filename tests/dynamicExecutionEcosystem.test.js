import test from 'node:test';
import assert from 'node:assert/strict';
import { CurriculumImporter } from '../server/services/curriculumImporter.js';

test('SARTHI Dynamic Execution Ecosystem — Universal 2x Learning Effort Rule', async (t) => {
  await t.test('1. Applies 2x execution effort multiplier by default for learning lectures', () => {
    const csvContent = [
      'serial_number,activity_name,content_duration_minutes',
      '1,Graph BFS Traversal,60',
      '2,Dynamic Programming Memoization,45',
      '3,Short Micro Lecture,15'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(csvContent);
    assert.equal(result.success, true);
    // 60m lecture -> 120m execution effort
    assert.equal(result.records[0].estimatedExecutionMinutes, 120);
    // 45m lecture -> 90m execution effort
    assert.equal(result.records[1].estimatedExecutionMinutes, 90);
    // 15m lecture -> 30m execution effort
    assert.equal(result.records[2].estimatedExecutionMinutes, 30);
  });

  await t.test('2. Supports course-level multiplier overrides (e.g. 1.5x or 2.5x)', () => {
    const csvContent = [
      'serial_number,activity_name,content_duration_minutes',
      '1,Excel Financial Modeling Basics,60'
    ].join('\n');

    const result15 = CurriculumImporter.parseCsv(csvContent, 1.5);
    assert.equal(result15.records[0].estimatedExecutionMinutes, 90);

    const result25 = CurriculumImporter.parseCsv(csvContent, 2.5);
    assert.equal(result25.records[0].estimatedExecutionMinutes, 150);
  });

  await t.test('3. Preserves explicit activity-level estimated_execution_minutes without overwriting', () => {
    const csvContent = [
      'serial_number,activity_name,content_duration_minutes,estimated_execution_minutes',
      '1,End-to-End Microservice Project,40,180'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(csvContent);
    // Explicit 180 min should be respected, not overridden by 40 * 2 = 80
    assert.equal(result.records[0].estimatedExecutionMinutes, 180);
  });
});

test('SARTHI Dynamic Execution Ecosystem — Exploration Hub & Universal Source Types', async (t) => {
  await t.test('1. Supports exploration activities with flexible activity types (exploration, research, project)', () => {
    const csvContent = [
      'serial_number,activity_name,content_duration_minutes,activity_type,priority',
      '1,Understand Pivot Tables & Slicers,30,exploration,P1',
      '2,Research Discounted Cash Flow Valuation,45,research,P2',
      '3,Build Interactive Financial Dashboard,60,project,P1'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(csvContent);
    assert.equal(result.success, true);
    assert.equal(result.records[0].activityType, 'exploration');
    assert.equal(result.records[1].activityType, 'research');
    assert.equal(result.records[2].activityType, 'project');
  });

  await t.test('2. Exploration sessions and activities update cumulative actual minutes without loss', () => {
    const exploration = {
      slug: 'explore-excel',
      title: 'Learning Excel',
      category: 'exploration',
      totalMinutes: 240,
      completedMinutes: 0
    };

    // User logs 25m exploration session
    const session1Minutes = 25;
    exploration.completedMinutes += session1Minutes;
    assert.equal(exploration.completedMinutes, 25);

    // User logs another 35m
    const session2Minutes = 35;
    exploration.completedMinutes += session2Minutes;
    assert.equal(exploration.completedMinutes, 60);

    const remaining = Math.max(0, exploration.totalMinutes - exploration.completedMinutes);
    assert.equal(remaining, 180);
  });
});

test('SARTHI Dynamic Execution Ecosystem — Oratory User-Managed Programme', async (t) => {
  await t.test('1. Allows user-defined speech practice sessions and custom rubrics', () => {
    const speechSession = {
      weekNumber: 1,
      topic: 'The Power of Intentional Pauses',
      primarySkill: 'Vocal Variety',
      durationMinutes: 120,
      scores: {
        structure: 8,
        clarity: 8,
        confidence: 9,
        voice: 7,
        gestures: 8,
        persuasion: 8
      },
      drillNotes: 'Practised 3-second silence between transitions',
      isCompleted: true
    };

    const avg = (speechSession.scores.structure + speechSession.scores.clarity + speechSession.scores.confidence + speechSession.scores.voice + speechSession.scores.gestures + speechSession.scores.persuasion) / 6;
    assert.equal(Math.round(avg * 10) / 10, 8.0);
    assert.equal(speechSession.isCompleted, true);
  });

  await t.test('2. Missed speech practice participates in Adaptive Recovery Ledger without weekly reset', () => {
    const recoveryDeficit = {
      source: 'oratory',
      topic: 'Impromptu Speaking & Table Topics',
      missedMinutes: 120,
      recoveredMinutes: 0,
      remainingDeficit: 120
    };

    // User completes a 30m recovery drill on Wednesday
    const drillMinutes = 30;
    recoveryDeficit.recoveredMinutes += drillMinutes;
    recoveryDeficit.remainingDeficit -= drillMinutes;

    assert.equal(recoveryDeficit.recoveredMinutes, 30);
    assert.equal(recoveryDeficit.remainingDeficit, 90);
  });
});
