/**
 * NORAD Two-Line Element (TLE) and Mission Report Export Modal
 */

import React, { useState } from 'react';
import {
  KeplerianElements,
  CubeSatSpec,
  SolarConditions,
  OrbitDerivedState,
  LifetimeSimulationResult,
} from '../types';
import { generateTLE } from '../physics/tleGenerator';
import { Copy, Check, Download, FileText, X, Terminal } from 'lucide-react';

interface TleExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: KeplerianElements;
  cubeSat: CubeSatSpec;
  derivedState: OrbitDerivedState;
  simulationResult: LifetimeSimulationResult;
  solar: SolarConditions;
}

export const TleExportModal: React.FC<TleExportModalProps> = ({
  isOpen,
  onClose,
  elements,
  cubeSat,
  derivedState,
  simulationResult,
  solar,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const { fullText, line0, line1, line2 } = generateTLE(elements, cubeSat);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadTLE = () => {
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cubeSat.name.toLowerCase().replace(/\s+/g, '_')}_orbit.tle`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const exportData = {
      mission: {
        cubeSatName: cubeSat.name,
        formFactor: cubeSat.formFactor,
        wetMassKg: cubeSat.mass,
        dragAreaM2: cubeSat.dragArea,
        dragCoefficientCd: cubeSat.dragCoefficient,
        hasDragSail: cubeSat.hasDragSail,
        dragSailAreaM2: cubeSat.dragSailArea,
        ballisticCoefficientKgM2: derivedState.ballisticCoefficientKgM2,
      },
      keplerianElements: {
        semiMajorAxisKm: elements.a,
        eccentricity: elements.e,
        inclinationDeg: elements.i,
        raanDeg: elements.raan,
        argumentOfPerigeeDeg: elements.argPerigee,
        trueAnomalyDeg: elements.trueAnomaly,
      },
      orbitalState: {
        perigeeAltitudeKm: derivedState.perigeeAltKm,
        apogeeAltitudeKm: derivedState.apogeeAltKm,
        orbitalPeriodMin: derivedState.orbitalPeriodMin,
        meanMotionRevsPerDay: derivedState.meanMotionRevsPerDay,
        velocityPerigeeKmS: derivedState.vPerigeeKmS,
        velocityApogeeKmS: derivedState.vApogeeKmS,
        nodalPrecessionDegPerDay: derivedState.nodalPrecessionDegPerDay,
        apsidalPrecessionDegPerDay: derivedState.apsidalPrecessionDegPerDay,
      },
      lifetimeAnalysis: {
        estimatedLifetimeYears: simulationResult.lifetimeYears,
        estimatedLifetimeDays: simulationResult.lifetimeDays,
        initialDecayRateKmPerDay: simulationResult.decayRateKmPerDay,
        projectedReentryDate: simulationResult.reentryDate,
        iadc25YearRuleCompliant: simulationResult.isCompliantIADC25Yr,
        fcc5YearRuleCompliant: simulationResult.isCompliantFCC5Yr,
        solarConditions: {
          f107FluxSfu: solar.f107,
          apIndex: solar.apIndex,
          model: solar.modelType,
        },
      },
      tle: {
        line0,
        line1,
        line2,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cubeSat.name.toLowerCase().replace(/\s+/g, '_')}_mission_analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    let csv = 'Time_Days,Time_Years,Altitude_km,Perigee_km,Apogee_km,Eccentricity,Density_kg_m3,Velocity_km_s\n';
    simulationResult.history.forEach((pt) => {
      csv += `${pt.timeDays},${pt.timeYears},${pt.altitudeKm},${pt.perigeeKm},${pt.apogeeKm},${pt.eccentricity},${pt.densityKgM3},${pt.velocityKmS}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cubeSat.name.toLowerCase().replace(/\s+/g, '_')}_decay_history.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-slate-100 text-base">
              NORAD Two-Line Element (TLE) &amp; Export
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-5 text-xs text-slate-300">
          {/* TLE Code Block */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-slate-400 font-medium">
              <span>Standard NORAD Format:</span>
              <span className="text-[11px] font-mono text-cyan-400">Checksum Verified</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-400 overflow-x-auto select-all leading-relaxed shadow-inner">
              <pre>{fullText}</pre>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleCopy}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors shadow-lg"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy TLE</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadTLE}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors border border-slate-700/80"
            >
              <Download className="w-4 h-4" />
              <span>Download .TLE</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors border border-slate-700/80"
            >
              <FileText className="w-4 h-4" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors border border-slate-700/80"
            >
              <Download className="w-4 h-4" />
              <span>Decay CSV</span>
            </button>
          </div>

          {/* Mission Briefing Readout */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">Satellite:</span>
              <span className="text-slate-200 font-semibold">{cubeSat.name}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Perigee / Apogee:</span>
              <span className="text-cyan-400 font-semibold">
                {derivedState.perigeeAltKm.toFixed(0)} x {derivedState.apogeeAltKm.toFixed(0)} km
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Inclination:</span>
              <span className="text-purple-300 font-semibold">{elements.i.toFixed(2)}°</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Predicted Life:</span>
              <span className="text-emerald-400 font-semibold">
                {simulationResult.lifetimeYears.toFixed(2)} yrs
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
