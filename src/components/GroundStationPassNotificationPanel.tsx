/**
 * Ground Station Pass Scheduling & Notification Panel
 * Identifies the next 3 upcoming satellite passes over a selected ground station
 * based on real orbital mechanics & astrodynamics data (AOS, TCA, LOS, Max Elevation, Doppler).
 */

import React, { useState, useMemo } from 'react';
import { KeplerianElements, GroundStation } from '../types';
import {
  predictUpcomingPasses,
  PassPrediction,
  formatPassDuration,
  formatTimeUntilPass,
  azimuthToCompass,
} from '../physics/passPredictor';
import {
  Radio,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  Wifi,
  Sun,
  Moon,
  Compass,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle,
  Bell,
  MapPin,
} from 'lucide-react';

interface GroundStationPassNotificationPanelProps {
  elements: KeplerianElements;
  groundStations: GroundStation[];
  simDate: Date;
  selectedStationId?: string;
  onSelectStation?: (stationId: string) => void;
  className?: string;
}

export const GroundStationPassNotificationPanel: React.FC<
  GroundStationPassNotificationPanelProps
> = ({
  elements,
  groundStations,
  simDate,
  selectedStationId,
  onSelectStation,
  className = '',
}) => {
  const [internalStationId, setInternalStationId] = useState<string>(
    selectedStationId || groundStations[0]?.id || 'svalbard'
  );
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const activeStationId = selectedStationId || internalStationId;
  const currentStation =
    groundStations.find((s) => s.id === activeStationId) || groundStations[0];

  const handleStationChange = (id: string) => {
    setInternalStationId(id);
    if (onSelectStation) {
      onSelectStation(id);
    }
  };

  // Predict the next 3 upcoming passes over the selected station using real orbital data
  const upcomingPasses: PassPrediction[] = useMemo(() => {
    if (!currentStation) return [];
    return predictUpcomingPasses(elements, simDate, currentStation, 3, 48);
  }, [elements, simDate, currentStation]);

  const activePass = upcomingPasses.find((p) => p.status === 'active');

  const formatUtcTime = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
  };

  if (!currentStation) return null;

  return (
    <div
      id="ground-station-pass-scheduler"
      className={`rounded-2xl bg-slate-950/95 backdrop-blur-md border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs transition-all ${className}`}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className={`w-4 h-4 ${activePass ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'}`} />
            {activePass && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 text-[11px] tracking-wide">
                PASS SCHEDULE (NEXT 3 PASSES)
              </span>
              {activePass ? (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50 animate-pulse">
                  ACTIVE UPLINK
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                  REAL ASTRODYNAMICS
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Station Dropdown Selector & Minimize Toggle */}
        <div className="flex items-center gap-1.5">
          <select
            value={currentStation.id}
            onChange={(e) => handleStationChange(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 text-cyan-300 rounded-lg px-2 py-1 text-[11px] font-sans font-medium focus:outline-none focus:border-cyan-500 max-w-[150px] sm:max-w-[190px] truncate"
            title="Select target Ground Station for pass schedule"
          >
            {groundStations.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
            title={isMinimized ? 'Expand Schedule' : 'Minimize Schedule'}
          >
            {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Panel Body */}
      {!isMinimized && (
        <div className="p-3 flex flex-col gap-2.5">
          {/* Station Coordinates & Mask Info */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-900/50 px-2.5 py-1 rounded-lg border border-slate-800/60 font-sans">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-cyan-400" />
              <span>
                {currentStation.lat.toFixed(2)}°N, {currentStation.lon.toFixed(2)}°E &bull; Horizon Mask: &ge;{currentStation.minElevationDeg}°
              </span>
            </div>
            <span className="font-mono text-cyan-300">
              {upcomingPasses.length} passes predicted
            </span>
          </div>

          {/* List of the Next 3 Passes */}
          {upcomingPasses.length === 0 ? (
            <div className="text-center py-4 text-slate-500 font-sans text-[11px]">
              No passes detected within the 48-hour horizon for this station inclination.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingPasses.map((pass, index) => {
                const isOverhead = pass.maxElevationDeg >= 50;
                const isLow = pass.maxElevationDeg < 20;

                return (
                  <div
                    key={`${pass.stationId}-pass-${index}`}
                    className={`p-2.5 rounded-xl border transition-all ${
                      pass.status === 'active'
                        ? 'bg-emerald-950/40 border-emerald-500/70 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                        : index === 0
                        ? 'bg-slate-900/80 border-cyan-500/40'
                        : 'bg-slate-900/40 border-slate-800/70'
                    }`}
                  >
                    {/* Pass Header: Number, Countdown, and Duration */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                            pass.status === 'active'
                              ? 'bg-emerald-500 text-slate-950 font-bold animate-pulse'
                              : index === 0
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          #{pass.passNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold ${
                              pass.status === 'active'
                                ? 'text-emerald-300 animate-pulse'
                                : index === 0
                                ? 'text-cyan-300'
                                : 'text-slate-200'
                            }`}
                          >
                            {pass.status === 'active' ? 'IN PROGRESS' : formatTimeUntilPass(pass.timeUntilAosSec)}
                          </span>
                          <span className="text-slate-500">&bull;</span>
                          <span className="text-slate-400 text-[11px] font-sans">
                            Duration: <strong className="text-slate-200 font-mono">{formatPassDuration(pass.durationSec)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Sunlight vs Eclipse Badge */}
                      <div className="flex items-center gap-1">
                        {pass.inSunlightAtTca ? (
                          <span
                            className="flex items-center gap-1 text-[10px] text-amber-400/90 font-sans"
                            title="Satellite is in direct sunlight during TCA"
                          >
                            <Sun className="w-3 h-3 text-amber-400" />
                            <span className="hidden sm:inline">Sunlit</span>
                          </span>
                        ) : (
                          <span
                            className="flex items-center gap-1 text-[10px] text-indigo-300 font-sans"
                            title="Satellite is in Earth shadow (umbra) during TCA"
                          >
                            <Moon className="w-3 h-3 text-indigo-400" />
                            <span className="hidden sm:inline">Eclipse</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pass Metrics Grid */}
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 text-[10px]">
                      {/* AOS Time */}
                      <div>
                        <div className="text-slate-500 text-[9px] uppercase">AOS (Rise)</div>
                        <div className="font-semibold text-slate-200 truncate">
                          {formatUtcTime(pass.aosTime)}
                        </div>
                        <div className="text-slate-400 text-[9px] truncate">
                          Az: {pass.aosAzimuthDeg.toFixed(0)}° ({azimuthToCompass(pass.aosAzimuthDeg)})
                        </div>
                      </div>

                      {/* Max Elevation (TCA) */}
                      <div>
                        <div className="text-slate-500 text-[9px] uppercase">Max El (TCA)</div>
                        <div className="flex items-center gap-1">
                          <span
                            className={`font-bold ${
                              isOverhead
                                ? 'text-emerald-400'
                                : isLow
                                ? 'text-amber-400'
                                : 'text-cyan-300'
                            }`}
                          >
                            {pass.maxElevationDeg.toFixed(1)}°
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {isOverhead ? 'Overhead' : isLow ? 'Horizon' : 'Mid'}
                          </span>
                        </div>
                        <div className="text-slate-400 text-[9px] truncate">
                          Range: {pass.minDistanceKm.toFixed(0)} km
                        </div>
                      </div>

                      {/* LOS (Set) & Doppler */}
                      <div>
                        <div className="text-slate-500 text-[9px] uppercase">LOS (Set)</div>
                        <div className="font-semibold text-slate-200 truncate">
                          {formatUtcTime(pass.losTime)}
                        </div>
                        <div className="text-slate-400 text-[9px] truncate">
                          Doppler: &plusmn;{pass.maxDopplerShiftKHz} kHz
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
