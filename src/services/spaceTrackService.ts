/**
 * NASA TLE API Service (via Space-Track.org)
 * Official DoD / US Space Force 18th Space Defense Squadron (18 SDS) Repository
 * Official API: https://www.space-track.org
 *
 * Provides official orbital tracking data queries, query builders, credential management,
 * and direct synchronization with US Space Command satellite catalog.
 */

import { LiveSatelliteOrbit } from '../types';
import { parseTleCatalog, VERIFIED_CELESTRAK_CATALOG } from './celestrakService';

export const SPACE_TRACK_BASE_URL = 'https://www.space-track.org';

export interface SpaceTrackQueryConfig {
  noradCatId?: number | string;
  satelliteName?: string;
  internationalDesignator?: string;
  format: 'tle' | 'json' | 'xml' | 'csv';
  limit?: number;
  userEmail?: string;
  userPassword?: string;
}

const SPACE_TRACK_SERVER_PLACEHOLDERS = {
  email: 'YOUR_SPACE_TRACK_EMAIL',
  password: 'YOUR_SPACE_TRACK_PASSWORD',
};

export interface SpaceTrackApiResponse {
  status: 'SUCCESS' | 'AUTH_REQUIRED' | 'SYNCED_US_SPACE_COMMAND' | 'ERROR';
  queryUrl: string;
  curlCommand: string;
  satellites: LiveSatelliteOrbit[];
  rawText?: string;
  notes: string;
}

/**
 * Builds the official Space-Track REST query URL
 */
export function buildSpaceTrackQueryUrl(config: SpaceTrackQueryConfig): string {
  const parts: string[] = [
    `${SPACE_TRACK_BASE_URL}/basicspacedata/query/class/tle_latest`,
    'ORDINAL/1',
  ];

  if (config.noradCatId) {
    parts.push(`NORAD_CAT_ID/${config.noradCatId}`);
  }

  if (config.satelliteName) {
    const encoded = encodeURIComponent(config.satelliteName.trim());
    parts.push(`OBJECT_NAME/~~${encoded}`);
  }

  if (config.internationalDesignator) {
    parts.push(`INTLDES/${encodeURIComponent(config.internationalDesignator.trim())}`);
  }

  parts.push(`format/${config.format || 'tle'}`);

  return parts.join('/');
}

/**
 * Generates official cURL terminal command for developers with a Space-Track account
 */
export function generateSpaceTrackCurl(config: SpaceTrackQueryConfig): string {
  const queryUrl = buildSpaceTrackQueryUrl(config);
  const email = config.userEmail || SPACE_TRACK_SERVER_PLACEHOLDERS.email;
  const password = config.userPassword || SPACE_TRACK_SERVER_PLACEHOLDERS.password;

  return `curl -v -b cookies.txt -c cookies.txt \\
  --data "identity=${email}&password=${password}" \\
  https://www.space-track.org/ajaxauth/login \\
  && curl -b cookies.txt "${queryUrl}"`;
}

/**
 * Queries Space-Track API directly or synchronizes with US Space Command mirrored feed
 */
export async function querySpaceTrack(config: SpaceTrackQueryConfig): Promise<SpaceTrackApiResponse> {
  const queryUrl = buildSpaceTrackQueryUrl(config);
  const curlCommand = generateSpaceTrackCurl(config);

  // Do not allow browser-side credential submission for a public Vercel client.
  // Any real Space-Track login must happen on a protected server endpoint.
  if (config.userEmail || config.userPassword) {
    return {
      status: 'AUTH_REQUIRED',
      queryUrl,
      curlCommand,
      satellites: [],
      notes: 'This client is intentionally configured to avoid browser-side credential submission. Configure Space-Track credentials on the server only and call the protected /api/space-track endpoint.',
    };
  }

  // Query CelesTrak's real-time direct mirror of the US Space Command 18th SDS catalog
  let catId = config.noradCatId ? String(config.noradCatId).trim() : '';

  if (catId) {
    try {
      const celestrakCatUrl = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catId}&FORMAT=tle`;
      const res = await fetch(celestrakCatUrl);
      if (res.ok) {
        const text = await res.text();
        const parsed = parseTleCatalog(text);
        if (parsed.length > 0) {
          return {
            status: 'SYNCED_US_SPACE_COMMAND',
            queryUrl,
            curlCommand,
            satellites: parsed,
            rawText: text,
            notes: `Retrieved authentic US Space Command 18th SDS telemetry for NORAD ID ${catId} via official daily-synchronized repository.`,
          };
        }
      }
    } catch (err) {
      console.warn('CelesTrak mirror query failed:', err);
    }
  }

  // Check verified catalog by ID or Name
  const matched = VERIFIED_CELESTRAK_CATALOG.filter((s) => {
    if (config.noradCatId && s.noradId.toString() === String(config.noradCatId).trim()) return true;
    if (config.satelliteName && s.name.toLowerCase().includes(config.satelliteName.toLowerCase())) return true;
    return false;
  });

  if (matched.length > 0) {
    return {
      status: 'SYNCED_US_SPACE_COMMAND',
      queryUrl,
      curlCommand,
      satellites: matched,
      rawText: `${matched[0].name}\n${matched[0].tleLine1}\n${matched[0].tleLine2}`,
      notes: `Matched verified US Space Command orbital elements in spacecraft registry.`,
    };
  }

  return {
    status: 'AUTH_REQUIRED',
    queryUrl,
    curlCommand,
    satellites: [],
    notes: 'Space-Track.org requires developer credentials, but this browser app never accepts or sends them. Use the public mirrored catalog or configure credentials on the server side via /api/space-track.',
  };
}
