import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HACKATHON_STAGES,
  getHackathonLifecycle,
  migrateLegacyStages,
  normalizeHackathonStages,
  sortHackathons,
  validateHackathonDates
} from '../server/services/hackathonLifecycle.js';
import { buildHackathonNotifications } from '../server/services/hackathonNotifications.js';

function configuredStages(start = '2026-11-01', end = '2026-11-30', none = []) {
  const dates = {
    registered: [start, start],
    ideation: ['2026-11-02', '2026-11-04'],
    proposal: ['2026-11-05', '2026-11-08'],
    prototype: ['2026-11-09', '2026-11-16'],
    demo: ['2026-11-17', '2026-11-24'],
    pitch: ['2026-11-25', end]
  };
  return HACKATHON_STAGES.map(stage => ({
    key: stage.key,
    availability: none.includes(stage.key) ? 'none' : 'scheduled',
    startDate: dates[stage.key][0],
    endDate: dates[stage.key][1]
  }));
}

test('hackathon stage setup requires the six standard stages and supports optional None rounds', () => {
  const allScheduled = normalizeHackathonStages(configuredStages(), '2026-11-01', '2026-11-30');
  assert.equal(allScheduled.stages.length, 6);
  const optionalNone = normalizeHackathonStages(configuredStages('2026-11-01', '2026-11-30', ['proposal', 'demo']), '2026-11-01', '2026-11-30');
  assert.equal(optionalNone.stages.find(stage => stage.key === 'proposal').availability, 'none');
  assert.equal(optionalNone.stages.find(stage => stage.key === 'proposal').startDate, '');
  assert.equal(normalizeHackathonStages(configuredStages().slice(1), '2026-11-01', '2026-11-30').error, 'Configure all six hackathon stages.');
  const invalidAvailability = configuredStages();
  invalidAvailability[1].availability = 'skipped';
  assert.match(normalizeHackathonStages(invalidAvailability, '2026-11-01', '2026-11-30').error, /Scheduled or None/);
});

test('hackathon date validation enforces valid overall and per-stage ranges and ordering', () => {
  assert.equal(validateHackathonDates('2026-11-01', '2026-11-30'), null);
  assert.match(validateHackathonDates('2026-02-30', '2026-03-01'), /Valid overall/);
  const outOfRange = configuredStages();
  outOfRange[2].endDate = '2026-12-01';
  assert.match(normalizeHackathonStages(outOfRange, '2026-11-01', '2026-11-30').error, /within the overall/);
  const unordered = configuredStages();
  unordered[2].startDate = '2026-11-03';
  assert.match(normalizeHackathonStages(unordered, '2026-11-01', '2026-11-30').error, /previous scheduled stage/);
  const requiredNone = configuredStages('2026-11-01', '2026-11-30', ['registered']);
  assert.match(normalizeHackathonStages(requiredNone, '2026-11-01', '2026-11-30').error, /required lifecycle/);
});

test('legacy hackathon milestone records can be mapped into six stage definitions', () => {
  const migrated = migrateLegacyStages([
    { name: 'Ideation & Problem Statement', deadline: '2026-07-10', status: 'completed' },
    { name: 'System Architecture & Prototype', deadline: '2026-08-01' }
  ], '2026-07-01', '2027-01-20', '2026-07-05');
  assert.equal(migrated.length, 6);
  assert.equal(migrated.find(stage => stage.key === 'ideation').status, 'completed');
  assert.equal(migrated.find(stage => stage.key === 'prototype').availability, 'scheduled');
  assert.equal(migrated.find(stage => stage.key === 'demo').availability, 'none');
});

test('current stage and lifecycle derive from dates without falsely submitting an expired hackathon', () => {
  const hackathon = {
    startDate: '2026-11-01', endDate: '2026-11-30', submissionStatus: 'not-submitted',
    stages: normalizeHackathonStages(configuredStages(), '2026-11-01', '2026-11-30').stages
  };
  assert.deepEqual(getHackathonLifecycle(hackathon, '2026-11-12'), { status: 'active', currentStage: 'prototype', nextStage: 'demo' });
  assert.equal(getHackathonLifecycle(hackathon, '2026-12-01').status, 'expired');
  assert.equal(getHackathonLifecycle(hackathon, '2026-12-01').currentStage, 'pitch');
  assert.equal(getHackathonLifecycle({ ...hackathon, submissionStatus: 'submitted' }, '2026-12-01').status, 'submitted');
});

test('hackathons sort active first, then oldest created, leaving expired and submitted records in history', () => {
  const make = (_id, createdAt, lifecycleStatus) => ({ _id, createdAt, lifecycleStatus, startDate:'2026-11-01', endDate: lifecycleStatus === 'expired' ? '2026-11-10' : '2026-11-30', submissionStatus: lifecycleStatus === 'submitted' ? 'submitted' : 'not-submitted', stages: [] });
  const sorted = sortHackathons([
    make('old-submitted', '2026-01-01', 'submitted'),
    make('new-active', '2026-04-01', 'active'),
    make('old-active', '2026-02-01', 'active'),
    make('expired', '2026-01-15', 'expired')
  ]);
  assert.deepEqual(sorted.map(item => item._id), ['old-active', 'new-active', 'expired', 'old-submitted']);
});

test('notification plan skips None stages, includes stage and final deadlines, and suppresses submitted records', () => {
  const stages = normalizeHackathonStages(configuredStages('2026-11-01', '2026-11-30', ['proposal', 'demo']), '2026-11-01', '2026-11-30').stages;
  const hackathon = { _id:'hack-1', userId:'user-1', title:'Test Sprint', startDate:'2026-11-01', endDate:'2026-11-30', submissionStatus:'not-submitted', stages };
  const now = new Date('2026-11-10T00:00:00.000Z');
  const alerts = buildHackathonNotifications(hackathon, now);
  assert.ok(alerts.some(alert => alert.stageKey === 'prototype' && alert.type === 'stage-deadline'));
  assert.ok(alerts.some(alert => alert.stageKey === 'final-deadline' && alert.type === 'final-deadline'));
  assert.equal(alerts.some(alert => alert.stageKey === 'proposal' || alert.stageKey === 'demo'), false);
  assert.equal(buildHackathonNotifications({ ...hackathon, submissionStatus:'submitted' }, now).length, 0);
  assert.equal(new Set(alerts.map(alert => alert.key)).size, alerts.length);
});
