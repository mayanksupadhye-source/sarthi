import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { hashKeyToId, isQuietTime, kolkataToISO, getDateRange } from '../server/services/reminderPlanEngine.js';
import { config } from '../server/config/env.js';

describe('SARTHI Deployment & Notification Mechanics', () => {
  test('1. hashKeyToId generates positive, stable, deterministic 32-bit integers', () => {
    const keyA = 'checkin-morning-2026-11-16';
    const keyB = 'timetable-2026-11-16-09:00-dsa-trees';
    const keyC = 'hackathon-milestone-stage-1';

    const idA1 = hashKeyToId(keyA);
    const idA2 = hashKeyToId(keyA);
    assert.equal(idA1, idA2, 'Same key must yield identical numeric ID across runs');

    assert.ok(idA1 > 0, 'ID must be positive integer');
    assert.ok(idA1 <= 2147483647, 'ID must fit within 32-bit signed integer for Android');

    const idB = hashKeyToId(keyB);
    const idC = hashKeyToId(keyC);
    assert.notEqual(idA1, idB, 'Different keys should yield distinct IDs');
    assert.notEqual(idB, idC);
  });

  test('2. isQuietTime accurately detects quiet hours including overnight windows', () => {
    // Overnight window: 23:30 to 05:00
    assert.equal(isQuietTime('23:45', '23:30', '05:00'), true, '23:45 should be in quiet hours');
    assert.equal(isQuietTime('02:00', '23:30', '05:00'), true, '02:00 should be in quiet hours');
    assert.equal(isQuietTime('04:59', '23:30', '05:00'), true, '04:59 should be in quiet hours');
    assert.equal(isQuietTime('05:00', '23:30', '05:00'), true, '05:00 should be boundary');
    assert.equal(isQuietTime('05:01', '23:30', '05:00'), false, '05:01 should be active');
    assert.equal(isQuietTime('14:30', '23:30', '05:00'), false, '14:30 afternoon should be active');
    assert.equal(isQuietTime('22:00', '23:30', '05:00'), false, '22:00 should be active');
  });

  test('3. kolkataToISO constructs accurate ISO string aligned to Asia/Kolkata (+05:30)', () => {
    const iso = kolkataToISO('2026-11-16', '07:00');
    const d = new Date(iso);
    // 07:00 IST = 01:30 UTC
    assert.equal(d.toISOString(), '2026-11-16T01:30:00.000Z');
  });

  test('4. getDateRange generates consecutive calendar days inclusive', () => {
    const range = getDateRange('2026-11-16', '2026-11-19');
    assert.deepEqual(range, [
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19'
    ]);
  });

  test('5. Native Bearer Auth token distinction and signature validation', () => {
    const mockUser = {
      _id: '6735dbd0e9123456789abcde',
      email: 'test@sarthi.app',
      name: 'Student Pilot',
      role: 'user'
    };

    // Access token with type: 'access'
    const accessToken = jwt.sign(
      { id: mockUser._id, email: mockUser.email, role: mockUser.role, type: 'access' },
      config.jwtSecret,
      { expiresIn: '15m' }
    );

    const decodedAccess = jwt.verify(accessToken, config.jwtSecret);
    assert.equal(decodedAccess.type, 'access');
    assert.equal(decodedAccess.email, mockUser.email);

    // Refresh token with type: 'refresh'
    const refreshToken = jwt.sign(
      { id: mockUser._id, tokenId: 'uuid-1234-test', type: 'refresh' },
      config.jwtRefreshSecret,
      { expiresIn: '30d' }
    );

    const decodedRefresh = jwt.verify(refreshToken, config.jwtRefreshSecret);
    assert.equal(decodedRefresh.type, 'refresh');
    assert.equal(decodedRefresh.tokenId, 'uuid-1234-test');

    // Access secret should fail to verify refresh token signed with refresh secret
    assert.throws(() => {
      jwt.verify(refreshToken, config.jwtSecret);
    });
  });
});
