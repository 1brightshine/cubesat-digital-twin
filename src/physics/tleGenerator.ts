/**
 * NORAD Two-Line Element (TLE) Formatter and Exporter
 */

import { KeplerianElements, CubeSatSpec } from '../types';
import { MU_EARTH, radToDeg, trueToEccentricAnomaly } from './orbitalMechanics';

/**
 * Computes TLE checksum modulo 10
 * Each digit counts as face value; minus signs count as 1; other chars count as 0
 */
function computeChecksum(line: string): number {
  let sum = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch >= '0' && ch <= '9') {
      sum += parseInt(ch, 10);
    } else if (ch === '-') {
      sum += 1;
    }
  }
  return sum % 10;
}

/**
 * Converts standard scientific notation to TLE-style decimal + exponent representation
 * e.g. 0.12345e-4 -> 12345-4
 */
function formatBstar(value: number): string {
  if (value === 0) return ' 00000-0';
  const sign = value < 0 ? '-' : ' ';
  const absVal = Math.abs(value);
  const exp = Math.floor(Math.log10(absVal)) + 1;
  const mantissa = Math.round((absVal / Math.pow(10, exp)) * 100000);
  const mantissaStr = mantissa.toString().padStart(5, '0');
  const expSign = exp <= 0 ? '-' : '+';
  const expAbs = Math.abs(exp).toString();
  return `${sign}${mantissaStr}${expSign}${expAbs}`;
}

export function generateTLE(
  elements: KeplerianElements,
  cubeSat: CubeSatSpec,
  satNumber = 99999
): { line0: string; line1: string; line2: string; fullText: string } {
  const line0 = cubeSat.name.toUpperCase().slice(0, 24);

  // Mean motion (revs per day)
  const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(elements.a, 3) / MU_EARTH);
  const meanMotion = 86400 / periodSec;

  // Mean anomaly from true anomaly
  const nuRad = (elements.trueAnomaly * Math.PI) / 180;
  const e = Math.min(0.99, Math.max(0, elements.e));
  const E_rad = trueToEccentricAnomaly(nuRad, e);
  let M_deg = radToDeg(E_rad - e * Math.sin(E_rad)) % 360;
  if (M_deg < 0) M_deg += 360;

  // Epoch day calculation
  const epoch = elements.epochDate || new Date();
  const yearFull = epoch.getUTCFullYear();
  const year2Dig = (yearFull % 100).toString().padStart(2, '0');
  const startOfYear = new Date(Date.UTC(yearFull, 0, 1));
  const dayOfYear = (epoch.getTime() - startOfYear.getTime()) / 86400000 + 1;
  const dayFraction = dayOfYear.toFixed(8).padStart(12, '0');

  // BSTAR drag term: B* = (rho_0 / 2) * (Cd * A / m)
  // Using reference rho_0 = 0.1570 kg/m² / Earth-radius
  const totalArea = cubeSat.dragArea + (cubeSat.hasDragSail ? cubeSat.dragSailArea : 0);
  const bStarVal = ((cubeSat.dragCoefficient * totalArea) / cubeSat.mass) * 0.05;
  const bStarFormatted = formatBstar(bStarVal);

  // Line 1 without checksum (68 chars)
  // Format: 1 NNNNNC NNNNNAAA YYDDD.DDDDDDDD +.NNNNNNNN +NNNNN-N +NNNNN-N N NNNNN
  const satNumStr = satNumber.toString().padStart(5, '0');
  const rawLine1 =
    `1 ${satNumStr}U 26001A   ${year2Dig}${dayFraction}  .00001000  00000-0 ${bStarFormatted} 0  999`;
  const chk1 = computeChecksum(rawLine1);
  const line1 = `${rawLine1}${chk1}`;

  // Line 2 without checksum (68 chars)
  // Format: 2 NNNNN III.IIII RRR.RRRR EEEEEEE PPP.PPPP MMM.MMMM NN.NNNNNNNNRRRRR
  const incStr = elements.i.toFixed(4).padStart(8, ' ');
  const raanStr = (elements.raan % 360).toFixed(4).padStart(8, ' ');
  const eccStr = Math.round(e * 10000000)
    .toString()
    .padStart(7, '0');
  const argPStr = (elements.argPerigee % 360).toFixed(4).padStart(8, ' ');
  const mStr = M_deg.toFixed(4).padStart(8, ' ');
  const mmStr = meanMotion.toFixed(8).padStart(11, ' ');
  const revNum = '00001';

  const rawLine2 = `2 ${satNumStr} ${incStr} ${raanStr} ${eccStr} ${argPStr} ${mStr} ${mmStr}${revNum}`;
  const chk2 = computeChecksum(rawLine2);
  const line2 = `${rawLine2}${chk2}`;

  const fullText = `${line0}\n${line1}\n${line2}`;

  return { line0, line1, line2, fullText };
}
