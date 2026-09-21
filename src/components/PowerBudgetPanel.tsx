/**
 * Real NASA Data CubeSat Power Budget & Electrical Power System (EPS) Panel
 * 
 * Features:
 * - NASA Solar Measurement Mission / TSIS-1 AM0 Solar Irradiance (1361.0 W/m²)
 * - Real Azur Space / Spectrolab 29.5% Triple-Junction Solar Cell model
 * - NASA Ames CubeSat Design Standard Subsystems breakdown (OBC, ADCS, EPS, Thermal, Payload, Comms)
 * - Orbit Energy Balance, Battery Depth-of-Discharge (DoD) LEO safety checks
 * - Ground Station Pass high-power downlink transmission power budget
 * - Interactive mission operational modes (Nominal, Science Imaging, Safe Mode, High-Rate Downlink)
 */

import React, { useState, useMemo } from 'react';
import { KeplerianElements, CubeSatSpec, OrbitDerivedState, SpiceGeometryState } from '../types';
import {
  calculatePowerBudget,
  OrbitPowerBudgetResult,
  PowerSubsystem,
  getNasaCubeSatSubsystems,
} from '../physics/powerBudget';
import {
  Zap,
  Battery,
  BatteryCharging,
  Sun,
  Moon,
  Radio,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  Info,
  Sliders,
  ChevronDown,
  CheckCircle2,
  Activity,
  ArrowUpRight,
} from 'lucide-react';

interface PowerBudgetPanelProps {
  elements: KeplerianElements;
  cubeSat?: CubeSatSpec;
  derivedState: OrbitDerivedState;
  spice?: SpiceGeometryState;
  isCompact?: boolean;
  onOpenFullModal?: () => void;
}

export type OperationalMode = 'nominal' | 'science' | 'safemode' | 'ground-contact';

