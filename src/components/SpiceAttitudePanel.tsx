/**
 * NASA SPICE Geometry, Orekit Perturbations & CubeSat Attitude Dynamics Panel
 * Provides NAIF SPICE WebGeocalc eclipse/beta angle geometry,
 * Orekit-grade J2-J4 and 3rd-body perturbation breakdowns,
 * and CubeSat attitude/tumbling simulation controls.
 */

import React from 'react';
import {
  SpiceGeometryState,
  OrekitPerturbationMetrics,
  AttitudeDynamicsState,
  DynamicAttitudeMode,
  CubeSatSpec,
} from '../types';
import {
  Sun,
  Moon,
  Compass,
  Zap,
  RotateCw,
  Orbit,
  Cpu,
  Info,
  Shield,
  Activity,
  Maximize2,
  Gauge,
  Sparkles,
} from 'lucide-react';

interface SpiceAttitudePanelProps {
  spice: SpiceGeometryState;
  perturbations: OrekitPerturbationMetrics;
  attitude: AttitudeDynamicsState;
  cubeSat: CubeSatSpec;
  onAttitudeModeChange: (mode: DynamicAttitudeMode) => void;
  onTumblingRpmChange: (rpm: number) => void;
  onOpenNasaSpiceModal?: (tab?: 'spice' | 'celestrak' | 'spacetrack') => void;
}

