/**
 * Orbital Lifetime and Atmospheric Drag Decay Analysis View
 * Featuring Recharts decay curves, compliance badges, and drag sail trade studies.
 */

import React, { useState } from 'react';
import {
  KeplerianElements,
  CubeSatSpec,
  SolarConditions,
  LifetimeSimulationResult,
} from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Wind,
  Layers,
  Sparkles,
  ArrowDownRight,
  TrendingDown,
  Info,
  Sliders,
  Cpu,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import {
  computeNasaExosphericTemp,
  getNasaScaleHeight,
} from '../physics/atmosphere';

interface LifetimeAnalysisViewProps {
  elements: KeplerianElements;
  cubeSat: CubeSatSpec;
  solar: SolarConditions;
  simulationResult: LifetimeSimulationResult;
  onUpdateDragSail: (hasSail: boolean, sailAreaM2: number) => void;
}

export const LifetimeAnalysisView: React.FC<LifetimeAnalysisViewProps> = ({
  elements,
  cubeSat,
  solar,
  simulationResult,
  onUpdateDragSail,
}) => {
  const [userTimeUnit, setUserTimeUnit] = useState<'auto' | 'years' | 'days'>('auto');
  const [interactiveSailArea, setInteractiveSailArea] = useState<number>(
    cubeSat.hasDragSail ? cubeSat.dragSailArea : 1.5
  );

  const {
    lifetimeDays,
    lifetimeYears,
    decayRateKmPerDay,
    decayRateKmPerYear,
    reentryDate,
    isCompliantIADC25Yr,
    isCompliantFCC5Yr,
    history,
    sailTradeStudy,
  } = simulationResult;

  // Smart active unit: automatically switch to days for missions under 1.5 years
  const activeTimeUnit: 'years' | 'days' =
    userTimeUnit === 'auto'
      ? lifetimeYears < 1.5
        ? 'days'
        : 'years'
      : userTimeUnit;

  // Format data for Recharts
  const chartData = history.map((pt) => ({
    time: activeTimeUnit === 'years' ? pt.timeYears : pt.timeDays,
    altitude: pt.altitudeKm,
    perigee: pt.perigeeKm,
    apogee: pt.apogeeKm,
    density: pt.densityKgM3.toExponential(2),
    velocity: pt.velocityKmS,
  }));

  // Handle Drag Sail Interactive Toggle & Slider
  const handleSailToggle = (enabled: boolean) => {
    onUpdateDragSail(enabled, interactiveSailArea);
  };

  const handleSailAreaSlider = (val: number) => {
    setInteractiveSailArea(val);
    if (cubeSat.hasDragSail) {
      onUpdateDragSail(true, val);
    }
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 110;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
    }
  };

  return (
    <div id="lifetime-analysis-container" className="flex flex-col gap-6 w-full">
      {/* NASA Astrodynamics Physics Engine Architecture Banner */}
      <div className="flex flex-wrap items-center justify-between bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/60 border border-blue-500/40 rounded-2xl p-3.5 shadow-xl text-xs gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 tracking-wide text-xs">
                NASA DAS 3.0 &bull; NRLMSISE-00 High-Fidelity Physics Engine
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-mono">
                {solar.atmosphereModel === 'jacchia-roberts'
                  ? 'Jacchia-Roberts 1970'
                  : solar.atmosphereModel === 'us-standard-1976'
                  ? 'US Standard 1976'
                  : 'NASA DAS 3.0 / NRLMSISE-00'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Exospheric Temp (T<sub>&infin;</sub>):{' '}
                <strong className="text-amber-300 font-mono">
                  {computeNasaExosphericTemp(solar.f107, solar.f107, solar.apIndex || 15)} K
                </strong>
              </span>
              <span>
                Scale Height (H<sub>p</sub>):{' '}
                <strong className="text-cyan-300 font-mono">
                  {getNasaScaleHeight(
                    elements.a * (1 - elements.e) - 6378.137,
                    solar.f107,
                    solar.apIndex || 15
                  ).toFixed(1)}{' '}
                  km
                </strong>
              </span>
              <span>
                Solar Radiation Pressure:{' '}
                <strong className="text-purple-300 font-mono">P<sub>&odot;</sub> = 4.56 &mu;N/m&sup2;</strong>
              </span>
              <span>
                Integrator:{' '}
                <strong className="text-emerald-300 font-mono">King-Hele Bessel I<sub>0</sub>, I<sub>1</sub>, I<sub>2</sub></strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Section: Key Mission Lifetime KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estimated Lifetime Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Estimated Lifetime</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-100 flex items-baseline gap-1.5">
              {lifetimeYears >= 100 ? (
                <span>&gt; 100 Yrs</span>
              ) : lifetimeYears < 1.0 ? (
                <>
                  <span>{lifetimeDays.toFixed(1)}</span>
                  <span className="text-sm font-sans font-normal text-slate-400">Days</span>
                </>
              ) : (
                <>
                  <span>{lifetimeYears.toFixed(2)}</span>
                  <span className="text-sm font-sans font-normal text-slate-400">Years</span>
                </>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span>Re-entry:</span>
              <span className="font-medium text-slate-200">{reentryDate}</span>
            </div>
          </div>
        </div>

        {/* Daily Decay Rate Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Current Decay Rate</span>
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-amber-400 flex items-baseline gap-1.5">
              {decayRateKmPerDay < 0.001 ? (
                <>
                  <span>{(decayRateKmPerDay * 1000).toFixed(1)}</span>
                  <span className="text-sm font-sans font-normal text-slate-400">m/day</span>
                </>
              ) : (
                <>
                  <span>{decayRateKmPerDay.toFixed(3)}</span>
                  <span className="text-sm font-sans font-normal text-slate-400">km/day</span>
                </>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              ~{decayRateKmPerYear.toFixed(1)} km/year altitude loss
            </div>
          </div>
        </div>

        {/* IADC 25-Year Rule */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">IADC / NASA 25-Yr Rule</span>
            {isCompliantIADC25Yr ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                  isCompliantIADC25Yr
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-700/50'
                }`}
              >
                {isCompliantIADC25Yr ? 'COMPLIANT (< 25y)' : 'NON-COMPLIANT'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              International space debris mitigation threshold.
            </div>
          </div>
        </div>

        {/* FCC 5-Year Rule */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">FCC 5-Yr Deorbit Rule</span>
            {isCompliantFCC5Yr ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                  isCompliantFCC5Yr
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                }`}
              >
                {isCompliantFCC5Yr ? 'COMPLIANT (< 5y)' : 'EXCEEDS 5 YEARS'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Mandatory post-mission disposal rule for US licenses.
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Interactive Decay Curve Chart */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-base">
              <TrendingDown className="w-4 h-4 text-cyan-400" />
              Orbital Altitude Decay Curve vs. Time
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulated secular semi-major axis, apogee, and perigee decay until re-entry interface (120 km)
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
            <button
              onClick={() => setUserTimeUnit('auto')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                userTimeUnit === 'auto'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
              title="Automatically choose Days or Years based on mission duration"
            >
              Auto ({activeTimeUnit === 'years' ? 'Yrs' : 'Days'})
            </button>
            <button
              onClick={() => setUserTimeUnit('years')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                userTimeUnit === 'years'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              Years
            </button>
            <button
              onClick={() => setUserTimeUnit('days')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                userTimeUnit === 'days'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              Days
            </button>
          </div>
        </div>

        {/* Recharts Area */}
        <div className="w-full h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                unit={activeTimeUnit === 'years' ? ' yr' : ' d'}
                label={{
                  value: activeTimeUnit === 'years' ? 'Simulation Time (Years)' : 'Simulation Time (Days)',
                  position: 'insideBottom',
                  offset: -12,
                  fill: '#94a3b8',
                  fontSize: 11,
                }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                domain={[(dataMin: number) => Math.max(0, Math.floor(Math.min(dataMin, 120) - 20)), 'auto']}
                unit=" km"
                label={{
                  value: 'Altitude (km)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#94a3b8',
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  color: '#f8fafc',
                  fontSize: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                }}
                formatter={(value: any, name?: any) => [
                  `${Number(value).toFixed(1)} km`,
                  name === 'apogee'
                    ? 'Apogee Altitude'
                    : name === 'perigee'
                    ? 'Perigee Altitude'
                    : 'Mean Altitude',
                ]}
                labelFormatter={(label) =>
                  `Time: ${label} ${activeTimeUnit === 'years' ? 'Years' : 'Days'}`
                }
              />
              {/* Critical Re-entry Line */}
              <ReferenceLine
                y={120}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Re-entry Threshold (120 km)',
                  fill: '#f43f5e',
                  fontSize: 10,
                  position: 'insideBottomRight',
                }}
              />

              <Line
                type="monotone"
                dataKey="apogee"
                name="apogee"
                stroke="#f43f5e"
                strokeWidth={1.8}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="perigee"
                name="perigee"
                stroke="#10b981"
                strokeWidth={1.8}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="altitude"
                name="meanAlt"
                stroke="#06b6d4"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-400 inline-block"></span>
            <span>Semi-Major Axis / Mean Altitude</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-500 inline-block"></span>
            <span>Perigee Altitude</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-500 inline-block"></span>
            <span>Apogee Altitude</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-rose-500 inline-block"></span>
            <span>Re-entry Interface (120 km)</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Drag Sail Trade Study & Deorbit Mitigation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Drag Sail What-If Tool */}
        <div className="lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
                <Wind className="w-4 h-4 text-purple-400" />
                Drag Sail Sizing Tool
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="drag-sail-toggle"
                  type="checkbox"
                  checked={cubeSat.hasDragSail}
                  onChange={(e) => handleSailToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deploy an aerodynamic de-orbit drag sail to drastically decrease lifetime and ensure compliance.
            </p>
          </div>

          <div className="flex flex-col gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Sail Surface Area:</span>
              <span className="font-mono text-purple-400 font-bold text-sm">
                {interactiveSailArea.toFixed(2)} m²
              </span>
            </div>

            <input
              id="sail-area-slider"
              type="range"
              min="0.1"
              max="4.0"
              step="0.1"
              value={interactiveSailArea}
              onChange={(e) => handleSailAreaSlider(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.1 m²</span>
              <span>1.5 m² (3U Sail)</span>
              <span>4.0 m²</span>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-xs flex justify-between items-center">
              <span className="text-slate-400">Total Drag Area:</span>
              <span className="font-mono text-slate-200">
                {(cubeSat.dragArea + (cubeSat.additionalArea || 0) + (cubeSat.hasDragSail ? interactiveSailArea : 0)).toFixed(3)} m²
              </span>
            </div>
          </div>

          <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-3 text-xs text-purple-200 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <span>
              {cubeSat.hasDragSail
                ? `Active drag sail provides a ${(
                    (cubeSat.dragArea + (cubeSat.additionalArea || 0) + interactiveSailArea) /
                    Math.max(0.001, cubeSat.dragArea + (cubeSat.additionalArea || 0))
                  ).toFixed(1)}x increase in ballistic cross-section.`
                : 'Toggle the switch above to deploy the drag sail in simulation and 3D view.'}
            </span>
          </div>
        </div>

        {/* Trade Study Table */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
                <Sliders className="w-4 h-4 text-cyan-400" />
                De-orbit Sail Area Trade Study
              </h4>
              <span className="text-xs text-slate-400">
                F10.7: {solar.f107} sfu ({solar.modelType})
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Predicted orbital lifetime across various sail deploy sizes for this exact satellite mass ({cubeSat.mass} kg) and orbit altitude.
            </p>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="pb-2">Sail Size</th>
                    <th className="pb-2">Total Area</th>
                    <th className="pb-2">Predicted Lifetime</th>
                    <th className="pb-2 text-center">IADC (25y)</th>
                    <th className="pb-2 text-center">FCC (5y)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {sailTradeStudy.map((row, idx) => {
                    const isCurrent =
                      cubeSat.hasDragSail &&
                      Math.abs(row.sailArea - cubeSat.dragSailArea) < 0.15;
                    const isBase = !cubeSat.hasDragSail && row.sailArea === 0;
                    return (
                      <tr
                        key={idx}
                        className={`transition-colors hover:bg-slate-800/40 ${
                          isCurrent || isBase ? 'bg-cyan-950/30 text-cyan-300 font-semibold' : 'text-slate-300'
                        }`}
                      >
                        <td className="py-2 flex items-center gap-1.5">
                          {row.sailArea === 0 ? 'No Sail' : `${row.sailArea.toFixed(2)} m²`}
                          {(isCurrent || isBase) && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-sans">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-slate-400">{row.totalArea.toFixed(3)} m²</td>
                        <td className="py-2 text-slate-100 font-bold">
                          {row.lifetimeYears >= 100
                            ? '> 100 Years'
                            : row.lifetimeYears < 1
                            ? `${row.lifetimeDays} Days`
                            : `${row.lifetimeYears} Years`}
                        </td>
                        <td className="py-2 text-center font-sans">
                          {row.iadcCompliant ? (
                            <span className="text-emerald-400 inline-flex items-center gap-0.5 text-[11px]">
                              PASS
                            </span>
                          ) : (
                            <span className="text-rose-400 text-[11px]">FAIL</span>
                          )}
                        </td>
                        <td className="py-2 text-center font-sans">
                          {row.fccCompliant ? (
                            <span className="text-emerald-400 inline-flex items-center gap-0.5 text-[11px]">
                              PASS
                            </span>
                          ) : (
                            <span className="text-amber-400 text-[11px]">FAIL</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              Atmospheric density is calculated using the US Standard Atmosphere 1976 / Jacchia model with solar cycle thermospheric expansion.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
