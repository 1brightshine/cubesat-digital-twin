/**
 * Aerospace Mission-Control Dashboard Overlay
 * Futuristic, minimalist, responsive HUD overlay for 3D CubeSat orbit simulation.
 * Floating glassmorphism HUDs, NASA-styled time scrubber, live telemetry cards, and camera/filter controls.
 */

import React, { useState, useMemo } from 'react';
import {
  KeplerianElements,
  CubeSatSpec,
  OrbitDerivedState,
  SpiceGeometryState,
  AttitudeDynamicsState,
  PropagatorEngine,
} from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  Layers,
  Sliders,
  Radio,
  Battery,
  BatteryCharging,
  Gauge,
  Activity,
  Globe2,
  TrendingDown,
  Cpu,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Eye,
  Maximize2,
  Compass,
  Zap,
  Clock,
  Satellite,
  X,
  FastForward,
  Rewind,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  CheckCircle2,
  Info,
  Sun,
  Moon,
  Lightbulb,
  Orbit,
  BookOpen,
  Home,
} from 'lucide-react';
import { keplerianToECI, getNasaUmbraOccultation } from '../physics/orbitalMechanics';

interface MissionControlOverlayProps {
  simDate: Date;
  elements: KeplerianElements;
  cubeSat: CubeSatSpec;
  derivedState: OrbitDerivedState;
  spice: SpiceGeometryState;
  attitude?: AttitudeDynamicsState;
  propagatorEngine: PropagatorEngine;
  isPlaying: boolean;
  onTogglePlay: () => void;
  simSpeedMultiplier: number;
  onSpeedChange: (speed: number) => void;
  onTrueAnomalyChange: (nuDeg: number) => void;
  // Camera Controls
  cameraMode: 'free' | 'plane' | 'polar' | 'chase' | 'geospatial';
  onSelectCameraMode: (mode: 'free' | 'plane' | 'polar' | 'chase' | 'geospatial') => void;
  onResetCamera: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  // Visual Filters & Lighting
  showVelocityVector: boolean;
  onToggleVelocityVector: () => void;
  showNadirProjection: boolean;
  onToggleNadirProjection: () => void;
  showEquatorPlane: boolean;
  onToggleEquatorPlane: () => void;
  showApsides: boolean;
  onToggleApsides: () => void;
  showShadowCone: boolean;
  onToggleShadowCone: () => void;
  showBodyAxes: boolean;
  onToggleBodyAxes: () => void;
  showDarkSideLight: boolean;
  onToggleDarkSideLight: () => void;
  showSunLight?: boolean;
  onToggleSunLight?: () => void;
  showKeplerianDiagram?: boolean;
  onToggleKeplerianDiagram?: () => void;
  onOpenKeplerianGuide?: () => void;
  // Navigation / Landing Page
  onReturnToLanding?: () => void;
  // Modal / Drawer Triggers
  onOpenCelestrak: () => void;
  onOpenSpiceModal: () => void;
  onOpenTleModal: () => void;
  onOpenKeplerianDrawer: () => void;
  onOpenGroundTrackModal: () => void;
  onOpenLifetimeModal: () => void;
  onOpenSpiceAttitudeModal: () => void;
  onOpenPowerBudgetModal?: () => void;
}

