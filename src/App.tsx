/**
 * CubeSat Orbit & Lifetime Simulator
 * Main application dashboard integrating 3D WebGL orbit propagation,
 * 2D ground track mapping, and atmospheric drag lifetime decay analysis.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  KeplerianElements,
  CubeSatSpec,
  SolarConditions,
  OrbitDerivedState,
  GroundStation,
  PropagatorEngine,
  SpiceGeometryState,
  AttitudeDynamicsState,
  DynamicAttitudeMode,
  LiveSatelliteOrbit,
} from './types';
import {
  EARTH_RADIUS_KM,
  computeOrbitDerivedState,
  keplerianToECI,
} from './physics/orbitalMechanics';
import { simulateLifetime } from './physics/lifetimeDecay';
import { initSgp4Satrec, propagateSgp4AtTime } from './physics/sgp4Propagator';
import { evaluateSpiceGeometry } from './physics/spiceGeometry';
import {
  computeOrekitPerturbationMetrics,
  computeAttitudeDynamics,
} from './physics/orekitPerturbations';
import { generateTLE } from './physics/tleGenerator';
import { ORBIT_PRESETS, CUBESAT_PRESETS, GROUND_STATIONS, OrbitPreset } from './data/presets';

import { Orbit3DViewer } from './components/Orbit3DViewer';
import { GroundTrackMap } from './components/GroundTrackMap';
import { LifetimeAnalysisView } from './components/LifetimeAnalysisView';
import { KeplerianControls } from './components/KeplerianControls';
import { CubeSatSpecsPanel } from './components/CubeSatSpecsPanel';
import { TleExportModal } from './components/TleExportModal';
import { CelestrakCatalogModal } from './components/CelestrakCatalogModal';
import { NasaSpiceApiModal } from './components/NasaSpiceApiModal';
import { SpiceAttitudePanel } from './components/SpiceAttitudePanel';
import { KeplerianElementsGuideModal } from './components/KeplerianElementsGuideModal';
import { PowerBudgetModal } from './components/PowerBudgetModal';
import { LandingPage } from './components/LandingPage';

import {
  Orbit,
  Globe,
  TrendingDown,
  FileCode,
  Box,
  Compass,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Radio,
  Cpu,
  Zap,
  Home,
  X,
} from 'lucide-react';

export default function App() {
  // 1. Initial State: Standard 3U CubeSat in 500 km LEO / ISS orbit
  const [elements, setElements] = useState<KeplerianElements>({
    a: EARTH_RADIUS_KM + 500,
    e: 0.0012,
    i: 51.64,
    raan: 120.0,
    argPerigee: 45.0,
    trueAnomaly: 0.0,
    epochDate: new Date(),
  });

  const [cubeSat, setCubeSat] = useState<CubeSatSpec>({
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
  });

  const [solar, setSolar] = useState<SolarConditions>({
    modelType: 'mean',
    f107: 130,
    apIndex: 15,
    atmosphereModel: 'nasa-das',
  });

  // Active Propagator Engine: SGP4 (satellite.js) | Orekit (RK4 numerical) | Keplerian
  const [propagatorEngine, setPropagatorEngine] = useState<PropagatorEngine>('sgp4');

  // Attitude Tumbling RPM
  const [tumblingRpm, setTumblingRpm] = useState<number>(2.5);

  // Current TLE (initialized from elements)
  const [currentTle, setCurrentTle] = useState<{ line1: string; line2: string; name: string }>(() => {
    const tle = generateTLE(
      {
        a: EARTH_RADIUS_KM + 500,
        e: 0.0012,
        i: 51.64,
        raan: 120.0,
        argPerigee: 45.0,
        trueAnomaly: 0.0,
        epochDate: new Date(),
      },
      {
        name: 'AeroCube-3U',
        formFactor: '3U',
        mass: 4.0,
        dragArea: 0.0433,
        dragCoefficient: 2.2,
        hasDragSail: false,
        dragSailArea: 1.5,
        reflectivity: 1.3,
        dimensionsCm: { length: 10, width: 10, height: 34 },
      }
    );
    return { line1: tle.line1, line2: tle.line2, name: 'AeroCube-3U' };
  });

  // Visualizer active tab
  const [activeTab, setActiveTab] = useState<'3d' | 'groundTrack' | 'lifetime' | 'spiceAttitude'>('3d');

  // NASA Real Map Satellite Layer State
  const [selectedMapLayerId, setSelectedMapLayerId] = useState<string>('blue-marble-bathymetry');

  // Simulation play state & speed
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(100);

  // Modal & Drawer States
  const [isTleModalOpen, setIsTleModalOpen] = useState<boolean>(false);
  const [isCelestrakModalOpen, setIsCelestrakModalOpen] = useState<boolean>(false);
  const [isNasaSpiceModalOpen, setIsNasaSpiceModalOpen] = useState<boolean>(false);
  const [nasaSpiceModalTab, setNasaSpiceModalTab] = useState<'spice' | 'celestrak' | 'spacetrack'>('spice');
  const [isKeplerianDrawerOpen, setIsKeplerianDrawerOpen] = useState<boolean>(false);
  const [isKeplerianGuideModalOpen, setIsKeplerianGuideModalOpen] = useState<boolean>(false);
  const [isGroundTrackModalOpen, setIsGroundTrackModalOpen] = useState<boolean>(false);
  const [isLifetimeModalOpen, setIsLifetimeModalOpen] = useState<boolean>(false);
  const [isSpiceAttitudeModalOpen, setIsSpiceAttitudeModalOpen] = useState<boolean>(false);
  const [isPowerBudgetModalOpen, setIsPowerBudgetModalOpen] = useState<boolean>(false);
  const [configDrawerTab, setConfigDrawerTab] = useState<'orbit' | 'cubesat' | 'engine'>('orbit');
  const [currentView, setCurrentView] = useState<'landing' | 'simulator'>('landing');

  const handleOpenNasaModal = (tab: 'spice' | 'celestrak' | 'spacetrack' = 'spice') => {
    setNasaSpiceModalTab(tab);
    setIsNasaSpiceModalOpen(true);
  };

  // SGP4 SatRec initialized from active TLE
  const satrecObj = useMemo(() => {
    return initSgp4Satrec(currentTle.line1, currentTle.line2);
  }, [currentTle.line1, currentTle.line2]);

  const satrec = satrecObj?.satrec || null;

  // 2. Compute live derived orbital dynamics
  const derivedState: OrbitDerivedState = useMemo(() => {
    const additionalArea = cubeSat.additionalArea || 0;
    const isNadirTimeAvg = cubeSat.useNadirTimeAveragedArea !== false;
    let effectiveAddnl = additionalArea;
    if (cubeSat.attitudeMode === 'nadir') {
      if (isNadirTimeAvg && (cubeSat.nadirAdditionalMode === 'in-plane-average' || cubeSat.nadirAdditionalMode === 'sun-tracking')) {
        effectiveAddnl = (2 / Math.PI) * additionalArea;
      } else if (!isNadirTimeAvg && cubeSat.nadirAdditionalMode === 'in-plane-average') {
        const pitchRad = ((cubeSat.nadirPitchAngleDeg ?? 0) * Math.PI) / 180;
        effectiveAddnl = additionalArea * Math.abs(Math.cos(pitchRad));
      }
    }

    const totalEffectiveArea =
      cubeSat.dragArea +
      effectiveAddnl +
      (cubeSat.hasDragSail ? cubeSat.dragSailArea : 0);
    return computeOrbitDerivedState(
      elements,
      cubeSat.mass,
      totalEffectiveArea,
      cubeSat.dragCoefficient,
      elements.epochDate,
      solar,
      cubeSat.reflectivity
    );
  }, [elements, cubeSat, solar]);

  // Current simulation timestamp
  const simDate = useMemo(() => {
    const epoch = elements.epochDate ? new Date(elements.epochDate.getTime()) : new Date();
    const periodSec = Math.max(10, derivedState.orbitalPeriodMin * 60);
    const progressSec = (elements.trueAnomaly / 360) * periodSec;
    return new Date(epoch.getTime() + progressSec * 1000);
  }, [elements.epochDate, elements.trueAnomaly, derivedState.orbitalPeriodMin]);

  // Real-time SGP4 Propagation Result from satellite.js
  const sgp4Result = useMemo(() => {
    if (!satrec) return null;
    return propagateSgp4AtTime(satrec, simDate);
  }, [satrec, simDate]);

  // Active Satellite ECI Position & Velocity based on selected engine
  const { currentSatPosKm, currentSatVelKm } = useMemo(() => {
    if (propagatorEngine === 'sgp4' && sgp4Result && sgp4Result.positionECI) {
      return {
        currentSatPosKm: sgp4Result.positionECI,
        currentSatVelKm: sgp4Result.velocityECI,
      };
    }
    const kep = keplerianToECI(elements);
    return {
      currentSatPosKm: kep.position,
      currentSatVelKm: kep.velocity,
    };
  }, [propagatorEngine, sgp4Result, elements]);

  // NASA NAIF SPICE WebGeocalc Planetary Geometry (Sun-Earth-Moon, Beta Angle, Umbra/Penumbra)
  const spiceState: SpiceGeometryState = useMemo(() => {
    return evaluateSpiceGeometry(
      currentSatPosKm,
      currentSatVelKm,
      simDate,
      cubeSat.dragArea,
      0.28
    );
  }, [currentSatPosKm, currentSatVelKm, simDate, cubeSat.dragArea]);

  // Orekit Flight Dynamics: J2, J3, J4 Geopotential Harmonics & 3rd-Body Sun/Moon Gravitational Tides
  const orekitPerturbations = useMemo(() => {
    const additionalArea = cubeSat.additionalArea || 0;
    const isNadirTimeAvg = cubeSat.useNadirTimeAveragedArea !== false;
    let effectiveAddnl = additionalArea;
    if (cubeSat.attitudeMode === 'nadir') {
      if (isNadirTimeAvg && (cubeSat.nadirAdditionalMode === 'in-plane-average' || cubeSat.nadirAdditionalMode === 'sun-tracking')) {
        effectiveAddnl = (2 / Math.PI) * additionalArea;
      } else if (!isNadirTimeAvg && cubeSat.nadirAdditionalMode === 'in-plane-average') {
        const pitchRad = ((cubeSat.nadirPitchAngleDeg ?? 0) * Math.PI) / 180;
        effectiveAddnl = additionalArea * Math.abs(Math.cos(pitchRad));
      }
    }
    const totalArea =
      cubeSat.dragArea +
      effectiveAddnl +
      (cubeSat.hasDragSail ? cubeSat.dragSailArea : 0);

    return computeOrekitPerturbationMetrics(
      currentSatPosKm,
      spiceState.sunVectorECI,
      spiceState.moonVectorECI,
      cubeSat.mass,
      totalArea,
      cubeSat.reflectivity,
      elements.a,
      elements.e,
      elements.i
    );
  }, [currentSatPosKm, spiceState, cubeSat, elements]);

  // Orekit CubeSat Rigid-Body Attitude Dynamics (LVLH Nadir, Sun-Pointing, Ram Aero-Drag, Tumbling, B-dot)
  const attitudeState: AttitudeDynamicsState = useMemo(() => {
    const elapsedSec = (elements.trueAnomaly / 360) * (derivedState.orbitalPeriodMin * 60);
    return computeAttitudeDynamics(
      cubeSat.attitudeMode || 'tumbling',
      tumblingRpm,
      elapsedSec,
      cubeSat,
      currentSatPosKm,
      currentSatVelKm,
      spiceState.sunVectorECI
    );
  }, [
    cubeSat,
    tumblingRpm,
    elements.trueAnomaly,
    derivedState.orbitalPeriodMin,
    currentSatPosKm,
    currentSatVelKm,
    spiceState.sunVectorECI,
  ]);

  // 3. Compute Lifetime Atmospheric Decay Simulation (only when orbit geometry, spacecraft specs or solar flux changes)
  const simulationResult = useMemo(() => {
    return simulateLifetime(elements, cubeSat, solar);
  }, [elements.a, elements.e, elements.i, cubeSat, solar]);

  // Navigate to specific tab AND smoothly move the user to the exact visualizer place
  const handleNavigateTab = (tab: '3d' | 'groundTrack' | 'lifetime' | 'spiceAttitude') => {
    setActiveTab(tab);
    setTimeout(() => {
      const el = document.getElementById('visualizer-display-area');
      if (el) {
        const headerOffset = 110;
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: 'smooth',
        });
      }
    }, 15);
  };

  // Scroll to a specific section on the page
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
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

  // Handle true anomaly scrubbing from 3D viewer
  const handleTrueAnomalyChange = useCallback((newNuDeg: number) => {
    setElements((prev) => ({
      ...prev,
      trueAnomaly: newNuDeg,
    }));
  }, []);

  // Handle orbit preset selection
  const handleSelectPreset = (preset: OrbitPreset) => {
    const next = {
      ...elements,
      ...preset.elements,
      trueAnomaly: 0,
    };
    setElements(next);
    const gen = generateTLE(next, cubeSat);
    setCurrentTle({
      name: cubeSat.name,
      line1: gen.line1,
      line2: gen.line2,
    });
  };

  // Handle selecting satellite from live CelesTrak / Space-Track catalog
  const handleSelectCelestrakSatellite = (
    sat: LiveSatelliteOrbit,
    satElements: KeplerianElements,
    cubeSatSpecPatch?: Partial<CubeSatSpec>
  ) => {
    setCurrentTle({
      name: sat.name,
      line1: sat.tleLine1,
      line2: sat.tleLine2,
    });
    setElements(satElements);
    setCubeSat((prev) => ({
      ...prev,
      name: sat.name,
      ...(cubeSatSpecPatch || {}),
    }));
    setPropagatorEngine('sgp4');
    setIsCelestrakModalOpen(false);
    setIsNasaSpiceModalOpen(false);
  };

  // Handle Drag Sail update from Lifetime view
  const handleUpdateDragSail = (hasSail: boolean, sailAreaM2: number) => {
    setCubeSat((prev) => ({
      ...prev,
      hasDragSail: hasSail,
      dragSailArea: sailAreaM2,
    }));
  };

  // If in Landing Homepage view, render the SSGI CubeSat Digital Twin landing page
  if (currentView === 'landing') {
    return <LandingPage onLaunchSimulator={() => setCurrentView('simulator')} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-slate-100 font-sans select-none">
      {/* 1. Full-Screen Transparent/Cosmic 3D Canvas Background (z-index: 0) */}
      <div className="fixed inset-0 w-full h-full z-0 overflow-hidden bg-black">
        <Orbit3DViewer
          elements={elements}
          cubeSat={cubeSat}
          derivedState={derivedState}
          onTrueAnomalyChange={handleTrueAnomalyChange}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          simSpeedMultiplier={simSpeedMultiplier}
          onSpeedChange={setSimSpeedMultiplier}
          selectedLayerId={selectedMapLayerId}
          onSelectLayer={setSelectedMapLayerId}
          spice={spiceState}
          attitude={attitudeState}
          propagatorEngine={propagatorEngine}
          sgp4Result={sgp4Result}
          satrec={satrec}
          simDate={simDate}
          onOpenCelestrakModal={() => handleOpenNasaModal('celestrak')}
          onOpenSpiceModal={() => handleOpenNasaModal('spice')}
          onOpenTleModal={() => setIsTleModalOpen(true)}
          onOpenKeplerianDrawer={() => setIsKeplerianDrawerOpen(true)}
          onOpenGroundTrackModal={() => setIsGroundTrackModalOpen(true)}
          onOpenLifetimeModal={() => setIsLifetimeModalOpen(true)}
          onOpenSpiceAttitudeModal={() => setIsSpiceAttitudeModalOpen(true)}
          onOpenPowerBudgetModal={() => setIsPowerBudgetModalOpen(true)}
          onReturnToLanding={() => setCurrentView('landing')}
          onUpdateElements={setElements}
          onOpenKeplerianGuideModal={() => setIsKeplerianGuideModalOpen(true)}
        />
      </div>

      {/* Quick Launch Floating Buttons in Lower Left */}
      <div className="absolute bottom-3 left-4 z-20 pointer-events-auto flex items-center gap-2">
        <button
          id="quick-return-landing-btn"
          onClick={() => setCurrentView('landing')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md border border-cyan-500/50 text-xs text-cyan-300 hover:text-white font-mono shadow-xl transition-all"
          title="Return to SSGI Landing Page &amp; Flight Crew Overview"
        >
          <Home className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">SSGI Home</span>
        </button>
        <button
          id="quick-open-keplerian-guide-btn"
          onClick={() => setIsKeplerianGuideModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md border border-cyan-500/40 text-xs text-slate-300 hover:text-cyan-300 font-mono shadow-xl transition-all"
          title="Keplerian Elements for Everyone (Visual Guide & Real-World Satellite Benchmarks)"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Keplerian Elements</span>
        </button>

        <button
          id="quick-open-keplerian-btn"
          onClick={() => setIsKeplerianDrawerOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md border border-slate-800 text-xs text-slate-300 hover:text-cyan-300 font-mono shadow-xl transition-all"
          title="Open Orbital Elements & Spacecraft Specs Drawer"
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Orbit &amp; Spacecraft</span>
        </button>

        <button
          id="quick-open-ground-track-btn"
          onClick={() => setIsGroundTrackModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md border border-slate-800 text-xs text-slate-300 hover:text-emerald-300 font-mono shadow-xl transition-all"
          title="Open 2D Ground Track Map"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Ground Track</span>
        </button>

        <button
          id="quick-open-power-budget-btn"
          onClick={() => setIsPowerBudgetModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md border border-slate-800 text-xs text-slate-300 hover:text-amber-300 font-mono shadow-xl transition-all"
          title="Open NASA Data Power Budget Analysis"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Power Budget</span>
        </button>

        <button
          id="quick-open-decay-btn"
          onClick={() => setIsLifetimeModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md border border-slate-800 text-xs text-slate-300 hover:text-amber-300 font-mono shadow-xl transition-all"
          title="Open Atmospheric Drag Decay Analysis"
        >
          <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Decay</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* FLOATING GLASSMORPHISM MODALS & DRAWERS */}
      {/* ========================================================================= */}

      {/* 1. Keplerian & Spacecraft Configuration Drawer */}
      {isKeplerianDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono">MISSION PARAMETERS &amp; CONFIGURATION</h3>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Osculating Keplerian elements, CubeSat mass/aerodynamics, and propagator engine
                  </p>
                </div>
              </div>

              {/* Navigation Tabs inside Drawer */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setConfigDrawerTab('orbit')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    configDrawerTab === 'orbit'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Keplerian
                </button>
                <button
                  onClick={() => setConfigDrawerTab('cubesat')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    configDrawerTab === 'cubesat'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  CubeSat Specs
                </button>
                <button
                  onClick={() => setConfigDrawerTab('engine')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    configDrawerTab === 'engine'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Propagator
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setIsKeplerianDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {configDrawerTab === 'orbit' && (
                <KeplerianControls
                  elements={elements}
                  derivedState={derivedState}
                  simulationResult={simulationResult}
                  onChange={setElements}
                  onSelectPreset={handleSelectPreset}
                  onNavigateTab={(tab) => {
                    setIsKeplerianDrawerOpen(false);
                    if (tab === 'groundTrack') setIsGroundTrackModalOpen(true);
                    if (tab === 'lifetime') setIsLifetimeModalOpen(true);
                  }}
                />
              )}

              {configDrawerTab === 'cubesat' && (
                <CubeSatSpecsPanel
                  cubeSat={cubeSat}
                  solar={solar}
                  simulationResult={simulationResult}
                  onCubeSatChange={setCubeSat}
                  onSolarChange={setSolar}
                  onNavigateTab={(tab) => {
                    setIsKeplerianDrawerOpen(false);
                    if (tab === 'lifetime') setIsLifetimeModalOpen(true);
                  }}
                />
              )}

              {configDrawerTab === 'engine' && (
                <div className="flex flex-col gap-4 font-sans text-xs">
                  <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                    <div className="text-sm font-bold text-slate-200 mb-2 font-mono">ACTIVE PROPAGATOR ENGINE</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                      <button
                        onClick={() => setPropagatorEngine('sgp4')}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          propagatorEngine === 'sgp4'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 font-bold shadow-lg'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-white text-xs">SGP4 / SDP4</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          satellite.js US Space Command Standard (B*, J2, Secular terms)
                        </span>
                      </button>

                      <button
                        onClick={() => setPropagatorEngine('orekit-numerical')}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          propagatorEngine === 'orekit-numerical'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500 font-bold shadow-lg'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-white text-xs">Orekit Flight Dynamics</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          Runge-Kutta 4th-order with J2-J4 harmonics, Sun/Moon tides, SRP &amp; Drag
                        </span>
                      </button>

                      <button
                        onClick={() => setPropagatorEngine('keplerian')}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          propagatorEngine === 'keplerian'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500 font-bold shadow-lg'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-white text-xs">Keplerian 2-Body</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          Classical analytical conic ellipse without environmental perturbations
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. 2D Ground Track Map Modal */}
      {isGroundTrackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono">2D GEOSPATIAL GROUND TRACK &amp; PASS PREDICTION</h3>
              </div>
              <button
                onClick={() => setIsGroundTrackModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <GroundTrackMap
                elements={elements}
                derivedState={derivedState}
                groundStations={GROUND_STATIONS}
                simDate={simDate}
                selectedLayerId={selectedMapLayerId}
                onSelectLayer={setSelectedMapLayerId}
                cubeSat={cubeSat}
                spice={spiceState}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Atmospheric Decay & Lifetime Modal */}
      {isLifetimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono">ATMOSPHERIC DRAG DECAY &amp; LIFETIME ANALYSIS</h3>
              </div>
              <button
                onClick={() => setIsLifetimeModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <LifetimeAnalysisView
                elements={elements}
                cubeSat={cubeSat}
                solar={solar}
                simulationResult={simulationResult}
                onUpdateDragSail={handleUpdateDragSail}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Orekit & SPICE Dynamics Modal */}
      {isSpiceAttitudeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-100 font-mono">OREKIT FLIGHT DYNAMICS &amp; NAIF SPICE GEOMETRY</h3>
              </div>
              <button
                onClick={() => setIsSpiceAttitudeModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SpiceAttitudePanel
                spice={spiceState}
                perturbations={orekitPerturbations}
                attitude={attitudeState}
                cubeSat={cubeSat}
                onAttitudeModeChange={(mode: DynamicAttitudeMode) =>
                  setCubeSat((prev) => ({ ...prev, attitudeMode: mode }))
                }
                onTumblingRpmChange={setTumblingRpm}
                onOpenNasaSpiceModal={handleOpenNasaModal}
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. TLE Export Modal */}
      <TleExportModal
        isOpen={isTleModalOpen}
        onClose={() => setIsTleModalOpen(false)}
        elements={elements}
        cubeSat={cubeSat}
        derivedState={derivedState}
        simulationResult={simulationResult}
        solar={solar}
      />

      {/* 6. CelesTrak & NASA Space-Track Live Satellite Catalog Modal */}
      <CelestrakCatalogModal
        isOpen={isCelestrakModalOpen}
        onClose={() => setIsCelestrakModalOpen(false)}
        onSelectSatellite={handleSelectCelestrakSatellite}
        currentSatName={cubeSat.name}
      />

      {/* 7. NASA NAIF SPICE, CelesTrak & NASA Space-Track Unified Astrodynamics Modal */}
      <NasaSpiceApiModal
        isOpen={isNasaSpiceModalOpen}
        onClose={() => setIsNasaSpiceModalOpen(false)}
        onSelectSatellite={handleSelectCelestrakSatellite}
        currentSatName={cubeSat.name}
        elements={elements}
        cubeSat={cubeSat}
        derivedAltKm={derivedState.currentAltKm}
        spiceState={spiceState}
        currentSatPosKm={currentSatPosKm}
        currentSatVelKm={currentSatVelKm}
        initialTab={nasaSpiceModalTab}
      />

      {/* 8. Keplerian Elements for Everyone Guide & Real Data Benchmarks Modal */}
      {isKeplerianGuideModalOpen && (
        <KeplerianElementsGuideModal
          elements={elements}
          derivedState={derivedState}
          onClose={() => setIsKeplerianGuideModalOpen(false)}
          onApplyElements={(newElements: KeplerianElements) => {
            setElements(newElements);
            setPropagatorEngine('keplerian');
          }}
        />
      )}

      {/* 9. NASA Power Budget & EPS Analysis Modal */}
      <PowerBudgetModal
        isOpen={isPowerBudgetModalOpen}
        onClose={() => setIsPowerBudgetModalOpen(false)}
        elements={elements}
        cubeSat={cubeSat}
        derivedState={derivedState}
        spice={spiceState}
      />
    </div>
  );
}
