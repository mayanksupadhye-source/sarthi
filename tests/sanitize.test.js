import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRequest } from '../server/middleware/sanitize.js';

test('sanitizeRequest supports Express 5 getter-only req.query and removes Mongo operators', () => {
  const requestPrototype = {};
  Object.defineProperty(requestPrototype, 'query', {
    get() { return { search: 'habits', '$where': 'malicious', nested: { '$gt': 1, safe: 'value' } }; }
  });
  const req = Object.create(requestPrototype);
  let advanced = false;

  assert.doesNotThrow(() => sanitizeRequest(req, {}, () => { advanced = true; }));
  assert.equal(advanced, true);
  assert.deepEqual(req.query, { search: 'habits', nested: { safe: 'value' } });
  assert.equal(Object.hasOwn(req, 'query'), true);
});
