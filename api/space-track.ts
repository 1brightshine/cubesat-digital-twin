const SPACE_TRACK_BASE_URL = 'https://www.space-track.org';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { noradCatId, satelliteName, format = 'tle' } = req.body || {};

  const email = process.env.SPACE_TRACK_EMAIL;
  const password = process.env.SPACE_TRACK_PASSWORD;

  if (!email || !password) {
    return res.status(500).json({
      status: 'AUTH_REQUIRED',
      notes: 'Missing server-side SPACE_TRACK_EMAIL or SPACE_TRACK_PASSWORD environment variables.',
      satellites: [],
      queryUrl: '',
      curlCommand: '',
    });
  }

  const params = new URLSearchParams({
    identity: email,
    password,
  });

  const loginRes = await fetch(`${SPACE_TRACK_BASE_URL}/ajaxauth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!loginRes.ok) {
    return res.status(401).json({
      status: 'AUTH_REQUIRED',
      notes: 'Server-side Space-Track authentication failed.',
      satellites: [],
    });
  }

  const query = new URL(`${SPACE_TRACK_BASE_URL}/basicspacedata/query/class/tle_latest/ORDINAL/1`);

  if (noradCatId) query.pathname += `/NORAD_CAT_ID/${encodeURIComponent(String(noradCatId))}`;
  if (satelliteName) query.pathname += `/OBJECT_NAME/~~${encodeURIComponent(String(satelliteName).trim())}`;
  query.pathname += `/format/${encodeURIComponent(String(format))}`;

  const dataRes = await fetch(query.toString(), {
    headers: { Accept: 'text/plain' },
    credentials: 'include',
  });

  if (!dataRes.ok) {
    return res.status(502).json({
      status: 'ERROR',
      notes: 'Space-Track query failed from the server.',
      satellites: [],
    });
  }

  const raw = await dataRes.text();

  return res.status(200).json({
    status: 'SUCCESS',
    notes: 'Successfully fetched authorized Space-Track data on the server.',
    rawText: raw,
    satellites: [],
    queryUrl: query.toString(),
  });
}