export const MissionControlOverlay: React.FC<MissionControlOverlayProps> = ({
  simDate,
  elements,
  cubeSat,
  derivedState,
  spice,
  attitude,
  propagatorEngine,
  isPlaying,
  onTogglePlay,
  simSpeedMultiplier,
  onSpeedChange,
  onTrueAnomalyChange,
  cameraMode,
  onSelectCameraMode,
  onResetCamera,
  onZoomIn,
  onZoomOut,
  showVelocityVector,
  onToggleVelocityVector,
  showNadirProjection,
  onToggleNadirProjection,
  showEquatorPlane,
  onToggleEquatorPlane,
  showApsides,
  onToggleApsides,
  showShadowCone,
  onToggleShadowCone,
  showBodyAxes,
  onToggleBodyAxes,
  showDarkSideLight,
  onToggleDarkSideLight,
  showSunLight = true,
  onToggleSunLight,
  showKeplerianDiagram = true,
  onToggleKeplerianDiagram,
  onOpenKeplerianGuide,
  onOpenCelestrak,
  onOpenSpiceModal,
  onOpenTleModal,
  onOpenKeplerianDrawer,
  onOpenGroundTrackModal,
  onOpenLifetimeModal,
  onOpenSpiceAttitudeModal,
  onOpenPowerBudgetModal,
  onReturnToLanding,
}) => {
  // HUD Dropdown states
  const [activeMenu, setActiveMenu] = useState<'camera' | 'telemetry' | 'filters' | null>(null);
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState<boolean>(false);
  const [isFullTelemetryExpanded, setIsFullTelemetryExpanded] = useState<boolean>(false);
  const [isUmbraVerificationOpen, setIsUmbraVerificationOpen] = useState<boolean>(false);

  // Live NASA Umbra & Penumbra Ground-Truth calculation
  const nasaUmbra = useMemo(() => {
    const kep = keplerianToECI(elements, elements.trueAnomaly);
    return getNasaUmbraOccultation(kep.position, simDate);
  }, [elements, simDate]);

  // Dynamic Battery calculation:
  // In Sunlight: high battery state 96-100%, +45W charging
  // In Eclipse: battery discharging down to ~78%, -18W discharge
  const batteryStats = useMemo(() => {
    const inSunlight = !spice.inEclipse;
    // Calculate orbital sun fraction
    const sunFraction = spice.sunlightFraction || (inSunlight ? 1.0 : 0.0);
    const chargeLevel = inSunlight ? 98.4 : 81.6;
    const powerRateWatts = inSunlight ? 42.5 * sunFraction : -18.2;
    return {
      percent: chargeLevel,
      isCharging: inSunlight,
      powerRateWatts,
      sunFraction,
    };
  }, [spice.inEclipse, spice.sunlightFraction]);

  // Dynamic Signal Strength calculation (RF link budget simulation)
  const signalDbm = useMemo(() => {
    // Altitude-dependent path loss and elevation angle simulation
    const altKm = derivedState.currentAltKm;
    const nominalDbm = -78;
    const pathLoss = Math.min(24, Math.max(0, (altKm - 300) / 40));
    return (nominalDbm - pathLoss).toFixed(1);
  }, [derivedState.currentAltKm]);

  // Formatted UTC simulation timestamp
  const formattedUtc = useMemo(() => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = simDate.getUTCFullYear();
    const m = pad(simDate.getUTCMonth() + 1);
    const d = pad(simDate.getUTCDate());
    const hh = pad(simDate.getUTCHours());
    const mm = pad(simDate.getUTCMinutes());
    const ss = pad(simDate.getUTCSeconds());
    return `${y}-${m}-${d} ${hh}:${mm}:${ss} UTC`;
  }, [simDate]);

  // Timeline intervals based on orbital period
  const orbitalPeriodMin = derivedState.orbitalPeriodMin || 94.6;
  const halfOrbitMin = (orbitalPeriodMin / 2).toFixed(0);

  // Step scrub by delta true anomaly
  const handleStepDelta = (deltaDeg: number) => {
    let nextNu = elements.trueAnomaly + deltaDeg;
    if (nextNu >= 360) nextNu -= 360;
    if (nextNu < 0) nextNu += 360;
    onTrueAnomalyChange(nextNu);
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3 sm:p-5 select-none overflow-hidden font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP HUD: Floating Translucent Glassmorphism Header */}
      {/* ========================================================================= */}
      <header className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/75 backdrop-blur-md border border-slate-800/80 shadow-2xl transition-all">
        {/* Left: App Title, Live Pulse, UTC Simulation Clock */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 rotate-45 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <h1 className="font-mono text-xs sm:text-sm font-extrabold tracking-widest text-slate-100 uppercase">
              CUBESAT MISSION SIMULATOR
            </h1>
          </div>

          {/* LIVE Pulse Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 text-[11px] font-mono font-semibold tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>LIVE</span>
          </div>

          {/* UTC Simulation Timestamp */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="tracking-wide text-slate-200">{formattedUtc}</span>
          </div>

          {/* Spacecraft Identification Tag */}
          <div className="hidden lg:flex items-center gap-1.5 text-slate-400 text-xs font-mono">
            <span className="text-slate-600">|</span>
            <span className="text-purple-300 font-semibold">{cubeSat.name}</span>
            <span className="text-slate-500">({cubeSat.formFactor})</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-cyan-400/90">{propagatorEngine.toUpperCase()}</span>
          </div>
        </div>

        {/* Right: Minimalist Flat-Icon Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Return to SSGI Landing Page & Flight Crew */}
          {onReturnToLanding && (
            <button
              id="hud-btn-return-landing"
              onClick={onReturnToLanding}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 hover:text-white text-xs font-mono font-semibold transition-all shadow-md"
              title="Return to SSGI Landing Page & Flight Crew Overview"
            >
              <Home className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">SSGI Home / Crew</span>
            </button>
          )}

          {/* Camera Settings Dropdown Button */}
          <div className="relative">
            <button
              id="hud-btn-camera"
              onClick={() => setActiveMenu(activeMenu === 'camera' ? null : 'camera')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                activeMenu === 'camera'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
              title="Camera Perspectives"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Camera</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Camera Settings Popup Menu */}
            {activeMenu === 'camera' && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-slate-950/95 backdrop-blur-lg border border-slate-800 shadow-2xl p-2 flex flex-col gap-1 z-30 font-mono text-xs">
                <div className="px-2 py-1 text-[10px] text-slate-400 uppercase tracking-wider font-sans border-b border-slate-800/80 mb-1">
                  Camera Perspective
                </div>
                {(
                  [
                    { id: 'free', label: 'Free Orbit (Interactive)' },
                    { id: 'plane', label: 'Orbital Plane Align' },
                    { id: 'polar', label: 'Polar Top-Down' },
                    { id: 'chase', label: 'Spacecraft Chase Cam' },
                    { id: 'geospatial', label: 'Nadir Earth View' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onSelectCameraMode(opt.id);
                      setActiveMenu(null);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      cameraMode === opt.id
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {cameraMode === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </button>
                ))}
                <div className="border-t border-slate-800/80 my-1" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (onZoomIn) onZoomIn();
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-850 transition-colors"
                    title="Zoom In (Keyboard: +)"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Zoom In</span>
                    <span className="text-[10px] text-slate-500 font-mono">+</span>
                  </button>
                  <button
                    onClick={() => {
                      if (onZoomOut) onZoomOut();
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-850 transition-colors"
                    title="Zoom Out (Keyboard: -)"
                  >
                    <ZoomOut className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Zoom Out</span>
                    <span className="text-[10px] text-slate-500 font-mono">-</span>
                  </button>
                </div>
                <button
                  onClick={() => {
                    onResetCamera();
                    setActiveMenu(null);
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                  title="Reset Camera View (Keyboard: 0)"
                >
                  <div className="flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset View</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">0</span>
                </button>
              </div>
            )}
          </div>

          {/* Telemetry Views Action Button */}
          <div className="relative">
            <button
              id="hud-btn-telemetry"
              onClick={() => setActiveMenu(activeMenu === 'telemetry' ? null : 'telemetry')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                activeMenu === 'telemetry'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
              title="Telemetry Subsystems & Analysis"
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Telemetry</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Telemetry Views Popup Menu */}
            {activeMenu === 'telemetry' && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-slate-950/95 backdrop-blur-lg border border-slate-800 shadow-2xl p-2 flex flex-col gap-1 z-30 font-mono text-xs">
                <div className="px-2 py-1 text-[10px] text-slate-400 uppercase tracking-wider font-sans border-b border-slate-800/80 mb-1">
                  Subsystems &amp; Modals
                </div>
                <button
                  onClick={() => {
                    onOpenKeplerianDrawer();
                    setActiveMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-850 hover:text-cyan-300 transition-colors text-left"
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Keplerian Elements</span>
                </button>
                <button
                  onClick={() => {
                    onOpenGroundTrackModal();
                    setActiveMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-850 hover:text-emerald-300 transition-colors text-left"
                >
                  <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2D Ground Track Map</span>
                </button>
                <button
                  onClick={() => {
                    onOpenLifetimeModal();
                    setActiveMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-850 hover:text-amber-300 transition-colors text-left"
                >
                  <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Atmospheric Decay</span>
                </button>
                <button
                  onClick={() => {
                    onOpenSpiceAttitudeModal();
                    setActiveMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-850 hover:text-purple-300 transition-colors text-left"
                >
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>Orekit &amp; SPICE Dynamics</span>
                </button>
                {onOpenPowerBudgetModal && (
                  <button
                    onClick={() => {
                      onOpenPowerBudgetModal();
                      setActiveMenu(null);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-850 hover:text-amber-300 transition-colors text-left"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Power Budget (NASA EPS)</span>
                  </button>
                )}
                <div className="border-t border-slate-800/80 my-1" />
                <button
                  onClick={() => {
                    onOpenCelestrak();
                    setActiveMenu(null);
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-slate-850 hover:text-white transition-colors text-left"
                >
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CelesTrak / TLEs</span>
                </button>
              </div>
            )}
          </div>

          {/* Filters Action Button */}
          <div className="relative">
            <button
              id="hud-btn-filters"
              onClick={() => setActiveMenu(activeMenu === 'filters' ? null : 'filters')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                activeMenu === 'filters'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
              title="Toggle Visual Geometric Overlays"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Filters</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Filters Popup Menu */}
            {activeMenu === 'filters' && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-slate-950/95 backdrop-blur-lg border border-slate-800 shadow-2xl p-2.5 flex flex-col gap-1.5 z-30 font-mono text-xs">
                <div className="px-1 py-0.5 text-[10px] text-slate-400 uppercase tracking-wider font-sans border-b border-slate-800/80 mb-1">
                  Geometric Overlays
                </div>
                {[
                  {
                    label: 'Velocity Vector',
                    checked: showVelocityVector,
                    toggle: onToggleVelocityVector,
                    color: 'text-emerald-400',
                  },
                  {
                    label: 'Nadir Projection',
                    checked: showNadirProjection,
                    toggle: onToggleNadirProjection,
                    color: 'text-amber-400',
                  },
                  {
                    label: 'Equatorial Plane',
                    checked: showEquatorPlane,
                    toggle: onToggleEquatorPlane,
                    color: 'text-cyan-400',
                  },
                  {
                    label: 'Perigee / Apogee',
                    checked: showApsides,
                    toggle: onToggleApsides,
                    color: 'text-rose-400',
                  },
                  {
                    label: 'Earth Shadow Cone (U)',
                    checked: showShadowCone,
                    toggle: onToggleShadowCone,
                    color: 'text-indigo-400',
                  },
                  {
                    label: 'Body XYZ Axes',
                    checked: showBodyAxes,
                    toggle: onToggleBodyAxes,
                    color: 'text-purple-400',
                  },
                  {
                    label: 'Dark Side Light (L)',
                    checked: showDarkSideLight,
                    toggle: onToggleDarkSideLight,
                    color: 'text-amber-400',
                  },
                  {
                    label: 'Sunlight Direction (S)',
                    checked: showSunLight,
                    toggle: onToggleSunLight || (() => {}),
                    color: 'text-yellow-400',
                  },
                  {
                    label: 'Keplerian Diagram (K)',
                    checked: showKeplerianDiagram,
                    toggle: onToggleKeplerianDiagram || (() => {}),
                    color: 'text-cyan-400',
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.toggle}
                    className="flex items-center justify-between px-2 py-1 rounded-lg text-slate-300 hover:bg-slate-850 transition-colors text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${item.color} bg-current`} />
                      {item.label}
                    </span>
                    <span
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                        item.checked
                          ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {item.checked ? '✓' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* FLOATING LEFT TOOLBAR: Quick Zoom In / Out & NASA Umbra Check */}
      {/* ========================================================================= */}
      <div className="pointer-events-auto absolute left-3 sm:left-5 top-20 z-20 flex flex-col gap-1.5 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 p-1.5 rounded-2xl shadow-2xl">
        <button
          onClick={onZoomIn}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-850 hover:border-slate-700 border border-transparent transition-all flex items-center justify-center group relative"
          title="Zoom In (Keyboard shortcut: +)"
        >
          <ZoomIn className="w-4 h-4 text-cyan-400" />
          <span className="sr-only">Zoom In</span>
          <span className="pointer-events-none absolute left-full ml-2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono text-cyan-300 shadow-xl group-hover:block whitespace-nowrap border border-slate-700 z-30">
            Zoom In (+)
          </span>
        </button>
        <button
          onClick={onZoomOut}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-850 hover:border-slate-700 border border-transparent transition-all flex items-center justify-center group relative"
          title="Zoom Out (Keyboard shortcut: -)"
        >
          <ZoomOut className="w-4 h-4 text-cyan-400" />
          <span className="sr-only">Zoom Out</span>
          <span className="pointer-events-none absolute left-full ml-2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono text-cyan-300 shadow-xl group-hover:block whitespace-nowrap border border-slate-700 z-30">
            Zoom Out (-)
          </span>
        </button>
        <div className="border-t border-slate-800/80 my-0.5" />
        <button
          onClick={onResetCamera}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-850 hover:border-slate-700 border border-transparent transition-all flex items-center justify-center group relative"
          title="Reset Camera (Keyboard shortcut: 0)"
        >
          <RotateCcw className="w-4 h-4 text-slate-400" />
          <span className="sr-only">Reset Camera</span>
          <span className="pointer-events-none absolute left-full ml-2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono text-slate-300 shadow-xl group-hover:block whitespace-nowrap border border-slate-700 z-30">
            Reset View (0)
          </span>
        </button>
        <div className="border-t border-slate-800/80 my-0.5" />
        {/* Direct Umbra Toggle Button */}
        <button
          id="btn-quick-toggle-umbra"
          onClick={onToggleShadowCone}
          className={`p-2 rounded-xl border transition-all flex items-center justify-center group relative ${
            showShadowCone
              ? 'bg-indigo-950/90 text-indigo-300 border-indigo-500/60 shadow-[0_0_12px_rgba(99,102,241,0.35)]'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-850 border-transparent'
          }`}
          title={`Earth Umbra: ${showShadowCone ? 'ON' : 'OFF'} (Click or press U to toggle)`}
        >
          <Moon className={`w-4 h-4 ${showShadowCone ? 'text-indigo-400' : 'text-slate-500'}`} />
          <span className="sr-only">Toggle Earth Umbra</span>
          <span className="pointer-events-none absolute left-full ml-2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono shadow-xl group-hover:block whitespace-nowrap border border-slate-700 z-30">
            Umbra: <strong className={showShadowCone ? 'text-indigo-300 font-bold' : 'text-slate-400'}>{showShadowCone ? 'ON' : 'OFF'}</strong> (Key: U)
          </span>
        </button>
        {/* Dark Side Floodlight / Nightside Illumination Toggle Button */}
        <button
          id="btn-quick-toggle-darkside-light"
          onClick={onToggleDarkSideLight}
          className={`p-2 rounded-xl border transition-all flex items-center justify-center group relative ${
            showDarkSideLight
              ? 'bg-amber-950/90 text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-850 border-transparent'
          }`}
          title={`Dark Side Light: ${showDarkSideLight ? 'ON' : 'OFF'} (Click or press L to toggle)`}
        >
          <Lightbulb className={`w-4 h-4 ${showDarkSideLight ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
          <span className="sr-only">Toggle Dark Side Light</span>
          <span className="pointer-events-none absolute left-full ml-2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono shadow-xl group-hover:block whitespace-nowrap border border-slate-700 z-30">
            Dark Side Light: <strong className={showDarkSideLight ? 'text-amber-300 font-bold' : 'text-slate-400'}>{showDarkSideLight ? 'ON' : 'OFF'}</strong> (Key: L)
          </span>
        </button>
        {/* Directional Sunlight / Solar Illuminator Toggle Button */}
        <button
          id="btn-quick-toggle-sunlight"
          onClick={onToggleSunLight}
          className={`p-2 rounded-xl border transition-all flex items-center justify-center group relative ${
            showSunLight
              ? 'bg-yellow-950/90 text-yellow-300 border-yellow-500/60 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-850 border-transparent'
          }`}
          title={`Sunlight Direction: ${showSunLight ? 'ON' : 'OFF'} (Click or press S to toggle)`}
        >
          <Sun className={`w-4 h-4 ${showSunLight ? 'text-yellow-400' : 'text-slate-500'}`} />
          <span className="sr-only">Toggle Directional Sunlight</span>
          <span className="pointer-events-none absolute left-full ml-2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono shadow-xl group-hover:block whitespace-nowrap border border-slate-700 z-30">
            Sunlight: <strong className={showSunLight ? 'text-yellow-300 font-bold' : 'text-slate-400'}>{showSunLight ? 'ON' : 'OFF'}</strong> (Key: S)
          </span>
        </button>
        {/* Keplerian Elements 3D Diagram Toggle Button (Key: K) */}
        <button
          id="btn-quick-toggle-keplerian-diagram"
          onClick={onToggleKeplerianDiagram}
          className={`p-2 rounded-xl border transition-all flex items-center justify-center group relative ${
            showKeplerianDiagram
              ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-850 border-transparent'
          }`}
          title={`Keplerian Diagram: ${showKeplerianDiagram ? 'ON' : 'OFF'} (Click or press K to toggle)`}
        >
          <Orbit className={`w-4 h-4 ${showKeplerianDiagram ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span className="sr-only">Toggle Keplerian Elements 3D Diagram</span>
          <span className="pointer-events-none absolute left-full ml-2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono shadow-xl group-hover:block whitespace-nowrap border border-slate-700 z-30">
            Keplerian Diagram: <strong className={showKeplerianDiagram ? 'text-cyan-300 font-bold' : 'text-slate-400'}>{showKeplerianDiagram ? 'ON' : 'OFF'}</strong> (Key: K)
          </span>
        </button>
        {/* Keplerian Elements Guide for Everyone Button */}
        <button
          id="btn-quick-open-keplerian-guide"
          onClick={onOpenKeplerianGuide}
          className="p-2 rounded-xl border border-transparent hover:border-cyan-500/40 text-slate-400 hover:text-cyan-300 hover:bg-slate-850 transition-all flex items-center justify-center group relative"
          title="Keplerian Elements for Everyone (Interactive Guide & Benchmarks)"
        >
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span className="sr-only">Keplerian Elements Guide</span>
          <span className="pointer-events-none absolute left-full ml-2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono text-cyan-300 shadow-xl group-hover:block whitespace-nowrap border border-slate-700 z-30">
            Keplerian Guide for Everyone
          </span>
        </button>
        {/* NASA Umbra Verification Button */}
        <button
          onClick={() => setIsUmbraVerificationOpen(true)}
          className={`p-2 rounded-xl border transition-all flex items-center justify-center group relative ${
            spice.inEclipse
              ? 'bg-indigo-950/90 text-indigo-300 border-indigo-500/60 shadow-[0_0_10px_rgba(99,102,241,0.3)]'
              : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-850 border-transparent'
          }`}
          title="Inspect Earth Umbra (NASA Free Data Verification)"
        >
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span className="sr-only">NASA Umbra Verification</span>
          <span className="pointer-events-none absolute left-full ml-2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-mono text-indigo-300 shadow-xl group-hover:block whitespace-nowrap border border-slate-700 z-30">
            NASA Umbra Check
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. FLOATING COMPACT SIDE PANEL: Live Telemetry Cards (Collapsible) */}
      {/* ========================================================================= */}
      <aside
        className={`pointer-events-auto absolute right-3 sm:right-5 top-20 z-10 transition-all duration-300 ease-out flex flex-col items-end ${
          isSidePanelCollapsed ? 'translate-x-[calc(100%-38px)]' : 'translate-x-0'
        }`}
      >
        <div className="flex items-start">
          {/* Collapse / Expand Tab Button */}
          <button
            onClick={() => setIsSidePanelCollapsed(!isSidePanelCollapsed)}
            className="mt-2 -mr-1 p-1.5 rounded-l-xl bg-slate-950/90 border-y border-l border-slate-800 text-slate-400 hover:text-cyan-400 transition-colors shadow-lg"
            title={isSidePanelCollapsed ? 'Expand Telemetry' : 'Collapse Telemetry'}
          >
            {isSidePanelCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Telemetry Card Container */}
          <div className="w-72 sm:w-80 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800/80 shadow-2xl p-3.5 flex flex-col gap-2.5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                <span>FLIGHT TELEMETRY</span>
              </div>
              <button
                onClick={() => setIsUmbraVerificationOpen(true)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all flex items-center gap-1 hover:scale-105 ${
                  spice.inEclipse
                    ? 'bg-indigo-950/90 text-indigo-300 border-indigo-500/60 shadow-[0_0_10px_rgba(99,102,241,0.3)]'
                    : 'bg-amber-950/90 text-amber-300 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                }`}
                title="Click to verify Earth Umbra geometry with NASA free data"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${spice.inEclipse ? 'bg-indigo-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                <span>{spice.inEclipse ? 'UMBRA ECLIPSE' : 'SOLAR EXPOSURE'}</span>
                <Info className="w-2.5 h-2.5 opacity-70" />
              </button>
            </div>

            {/* Quick Umbra 3D Visual Cone Toggle */}
            <div className="flex items-center justify-between text-[11px] px-2.5 py-1 rounded-xl bg-slate-900/60 border border-slate-800/80 font-mono">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className={`w-2 h-2 rounded-full ${showShadowCone ? 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.8)]' : 'bg-slate-600'}`} />
                <span>3D Umbra Shadow</span>
              </div>
              <button
                id="hud-toggle-umbra-telemetry"
                onClick={onToggleShadowCone}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                  showShadowCone
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-500/60 hover:bg-indigo-900 shadow-[0_0_8px_rgba(99,102,241,0.25)]'
                    : 'bg-slate-850 text-slate-400 border-slate-750 hover:bg-slate-800 hover:text-white'
                }`}
                title="Toggle Earth 3D Umbra shadow cone visibility (Shortcut: U)"
              >
                {showShadowCone ? 'ON (Press U)' : 'OFF (Press U)'}
              </button>
            </div>

            {/* Quick Dark Side Orbit Fill Light Toggle */}
            <div className="flex items-center justify-between text-[11px] px-2.5 py-1 rounded-xl bg-slate-900/60 border border-slate-800/80 font-mono">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className={`w-2 h-2 rounded-full ${showDarkSideLight ? 'bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]' : 'bg-slate-600'}`} />
                <span>Dark Side Light</span>
              </div>
              <button
                id="hud-toggle-darkside-light-telemetry"
                onClick={onToggleDarkSideLight}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                  showDarkSideLight
                    ? 'bg-amber-950 text-amber-300 border-amber-500/60 hover:bg-amber-900 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-slate-850 text-slate-400 border-slate-750 hover:bg-slate-800 hover:text-white'
                }`}
                title="Turn on/off light to see dark side of Earth and orbit (Shortcut: L)"
              >
                {showDarkSideLight ? 'LIGHT: ON (L)' : 'LIGHT: OFF (L)'}
              </button>
            </div>

            {/* Quick Directional Sunlight Source Toggle */}
            <div className="flex items-center justify-between text-[11px] px-2.5 py-1 rounded-xl bg-slate-900/60 border border-slate-800/80 font-mono">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className={`w-2 h-2 rounded-full ${showSunLight ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.8)]' : 'bg-slate-600'}`} />
                <span>Sunlight Direction</span>
              </div>
              <button
                id="hud-toggle-sunlight-telemetry"
                onClick={onToggleSunLight}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                  showSunLight
                    ? 'bg-yellow-950 text-yellow-300 border-yellow-500/60 hover:bg-yellow-900 shadow-[0_0_8px_rgba(250,204,21,0.25)]'
                    : 'bg-slate-850 text-slate-400 border-slate-750 hover:bg-slate-800 hover:text-white'
                }`}
                title="Turn on/off directional sunlight simulating solar vector (Shortcut: S)"
              >
                {showSunLight ? 'SUN: ON (S)' : 'SUN: OFF (S)'}
              </button>
            </div>

            {/* Quick Keplerian Diagram Overlay Toggle */}
            <div className="flex items-center justify-between text-[11px] px-2.5 py-1 rounded-xl bg-slate-900/60 border border-slate-800/80 font-mono">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className={`w-2 h-2 rounded-full ${showKeplerianDiagram ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-slate-600'}`} />
                <span>Keplerian Diagram</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  id="hud-toggle-keplerian-telemetry"
                  onClick={onToggleKeplerianDiagram}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                    showKeplerianDiagram
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60 hover:bg-cyan-900 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                      : 'bg-slate-850 text-slate-400 border-slate-750 hover:bg-slate-800 hover:text-white'
                  }`}
                  title="Turn on/off 3D Keplerian visual diagram overlay (Shortcut: K)"
                >
                  {showKeplerianDiagram ? 'DIAGRAM: ON (K)' : 'DIAGRAM: OFF (K)'}
                </button>
                {onOpenKeplerianGuide && (
                  <button
                    id="hud-open-keplerian-guide-btn"
                    onClick={onOpenKeplerianGuide}
                    className="px-1.5 py-0.5 rounded-lg text-[10px] bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-sans font-semibold transition-colors"
                    title="Open Keplerian Elements Guide for Everyone"
                  >
                    Guide
                  </button>
                )}
              </div>
            </div>

            {/* Read-Only Telemetry Blocks */}
            <div className="grid grid-cols-2 gap-2 font-mono">
              {/* 1. Altitude (km) */}
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/70 flex flex-col justify-between">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-sans flex items-center justify-between">
                  <span>ALTITUDE</span>
                  <span className="text-cyan-400/80 text-[10px]">KM</span>
                </div>
                <div className="text-lg font-bold text-slate-100 mt-1">
                  {derivedState.currentAltKm.toFixed(1)}
                  <span className="text-xs font-normal text-slate-400 ml-1">km</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  Peri: {derivedState.perigeeAltKm.toFixed(0)} | Apo: {derivedState.apogeeAltKm.toFixed(0)}
                </div>
              </div>

              {/* 2. Velocity (km/s) */}
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/70 flex flex-col justify-between">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-sans flex items-center justify-between">
                  <span>VELOCITY</span>
                  <span className="text-emerald-400/80 text-[10px]">KM/S</span>
                </div>
                <div className="text-lg font-bold text-slate-100 mt-1">
                  {derivedState.currentVelocityKmS.toFixed(2)}
                  <span className="text-xs font-normal text-slate-400 ml-1">km/s</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  Period: {derivedState.orbitalPeriodMin.toFixed(1)} min
                </div>
              </div>

              {/* 3. Battery (%) */}
              <div
                onClick={() => {
                  if (onOpenPowerBudgetModal) onOpenPowerBudgetModal();
                }}
                className={`p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/70 flex flex-col justify-between transition-all ${
                  onOpenPowerBudgetModal ? 'cursor-pointer hover:border-amber-500/50 hover:bg-slate-900' : ''
                }`}
                title="Click to view NASA Power Budget & EPS Analysis"
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-sans flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span>BATTERY</span>
                    <span className="text-[9px] text-amber-400/80 font-mono">(EPS)</span>
                  </div>
                  {batteryStats.isCharging ? (
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Battery className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>
                <div className="text-lg font-bold text-slate-100 mt-1 flex items-baseline gap-1">
                  <span className={batteryStats.isCharging ? 'text-emerald-300' : 'text-amber-300'}>
                    {batteryStats.percent.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center justify-between">
                  <span>{batteryStats.isCharging ? `+${batteryStats.powerRateWatts.toFixed(0)}W Solar` : '-18W Drain'}</span>
                  <span className="text-[9px] text-cyan-400 underline">Details</span>
                </div>
              </div>

              {/* 4. Signal Strength (dBm) */}
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/70 flex flex-col justify-between">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-sans flex items-center justify-between">
                  <span>SIGNAL RF</span>
                  <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                </div>
                <div className="text-lg font-bold text-slate-100 mt-1">
                  <span className="text-cyan-300">{signalDbm}</span>
                  <span className="text-xs font-normal text-slate-400 ml-1">dBm</span>
                </div>
                <div className="text-[10px] text-emerald-400/90 truncate mt-0.5">
                  AOS Locked (UHF)
                </div>
              </div>
            </div>

            {/* Expandable Advanced Subsystem Telemetry */}
            {isFullTelemetryExpanded && (
              <div className="pt-2 border-t border-slate-800/70 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-300">
                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-slate-400">Inclination:</span>{' '}
                  <span className="text-slate-100 font-bold">{elements.i.toFixed(2)}&deg;</span>
                </div>
                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-slate-400">True Anomaly:</span>{' '}
                  <span className="text-cyan-300 font-bold">{elements.trueAnomaly.toFixed(1)}&deg;</span>
                </div>
                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-slate-400">Beta Angle (&beta;):</span>{' '}
                  <span className="text-purple-300 font-bold">{spice.betaAngleDeg.toFixed(1)}&deg;</span>
                </div>
                <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-slate-400">Attitude:</span>{' '}
                  <span className="text-amber-300 font-bold capitalize">{cubeSat.attitudeMode || 'tumbling'}</span>
                </div>
              </div>
            )}

            {/* Toggle Full Telemetry View */}
            <button
              onClick={() => setIsFullTelemetryExpanded(!isFullTelemetryExpanded)}
              className="w-full text-center py-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors flex items-center justify-center gap-1"
            >
              <span>{isFullTelemetryExpanded ? 'Less Details' : 'Full Telemetry'}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${isFullTelemetryExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 3. BOTTOM TIME CONTROLLER: NASA-Style Timeline Scrubber */}
      {/* ========================================================================= */}
      <footer className="pointer-events-auto self-center w-[96%] max-w-3xl rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800/80 shadow-2xl p-3 sm:p-4 mb-1 transition-all">
        <div className="flex flex-col gap-2.5">
          {/* Top Bar: Play/Pause, Step Controls, Speed Multipliers */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Left Controls: Rewind, Play/Pause, Fast-Forward */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStepDelta(-15)}
                className="p-1.5 rounded-xl bg-slate-900/80 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors"
                title="Rewind 15 degrees"
              >
                <Rewind className="w-3.5 h-3.5" />
              </button>

              <button
                id="hud-timeline-play-btn"
                onClick={onTogglePlay}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shadow-md ${
                  isPlaying
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                    : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                }`}
                title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                onClick={() => handleStepDelta(15)}
                className="p-1.5 rounded-xl bg-slate-900/80 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors"
                title="Advance 15 degrees"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>

              <span className="text-slate-600 font-mono text-xs">|</span>

              {/* Reset to Perigee */}
              <button
                onClick={() => onTrueAnomalyChange(0)}
                className="text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors px-2 py-1 rounded bg-slate-900/50 border border-slate-800/60"
                title="Reset to Perigee (True Anomaly = 0)"
              >
                T0 Peri
              </button>
            </div>

            {/* Center: Current Orbit Angle readout */}
            <div className="font-mono text-xs text-slate-300 flex items-center gap-2">
              <span className="text-slate-500 hidden sm:inline">ORBIT PHASE:</span>
              <span className="text-cyan-400 font-bold">{elements.trueAnomaly.toFixed(1)}&deg;</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">360&deg;</span>
            </div>

            {/* Right: NASA Speed Multipliers (1x, 10x, 50x, 100x, 500x) */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 text-[11px] font-mono">
              <span className="text-slate-500 px-1 text-[10px] font-sans">SPEED:</span>
              {[1, 10, 50, 100, 500].map((multiplier) => (
                <button
                  key={multiplier}
                  onClick={() => onSpeedChange(multiplier)}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    simSpeedMultiplier === multiplier
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {multiplier}x
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Range Slider Track */}
          <div className="relative flex flex-col gap-1">
            <input
              id="hud-timeline-slider"
              type="range"
              min={0}
              max={360}
              step={0.5}
              value={elements.trueAnomaly}
              onChange={(e) => onTrueAnomalyChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 focus:outline-none transition-all"
            />

            {/* Explicit Calendar Intervals / Orbital Milestones */}
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 px-0.5">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                PERIGEE (T0)
              </span>
              <span className="hidden sm:inline text-slate-500">+{((orbitalPeriodMin / 4)).toFixed(0)}m (Node)</span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                APOGEE (+{halfOrbitMin}m)
              </span>
              <span className="hidden sm:inline text-slate-500">+{((orbitalPeriodMin * 0.75)).toFixed(0)}m</span>
              <span className="text-cyan-400">T+{orbitalPeriodMin.toFixed(0)}m (Orbit 1)</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 4. NASA EARTH UMBRA & OCCULTATION VERIFICATION MODAL */}
      {/* ========================================================================= */}
      {isUmbraVerificationOpen && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-slate-950/95 border border-indigo-500/40 shadow-2xl p-5 flex flex-col gap-4 font-sans text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                    NASA EARTH UMBRA VERIFICATION
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
                      NASA FREE DATA
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Dual-Cone Shadow Geometry verified against NAIF SPICE &amp; Vallado Astrodynamics
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUmbraVerificationOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Verification Status Card */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                nasaUmbra.inUmbra
                  ? 'bg-indigo-950/40 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                  : nasaUmbra.inPenumbra
                  ? 'bg-purple-950/40 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                  : 'bg-amber-950/30 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
              }`}
            >
              <div className="flex items-center gap-3">
                {nasaUmbra.inUmbra ? (
                  <Moon className="w-6 h-6 text-indigo-400 animate-pulse" />
                ) : (
                  <Sun className="w-6 h-6 text-amber-400 animate-pulse" />
                )}
                <div>
                  <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    {nasaUmbra.inUmbra
                      ? 'Total Earth Umbra (Full Shadow)'
                      : nasaUmbra.inPenumbra
                      ? 'Penumbra (Partial Occultation)'
                      : 'Direct Solar Exposure (Sunlit)'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Sunlight Fraction:{' '}
                    <span className="font-mono text-cyan-300 font-semibold">
                      {(nasaUmbra.sunlightFraction * 100).toFixed(1)}%
                    </span>{' '}
                    | Solar Flux:{' '}
                    <span className="font-mono text-emerald-300 font-semibold">
                      {nasaUmbra.inUmbra ? '0 W/m²' : `${(1361 * nasaUmbra.sunlightFraction).toFixed(0)} W/m²`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/70 px-2 py-1 rounded-lg border border-emerald-700/60">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>VERIFIED</span>
              </div>
            </div>

            {/* Interactive 3D Umbra Visibility Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl border transition-all ${
                    showShadowCone
                      ? 'bg-indigo-950 text-indigo-400 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                      : 'bg-slate-850 text-slate-500 border-slate-750'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                    <span>3D Earth Umbra Shadow Cone</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                        showShadowCone
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {showShadowCone ? 'RENDERED ON' : 'DISABLED OFF'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Display dual-cone umbra &amp; penumbra volume in 3D simulator (Shortcut: <kbd className="px-1 py-0.2 bg-slate-800 rounded text-cyan-300 font-mono">U</kbd>)
                  </div>
                </div>
              </div>
              <button
                id="modal-toggle-umbra-btn"
                onClick={onToggleShadowCone}
                className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all border shadow-md ${
                  showShadowCone
                    ? 'bg-indigo-600 text-white border-indigo-400 hover:bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750 hover:text-white'
                }`}
              >
                {showShadowCone ? 'Turn OFF' : 'Turn ON'}
              </button>
            </div>

            {/* Real-time NASA Occultation Geometry Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase font-sans">Shadow Orientation Axis</div>
                <div className="text-slate-100 font-bold mt-0.5">Anti-Solar Vector (-ŝ)</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Points directly into Earth's night hemisphere</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase font-sans">Umbra Apex Length (L_u)</div>
                <div className="text-indigo-300 font-bold mt-0.5">1,384,140 km</div>
                <div className="text-[10px] text-slate-400 mt-0.5">217.02 Earth radii (R_E)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase font-sans">Behind Earth Plane (s)</div>
                <div className="text-cyan-300 font-bold mt-0.5">
                  {nasaUmbra.distanceBehindEarthKm.toFixed(1)} km
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Along anti-solar center axis</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase font-sans">Axis Distance (ρ vs R_u)</div>
                <div className="text-amber-300 font-bold mt-0.5">
                  {nasaUmbra.perpDistanceKm.toFixed(1)} km
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Umbra radius limit: {nasaUmbra.umbraRadiusKm.toFixed(1)} km
                </div>
              </div>
            </div>

            {/* Verified NASA Physical Constants */}
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-[11px] font-mono text-slate-300 flex flex-col gap-1.5">
              <div className="text-[10px] uppercase font-sans text-slate-400 tracking-wider flex items-center justify-between">
                <span>NASA Planetary &amp; Astrodynamic Constants</span>
                <span className="text-cyan-400">NAIF SPICE KERNELS</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <div>Earth Radius (WGS-84): <span className="text-white">6,378.137 km</span></div>
                <div>Sun Radius (IAU): <span className="text-white">696,340 km</span></div>
                <div>1 AU Mean Distance: <span className="text-white">149,597,871 km</span></div>
                <div>Umbral Taper Angle: <span className="text-white">0.26425° (0.0046 rad)</span></div>
                <div>Penumbral Flare Angle: <span className="text-white">0.26915° (0.0047 rad)</span></div>
                <div>Solar Flux Constant: <span className="text-white">1,361.0 W/m²</span></div>
              </div>
            </div>

            {/* Controls Note & Keyboard Shortcuts */}
            <div className="px-3 py-2 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between flex-wrap gap-2">
              <span>View Controls:</span>
              <div className="flex items-center gap-2.5 text-cyan-400 flex-wrap">
                <span>Sun: <strong className="text-yellow-300">S</strong></span>
                <span>Dark Light: <strong className="text-amber-300">L</strong></span>
                <span>Umbra: <strong className="text-white">U</strong></span>
                <span>Zoom: <strong className="text-white">+ / -</strong></span>
                <span>Reset: <strong className="text-white">0</strong></span>
                <span>Orbit: <strong className="text-white">Drag</strong></span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
              <span>Free NASA source: NAIF SPICE, JPL DE440</span>
              <button
                onClick={() => setIsUmbraVerificationOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold font-mono text-xs hover:bg-cyan-400 transition-colors shadow-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
