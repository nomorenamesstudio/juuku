import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ApiError, binary } from './subsonic.mjs';

// Navidrome does not fail a missing cover with a status: it answers 200 and puts a
// subsonic error in the body. Passing that through as artwork meant the browser cached
// a JSON error in place of the cover for a day — the covers "disappeared" long after
// the server could serve them again.
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const stub = (body, contentType, status = 200) => {
  globalThis.fetch = async () =>
    new Response(body, { status, headers: { 'content-type': contentType } });
};

test('binary hands back a real image', async () => {
  stub('jpegbytes', 'image/jpeg');
  const art = await binary('getCoverArt', { id: 'al-1' });
  assert.equal(art.contentType, 'image/jpeg');
  assert.equal(art.body.toString(), 'jpegbytes');
});

test('binary refuses a 200 that carries an error instead of an image', async () => {
  stub('{"subsonic-response":{"status":"failed","error":{"code":70,"message":"Artwork not found"}}}', 'application/json');
  await assert.rejects(binary('getCoverArt', { id: 'al-missing' }), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 404, 'a missing cover is a 404, not a server error');
    return true;
  });

  // an unreadable artwork store is a different failure and must not look like a 404
  stub('{"subsonic-response":{"status":"failed","error":{"code":0,"message":"permission denied"}}}', 'application/json');
  await assert.rejects(binary('getCoverArt', { id: 'al-1' }), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 502);
    return true;
  });
});