export const PowerBudgetPanel: React.FC<PowerBudgetPanelProps> = ({
  elements,
  cubeSat = {
    name: 'AeroCube-3U',
    formFactor: '3U',
    mass: 4.0,
    dragArea: 0.0433,
    dragCoefficient: 2.2,
    hasDragSail: false,
    dragSailArea: 1.5,
    reflectivity: 1.3,
    dimensionsCm: { length: 10, width: 10, height: 34 },
    attitudeMode: 'nadir',
  },
  derivedState,
  spice,
  isCompact = false,
  onOpenFullModal,
}) => {
  const [operationalMode, setOperationalMode] = useState<OperationalMode>('nominal');
  const [batteryCapacityWh, setBatteryCapacityWh] = useState<number>(45.0);
  const [cellEfficiencyPct, setCellEfficiencyPct] = useState<number>(29.5);
  const [showSubsystemDetails, setShowSubsystemDetails] = useState<boolean>(!isCompact);

  // Adjust subsystems based on selected operational mode
  const activeSubsystems = useMemo<PowerSubsystem[]>(() => {
    const base = getNasaCubeSatSubsystems();
    return base.map((sub) => {
      if (operationalMode === 'safemode') {
        if (sub.id === 'payload') return { ...sub, dutyCyclePercent: 0, powerNominalWatts: 0 };
        if (sub.id === 'adcs') return { ...sub, powerNominalWatts: 0.70 }; // coarse sun-pointing
        if (sub.id === 'comms-tx') return { ...sub, dutyCyclePercent: 2, powerNominalWatts: 2.0 };
      } else if (operationalMode === 'science') {
        if (sub.id === 'payload') return { ...sub, dutyCyclePercent: 60, powerNominalWatts: 3.50 };
        if (sub.id === 'adcs') return { ...sub, powerNominalWatts: 1.80 }; // fine target tracking
      } else if (operationalMode === 'ground-contact') {
        if (sub.id === 'comms-tx') return { ...sub, dutyCyclePercent: 35, powerNominalWatts: 7.20 };
        if (sub.id === 'payload') return { ...sub, dutyCyclePercent: 10 };
      }
      return sub;
    });
  }, [operationalMode]);

  // Compute power budget using real NASA data
  const budget: OrbitPowerBudgetResult = useMemo(() => {
    return calculatePowerBudget(elements, cubeSat, derivedState, {
      batteryCapacityWh,
      cellEfficiency: cellEfficiencyPct / 100,
      customSubsystems: activeSubsystems,
    });
  }, [elements, cubeSat, derivedState, batteryCapacityWh, cellEfficiencyPct, activeSubsystems]);

  const periodMin = derivedState.orbitalPeriodMin || 94.6;
  const eclipseMin = derivedState.eclipseDurationMin || 35.2;
  const sunlitMin = Math.max(0, periodMin - eclipseMin);

  return (
    <div className="w-full flex flex-col gap-3 font-mono text-xs text-slate-200">
      {/* 1. Header & NASA Real-Data Reference Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-white text-xs">
              <span>NASA POWER BUDGET ANALYSIS</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px]">
                TSIS-1 Solar AM0
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-sans">
              Solar Constant: <strong className="text-amber-300">{budget.solarIrradianceWm2} W/m²</strong> (1 AU) &bull; Array: {(budget.solarArrayAreaM2 * 10000).toFixed(0)} cm² ({budget.cellEfficiencyPercent}% Triple-Junction)
            </div>
          </div>
        </div>

        {/* Operational Modes Selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
          <button
            onClick={() => setOperationalMode('nominal')}
            className={`px-2.5 py-1 rounded transition-colors ${
              operationalMode === 'nominal'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Nominal
          </button>
          <button
            onClick={() => setOperationalMode('science')}
            className={`px-2.5 py-1 rounded transition-colors ${
              operationalMode === 'science'
                ? 'bg-purple-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Payload Ops
          </button>
          <button
            onClick={() => setOperationalMode('ground-contact')}
            className={`px-2.5 py-1 rounded transition-colors ${
              operationalMode === 'ground-contact'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pass Downlink
          </button>
          <button
            onClick={() => setOperationalMode('safemode')}
            className={`px-2.5 py-1 rounded transition-colors ${
              operationalMode === 'safemode'
                ? 'bg-rose-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Safe Mode
          </button>
        </div>
      </div>

      {/* 2. Key Metrics 4-Card Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Card 1: Solar Power Generation */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>SOLAR GENERATION</span>
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="my-1">
            <span className="text-xl font-bold text-amber-300">
              +{budget.orbitAverageGenerationWatts.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 ml-1">W avg</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Peak: {budget.peakGenerationWatts.toFixed(1)}W | Sun: {sunlitMin.toFixed(0)}m/rev
          </div>
        </div>

        {/* Card 2: Spacecraft Average Load */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>AVG BUS LOAD</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="my-1">
            <span className="text-xl font-bold text-cyan-300">
              {budget.totalOrbitAverageLoadWatts.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 ml-1">W avg</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Day: {budget.daytimeLoadWatts.toFixed(1)}W | Eclipse: {budget.eclipseLoadWatts.toFixed(1)}W
          </div>
        </div>

        {/* Card 3: Net Power Margin (NASA Flight Standard >= 20%) */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>POWER MARGIN</span>
            {budget.isNasaCompliantMargin ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className="my-1 flex items-baseline gap-1">
            <span
              className={`text-xl font-bold ${
                budget.powerMarginPercent >= 20
                  ? 'text-emerald-400'
                  : budget.powerMarginPercent >= 0
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {budget.powerMarginPercent > 0 ? '+' : ''}
              {budget.powerMarginPercent.toFixed(1)}%
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            {budget.isNasaCompliantMargin ? (
              <span className="text-emerald-400 font-semibold">NASA Compliant (&ge;20%)</span>
            ) : (
              <span className="text-rose-400 font-semibold">Below 20% Guideline</span>
            )}
          </div>
        </div>

        {/* Card 4: Battery Depth-of-Discharge (DoD) */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span>BATTERY DoD</span>
            <Battery className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="my-1">
            <span
              className={`text-xl font-bold ${
                budget.dodStatus === 'optimal'
                  ? 'text-emerald-300'
                  : budget.dodStatus === 'acceptable'
                  ? 'text-amber-300'
                  : 'text-rose-300'
              }`}
            >
              {budget.depthOfDischargePercent.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 ml-1">DoD</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Cap: {budget.batteryCapacityWh}Wh | Drain: {budget.eclipseEnergyDrainedWh.toFixed(1)}Wh
          </div>
        </div>
      </div>

      {/* 3. Orbit Energy Balance Visual Bar & Pass Comm Link Capacity */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 font-semibold">ORBIT ENERGY BALANCE (Per Revolution):</span>
          <span className="font-mono text-cyan-300">
            Gen: <strong>{budget.energyGeneratedPerOrbitWh.toFixed(2)} Wh</strong> &bull; Drain: <strong>{budget.totalEnergyConsumedPerOrbitWh.toFixed(2)} Wh</strong> &bull; Net:{' '}
            <strong
              className={
                budget.netEnergyDeltaPerOrbitWh >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }
            >
              {budget.netEnergyDeltaPerOrbitWh > 0 ? '+' : ''}
              {budget.netEnergyDeltaPerOrbitWh.toFixed(2)} Wh
            </strong>
          </span>
        </div>

        {/* Visual Ratio Progress Bar */}
        <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex border border-slate-800">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{
              width: `${Math.min(
                100,
                (budget.energyGeneratedPerOrbitWh /
                  (budget.energyGeneratedPerOrbitWh + budget.totalEnergyConsumedPerOrbitWh || 1)) *
                  100
              )}%`,
            }}
            title="Solar Energy Input"
          />
          <div
            className="h-full bg-cyan-600 transition-all duration-300"
            style={{
              width: `${Math.min(
                100,
                (budget.totalEnergyConsumedPerOrbitWh /
                  (budget.energyGeneratedPerOrbitWh + budget.totalEnergyConsumedPerOrbitWh || 1)) *
                  100
              )}%`,
            }}
            title="Subsystem Energy Consumption"
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>Solar Input: +{budget.energyGeneratedPerOrbitWh.toFixed(2)} Wh</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 inline-block" />
            <span>Load Draw: -{budget.totalEnergyConsumedPerOrbitWh.toFixed(2)} Wh</span>
          </div>
          <div className="flex items-center gap-1 text-slate-300 font-mono">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>
              Pass Tx Energy: {budget.passEnergyDrainWh.toFixed(1)} Wh/pass ({budget.maxDailyCommTimeMin} min/day cap)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Subsystems Power Breakdown Toggle */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <button
          onClick={() => setShowSubsystemDetails(!showSubsystemDetails)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/80 hover:bg-slate-900 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-white text-[11px]">NASA Subsystem Power Consumption Table</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span>{showSubsystemDetails ? 'Collapse' : 'Expand Details'}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                showSubsystemDetails ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {showSubsystemDetails && (
          <div className="p-3 border-t border-slate-800 overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                  <th className="pb-1.5 font-semibold">Subsystem</th>
                  <th className="pb-1.5 font-semibold text-right">Nominal (W)</th>
                  <th className="pb-1.5 font-semibold text-right">Duty Cycle</th>
                  <th className="pb-1.5 font-semibold text-right">Avg Draw (W)</th>
                  <th className="pb-1.5 font-semibold text-right">Wh / Orbit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {budget.subsystems.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-900/40">
                    <td className="py-1 font-medium text-white flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          sub.category === 'obc'
                            ? 'bg-blue-400'
                            : sub.category === 'adcs'
                            ? 'bg-purple-400'
                            : sub.category === 'thermal'
                            ? 'bg-amber-400'
                            : sub.category === 'payload'
                            ? 'bg-emerald-400'
                            : sub.category === 'comms'
                            ? 'bg-cyan-400'
                            : 'bg-slate-400'
                        }`}
                      />
                      <span>{sub.name}</span>
                    </td>
                    <td className="py-1 text-right text-slate-400">
                      {sub.powerNominalWatts.toFixed(2)}W
                    </td>
                    <td className="py-1 text-right text-slate-400">{sub.dutyCyclePercent}%</td>
                    <td className="py-1 text-right font-bold text-cyan-300">
                      {sub.orbitAverageWatts.toFixed(2)}W
                    </td>
                    <td className="py-1 text-right text-slate-300">
                      {sub.energyPerOrbitWh.toFixed(2)} Wh
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
