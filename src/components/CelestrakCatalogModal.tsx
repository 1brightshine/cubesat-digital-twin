/**
 * CelesTrak & NASA Space-Track Live Satellite Catalog Modal
 * Allows searching and loading live CubeSats, Space Stations, and Science missions
 * directly from US Space Command / CelesTrak into SGP4 propagator.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LiveSatelliteOrbit,
  CubeSatSpec,
  KeplerianElements,
} from '../types';
import {
  VERIFIED_CELESTRAK_CATALOG,
  fetchCelestrakGroup,
  searchSatellites,
} from '../services/celestrakService';
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
  Layers,
} from 'lucide-react';

interface CelestrakCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSatellite: (
    sat: LiveSatelliteOrbit,
    elements: KeplerianElements,
    cubeSatSpecPatch?: Partial<CubeSatSpec>
  ) => void;
  currentSatName?: string;
}

export const CelestrakCatalogModal: React.FC<CelestrakCatalogModalProps> = ({
  isOpen,
  onClose,
  onSelectSatellite,
  currentSatName,
}) => {
  const [catalog, setCatalog] = useState<LiveSatelliteOrbit[]>(VERIFIED_CELESTRAK_CATALOG);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [selectedSat, setSelectedSat] = useState<LiveSatelliteOrbit>(VERIFIED_CELESTRAK_CATALOG[0]);
  const [loadStatusMsg, setLoadStatusMsg] = useState<string | null>(null);

  // Filtered list
  const filteredSats = useMemo(() => {
    return searchSatellites(catalog, searchQuery, selectedCategory);
  }, [catalog, searchQuery, selectedCategory]);

  const handleFetchLiveGroup = async (group: 'cubesat' | 'stations' | 'weather' | 'active') => {
    setIsLoadingLive(true);
    setLoadStatusMsg('Connecting to CelesTrak US Space Command database...');
    try {
      const data = await fetchCelestrakGroup(group);
      setCatalog(data);
      if (data.length > 0) {
        setSelectedSat(data[0]);
        setLoadStatusMsg(`Successfully loaded ${data.length} operational satellites from CelesTrak!`);
      }
    } catch (err) {
      console.error(err);
      setLoadStatusMsg('Network timeout - displaying verified Space Command catalog.');
    } finally {
      setIsLoadingLive(false);
      setTimeout(() => setLoadStatusMsg(null), 4000);
    }
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  CelesTrak &amp; Space-Track Live Satellite Catalog
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                  SGP4 Engine Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official orbital elements from US Space Command (18th Space Defense Squadron)
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

        {/* Quick Toolbar & Live Fetch buttons */}
        <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-medium">Live Feeds:</span>
            <button
              onClick={() => handleFetchLiveGroup('cubesat')}
              disabled={isLoadingLive}
              className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 hover:bg-cyan-900/60 font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingLive ? 'animate-spin' : ''}`} />
              <span>Live CubeSats</span>
            </button>
            <button
              onClick={() => handleFetchLiveGroup('stations')}
              disabled={isLoadingLive}
              className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
            >
              <span>Space Stations (ISS)</span>
            </button>
            <button
              onClick={() => handleFetchLiveGroup('weather')}
              disabled={isLoadingLive}
              className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 font-medium transition-colors"
            >
              <span>Weather / Earth Obs</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Updated daily by US Space Command</span>
          </div>
        </div>

        {loadStatusMsg && (
          <div className="px-4 py-2 bg-blue-950/50 border-b border-blue-800/50 text-xs text-blue-300 flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>{loadStatusMsg}</span>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by satellite name (e.g. 'LightSail', 'Lemur', 'Dove') or NORAD Cat ID (e.g. 25544)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs shrink-0">
            {[
              { id: 'all', label: 'All' },
              { id: 'cubesat', label: 'CubeSats' },
              { id: 'station', label: 'Stations' },
              { id: 'earth-obs', label: 'Earth Obs' },
              { id: 'scientific', label: 'Science' },
              { id: 'amateur', label: 'Amateur' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-2 rounded-xl font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Split View: List on Left, Details & TLE on Right */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Left Column: Satellite List */}
          <div className="md:col-span-6 overflow-y-auto p-3 flex flex-col gap-2 max-h-[350px] md:max-h-[460px]">
            {filteredSats.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No satellites found matching "{searchQuery}".
              </div>
            ) : (
              filteredSats.map((sat) => {
                const isSelected = selectedSat?.noradId === sat.noradId;
                const isCurrent = currentSatName?.toLowerCase() === sat.name.toLowerCase();

                return (
                  <button
                    key={sat.noradId}
                    onClick={() => setSelectedSat(sat)}
                    className={`p-3 rounded-xl border text-left transition-all text-xs flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/80 shadow-md shadow-cyan-950/40'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 flex items-center gap-1.5">
                        <Satellite className="w-3.5 h-3.5 text-cyan-400" />
                        {sat.name}
                      </span>
                      <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                        NORAD #{sat.noradId}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 line-clamp-1">
                      {sat.description}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-0.5">
                      <span>Alt: {sat.perigeeKm}&times;{sat.apogeeKm} km</span>
                      <span>Inc: {sat.inclinationDeg}&deg;</span>
                      <span>T: {sat.periodMin} min</span>
                      {isCurrent && (
                        <span className="text-emerald-400 font-bold ml-auto flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Satellite Telemetry & TLE Preview */}
          <div className="md:col-span-6 p-4 flex flex-col justify-between overflow-y-auto max-h-[350px] md:max-h-[460px] bg-slate-950/30">
            {selectedSat ? (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                      Satellite Dossier &bull; US Space Command
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                      Desig: {selectedSat.intlDesig}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">{selectedSat.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {selectedSat.description}
                  </p>
                </div>

                {/* Orbit Elements Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Perigee Alt</span>
                    <span className="font-mono text-cyan-300 font-bold">{selectedSat.perigeeKm} km</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Apogee Alt</span>
                    <span className="font-mono text-cyan-300 font-bold">{selectedSat.apogeeKm} km</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Inclination</span>
                    <span className="font-mono text-amber-300 font-bold">{selectedSat.inclinationDeg}&deg;</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Orbital Period</span>
                    <span className="font-mono text-emerald-300 font-bold">{selectedSat.periodMin} min</span>
                  </div>
                </div>

                {/* Two-Line Element Set (TLE) Viewer */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      Two-Line Element Set (NORAD TLE)
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${selectedSat.name}\n${selectedSat.tleLine1}\n${selectedSat.tleLine2}`
                        );
                        alert('TLE copied to clipboard!');
                      }}
                      className="text-[10px] text-cyan-400 hover:underline"
                    >
                      Copy TLE
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre leading-relaxed select-all">
                    <span className="text-amber-400 block">{selectedSat.name}</span>
                    <span className="text-cyan-300 block">{selectedSat.tleLine1}</span>
                    <span className="text-cyan-300 block">{selectedSat.tleLine2}</span>
                  </div>
                </div>

                {/* Mission Status Callout */}
                <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/40 text-[11px] text-blue-300 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Operational Status:</span>
                    <strong className="text-white">{selectedSat.operationalStatus || 'Active in Orbit'}</strong>
                  </div>
                  {selectedSat.launchYear && (
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">Launch Year:</span>
                      <strong className="text-white">{selectedSat.launchYear}</strong>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                Select a satellite from the left to view orbit specs and TLE data.
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={() => selectedSat && handleApplySatellite(selectedSat)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
              >
                <Orbit className="w-4 h-4" />
                <span>Load Into Simulation (SGP4)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
