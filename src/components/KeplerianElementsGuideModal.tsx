/**
 * Keplerian Elements Guide & Interactive Demonstrator Modal
 *
 * Designed for EVERYONE: converts complex celestial astrodynamics into
 * intuitive, plain-English concepts with real data, interactive visual highlights,
 * real-world satellite benchmarks (ISS, Hubble, Landsat, Molniya, Geo),
 * and live synchronization with the 3D orbital diagram.
 */

import React, { useState, useMemo } from 'react';
import { KeplerianElements, OrbitDerivedState } from '../types';
import { EARTH_RADIUS_KM, computeOrbitDerivedState } from '../physics/orbitalMechanics';
import {
  Orbit,
  X,
  Compass,
  Layers,
  Sparkles,
  Sliders,
  Eye,
  EyeOff,
  Info,
  CheckCircle2,
  ChevronRight,
  RotateCw,
  Maximize2,
  Minimize2,
  Satellite,
  Activity,
  ArrowUpRight,
  TrendingDown,
} from 'lucide-react';

interface KeplerianElementsGuideModalProps {
  isOpen?: boolean;
  onClose: () => void;
  elements: KeplerianElements;
  derivedState?: OrbitDerivedState;
  onChangeElements?: (updated: KeplerianElements) => void;
  onApplyElements?: (updated: KeplerianElements) => void;
  showDiagram?: boolean;
  onToggleDiagram?: () => void;
  activeHighlightElement?: string | null;
  onSelectHighlightElement?: (elementKey: string | null) => void;
}

interface BenchmarkPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  elements: Partial<KeplerianElements>;
  badgeColor: string;
}

const BENCHMARK_PRESETS: BenchmarkPreset[] = [
  {
    id: 'iss',
    name: 'ISS (Space Station)',
    category: 'Crewed Spaceflight',
    description: '420 km nearly circular Low Earth Orbit tilted 51.6° to fly over 90% of Earth population.',
    elements: {
      a: EARTH_RADIUS_KM + 420,
      e: 0.0008,
      i: 51.64,
      raan: 142.5,
      argPerigee: 78.0,
    },
    badgeColor: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/60',
  },
  {
    id: 'hubble',
    name: 'Hubble Space Telescope',
    category: 'Astrophysics',
    description: '535 km high, low inclination (28.5°) to maximize rocket payload capacity from Cape Canaveral.',
    elements: {
      a: EARTH_RADIUS_KM + 535,
      e: 0.0003,
      i: 28.47,
      raan: 85.0,
      argPerigee: 120.0,
    },
    badgeColor: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/60',
  },
  {
    id: 'landsat9',
    name: 'Landsat 9 (Sun-Sync)',
    category: 'Earth Observation',
    description: '705 km retrograde polar orbit (98.2°) that crosses the equator at the same local solar time daily.',
    elements: {
      a: EARTH_RADIUS_KM + 705,
      e: 0.0001,
      i: 98.2,
      raan: 210.0,
      argPerigee: 90.0,
    },
    badgeColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/60',
  },
  {
    id: 'molniya',
    name: 'Molniya Spy & Comms',
    category: 'Highly Elliptical (HEO)',
    description: 'Extreme oval (e = 0.72) with 63.4° tilt. Spends 8 hours hovering high over the Northern hemisphere.',
    elements: {
      a: 26600,
      e: 0.72,
      i: 63.4,
      raan: 45.0,
      argPerigee: 270.0,
    },
    badgeColor: 'text-amber-400 border-amber-500/40 bg-amber-950/60',
  },
  {
    id: 'geo',
    name: 'Geostationary Weather Sat',
    category: 'Equatorial High Orbit',
    description: '35,786 km circular orbit over the equator. Matches Earth spin period (24 hours) to hover motionless.',
    elements: {
      a: EARTH_RADIUS_KM + 35786,
      e: 0.0001,
      i: 0.0,
      raan: 0.0,
      argPerigee: 0.0,
    },
    badgeColor: 'text-purple-400 border-purple-500/40 bg-purple-950/60',
  },
  {
    id: 'starlink',
    name: 'Starlink Constellation',
    category: 'Broadband Mega-Constellation',
    description: '550 km low altitude for low latency internet with a 53.0° inclination for global coverage.',
    elements: {
      a: EARTH_RADIUS_KM + 550,
      e: 0.0001,
      i: 53.0,
      raan: 315.0,
      argPerigee: 45.0,
    },
    badgeColor: 'text-sky-400 border-sky-500/40 bg-sky-950/60',
  },
];

