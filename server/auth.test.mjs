import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuth, createThrottle, MAX_AGE, readCookie } from './auth.mjs';

test('the password gates the session and nothing leaks through the token', () => {
  const auth = createAuth('hunter2');

  assert.equal(auth.enabled, true);
  assert.equal(auth.verify('hunter2'), true);
  assert.equal(auth.verify('hunter3'), false);
  assert.equal(auth.verify(undefined), false);

  const token = auth.issue();
  assert.equal(auth.valid(token), true);
  assert.equal(auth.valid(`${token}x`), false);
  assert.equal(auth.valid(token.split('.')[0]), false);
  assert.equal(auth.valid(''), false);
});

test('a token expires, and an empty password disables auth entirely', () => {
  let clock = 0;
  const auth = createAuth('hunter2', () => clock);
  const token = auth.issue();
  assert.equal(auth.valid(token), true);

  clock = (MAX_AGE + 1) * 1000;
  assert.equal(auth.valid(token), false);

  const off = createAuth('');
  assert.equal(off.enabled, false);
  assert.equal(off.valid(off.issue()), false);
  assert.equal(off.verify(''), false);
});

test('cookies parse and the throttle locks an address after repeated failures', () => {
  assert.equal(readCookie('a=1; juuku_session=abc.def; b=2', 'juuku_session'), 'abc.def');
  assert.equal(readCookie(undefined, 'juuku_session'), undefined);

  const throttle = createThrottle({ limit: 2 });
  assert.equal(throttle.blocked('10.0.0.5'), false);
  throttle.fail('10.0.0.5');
  throttle.fail('10.0.0.5');
  assert.equal(throttle.blocked('10.0.0.5'), true);
  throttle.clear('10.0.0.5');
  assert.equal(throttle.blocked('10.0.0.5'), false);
});

// A cookie the browser mangled is not a session. decodeURIComponent threw out of a
// synchronous route, so a `juuku_session=%` header answered 500 on every call,
// starting with the session check the app boots on.
test('a malformed session cookie is not a session', () => {
  assert.equal(readCookie('juuku_session=%', 'juuku_session'), undefined);
  assert.equal(readCookie('juuku_session=%E0%A4%A', 'juuku_session'), undefined);
  assert.equal(readCookie('juuku_session=abc%20def', 'juuku_session'), 'abc def');
});
