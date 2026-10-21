import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonWrites } from './json-writes.mjs';

// The guard sits in front of every mutating route, so it is what stands between a
// cross-site form and the jukebox. It also has to let the app's own writes through:
// `req.is('application/json')` looked equivalent and rejected every DELETE, because
// type-is answers null for a request that carries no body.
function guard(method, contentType) {
  const req = { method, headers: contentType === undefined ? {} : { 'content-type': contentType } };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let passed = false;
  jsonWrites(req, res, () => {
    passed = true;
  });
  return { passed, status: res.statusCode, body: res.body };
}

test('writes must declare application/json, reads do not', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(guard(method, 'application/json').passed, true, `${method} as JSON passes`);
    assert.equal(guard(method, 'application/json; charset=utf-8').passed, true, `${method} with a charset passes`);
    assert.equal(guard(method).status, 415, `${method} without a content type is refused`);
    assert.equal(guard(method, 'text/plain').status, 415, `${method} as text is refused`);
    assert.equal(guard(method, 'application/x-www-form-urlencoded').status, 415, `${method} as a form is refused`);
  }

  assert.equal(guard('GET').passed, true, 'reads need no content type');
  assert.equal(guard('GET', 'text/plain').passed, true, 'a read with a stray content type still reads');
});

test('a write with no body is still a write', () => {
  // the app sends exactly this on every DELETE and on the player restart
  assert.equal(guard('DELETE', 'application/json').passed, true);
  assert.equal(guard('POST', 'application/json').passed, true);
});
