/**
 * NASA SPICE WebGeocalc & US Space Command TLE APIs Hub
 * Combines:
 * 1. NASA NAIF SPICE WebGeocalc API (Exact planetary geometry, occultations, eclipse windows)
 * 2. CelesTrak TLE API (Live US Space Command daily elements)
 * 3. NASA TLE API via Space-Track.org (Official 18th Space Defense Squadron repository)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LiveSatelliteOrbit,
  CubeSatSpec,
  KeplerianElements,
  SpiceGeometryState,
} from '../types';
import {
  fetchWebGeocalcKernelSets,
  executeWebGeocalcCalculation,
  calculateUpcomingEclipseWindows,
  getPlanetaryGeometries,
  OFFICIAL_SPICE_KERNEL_SETS,
  EclipseWindowResult,
  WebGeocalcApiResponse,
} from '../services/nasaSpiceService';
import {
  fetchCelestrakGroup,
  fetchCelestrakByCatnr,
  fetchCelestrakByName,
  searchSatellites,
  VERIFIED_CELESTRAK_CATALOG,
} from '../services/celestrakService';
import {
  querySpaceTrack,
  buildSpaceTrackQueryUrl,
  generateSpaceTrackCurl,
  SpaceTrackQueryConfig,
} from '../services/spaceTrackService';
import { extractKeplerianFromSatrec, initSgp4Satrec } from '../physics/sgp4Propagator';
import {
  X,
  Search,
  Satellite,
  Download,
  ExternalLink,
  RefreshCw,
  Radio,
  CheckCircle2,
  Orbit,
  Sparkles,
  Info,
  Sun,
  Moon,
  Zap,
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  Cpu,
  Layers,
  Clock,
  Shield,
  Send,
  Database,
} from 'lucide-react';

interface NasaSpiceApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSatellite: (
    sat: LiveSatelliteOrbit,
    elements: KeplerianElements,
    cubeSatSpecPatch?: Partial<CubeSatSpec>
  ) => void;
  currentSatName?: string;
  elements: KeplerianElements;
  cubeSat: CubeSatSpec;
  derivedAltKm: number;
  spiceState?: SpiceGeometryState;
  currentSatPosKm: { x: number; y: number; z: number };
  currentSatVelKm: { x: number; y: number; z: number };
  initialTab?: 'spice' | 'celestrak' | 'spacetrack';
}

export const NasaSpiceApiModal: React.FC<NasaSpiceApiModalProps> = ({
  isOpen,
  onClose,
  onSelectSatellite,
  currentSatName,
  elements,
  cubeSat,
  derivedAltKm,
  spiceState,
  currentSatPosKm,
  currentSatVelKm,
  initialTab = 'spice',
}) => {
  const [activeTab, setActiveTab] = useState<'spice' | 'celestrak' | 'spacetrack'>(initialTab);

  // --- TAB 1: NASA SPICE WebGeocalc API State ---
  const [calcType, setCalcType] = useState<'OCCULTATION_INTERVALS' | 'SUB_SOLAR_POINT' | 'ANGULAR_SEPARATION' | 'STATE_VECTOR'>('OCCULTATION_INTERVALS');
  const [targetBody, setTargetBody] = useState<string>('EARTH');
  const [selectedKernelId, setSelectedKernelId] = useState<number>(1);
  const [isExecutingSpice, setIsExecutingSpice] = useState<boolean>(false);
  const [spiceApiResponse, setSpiceApiResponse] = useState<WebGeocalcApiResponse | null>(null);
  const [batteryCapacityWh, setBatteryCapacityWh] = useState<number>(20.0);
  const [subsystemPowerWatts, setSubsystemPowerWatts] = useState<number>(3.0);
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);

  // Eclipse Windows derived from SPICE
  const eclipseWindows: EclipseWindowResult[] = useMemo(() => {
    return calculateUpcomingEclipseWindows(
      currentSatPosKm,
      currentSatVelKm,
      (2 * Math.PI * Math.sqrt(Math.pow(elements.a, 3) / 398600.4418)) / 60,
      derivedAltKm,
      elements.i,
      new Date(),
      cubeSat.dragArea * 1.5,
      0.295,
      batteryCapacityWh,
      subsystemPowerWatts,
      4
    );
  }, [currentSatPosKm, currentSatVelKm, elements, derivedAltKm, cubeSat, batteryCapacityWh, subsystemPowerWatts]);

  // Planetary separations
  const planetaryGeometries = useMemo(() => {
    return getPlanetaryGeometries(new Date(), currentSatPosKm);
  }, [currentSatPosKm]);

  // --- TAB 2: CelesTrak TLE API State ---
  const [celestrakCatalog, setCelestrakCatalog] = useState<LiveSatelliteOrbit[]>(VERIFIED_CELESTRAK_CATALOG);
  const [celestrakSearch, setCelestrakSearch] = useState<string>('');
  const [celestrakGroup, setCelestrakGroup] = useState<string>('cubesat');
  const [selectedSat, setSelectedSat] = useState<LiveSatelliteOrbit>(VERIFIED_CELESTRAK_CATALOG[0]);
  const [isLoadingCelestrak, setIsLoadingCelestrak] = useState<boolean>(false);
  const [directCatnrInput, setDirectCatnrInput] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Filtered CelesTrak satellites
  const filteredSats = useMemo(() => {
    return searchSatellites(celestrakCatalog, celestrakSearch, 'all');
  }, [celestrakCatalog, celestrakSearch]);

  // --- TAB 3: NASA Space-Track.org API State ---
  const [spaceTrackCatId, setSpaceTrackCatId] = useState<string>('25544');
  const [spaceTrackName, setSpaceTrackName] = useState<string>('');
  const [spaceTrackEmail, setSpaceTrackEmail] = useState<string>('');
  const [spaceTrackPassword, setSpaceTrackPassword] = useState<string>('');
  const [isQueryingSpaceTrack, setIsQueryingSpaceTrack] = useState<boolean>(false);
  const [spaceTrackResponse, setSpaceTrackResponse] = useState<any>(null);
  const [copiedSpaceTrackCurl, setCopiedSpaceTrackCurl] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Handler: Run NASA NAIF WebGeocalc Calculation
  const handleRunWebGeocalc = async () => {
    setIsExecutingSpice(true);
    try {
      const res = await executeWebGeocalcCalculation(
        {
          calculationType: calcType,
          targetBody,
          observerBody: 'CUBESAT_LEO',
          referenceFrame: 'J2000',
          aberrationCorrection: 'NONE',
          timeUTC: new Date().toISOString(),
          kernelSetId: selectedKernelId,
        },
        currentSatPosKm,
        currentSatVelKm
      );
      setSpiceApiResponse(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExecutingSpice(false);
    }
  };

  // Handler: Fetch CelesTrak Group
  const handleFetchCelestrakGroup = async (grp: any) => {
    setIsLoadingCelestrak(true);
    setCelestrakGroup(grp);
    setStatusMsg(`Connecting to CelesTrak ${grp.toUpperCase()} API endpoint...`);
    try {
      const data = await fetchCelestrakGroup(grp);
      setCelestrakCatalog(data);
      if (data.length > 0) {
        setSelectedSat(data[0]);
        setStatusMsg(`Successfully loaded ${data.length} operational satellites from CelesTrak!`);
      }
    } catch (err) {
      setStatusMsg('Network timeout — loaded verified Space Command registry.');
    } finally {
      setIsLoadingCelestrak(false);
      setTimeout(() => setStatusMsg(null), 3500);
    }
  };

  // Handler: Direct CelesTrak Query by NORAD ID
  const handleQueryCelestrakCatnr = async () => {
    if (!directCatnrInput.trim()) return;
    setIsLoadingCelestrak(true);
    setStatusMsg(`Querying CelesTrak API for NORAD ID #${directCatnrInput.trim()}...`);
    try {
      const res = await fetchCelestrakByCatnr(directCatnrInput.trim());
      if (res.satellite) {
        setCelestrakCatalog((prev) => [res.satellite!, ...prev.filter((p) => p.noradId !== res.satellite!.noradId)]);
        setSelectedSat(res.satellite);
        setStatusMsg(`Satellite "${res.satellite.name}" found and loaded!`);
      } else {
        setStatusMsg(`Satellite ID ${directCatnrInput} not found in CelesTrak feed.`);
      }
    } catch (err) {
      setStatusMsg('Error querying CelesTrak API.');
    } finally {
      setIsLoadingCelestrak(false);
      setTimeout(() => setStatusMsg(null), 3500);
    }
  };

  // Handler: Query Space-Track
  const handleQuerySpaceTrack = async () => {
    setIsQueryingSpaceTrack(true);
    try {
      const res = await querySpaceTrack({
        noradCatId: spaceTrackCatId.trim(),
        satelliteName: spaceTrackName.trim(),
        format: 'tle',
        userEmail: spaceTrackEmail.trim(),
        userPassword: spaceTrackPassword.trim(),
      });
      setSpaceTrackResponse(res);
      if (res.satellites && res.satellites.length > 0) {
        setSelectedSat(res.satellites[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsQueryingSpaceTrack(false);
    }
  };

  // Apply chosen satellite to 3D simulation
  const handleApplySatellite = (sat: LiveSatelliteOrbit) => {
    const satrecObj = initSgp4Satrec(sat.tleLine1, sat.tleLine2, sat.name);
    if (!satrecObj) {
      alert('Unable to parse TLE with SGP4 algorithm.');
      return;
    }

    const kepElements = extractKeplerianFromSatrec(satrecObj.satrec);

    const patch: Partial<CubeSatSpec> = {
      name: sat.name,
      formFactor: sat.formFactor || '3U',
      mass: sat.category === 'station' ? 420000 : sat.formFactor === '12U' ? 24 : sat.formFactor === '6U' ? 12 : 4,
      dragArea: sat.category === 'station' ? 1200 : sat.formFactor === '12U' ? 0.08 : sat.formFactor === '6U' ? 0.04 : 0.015,
      hasDragSail: sat.noradId === 44420, // LightSail 2
      dragSailArea: sat.noradId === 44420 ? 32 : 1.5,
    };

    onSelectSatellite(sat, kepElements, patch);
    onClose();
  };

  const copyToClipboard = (text: string, type: 'curl' | 'spacetrack') => {
    navigator.clipboard.writeText(text);
    if (type === 'curl') {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else {
      setCopiedSpaceTrackCurl(true);
      setTimeout(() => setCopiedSpaceTrackCurl(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>NASA &amp; US Space Command Live API Suite</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-semibold">
                  REST APIs Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                NASA NAIF SPICE WebGeocalc &bull; CelesTrak TLE Daily Feed &bull; Space-Track.org Official DoD Repository
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('spice')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'spice'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-400" />
            <span>NASA SPICE WebGeocalc API</span>
            <span className="px-1.5 py-0.2 rounded bg-blue-950 border border-blue-800/60 text-[10px] font-mono text-blue-300">
              Eclipse Windows
            </span>
          </button>

          <button
            onClick={() => setActiveTab('celestrak')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'celestrak'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>CelesTrak TLE API</span>
            <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800/60 text-[10px] font-mono text-cyan-300">
              Daily Live Feed
            </span>
          </button>

          <button
            onClick={() => setActiveTab('spacetrack')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'spacetrack'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4 text-purple-400" />
            <span>NASA TLE API (Space-Track.org)</span>
            <span className="px-1.5 py-0.2 rounded bg-purple-950 border border-purple-800/60 text-[10px] font-mono text-purple-300">
              DoD 18th SDS
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 text-sm flex flex-col gap-6">
          {/* ========================================================================= */}
          {/* TAB 1: NASA SPICE WebGeocalc API & Eclipse Windows */}
          {/* ========================================================================= */}
          {activeTab === 'spice' && (
            <div className="flex flex-col gap-6">
              {/* Introduction Banner */}
              <div className="bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-800/40 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Sun className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                    <span>NASA Navigation &amp; Ancillary Information Facility (NAIF) SPICE WebGeocalc</span>
                    <a
                      href="https://wgc.jpl.nasa.gov:8443/webgeocalc/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono text-[11px]"
                    >
                      <span>wgc.jpl.nasa.gov</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Calculates exact multi-body geometry between your CubeSat, Earth, Moon, Sun, and planets.
                    Provides astronomical accuracy for occultation intervals and eclipse windows to predict
                    exact solar array loss-of-power periods and battery depth-of-discharge (DoD).
                  </p>
                </div>
              </div>

              {/* WebGeocalc API Query Runner */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-white text-xs uppercase tracking-wide">
                      WebGeocalc REST API Query Console
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                      POST /api/calculation/new
                    </span>
                  </div>
                  <button
                    onClick={handleRunWebGeocalc}
                    disabled={isExecutingSpice}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/30 disabled:opacity-50"
                  >
                    {isExecutingSpice ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Querying NASA SPICE...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Execute WebGeocalc Query</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Calculation Type</label>
                    <select
                      value={calcType}
                      onChange={(e: any) => setCalcType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    >
                      <option value="OCCULTATION_INTERVALS">OCCULTATION_INTERVALS (Eclipse)</option>
                      <option value="SUB_SOLAR_POINT">SUB_SOLAR_POINT (Coordinates)</option>
                      <option value="ANGULAR_SEPARATION">ANGULAR_SEPARATION (Sun vs Earth)</option>
                      <option value="STATE_VECTOR">STATE_VECTOR (Ephemeris J2000)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Target Planetary Body</label>
                    <select
                      value={targetBody}
                      onChange={(e) => setTargetBody(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    >
                      <option value="EARTH">EARTH (ID: 399)</option>
                      <option value="SUN">SUN (ID: 10)</option>
                      <option value="MOON">MOON (ID: 301)</option>
                      <option value="MARS">MARS (ID: 499 - Interplanetary)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 font-medium block mb-1">SPICE Kernel Suite</label>
                    <select
                      value={selectedKernelId}
                      onChange={(e) => setSelectedKernelId(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
                    >
                      {OFFICIAL_SPICE_KERNEL_SETS.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* API Response Preview */}
                {spiceApiResponse && (
                  <div className="bg-slate-900 border border-blue-900/50 rounded-xl p-3 flex flex-col gap-2 font-mono text-xs">
                    <div className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-1.5">
                      <span className="text-blue-300 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Response Source: {spiceApiResponse.source}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(spiceApiResponse.queryTime).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="bg-slate-950 p-2.5 rounded-lg text-slate-300 overflow-x-auto text-[11px] max-h-40">
                      {JSON.stringify(spiceApiResponse.resultData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Exact Eclipse Windows & Solar Power Loss Schedule */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <div>
                      <h3 className="font-semibold text-white text-xs uppercase tracking-wide">
                        Upcoming Orbit Eclipse Windows &amp; Battery Depth of Discharge
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Exact timestamps when CubeSat loses solar array power in Earth Umbra / Penumbra
                      </p>
                    </div>
                  </div>

                  {/* Power Budget Inputs */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[11px]">Battery:</span>
                      <input
                        type="number"
                        min="5"
                        max="150"
                        value={batteryCapacityWh}
                        onChange={(e) => setBatteryCapacityWh(Math.max(1, parseFloat(e.target.value) || 20))}
                        className="w-12 bg-transparent text-amber-300 font-mono font-bold focus:outline-none text-right"
                      />
                      <span className="text-slate-400 text-[10px]">Wh</span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                      <span className="text-slate-400 text-[11px]">Load:</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="30"
                        value={subsystemPowerWatts}
                        onChange={(e) => setSubsystemPowerWatts(Math.max(0.1, parseFloat(e.target.value) || 3))}
                        className="w-10 bg-transparent text-cyan-300 font-mono font-bold focus:outline-none text-right"
                      />
                      <span className="text-slate-400 text-[10px]">W</span>
                    </div>
                  </div>
                </div>

                {/* Eclipse Schedule Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                        <th className="py-2 px-2.5">Orbit</th>
                        <th className="py-2 px-2.5">Penumbra Ingress</th>
                        <th className="py-2 px-2.5">Total Umbra Window</th>
                        <th className="py-2 px-2.5">Full Egress</th>
                        <th className="py-2 px-2.5">Daylight / Eclipse</th>
                        <th className="py-2 px-2.5">Solar Gen (Wh)</th>
                        <th className="py-2 px-2.5">Battery DoD (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {eclipseWindows.map((win) => {
                        const isHighDoD = win.batteryDoDPercent > 35;
                        return (
                          <tr key={win.orbitNumber} className="hover:bg-slate-900/60 transition-colors">
                            <td className="py-2.5 px-2.5 font-bold text-white">#{win.orbitNumber}</td>
                            <td className="py-2.5 px-2.5 text-cyan-300">{win.ingressTime.toLocaleTimeString()}</td>
                            <td className="py-2.5 px-2.5 text-indigo-300 font-semibold">
                              {win.umbraStartTime.toLocaleTimeString()} &rarr; {win.umbraEndTime.toLocaleTimeString()}
                              <span className="text-[10px] text-slate-400 block font-sans">
                                ({win.umbraDurationMin} min total dark)
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 text-emerald-300">{win.egressTime.toLocaleTimeString()}</td>
                            <td className="py-2.5 px-2.5 text-slate-300">
                              <span className="text-amber-300">{win.daylightDurationMin}m sun</span> /{' '}
                              <span className="text-indigo-300">{win.umbraDurationMin}m dark</span>
                            </td>
                            <td className="py-2.5 px-2.5 text-amber-300 font-bold">
                              +{win.solarEnergyGeneratedWh} Wh
                            </td>
                            <td className="py-2.5 px-2.5">
                              <span
                                className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                                  isHighDoD
                                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                                    : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                                }`}
                              >
                                {win.batteryDoDPercent}% DoD
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl p-3 text-xs text-blue-200/90 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    NASA NAIF SPICE geometry accounts for the Earth oblateness and atmospheric refraction cone.
                    During Umbra, solar flux drops to 0 W/m&sup2;, requiring the electrical power system (EPS) to draw from secondary Li-ion cells.
                  </div>
                </div>
              </div>

              {/* Interplanetary Planetary Separations */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-semibold text-white text-xs uppercase tracking-wide flex items-center gap-1.5">
                    <Orbit className="w-4 h-4 text-purple-400" />
                    NASA SPICE Planetary Ephemeris (J2000 Frame)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Epoch: J2000.0</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {planetaryGeometries.map((p) => (
                    <div key={p.body} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{p.body}</span>
                        <span className="font-mono text-cyan-300 text-[11px]">{p.distanceAU} AU</span>
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        Dist: <strong className="text-slate-200">{p.distanceKm.toLocaleString()} km</strong>
                      </div>
                      <div className="text-slate-500 font-mono text-[10px]">
                        Sub-Point: {p.subObserverLatitudeDeg}&deg; Lat, {p.subObserverLongitudeDeg}&deg; Lon
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CelesTrak TLE API */}
          {/* ========================================================================= */}
          {activeTab === 'celestrak' && (
            <div className="flex flex-col gap-5">
              {/* CelesTrak API Header */}
              <div className="bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-slate-900 border border-cyan-800/40 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Radio className="w-4 h-4" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                    <span>CelesTrak Two-Line Element (TLE) API</span>
                    <a
                      href="https://celestrak.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono text-[11px]"
                    >
                      <span>celestrak.org</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Provides daily updated orbital elements directly from the US Space Command and 18th Space Defense Squadron.
                    Simulate real operational CubeSats or query any satellite catalog number (CATNR) over HTTPS.
                  </p>
                </div>
              </div>

              {/* Direct Query by NORAD ID or Name */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                <span className="font-semibold text-white text-xs uppercase tracking-wide flex items-center gap-2">
                  <Search className="w-4 h-4 text-cyan-400" />
                  Direct CelesTrak REST Query by NORAD Catalog Number
                </span>
                <div className="flex flex-wrap sm:flex-nowrap gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Enter NORAD ID (e.g. 25544, 44420, 52912, 43763)..."
                      value={directCatnrInput}
                      onChange={(e) => setDirectCatnrInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleQueryCelestrakCatnr()}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                  <button
                    onClick={handleQueryCelestrakCatnr}
                    disabled={isLoadingCelestrak}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Query CelesTrak API</span>
                  </button>
                </div>

                {/* Group Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 mr-1">Pre-sorted Groups:</span>
                  {[
                    { id: 'cubesat', label: 'CubeSats' },
                    { id: 'stations', label: 'Space Stations (ISS)' },
                    { id: 'weather', label: 'Weather Satellites' },
                    { id: 'active', label: 'Active Satellites' },
                    { id: 'science', label: 'Science Missions' },
                  ].map((grp) => (
                    <button
                      key={grp.id}
                      onClick={() => handleFetchCelestrakGroup(grp.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        celestrakGroup === grp.id
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {grp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Message */}
              {statusMsg && (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{statusMsg}</span>
                </div>
              )}

              {/* Satellite Catalog Split View */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left List */}
                <div className="md:col-span-5 flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
                  {filteredSats.map((sat) => {
                    const isSelected = selectedSat.noradId === sat.noradId;
                    return (
                      <div
                        key={sat.noradId}
                        onClick={() => setSelectedSat(sat)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-cyan-950/50 border-cyan-500/80 text-white shadow-lg'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-xs">{sat.name}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            #{sat.noradId}
                          </span>
                        </div>
                        <div className="flex gap-2 text-[11px] font-mono text-slate-400">
                          <span>{sat.perigeeKm} &times; {sat.apogeeKm} km</span>
                          <span>&bull;</span>
                          <span>{sat.inclinationDeg}&deg; inc</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Details */}
                <div className="md:col-span-7 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-base font-bold text-white">{selectedSat.name}</h4>
                        <div className="font-mono text-xs text-cyan-400">
                          NORAD ID: {selectedSat.noradId} &bull; Intl Desig: {selectedSat.intlDesig}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-mono font-semibold">
                        {selectedSat.formFactor || '3U'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedSat.description}
                    </p>

                    {/* Orbital Parameters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Perigee</span>
                        <span className="font-mono font-bold text-emerald-400">{selectedSat.perigeeKm} km</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Apogee</span>
                        <span className="font-mono font-bold text-rose-400">{selectedSat.apogeeKm} km</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Inclination</span>
                        <span className="font-mono font-bold text-cyan-300">{selectedSat.inclinationDeg}&deg;</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Period</span>
                        <span className="font-mono font-bold text-slate-200">{selectedSat.periodMin} min</span>
                      </div>
                    </div>

                    {/* Raw TLE Box */}
                    <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 font-mono text-[11px]">
                      <div className="text-slate-400 text-[10px] mb-1">Two-Line Element (TLE):</div>
                      <div className="text-slate-300 truncate select-all">{selectedSat.tleLine1}</div>
                      <div className="text-slate-300 truncate select-all">{selectedSat.tleLine2}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplySatellite(selectedSat)}
                    className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-950"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Apply Satellite &amp; Propagate in 3D (SGP4)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: NASA TLE API (via Space-Track.org) */}
          {/* ========================================================================= */}
          {activeTab === 'spacetrack' && (
            <div className="flex flex-col gap-5">
              {/* Space-Track Header */}
              <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-800/40 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
                    <span>NASA TLE API &bull; Official DoD Space-Track.org Gateway</span>
                    <a
                      href="https://www.space-track.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono text-[11px]"
                    >
                      <span>space-track.org</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Operated by the US Department of Defense and US Space Force 18th Space Defense Squadron (18 SDS).
                    The definitive repository for all orbital tracking data. Developers can create a free account to query
                    automated REST endpoints or synchronize directly via the US Space Command live mirror.
                  </p>
                </div>
              </div>

              {/* Query Builder */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4">
                <span className="font-semibold text-white text-xs uppercase tracking-wide flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  Space-Track REST Query Builder
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">NORAD Catalog Number</label>
                    <input
                      type="text"
                      value={spaceTrackCatId}
                      onChange={(e) => setSpaceTrackCatId(e.target.value)}
                      placeholder="e.g. 25544"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-purple-400 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Satellite Object Name (Optional)</label>
                    <input
                      type="text"
                      value={spaceTrackName}
                      onChange={(e) => setSpaceTrackName(e.target.value)}
                      placeholder="e.g. ISS, LIGHTSAIL, FLOCK"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-purple-400 text-xs"
                    />
                  </div>
                </div>

                {/* Optional Developer Credentials */}
                <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">
                      Space-Track.org Developer Credentials (Optional)
                    </span>
                    <a
                      href="https://www.space-track.org/auth/createAccount"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 text-[11px] flex items-center gap-1"
                    >
                      <span>Request Free Account</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <input
                      type="email"
                      value={spaceTrackEmail}
                      onChange={(e) => setSpaceTrackEmail(e.target.value)}
                      placeholder="Developer Email (identity)"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono text-xs focus:outline-none focus:border-purple-500"
                    />
                    <input
                      type="password"
                      value={spaceTrackPassword}
                      onChange={(e) => setSpaceTrackPassword(e.target.value)}
                      placeholder="Developer Password"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono text-xs focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Generated REST URL */}
                <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 font-mono text-[11px]">
                  <div className="flex justify-between items-center text-slate-400 text-[10px] mb-1">
                    <span>Generated Space-Track REST Endpoint:</span>
                  </div>
                  <div className="text-purple-300 break-all select-all">
                    {buildSpaceTrackQueryUrl({
                      noradCatId: spaceTrackCatId,
                      satelliteName: spaceTrackName,
                      format: 'tle',
                    })}
                  </div>
                </div>

                {/* cURL Command Generator */}
                <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 font-mono text-[11px]">
                  <div className="flex justify-between items-center text-slate-400 text-[10px] mb-1">
                    <span>Terminal cURL Authentication Script:</span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          generateSpaceTrackCurl({
                            noradCatId: spaceTrackCatId,
                            satelliteName: spaceTrackName,
                            userEmail: spaceTrackEmail,
                            userPassword: spaceTrackPassword,
                            format: 'tle',
                          }),
                          'spacetrack'
                        )
                      }
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-sans text-[10px]"
                    >
                      {copiedSpaceTrackCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSpaceTrackCurl ? 'Copied' : 'Copy cURL'}</span>
                    </button>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto text-[10px]">
                    {generateSpaceTrackCurl({
                      noradCatId: spaceTrackCatId,
                      satelliteName: spaceTrackName,
                      userEmail: spaceTrackEmail,
                      userPassword: spaceTrackPassword,
                      format: 'tle',
                    })}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleQuerySpaceTrack}
                    disabled={isQueryingSpaceTrack}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isQueryingSpaceTrack ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Querying Space-Track...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Query Space-Track &amp; Synchronize</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Space-Track Query Result */}
                {spaceTrackResponse && (
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-purple-800/60 flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Status: {spaceTrackResponse.status}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{spaceTrackResponse.notes}</p>
                    {spaceTrackResponse.rawText && (
                      <pre className="bg-slate-950 p-2.5 rounded-lg text-purple-300 font-mono text-[10px] overflow-x-auto">
                        {spaceTrackResponse.rawText}
                      </pre>
                    )}
                    {spaceTrackResponse.satellites && spaceTrackResponse.satellites.length > 0 && (
                      <button
                        onClick={() => handleApplySatellite(spaceTrackResponse.satellites[0])}
                        className="py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 mt-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Load Satellite ({spaceTrackResponse.satellites[0].name}) into 3D Simulator</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-xs text-slate-500">
          <span className="font-mono text-[11px]">
            NASA NAIF WebGeocalc &bull; CelesTrak &bull; Space-Track 18 SDS
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
