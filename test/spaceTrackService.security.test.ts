import test from 'node:test';
import assert from 'node:assert/strict';

import { generateSpaceTrackCurl } from '../src/services/spaceTrackService.ts';

test('generateSpaceTrackCurl redacts credentials instead of embedding them in browser-visible output', () => {
  const curl = generateSpaceTrackCurl({
    noradCatId: 25544,
    format: 'tle',
    userEmail: 'user@example.com',
    userPassword: 'super-secret-password',
  });

  assert.match(curl, /YOUR_SPACE_TRACK_EMAIL|YOUR_SPACE_TRACK_PASSWORD/);
  assert.doesNotMatch(curl, /user@example.com|super-secret-password/);
});