export const KeplerianElementsGuideModal: React.FC<KeplerianElementsGuideModalProps> = ({
  isOpen = true,
  onClose,
  elements,
  derivedState: propDerivedState,
  onChangeElements,
  onApplyElements,
  showDiagram = true,
  onToggleDiagram,
  activeHighlightElement,
  onSelectHighlightElement,
}) => {
  const [activeTab, setActiveTab] = useState<'elements' | 'diagram' | 'benchmarks'>('elements');
  const [isBriefMode, setIsBriefMode] = useState<boolean>(true);
  const [selectedElementKey, setSelectedElementKey] = useState<string>('i');

  const derivedState = useMemo(() => {
    return propDerivedState || computeOrbitDerivedState(elements, 4.0, 0.01, 2.2, new Date());
  }, [propDerivedState, elements]);

  const handleUpdate = (updated: KeplerianElements) => {
    if (onChangeElements) onChangeElements(updated);
    if (onApplyElements) onApplyElements(updated);
  };

  if (!isOpen) return null;

  const perigeeAlt = elements.a * (1 - elements.e) - EARTH_RADIUS_KM;
  const apogeeAlt = elements.a * (1 + elements.e) - EARTH_RADIUS_KM;

  const handleApplyPreset = (preset: BenchmarkPreset) => {
    handleUpdate({
      ...elements,
      ...preset.elements,
      trueAnomaly: 0,
    });
  };

  const ELEMENT_CARDS = [
    {
      key: 'a',
      symbol: 'a',
      name: 'Semi-Major Axis',
      laymanTitle: 'Orbit Size & Average Height',
      briefSummary: 'Orbit size and average altitude. By Kepler’s 3rd Law, directly sets orbital period (lap time) and velocity.',
      currentVal: `${elements.a.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`,
      subVal: `Altitude: ${((perigeeAlt + apogeeAlt) / 2).toFixed(0)} km`,
      color: 'text-cyan-400',
      accentHex: '#00f0ff',
      borderColor: 'border-cyan-500/30',
      bgGlow: 'bg-cyan-950/40',
      analogy: 'Size of the running track.',
      plainExplanation:
        'Measures half the longest diameter of the orbital ellipse. Higher orbits travel slower and take longer to complete a revolution.',
      realDataFact: `Takes ${(derivedState.orbitalPeriodMin).toFixed(1)} min/orbit at ${(derivedState.currentVelocityKmS).toFixed(2)} km/s.`,
      min: EARTH_RADIUS_KM + 160,
      max: 42164,
      step: 10,
      val: elements.a,
      onChangeVal: (v: number) => handleUpdate({ ...elements, a: v }),
    },
    {
      key: 'e',
      symbol: 'e',
      name: 'Eccentricity',
      laymanTitle: 'Orbit Ovalness / Stretch',
      briefSummary: 'Orbit shape. 0 = circular; near 1 = stretched oval with low perigee and high apogee.',
      currentVal: elements.e.toFixed(4),
      subVal: elements.e < 0.005 ? 'Nearly Perfect Circle' : elements.e > 0.5 ? 'Extreme Oval' : 'Mild Oval',
      color: 'text-emerald-400',
      accentHex: '#10b981',
      borderColor: 'border-emerald-500/30',
      bgGlow: 'bg-emerald-950/40',
      analogy: 'Stretching a round rubber band into an egg.',
      plainExplanation:
        'Describes non-circularity. If e = 0, height is constant. High e causes low perigee plunges and high apogee swings.',
      realDataFact: `Low: ${perigeeAlt.toFixed(0)} km | High: ${apogeeAlt.toFixed(0)} km (Δ ${(apogeeAlt - perigeeAlt).toFixed(0)} km).`,
      min: 0,
      max: 0.85,
      step: 0.005,
      val: elements.e,
      onChangeVal: (v: number) => {
        const maxE = 1 - (EARTH_RADIUS_KM + 120) / elements.a;
        handleUpdate({ ...elements, e: Math.max(0, Math.min(maxE, v)) });
      },
    },
    {
      key: 'i',
      symbol: 'i',
      name: 'Inclination',
      laymanTitle: 'Orbit Tilt Angle',
      briefSummary: 'Orbit tilt relative to Earth’s equator. Sets the maximum latitude the satellite will fly over.',
      currentVal: `${elements.i.toFixed(2)}°`,
      subVal: elements.i === 0 ? 'Equatorial Orbit' : elements.i === 90 ? 'Polar Orbit' : elements.i > 90 ? 'Retrograde Orbit' : 'Prograde Orbit',
      color: 'text-yellow-400',
      accentHex: '#facc15',
      borderColor: 'border-yellow-500/30',
      bgGlow: 'bg-yellow-950/40',
      analogy: 'Tilting a spinning coin or hoop relative to the floor.',
      plainExplanation:
        'Vertical tilt between Earth’s equatorial plane and orbital plane (0° = equator, 90° = over North/South poles).',
      realDataFact: `Sweeps between ${Math.min(90, elements.i).toFixed(1)}° North and South latitudes.`,
      min: 0,
      max: 180,
      step: 0.5,
      val: elements.i,
      onChangeVal: (v: number) => handleUpdate({ ...elements, i: v }),
    },
    {
      key: 'raan',
      symbol: 'Ω',
      name: 'RAAN (Right Ascension)',
      laymanTitle: 'Deep Space Compass Heading',
      briefSummary: 'Celestial heading. Angle around the equator where the satellite climbs North, measured from Vernal Equinox (♈).',
      currentVal: `${elements.raan.toFixed(2)}°`,
      subVal: 'Measured from Vernal Equinox (♈)',
      color: 'text-amber-400',
      accentHex: '#f59e0b',
      borderColor: 'border-amber-500/30',
      bgGlow: 'bg-amber-950/40',
      analogy: 'Rotating a globe stand to face a different wall.',
      plainExplanation:
        'Orients the orbital plane in celestial space. Measured from the First Point of Aries (Vernal Equinox).',
      realDataFact: `Ascending node is at ${elements.raan.toFixed(1)}° celestial longitude.`,
      min: 0,
      max: 360,
      step: 1,
      val: elements.raan,
      onChangeVal: (v: number) => handleUpdate({ ...elements, raan: v }),
    },
    {
      key: 'argPerigee',
      symbol: 'ω',
      name: 'Argument of Perigee',
      laymanTitle: 'Where Lowest Point Sits',
      briefSummary: 'Where the closest point (perigee) sits along the oval track, measured from the ascending node.',
      currentVal: `${elements.argPerigee.toFixed(2)}°`,
      subVal: 'Measured along track from Node',
      color: 'text-violet-400',
      accentHex: '#a855f7',
      borderColor: 'border-violet-500/30',
      bgGlow: 'bg-violet-950/40',
      analogy: 'Where the deepest dip in a coaster track is located.',
      plainExplanation:
        'Controls whether the lowest skim occurs over the equator, North Pole, or South Pole.',
      realDataFact: `Perigee is rotated ${elements.argPerigee.toFixed(1)}° along the orbital plane.`,
      min: 0,
      max: 360,
      step: 1,
      val: elements.argPerigee,
      onChangeVal: (v: number) => handleUpdate({ ...elements, argPerigee: v }),
    },
    {
      key: 'trueAnomaly',
      symbol: 'θ / ν',
      name: 'True Anomaly',
      laymanTitle: 'Satellite Clock Position',
      briefSummary: 'Satellite position right now along the path (0° = closest/perigee, 180° = farthest/apogee).',
      currentVal: `${elements.trueAnomaly.toFixed(1)}°`,
      subVal: 'Real-time live position',
      color: 'text-rose-400',
      accentHex: '#f43f5e',
      borderColor: 'border-rose-500/30',
      bgGlow: 'bg-rose-950/40',
      analogy: 'Minute hand on a clock face.',
      plainExplanation:
        'Identifies exact spacecraft position along the track at the current moment in time.',
      realDataFact: `Currently flying at ${(derivedState.currentVelocityKmS).toFixed(2)} km/s at ${(Math.hypot(derivedState.perigeeAltKm || perigeeAlt, 0)).toFixed(0)} km.`,
      min: 0,
      max: 360,
      step: 1,
      val: elements.trueAnomaly,
      onChangeVal: (v: number) => handleUpdate({ ...elements, trueAnomaly: v }),
    },
  ];

  const currentActiveCard = ELEMENT_CARDS.find((c) => c.key === selectedElementKey) || ELEMENT_CARDS[2];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in select-none">
      <div
        id="keplerian-guide-modal"
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-950/95 border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden font-sans text-xs text-slate-200"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/90 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <Orbit className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Keplerian Elements for Everyone
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  Real Spacecraft Physics
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Interactive 3D geometry demonstrator explaining the 6 orbital parameters used by NASA & ESA
              </p>
            </div>
          </div>

          {/* Controls: Diagram ON/OFF Switch & Close */}
          <div className="flex items-center gap-2.5">
            {/* Dedicated ON/OFF Switch for 3D Diagram */}
            <button
              id="keplerian-modal-toggle-diagram-btn"
              onClick={onToggleDiagram}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
                showDiagram
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60 shadow-[0_0_14px_rgba(6,182,212,0.35)]'
                  : 'bg-slate-850 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Toggle the 3D Keplerian visual diagram overlay (Shortcut: K)"
            >
              {showDiagram ? <Eye className="w-4 h-4 text-cyan-400" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
              <span>3D Diagram: <strong>{showDiagram ? 'ON' : 'OFF'}</strong> (Key: K)</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Guide"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-slate-800/80 bg-slate-900/40 font-mono">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('elements')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'elements'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              The 6 Elements Explained
            </button>
            <button
              onClick={() => setActiveTab('diagram')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'diagram'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Textbook Diagram Anatomy
            </button>
            <button
              onClick={() => setActiveTab('benchmarks')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === 'benchmarks'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Real Satellite Benchmarks (ISS, Hubble...)
            </button>
          </div>

          {/* Quick Summary Pill */}
          <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400">
            <span>Period: <strong className="text-white font-mono">{derivedState.orbitalPeriodMin.toFixed(1)} min</strong></span>
            <span>Speed: <strong className="text-emerald-400 font-mono">{derivedState.currentVelocityKmS.toFixed(2)} km/s</strong></span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: THE 6 ELEMENTS EXPLAINED */}
          {activeTab === 'elements' && (
            <div className="space-y-4">
              {/* Brief vs Deep-Dive Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white font-mono">
                    {isBriefMode ? '⚡ BRIEF 6-ELEMENT CHEAT-SHEET' : '📖 DEEP-DIVE INSPECTION'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-sans hidden sm:inline">
                    {isBriefMode
                      ? 'Concise 1-sentence summaries with direct live sliders for all 6 parameters'
                      : 'Comprehensive astrodynamic explanations and real-world mission mechanics'}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                  <button
                    onClick={() => setIsBriefMode(true)}
                    className={`px-3 py-1 rounded-md transition-all ${
                      isBriefMode
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ⚡ Brief Mode
                  </button>
                  <button
                    onClick={() => setIsBriefMode(false)}
                    className={`px-3 py-1 rounded-md transition-all ${
                      !isBriefMode
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📖 Deep Dive
                  </button>
                </div>
              </div>

              {/* BRIEF MODE: All 6 Elements displayed at a glance in a tight, concise grid */}
              {isBriefMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono">
                  {ELEMENT_CARDS.map((card) => {
                    const isSelected = selectedElementKey === card.key;
                    return (
                      <div
                        key={card.key}
                        onClick={() => {
                          setSelectedElementKey(card.key);
                          if (onSelectHighlightElement) {
                            onSelectHighlightElement(card.key);
                          }
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                          isSelected
                            ? `${card.borderColor} bg-slate-900/90 shadow-[0_0_15px_rgba(56,189,248,0.2)] ring-1 ring-cyan-500/40`
                            : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xl font-black ${card.color}`}>{card.symbol}</span>
                              <span className="font-bold text-white text-xs">{card.name}</span>
                            </div>
                            <span className="text-xs font-bold text-cyan-300 font-mono">
                              {card.currentVal}
                            </span>
                          </div>

                          <div className="text-[10px] text-amber-300/90 font-sans font-medium mb-1.5">
                            {card.laymanTitle} &bull; <span className="text-slate-400 italic">{card.analogy}</span>
                          </div>

                          {/* Brief 1-Sentence Definition */}
                          <p className="text-[11px] font-sans leading-relaxed text-slate-200">
                            {card.briefSummary}
                          </p>
                        </div>

                        {/* Interactive Slider & Live Fact */}
                        <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Adjust Value:</span>
                            <span className="font-semibold text-white">{card.currentVal}</span>
                          </div>
                          <input
                            type="range"
                            min={card.min}
                            max={card.max}
                            step={card.step}
                            value={card.val}
                            onChange={(e) => {
                              e.stopPropagation();
                              card.onChangeVal(parseFloat(e.target.value));
                            }}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                          />
                          <div className="text-[10px] text-emerald-400 font-sans truncate">
                            &bull; {card.realDataFact}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* DEEP DIVE MODE: Selector Pills + Single Expanded Card */
                <div className="space-y-4">
                  {/* Element Selector Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono">
                    {ELEMENT_CARDS.map((card) => {
                      const isSelected = selectedElementKey === card.key;
                      return (
                        <button
                          key={card.key}
                          onClick={() => {
                            setSelectedElementKey(card.key);
                            if (onSelectHighlightElement) {
                              onSelectHighlightElement(card.key);
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                            isSelected
                              ? `${card.borderColor} bg-slate-900 shadow-[0_0_12px_rgba(56,189,248,0.2)]`
                              : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/80'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-base font-bold ${card.color}`}>{card.symbol}</span>
                            <span className="text-[10px] text-slate-400 font-sans font-semibold truncate">
                              {card.laymanTitle.split(' ')[0]}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-white truncate">{card.currentVal}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Element Deep-Dive Card */}
                  <div className={`p-5 rounded-2xl border ${currentActiveCard.borderColor} bg-slate-900/80 relative space-y-4`}>
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className={`text-2xl font-black font-mono ${currentActiveCard.color}`}>
                            {currentActiveCard.symbol}
                          </span>
                          <h3 className="text-base font-bold text-white">
                            {currentActiveCard.name}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                            {currentActiveCard.laymanTitle}
                          </span>
                        </div>
                        <p className="text-xs text-amber-300 font-medium mt-1">
                          💡 {currentActiveCard.analogy}
                        </p>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-lg font-bold text-white">{currentActiveCard.currentVal}</div>
                        <div className="text-[11px] text-slate-400">{currentActiveCard.subVal}</div>
                      </div>
                    </div>

                    {/* Explanation & Real Data */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <h4 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                          Plain-English Explanation (For Everyone)
                        </h4>
                        <p className="text-xs leading-relaxed text-slate-300">
                          {currentActiveCard.plainExplanation}
                        </p>
                        <div className="pt-2 flex items-center gap-2 text-emerald-400 font-mono text-[11px]">
                          <Activity className="w-3.5 h-3.5" />
                          <span>{currentActiveCard.realDataFact}</span>
                        </div>
                      </div>

                      {/* Interactive Slider to Test and Observe Live */}
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 font-mono">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Live Adjustment Slider</span>
                          <span className={`font-bold ${currentActiveCard.color}`}>{currentActiveCard.currentVal}</span>
                        </div>

                        <input
                          type="range"
                          min={currentActiveCard.min}
                          max={currentActiveCard.max}
                          step={currentActiveCard.step}
                          value={currentActiveCard.val}
                          onChange={(e) => currentActiveCard.onChangeVal(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />

                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>Min: {currentActiveCard.min}</span>
                          <span>Max: {currentActiveCard.max}</span>
                        </div>

                        <div className="text-[10px] text-slate-400 italic">
                          Move slider to see the 3D orbit and diagram bend &amp; shift live!
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* The "Why 6 Numbers?" Educational Insight */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan-400" />
                  Why do we need exactly 6 numbers to describe any orbit in the universe?
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  In 3D space, any moving satellite needs 3 numbers for its position (X, Y, Z) and 3 numbers for its speed and direction (Vx, Vy, Vz). In 1609, German astronomer Johannes Kepler and later Leonhard Euler discovered that instead of complicated coordinates, you can describe an entire orbit using 6 elegant geometric parameters:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <strong className="text-cyan-400 block mb-0.5">1. Shape &amp; Size (2)</strong>
                    <span className="text-slate-400">Semi-major axis (a) &amp; Eccentricity (e) determine the orbit track dimensions.</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <strong className="text-yellow-400 block mb-0.5">2. 3D Orientation (3)</strong>
                    <span className="text-slate-400">Inclination (i), RAAN (Ω), and Arg of Perigee (ω) orient the track in 3D deep space.</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <strong className="text-rose-400 block mb-0.5">3. Position on Track (1)</strong>
                    <span className="text-slate-400">True Anomaly (θ) tells you exactly where the satellite is right now.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TEXTBOOK DIAGRAM ANATOMY */}
          {activeTab === 'diagram' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    How the 3D Scene Matches the Textbook Diagram
                  </h3>
                  <button
                    onClick={onToggleDiagram}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                      showDiagram
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Diagram Overlay: {showDiagram ? 'VISIBLE' : 'HIDDEN'}
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The 3D viewer directly renders every plane, vector, and arc from classic aerospace textbooks (Vallado, Bate-Mueller-White). Here is what each label represents:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 font-mono text-[11px]">
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span>Earth's Equatorial Plane (Disc)</span>
                    </div>
                    <p className="text-slate-400 font-sans text-xs">
                      The horizontal reference plane slicing through Earth's equator (latitude 0°). All inclinations and RAAN angles are measured against this plane.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-blue-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span>K̂ (Z-Axis): Earth's North Polar Axis</span>
                    </div>
                    <p className="text-slate-400 font-sans text-xs">
                      The vertical arrow pointing straight through Earth's North Pole. Earth spins counter-clockwise around this axis.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Î (X-Axis): Vernal Equinox (γ / First Point of Aries)</span>
                    </div>
                    <p className="text-slate-400 font-sans text-xs">
                      Points from Earth's center toward the Sun on the first day of Spring. This fixed deep-space direction is the zero point for RAAN (Ω).
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>N: Ascending Node &amp; Node Line</span>
                    </div>
                    <p className="text-slate-400 font-sans text-xs">
                      The line where the tilted orbit crosses the flat equator going from South to North. The glowing dot on the equator is the Ascending Node.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-yellow-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span>i: Inclination Arc</span>
                    </div>
                    <p className="text-slate-400 font-sans text-xs">
                      The vertical curved angle showing how many degrees the satellite’s orbital plane tilts above the equatorial plane.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-purple-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span>e (Perigee) &amp; ω (Argument of Perigee)</span>
                    </div>
                    <p className="text-slate-400 font-sans text-xs">
                      Vector <strong>e</strong> points from Earth to the closest approach (Perigee). Angle <strong>ω</strong> measures the degrees along the track from the Node Line to Perigee.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-rose-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      <span>r (Satellite Position) &amp; θ (True Anomaly)</span>
                    </div>
                    <p className="text-slate-400 font-sans text-xs">
                      Vector <strong>r</strong> connects Earth to the satellite. Angle <strong>θ</strong> sweeps from Perigee to the satellite, advancing as it flies.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 text-sky-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <span>h: Angular Momentum Vector</span>
                    </div>
                    <p className="text-slate-400 font-sans text-xs">
                      Perpendicular to the orbital plane (h = r × v). The angle between h and K̂ is also equal to the inclination i!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REAL SATELLITE BENCHMARKS */}
          {activeTab === 'benchmarks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Real-World Satellite Benchmark Orbits</h3>
                  <p className="text-xs text-slate-400">
                    Click any satellite to load its actual orbital elements into the 3D visualizer!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {BENCHMARK_PRESETS.map((sat) => (
                  <div
                    key={sat.id}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/70 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-white">{sat.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${sat.badgeColor}`}>
                          {sat.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        {sat.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                      <div className="text-slate-400">
                        <span>Alt: ~{(sat.elements.a! - EARTH_RADIUS_KM).toFixed(0)} km</span> • <span>Tilt: {sat.elements.i}°</span>
                      </div>
                      <button
                        onClick={() => handleApplyPreset(sat)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-bold transition-colors"
                      >
                        <span>Load Orbit</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800/80 bg-slate-900/60 font-mono text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Orbit propagation powered by SGP4 &amp; analytical Keplerian equations.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
