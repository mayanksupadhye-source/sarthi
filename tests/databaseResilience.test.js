import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectMongoUri, getDBStatus, requireDB } from '../server/config/db.js';

test('Database Architecture & Resilience — URI Inspector & Credentials Guard', async (t) => {
  await t.test('1. Accurately redacts password while keeping username and host intact', () => {
    const rawUri = 'mongodb+srv://admin_user:SuperSecretPassword123@ac-civbuks-shard-00-00.9bufqyi.mongodb.net/sarthi?retryWrites=true&w=majority';
    const result = inspectMongoUri(rawUri);

    assert.equal(result.valid, true);
    assert.equal(result.hasAngleBrackets, false);
    assert.equal(result.username, 'admin_user');
    assert.equal(result.host, 'ac-civbuks-shard-00-00.9bufqyi.mongodb.net');
    assert.equal(result.database, 'sarthi');
    assert.ok(!result.sanitizedUri.includes('SuperSecretPassword123'));
    assert.ok(result.sanitizedUri.includes('[REDACTED]'));
  });

  await t.test('2. Detects unreplaced Atlas placeholder brackets <password>', () => {
    const rawUriWithBrackets = 'mongodb+srv://mayank:<my_actual_password>@cluster0.mongodb.net/sarthi';
    const result = inspectMongoUri(rawUriWithBrackets);

    assert.equal(result.valid, true);
    assert.equal(result.hasAngleBrackets, true);
  });

  await t.test('3. Handles missing or empty URI gracefully', () => {
    assert.equal(inspectMongoUri('').valid, false);
    assert.equal(inspectMongoUri(null).valid, false);
    assert.equal(inspectMongoUri(undefined).valid, false);
  });
});

test('Database Architecture & Resilience — Health Status & Fail-Safe Guard', async (t) => {
  await t.test('1. getDBStatus returns structured diagnostics object', () => {
    const status = getDBStatus();
    assert.ok(typeof status === 'object');
    assert.ok('connected' in status);
    assert.ok('readyState' in status);
    assert.ok('stateDescription' in status);
    assert.ok('reconnectAttempts' in status);
    assert.ok('host' in status);
    assert.ok('name' in status);
  });

  await t.test('2. requireDB middleware responds with HTTP 503 and Retry-After header when disconnected', () => {
    let capturedStatus = null;
    let capturedJson = null;
    let capturedHeaders = {};

    const req = {};
    const res = {
      setHeader: (k, v) => { capturedHeaders[k] = v; },
      status: (code) => {
        capturedStatus = code;
        return {
          json: (data) => { capturedJson = data; }
        };
      }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    // Since in unit test disconnected readyState is 0, requireDB should intercept
    requireDB(req, res, next);

    assert.equal(capturedStatus, 503);
    assert.equal(capturedHeaders['Retry-After'], '3');
    assert.equal(capturedJson.success, false);
    assert.ok(capturedJson.error.includes('Database temporarily unavailable'));
    assert.equal(nextCalled, false);
  });
});