export const SpiceAttitudePanel: React.FC<SpiceAttitudePanelProps> = ({
  spice,
  perturbations,
  attitude,
  cubeSat,
  onAttitudeModeChange,
  onTumblingRpmChange,
  onOpenNasaSpiceModal,
}) => {
  const isContinuousSunlight = Math.abs(spice.betaAngleDeg) > 68;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-5 text-slate-100 shadow-xl backdrop-blur-sm">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>NASA SPICE &amp; Attitude Dynamics Engine</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono">
                Orekit Flight Dynamics
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              NAIF WebGeocalc planetary geometry, dual-cone eclipse windows &amp; CubeSat attitude tumbling
            </p>
          </div>
        </div>

        {/* Live Eclipse State Chip & Launch Modal Button */}
        <div className="flex items-center gap-2">
          {onOpenNasaSpiceModal && (
            <button
              onClick={() => onOpenNasaSpiceModal('spice')}
              className="px-2.5 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/50 text-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Launch NASA NAIF SPICE WebGeocalc & TLE Console"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>NASA WebGeocalc API</span>
            </button>
          )}

          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
              spice.eclipseState === 'sunlight'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : spice.eclipseState === 'penumbra'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
            }`}
          >
            {spice.eclipseState === 'sunlight' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Full Sunlight ({Math.round(spice.eclipseFraction * 100)}%)</span>
              </>
            ) : spice.eclipseState === 'penumbra' ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Penumbra ({Math.round(spice.eclipseFraction * 100)}%)</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Total Umbra (0%)</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 1. NASA SPICE Planetary Geometry & Solar Power Telemetry */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-amber-400" />
            NAIF SPICE Geometry &amp; Solar Power Telemetry
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            AU: {(spice.earthSunDistKm / 149597870.7).toFixed(4)} AU
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Solar Power Generation */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Solar Power</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="font-mono text-base font-bold text-amber-300">
              {spice.solarPowerOutputWatts.toFixed(2)} W
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Flux: {Math.round(spice.solarFluxWm2)} W/m&sup2;
            </div>
          </div>

          {/* Orbit Beta Angle */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Beta Angle (&beta;)</span>
              <Orbit className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="font-mono text-base font-bold text-cyan-300">
              {spice.betaAngleDeg.toFixed(1)}&deg;
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {isContinuousSunlight ? 'Continuous Sunlight' : 'Standard Eclipses'}
            </div>
          </div>

          {/* Solar Phase Angle */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Solar Phase</span>
              <Compass className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="font-mono text-base font-bold text-blue-300">
              {spice.solarPhaseAngleDeg.toFixed(1)}&deg;
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Sun Inc: {attitude.sunAngleIncidenceDeg.toFixed(1)}&deg;
            </div>
          </div>

          {/* Moon Distance */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Moon Ephemeris</span>
              <Moon className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <div className="font-mono text-base font-bold text-slate-200">
              {Math.round(spice.earthMoonDistKm).toLocaleString()} km
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Sub-Solar: {spice.subSolarLat.toFixed(1)}&deg;Lat
            </div>
          </div>
        </div>
      </div>

      {/* 2. CubeSat Attitude Simulation & Tumbling Dynamics */}
      <div className="border-t border-slate-800 pt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span className="flex items-center gap-1.5">
            <RotateCw className="w-4 h-4 text-emerald-400" />
            CubeSat Attitude Simulation &amp; Tumbling Dynamics
          </span>
          <span className="font-mono text-[11px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
            {attitude.mode.toUpperCase()}
          </span>
        </div>

        {/* Attitude Mode Selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            {
              id: 'nadir' as DynamicAttitudeMode,
              name: 'Nadir-Pointing',
              desc: 'Earth-facing LVLH (Payload)',
            },
            {
              id: 'sun-pointing' as DynamicAttitudeMode,
              name: 'Sun-Pointing',
              desc: 'Max Solar Charging',
            },
            {
              id: 'ram-aerobrake' as DynamicAttitudeMode,
              name: 'Ram Aero-Brake',
              desc: 'Max Drag Deorbiting',
            },
            {
              id: 'tumbling' as DynamicAttitudeMode,
              name: 'Free Tumbling',
              desc: 'Post-Deploy Spin',
            },
            {
              id: 'detumbling-bdot' as DynamicAttitudeMode,
              name: 'B-Dot Detumble',
              desc: 'Magnetic Damping',
            },
          ].map((modeItem) => {
            const isSelected = attitude.mode === modeItem.id;
            return (
              <button
                key={modeItem.id}
                onClick={() => onAttitudeModeChange(modeItem.id)}
                className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/50 border-emerald-500/80 text-emerald-100 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-100 flex items-center justify-between">
                    <span>{modeItem.name}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                    {modeItem.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tumbling Speed Slider (when tumbling or detumbling) */}
        {(attitude.mode === 'tumbling' || attitude.mode === 'detumbling-bdot') && (
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2 animate-in fade-in">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                Rotational Tumbling Rate
              </span>
              <span className="font-mono text-emerald-300 font-bold text-xs">
                {attitude.tumblingRpm.toFixed(1)} RPM ({(attitude.tumblingRpm * 6).toFixed(0)} &deg;/s)
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="15"
              step="0.2"
              value={attitude.tumblingRpm}
              onChange={(e) => onTumblingRpmChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.5 RPM (Slow Drift)</span>
              <span>3.0 RPM (Nominal)</span>
              <span>12+ RPM (High Tip-off)</span>
            </div>
          </div>
        )}

        {/* Moments of Inertia & Euler Attitude Angles Readout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Inertia I_xx</span>
            <span className="font-mono text-slate-200 font-bold">
              {attitude.momentsOfInertiaKgM2[0].toExponential(3)} kg&middot;m&sup2;
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Inertia I_yy</span>
            <span className="font-mono text-slate-200 font-bold">
              {attitude.momentsOfInertiaKgM2[1].toExponential(3)} kg&middot;m&sup2;
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Inertia I_zz</span>
            <span className="font-mono text-slate-200 font-bold">
              {attitude.momentsOfInertiaKgM2[2].toExponential(3)} kg&middot;m&sup2;
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Euler Angles [&phi;, &theta;, &psi;]</span>
            <span className="font-mono text-emerald-300 font-bold">
              {Math.round(attitude.eulerDeg[0])}&deg;, {Math.round(attitude.eulerDeg[1])}&deg;, {Math.round(attitude.eulerDeg[2])}&deg;
            </span>
          </div>
        </div>
      </div>

      {/* 3. Orekit-Grade Orbital Perturbation Force Breakdown */}
      <div className="border-t border-slate-800 pt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-purple-400" />
            Orekit Orbital Perturbation Forces
          </span>
          <span className="font-mono text-[11px] text-purple-300 font-semibold">
            &Sigma; {perturbations.totalPerturbationAccelMs2.toExponential(3)} m/s&sup2;
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Earth J2 (Oblateness)</span>
            <span className="font-mono text-purple-300 font-bold">
              {perturbations.j2AccelMs2.toExponential(2)} m/s&sup2;
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Earth J3 (Pear)</span>
            <span className="font-mono text-slate-300 font-bold">
              {perturbations.j3AccelMs2.toExponential(2)} m/s&sup2;
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Earth J4</span>
            <span className="font-mono text-slate-300 font-bold">
              {perturbations.j4AccelMs2.toExponential(2)} m/s&sup2;
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Moon 3rd-Body</span>
            <span className="font-mono text-cyan-300 font-bold">
              {perturbations.lunarGravityAccelMs2.toExponential(2)} m/s&sup2;
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Sun 3rd-Body</span>
            <span className="font-mono text-amber-300 font-bold">
              {perturbations.solarGravityAccelMs2.toExponential(2)} m/s&sup2;
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Radiation (SRP)</span>
            <span className="font-mono text-rose-300 font-bold">
              {perturbations.solarRadiationPressureAccelMs2.toExponential(2)} m/s&sup2;
            </span>
          </div>
        </div>

        <div className="bg-purple-950/20 border border-purple-800/30 rounded-xl p-3 text-[11px] text-purple-200/90 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
          <span>
            Orekit precision flight dynamics: Earth oblateness ($J_2$) drives nodal regression of{' '}
            <strong className="text-white font-mono">{perturbations.nodalPrecessionDegPerDay.toFixed(2)}&deg;/day</strong> and apsidal rotation of{' '}
            <strong className="text-white font-mono">{perturbations.apsidalPrecessionDegPerDay.toFixed(2)}&deg;/day</strong>.
          </span>
        </div>
      </div>
    </div>
  );
};
