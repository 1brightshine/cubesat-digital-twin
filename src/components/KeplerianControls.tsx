/**
 * Keplerian Elements and Orbital Geometry Controls
 */

import React, { useState } from 'react';
import { KeplerianElements, OrbitDerivedState, LifetimeSimulationResult } from '../types';
import { EARTH_RADIUS_KM } from '../physics/orbitalMechanics';
import { ORBIT_PRESETS, OrbitPreset } from '../data/presets';
import {
  Compass,
  Orbit,
  Sparkles,
  TrendingDown,
  ArrowUpRight,
  Globe,
  Sliders,
} from 'lucide-react';

interface KeplerianControlsProps {
  elements: KeplerianElements;
  derivedState: OrbitDerivedState;
  simulationResult?: LifetimeSimulationResult;
  onChange: (updated: KeplerianElements) => void;
  onSelectPreset: (preset: OrbitPreset) => void;
  onNavigateTab?: (tab: '3d' | 'groundTrack' | 'lifetime') => void;
}

export const KeplerianControls: React.FC<KeplerianControlsProps> = ({
  elements,
  derivedState,
  simulationResult,
  onChange,
  onSelectPreset,
  onNavigateTab,
}) => {
  const [inputMode, setInputMode] = useState<'altitude' | 'classical'>('altitude');

  const { a, e, i, raan, argPerigee, trueAnomaly } = elements;
  const perigeeAlt = a * (1 - e) - EARTH_RADIUS_KM;
  const apogeeAlt = a * (1 + e) - EARTH_RADIUS_KM;

  // Handle Perigee Altitude changes
  const handlePerigeeAltChange = (hp: number) => {
    const safeHp = Math.max(120, hp);
    const safeHa = Math.max(safeHp, apogeeAlt);
    const rP = EARTH_RADIUS_KM + safeHp;
    const rA = EARTH_RADIUS_KM + safeHa;
    const newA = (rP + rA) / 2;
    const newE = (rA - rP) / (rA + rP);
    onChange({ ...elements, a: newA, e: newE });
  };

  // Handle Apogee Altitude changes
  const handleApogeeAltChange = (ha: number) => {
    const safeHp = perigeeAlt;
    const safeHa = Math.max(safeHp, ha);
    const rP = EARTH_RADIUS_KM + safeHp;
    const rA = EARTH_RADIUS_KM + safeHa;
    const newA = (rP + rA) / 2;
    const newE = (rA - rP) / (rA + rP);
    onChange({ ...elements, a: newA, e: newE });
  };

  // Handle Classical (a, e) changes
  const handleSemiMajorAxisChange = (newA: number) => {
    const safeA = Math.max(EARTH_RADIUS_KM + 120, newA);
    onChange({ ...elements, a: safeA });
  };

  const handleEccentricityChange = (newE: number) => {
    const safeE = Math.max(0, Math.min(0.9, newE));
    // Ensure perigee is not below 120 km re-entry interface
    if (a * (1 - safeE) - EARTH_RADIUS_KM < 120) {
      const maxAllowedE = 1 - (EARTH_RADIUS_KM + 120) / a;
      onChange({ ...elements, e: Math.max(0, maxAllowedE) });
    } else {
      onChange({ ...elements, e: safeE });
    }
  };

  return (
    <div
      id="keplerian-controls-panel"
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5"
    >
      {/* Header with Preset Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Orbit className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-slate-100 text-sm">Keplerian Orbital Elements</h3>
        </div>

        {/* Input Mode Toggle */}
        <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60 text-xs">
          <button
            onClick={() => setInputMode('altitude')}
            className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
              inputMode === 'altitude'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Altitude (hp, ha)
          </button>
          <button
            onClick={() => setInputMode('classical')}
            className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
              inputMode === 'classical'
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Classical (a, e)
          </button>
        </div>
      </div>

      {/* Orbit Quick Presets Pills */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] text-slate-400 font-medium">Standard Orbit Presets:</div>
        <div className="flex flex-wrap gap-1.5">
          {ORBIT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700/70 hover:border-cyan-500/50 text-slate-200 hover:text-cyan-300 transition-all font-medium"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Dimensional Inputs (Altitude or Classical a, e) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {inputMode === 'altitude' ? (
          <>
            {/* Perigee Altitude */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Perigee Altitude (h_p)</span>
                <input
                  type="number"
                  min="120"
                  max="2500"
                  step="5"
                  value={Math.round(perigeeAlt * 10) / 10}
                  onChange={(e) => handlePerigeeAltChange(parseFloat(e.target.value) || 120)}
                  className="w-24 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-emerald-400 font-bold text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <input
                id="input-perigee-alt"
                type="range"
                min="120"
                max="2000"
                step="5"
                value={perigeeAlt}
                onChange={(e) => handlePerigeeAltChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>120 km (Limit)</span>
                <span>500 km</span>
                <span>2000 km</span>
              </div>
            </div>

            {/* Apogee Altitude */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Apogee Altitude (h_a)</span>
                <input
                  type="number"
                  min="120"
                  max="36000"
                  step="5"
                  value={Math.round(apogeeAlt * 10) / 10}
                  onChange={(e) => handleApogeeAltChange(parseFloat(e.target.value) || 120)}
                  className="w-24 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-rose-400 font-bold text-xs focus:border-rose-500 focus:outline-none"
                />
              </div>
              <input
                id="input-apogee-alt"
                type="range"
                min="120"
                max="2000"
                step="5"
                value={apogeeAlt}
                onChange={(e) => handleApogeeAltChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>120 km</span>
                <span>500 km</span>
                <span>2000 km</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Semi-Major Axis (a) */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Semi-Major Axis (a)</span>
                <input
                  type="number"
                  min={EARTH_RADIUS_KM + 120}
                  max={EARTH_RADIUS_KM + 35000}
                  step="10"
                  value={Math.round(a * 10) / 10}
                  onChange={(e) => handleSemiMajorAxisChange(parseFloat(e.target.value) || (EARTH_RADIUS_KM + 120))}
                  className="w-28 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-cyan-400 font-bold text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <input
                id="input-semi-major-axis"
                type="range"
                min={EARTH_RADIUS_KM + 120}
                max={EARTH_RADIUS_KM + 2500}
                step="10"
                value={a}
                onChange={(e) => handleSemiMajorAxisChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>{(EARTH_RADIUS_KM + 120).toFixed(0)} km</span>
                <span>{(EARTH_RADIUS_KM + 2500).toFixed(0)} km</span>
              </div>
            </div>

            {/* Eccentricity (e) */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Eccentricity (e)</span>
                <input
                  type="number"
                  min="0"
                  max="0.85"
                  step="0.001"
                  value={Math.round(e * 10000) / 10000}
                  onChange={(e) => handleEccentricityChange(parseFloat(e.target.value) || 0)}
                  className="w-24 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-amber-400 font-bold text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
              <input
                id="input-eccentricity"
                type="range"
                min="0"
                max="0.4"
                step="0.001"
                value={e}
                onChange={(e) => handleEccentricityChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.000 (Circular)</span>
                <span>0.200</span>
                <span>0.400 (Elliptical)</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Orientation Angles: Inclination, RAAN, Argument of Perigee */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Inclination (i) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Inclination (i)</span>
            <input
              type="number"
              min="0"
              max="180"
              step="0.1"
              value={Math.round(i * 100) / 100}
              onChange={(e) => onChange({ ...elements, i: parseFloat(e.target.value) || 0 })}
              className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-cyan-300 font-bold text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <input
            id="input-inclination"
            type="range"
            min="0"
            max="180"
            step="0.1"
            value={i}
            onChange={(e) => onChange({ ...elements, i: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          {/* Quick presets for inclination */}
          <div className="flex flex-wrap gap-1 text-[9px] pt-1">
            {[
              { name: '0° Eq', val: 0 },
              { name: '51.6° ISS', val: 51.64 },
              { name: '90° Polar', val: 90 },
              { name: '97.6° SSO', val: 97.59 },
            ].map((p) => (
              <button
                key={p.name}
                onClick={() => onChange({ ...elements, i: p.val })}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* RAAN (Omega) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">RAAN (&Omega;)</span>
            <input
              type="number"
              min="0"
              max="360"
              step="1"
              value={Math.round(raan * 10) / 10}
              onChange={(e) => onChange({ ...elements, raan: parseFloat(e.target.value) || 0 })}
              className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-purple-300 font-bold text-xs focus:border-purple-500 focus:outline-none"
            />
          </div>
          <input
            id="input-raan"
            type="range"
            min="0"
            max="360"
            step="1"
            value={raan}
            onChange={(e) => onChange({ ...elements, raan: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0°</span>
            <span>180°</span>
            <span>360°</span>
          </div>
        </div>

        {/* Argument of Perigee (omega) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Arg of Perigee (&omega;)</span>
            <input
              type="number"
              min="0"
              max="360"
              step="1"
              value={Math.round(argPerigee * 10) / 10}
              onChange={(e) =>
                onChange({ ...elements, argPerigee: parseFloat(e.target.value) || 0 })
              }
              className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-amber-300 font-bold text-xs focus:border-amber-500 focus:outline-none"
            />
          </div>
          <input
            id="input-arg-perigee"
            type="range"
            min="0"
            max="360"
            step="1"
            value={argPerigee}
            onChange={(e) =>
              onChange({ ...elements, argPerigee: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0°</span>
            <span>180°</span>
            <span>360°</span>
          </div>
        </div>
      </div>

      {/* Live Detected Lifetime & Dynamic Calculation Feedback */}
      {simulationResult && (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 p-4 rounded-xl border border-cyan-500/40 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Detected Lifetime for this Orbit:
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg font-bold font-mono text-slate-100">
                  {simulationResult.lifetimeYears >= 100
                    ? '> 100 Years'
                    : simulationResult.lifetimeYears < 1.5
                    ? `${simulationResult.lifetimeDays.toFixed(0)} Days`
                    : `${simulationResult.lifetimeYears.toFixed(2)} Years`}
                </span>
                <span className="text-xs text-amber-400 font-mono">
                  &bull; Decay: {simulationResult.decayRateKmPerDay.toFixed(4)} km/day
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateTab && (
              <>
                <button
                  onClick={() => onNavigateTab('3d')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700"
                >
                  <Orbit className="w-3.5 h-3.5 text-cyan-400" />
                  <span>3D View</span>
                </button>
                <button
                  onClick={() => onNavigateTab('groundTrack')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700"
                >
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ground Track</span>
                </button>
                <button
                  onClick={() => onNavigateTab('lifetime')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-md hover:shadow-cyan-500/20"
                >
                  <span>Lifetime Chart</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* J2 Secular Perturbations & Derived Physical Readouts */}
      <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 text-xs">
        <div className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Earth J2 Oblateness Secular Perturbations
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
          <div>
            <span className="text-slate-400 block text-[10px]">Nodal Drift (d&Omega;/dt):</span>
            <span className="text-cyan-300 font-semibold">
              {derivedState.nodalPrecessionDegPerDay > 0 ? '+' : ''}
              {derivedState.nodalPrecessionDegPerDay.toFixed(3)}°/day
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">Apsidal Drift (d&omega;/dt):</span>
            <span className="text-amber-300 font-semibold">
              {derivedState.apsidalPrecessionDegPerDay > 0 ? '+' : ''}
              {derivedState.apsidalPrecessionDegPerDay.toFixed(3)}°/day
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">Orbital Period:</span>
            <span className="text-slate-200 font-semibold">
              {derivedState.orbitalPeriodMin.toFixed(2)} min
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">Mean Motion:</span>
            <span className="text-slate-200 font-semibold">
              {derivedState.meanMotionRevsPerDay.toFixed(2)} revs/day
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
