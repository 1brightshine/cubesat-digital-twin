/**
 * 2D Equirectangular Ground Track Map with Real NASA GIBS Satellite Imagery
 * Connects to NASA Earth Science WMS (EPSG:4326 WGS-84) for Blue Marble & Black Marble feeds.
 */

import React, { useState, useMemo } from 'react';
import { KeplerianElements, GroundStation, OrbitDerivedState, CubeSatSpec, SpiceGeometryState } from '../types';
import {
  generateGroundTrack,
  getGroundStationPass,
  EARTH_RADIUS_KM,
} from '../physics/orbitalMechanics';
import { NASA_MAP_LAYERS, NasaMapLayer } from '../services/nasaMapService';
import { GroundStationPassNotificationPanel } from './GroundStationPassNotificationPanel';
import { PowerBudgetPanel } from './PowerBudgetPanel';
import {
  Radio,
  Satellite,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Sun,
  Moon,
  Calendar,
  Zap,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface GroundTrackMapProps {
  elements: KeplerianElements;
  derivedState: OrbitDerivedState;
  groundStations: GroundStation[];
  simDate: Date;
  selectedLayerId?: string;
  onSelectLayer?: (layerId: string) => void;
  cubeSat?: CubeSatSpec;
  spice?: SpiceGeometryState;
}

export const GroundTrackMap: React.FC<GroundTrackMapProps> = ({
  elements,
  derivedState,
  groundStations,
  simDate,
  selectedLayerId = 'blue-marble-bathymetry',
  onSelectLayer,
  cubeSat,
  spice,
}) => {
  const [internalLayerId, setInternalLayerId] = useState<string>(selectedLayerId);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);
  const [hoveredStation, setHoveredStation] = useState<GroundStation | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string>('svalbard');
  const [showSchedulePanel, setShowSchedulePanel] = useState<boolean>(true);
  const [showPowerBudgetPanel, setShowPowerBudgetPanel] = useState<boolean>(true);

  const activeLayerId = onSelectLayer ? selectedLayerId : internalLayerId;
  const currentLayer =
    NASA_MAP_LAYERS.find((l) => l.id === activeLayerId) || NASA_MAP_LAYERS[0];

  const handleLayerChange = (layerId: string) => {
    setImgLoaded(false);
    setImgError(false);
    if (onSelectLayer) {
      onSelectLayer(layerId);
    } else {
      setInternalLayerId(layerId);
    }
  };

  const mapWidth = 1000;
  const mapHeight = 500;

  // Convert Lon [-180, 180] and Lat [-90, 90] to SVG coords
  const toSvgX = (lon: number) => ((lon + 180) / 360) * mapWidth;
  const toSvgY = (lat: number) => ((90 - lat) / 180) * mapHeight;

  // Generate ground track points for ~2.5 orbits with high step density
  const trackPoints = useMemo(() => {
    return generateGroundTrack(elements, simDate, 2.5, 140);
  }, [elements, simDate]);

  // Split ground track into continuous segments to avoid anti-meridian wrap streaks (-180 to +180)
  const trackSegments = useMemo(() => {
    const segments: Array<Array<{ x: number; y: number }>> = [];
    if (trackPoints.length === 0) return segments;

    let currentSegment: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < trackPoints.length; i++) {
      const pt = trackPoints[i];
      const x = toSvgX(pt.lon);
      const y = toSvgY(pt.lat);

      if (currentSegment.length > 0) {
        const prevPt = trackPoints[i - 1];
        if (Math.abs(pt.lon - prevPt.lon) > 180) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      }
      currentSegment.push({ x, y });
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    return segments;
  }, [trackPoints]);

  // Radio Horizon Footprint Radius on Earth surface (in degrees)
  // rho_horizon = arccos(R_E / (R_E + h))
  const footprintRadiusDeg = useMemo(() => {
    const h = derivedState.currentAltKm;
    const centralAngleRad = Math.acos(
      Math.max(0, Math.min(1, EARTH_RADIUS_KM / (EARTH_RADIUS_KM + h)))
    );
    return (centralAngleRad * 180) / Math.PI;
  }, [derivedState.currentAltKm]);

  // Sub-satellite position in SVG coordinates
  const subSatX = toSvgX(derivedState.subSatelliteLongitude);
  const subSatY = toSvgY(derivedState.subSatelliteLatitude);
  const footprintPixelRadius = (footprintRadiusDeg / 360) * mapWidth;

  // Compute Ground Station Pass status
  const stationStatus = useMemo(() => {
    return groundStations.map((station) => {
      const pass = getGroundStationPass(
        derivedState.subSatelliteLatitude,
        derivedState.subSatelliteLongitude,
        derivedState.currentAltKm,
        station.lat,
        station.lon,
        station.minElevationDeg
      );
      return {
        ...station,
        inContact: pass.inContact,
        elevationDeg: pass.elevationDeg,
        distanceKm: pass.distanceKm,
      };
    });
  }, [groundStations, derivedState]);

  const activeContactStations = stationStatus.filter((s) => s.inContact);

  return (
    <div id="ground-track-container" className="w-full flex flex-col gap-3">
      {/* Top Telemetry & NASA Layer Switcher Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-2xl text-xs shadow-lg">
        {/* Sub-Satellite Telemetry Readouts */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Satellite className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-200">Sub-Sat Coordinates:</span>
            <span className="font-mono text-cyan-300 font-bold">
              {Math.abs(derivedState.subSatelliteLatitude).toFixed(2)}°
              {derivedState.subSatelliteLatitude >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(derivedState.subSatelliteLongitude).toFixed(2)}°
              {derivedState.subSatelliteLongitude >= 0 ? 'E' : 'W'}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-slate-400">
            <span>Swath Diameter:</span>
            <span className="font-mono text-slate-200 font-medium">
              {(footprintRadiusDeg * 111.32 * 2).toFixed(0)} km
            </span>
          </div>

          {/* Active Contact Badge */}
          {activeContactStations.length > 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/90 text-emerald-300 border border-emerald-600/60 rounded-xl text-[11px] font-semibold animate-pulse shadow-md shadow-emerald-950/50">
              <Wifi className="w-3.5 h-3.5" />
              <span>
                Uplink Active: {activeContactStations.map((s) => s.name.split(' ')[0]).join(', ')} (
                {activeContactStations[0].elevationDeg.toFixed(1)}° el)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 text-slate-400 rounded-xl text-[11px]">
              <Radio className="w-3.5 h-3.5" />
              <span>Out of Station Range</span>
            </div>
          )}
        </div>

        {/* Action Toggles & NASA Map Layer Selector Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Schedule Toggle */}
          <button
            onClick={() => setShowSchedulePanel(!showSchedulePanel)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-medium transition-all flex items-center gap-1.5 border ${
              showSchedulePanel
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle Pass Scheduling Notification Panel (Next 3 Passes)"
          >
            <Calendar className="w-3 h-3 text-cyan-400" />
            <span>Pass Schedule</span>
          </button>

          {/* Quick Power Budget Toggle */}
          <button
            onClick={() => setShowPowerBudgetPanel(!showPowerBudgetPanel)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-medium transition-all flex items-center gap-1.5 border ${
              showPowerBudgetPanel
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle NASA AM0 Power Budget Analysis"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Power Budget</span>
          </button>

          {/* NASA Map Layer Selector Buttons */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-[11px]">
          {NASA_MAP_LAYERS.map((layer) => {
            const isSelected = layer.id === activeLayerId;
            return (
              <button
                key={layer.id}
                onClick={() => handleLayerChange(layer.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={layer.description}
              >
                {layer.id === 'black-marble-night' ? (
                  <Moon className="w-3 h-3" />
                ) : layer.id === 'vector-telemetry' ? (
                  <Layers className="w-3 h-3" />
                ) : (
                  <Sun className="w-3 h-3" />
                )}
                <span>
                  {layer.id === 'blue-marble-bathymetry'
                    ? 'NASA Blue Marble'
                    : layer.id === 'black-marble-night'
                    ? 'NASA Black Marble (Night)'
                    : layer.id === 'blue-marble-nextgen'
                    ? 'NASA NextGen'
                    : 'Tactical Grid'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>

      {/* Main Map Viewport with Real NASA Imagery */}
      <div className="relative w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl aspect-[2/1] group">
        <svg
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          className="w-full h-full block select-none"
        >
          {/* Layer 1: Background Ocean Base */}
          <rect width={mapWidth} height={mapHeight} fill="#060c18" />

          {/* Layer 2: REAL NASA SATELLITE MAP (GIBS EPSG:4326 WGS-84) */}
          {currentLayer.url && (
            <image
              href={currentLayer.url}
              x="0"
              y="0"
              width={mapWidth}
              height={mapHeight}
              preserveAspectRatio="none"
              crossOrigin="anonymous"
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                setImgError(true);
                setImgLoaded(false);
              }}
              style={{
                opacity: 0.98,
              }}
            />
          )}

          {/* Layer 3: Loading Indicator if image is fetching */}
          {!imgLoaded && !imgError && (
            <text
              x={mapWidth / 2}
              y={mapHeight / 2}
              textAnchor="middle"
              fill="rgba(56, 189, 248, 0.6)"
              fontSize="12"
              fontFamily="monospace"
            >
              Loading Authentic NASA Satellite Map...
            </text>
          )}

          {/* Layer 4: Latitude & Longitude Precision Astrodynamics Grid */}
          <g stroke="rgba(255, 255, 255, 0.15)" strokeWidth="0.8">
            {[-60, -30, 0, 30, 60].map((lat) => (
              <g key={`lat-${lat}`}>
                <line
                  x1={0}
                  y1={toSvgY(lat)}
                  x2={mapWidth}
                  y2={toSvgY(lat)}
                  stroke={
                    lat === 0
                      ? 'rgba(251, 191, 36, 0.6)'
                      : lat === 23.44 || lat === -23.44
                      ? 'rgba(244, 63, 94, 0.3)'
                      : undefined
                  }
                  strokeWidth={lat === 0 ? 1.5 : 0.75}
                  strokeDasharray={lat === 0 ? undefined : '3,3'}
                />
                <text
                  x={10}
                  y={toSvgY(lat) - 3}
                  fill={lat === 0 ? '#fbbf24' : '#94a3b8'}
                  fontSize="9"
                  fontFamily="monospace"
                  opacity="0.8"
                >
                  {lat === 0 ? 'Equator 0°' : `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`}
                </text>
              </g>
            ))}

            {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => (
              <g key={`lon-${lon}`}>
                <line
                  x1={toSvgX(lon)}
                  y1={0}
                  x2={toSvgX(lon)}
                  y2={mapHeight}
                  stroke={lon === 0 ? 'rgba(6, 182, 212, 0.7)' : undefined}
                  strokeWidth={lon === 0 ? 1.5 : 0.75}
                  strokeDasharray={lon === 0 ? undefined : '3,3'}
                />
                <text
                  x={toSvgX(lon) + 4}
                  y={mapHeight - 8}
                  fill={lon === 0 ? '#06b6d4' : '#94a3b8'}
                  fontSize="9"
                  fontFamily="monospace"
                  opacity="0.8"
                >
                  {lon === 0 ? '0° (Prime)' : `${Math.abs(lon)}°${lon > 0 ? 'E' : 'W'}`}
                </text>
              </g>
            ))}
          </g>

          {/* Layer 5: Ground Station Cones of Visibility & Contact Beams */}
          {stationStatus.map((station) => {
            const sx = toSvgX(station.lon);
            const sy = toSvgY(station.lat);
            const isSelected = station.id === selectedStationId;

            return (
              <g
                key={station.id}
                className="cursor-pointer transition-transform hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStationId(station.id);
                }}
                onMouseEnter={() => setHoveredStation(station)}
                onMouseLeave={() => setHoveredStation(null)}
              >
                {/* Communication Beam Line if satellite is in contact */}
                {station.inContact && (
                  <line
                    x1={sx}
                    y1={sy}
                    x2={subSatX}
                    y2={subSatY}
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeDasharray="4,3"
                    className="animate-pulse"
                    opacity="0.9"
                  />
                )}

                {/* Selected Station Target Reticle */}
                {isSelected && (
                  <g>
                    <circle
                      cx={sx}
                      cy={sy}
                      r="14"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="3,2"
                      className="animate-spin"
                    />
                    <circle
                      cx={sx}
                      cy={sy}
                      r="18"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1"
                      opacity="0.4"
                    />
                  </g>
                )}

                {/* Ground Station Visibility Horizon Ring */}
                <circle
                  cx={sx}
                  cy={sy}
                  r={station.inContact ? 16 : isSelected ? 12 : 8}
                  fill={
                    station.inContact
                      ? 'rgba(16, 185, 129, 0.25)'
                      : isSelected
                      ? 'rgba(245, 158, 11, 0.25)'
                      : 'rgba(56, 189, 248, 0.15)'
                  }
                  stroke={station.inContact ? '#10b981' : isSelected ? '#f59e0b' : '#38bdf8'}
                  strokeWidth={station.inContact || isSelected ? 2 : 1}
                />

                {/* Ground Station Center Dot */}
                <circle
                  cx={sx}
                  cy={sy}
                  r={isSelected ? 4 : 3}
                  fill={station.inContact ? '#34d399' : isSelected ? '#fbbf24' : '#0ea5e9'}
                />

                {/* Station Label */}
                <text
                  x={sx + 6}
                  y={sy - 4}
                  fill={station.inContact ? '#34d399' : isSelected ? '#fbbf24' : '#e2e8f0'}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight={station.inContact || isSelected ? 'bold' : 'normal'}
                  filter="drop-shadow(0 1px 2px rgba(0,0,0,0.9))"
                >
                  {station.name.split(' ')[0]} {isSelected ? '★' : ''}
                </text>
              </g>
            );
          })}

          {/* Layer 6: Future & Past Ground Track Paths (Multi-Orbit Curves) */}
          {trackSegments.map((segment, segIdx) => {
            if (segment.length < 2) return null;
            const pathData = segment
              .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
              .join(' ');

            return (
              <g key={`track-seg-${segIdx}`}>
                {/* Track Glow */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="3.5"
                  strokeOpacity="0.3"
                />
                {/* Sharp Track Core */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.8"
                  strokeOpacity="0.85"
                />
              </g>
            );
          })}

          {/* Layer 7: Satellite Radio Footprint Swath (Ground Visibility Circle) */}
          <circle
            cx={subSatX}
            cy={subSatY}
            r={footprintPixelRadius}
            fill="rgba(6, 182, 212, 0.12)"
            stroke="#06b6d4"
            strokeWidth="1.5"
            strokeDasharray="4,4"
          />

          {/* Layer 8: Current CubeSat Nadir Sub-Satellite Target Reticle */}
          <g transform={`translate(${subSatX}, ${subSatY})`}>
            {/* Outer Expanding Pulse */}
            <circle
              r="12"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              className="animate-ping"
              opacity="0.6"
            />
            {/* Crosshair Ring */}
            <circle r="6" fill="rgba(2, 132, 199, 0.6)" stroke="#38bdf8" strokeWidth="2" />
            <circle r="2" fill="#ffffff" />
            {/* Crosshairs */}
            <line x1="-10" y1="0" x2="-6" y2="0" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="6" y1="0" x2="10" y2="0" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="0" y1="-10" x2="0" y2="-6" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="0" y1="6" x2="0" y2="10" stroke="#38bdf8" strokeWidth="1.5" />

            {/* Satellite Name Tag */}
            <text
              x="12"
              y="4"
              fill="#38bdf8"
              fontSize="11"
              fontFamily="monospace"
              fontWeight="bold"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.95))"
            >
              CUBESAT (NADIR)
            </text>
          </g>
        </svg>

        {/* Live NASA Satellite Feed Attribution Badge */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-xl text-[11px] font-mono pointer-events-none">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="text-cyan-300 font-semibold">{currentLayer.name}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 text-[10px]">{currentLayer.attribution}</span>
        </div>

        {/* Floating Pass Schedule Notification Panel (Next 3 Passes) */}
        {showSchedulePanel && (
          <div className="absolute top-3 right-3 z-20 max-w-[280px] sm:max-w-[340px] md:max-w-[380px] w-full shadow-2xl">
            <GroundStationPassNotificationPanel
              elements={elements}
              groundStations={groundStations}
              simDate={simDate}
              selectedStationId={selectedStationId}
              onSelectStation={(id) => setSelectedStationId(id)}
            />
          </div>
        )}

        {/* Station Hover Tooltip */}
        {hoveredStation && (
          <div className="absolute bottom-3 left-3 z-10 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3 shadow-2xl text-xs font-mono text-slate-200 pointer-events-none">
            <div className="font-bold text-cyan-300 text-sm mb-1">{hoveredStation.name}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              <span className="text-slate-400">Position:</span>
              <span>
                {hoveredStation.lat.toFixed(2)}°N, {hoveredStation.lon.toFixed(2)}°E
              </span>
              <span className="text-slate-400">Status:</span>
              <span className={hoveredStation.isInContact ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                {hoveredStation.isInContact ? 'UPLINK ACQUIRED' : 'No Line-of-Sight'}
              </span>
              <span className="text-slate-400">Schedule:</span>
              <span className="text-amber-400 font-semibold">Click to View Next 3 Passes</span>
            </div>
          </div>
        )}
      </div>

      {/* Map Legend and Real Data Information */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-xl">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-400 inline-block"></span>
            <span>Orbital Ground Track (~2.5 Revs)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-dashed border-cyan-400 bg-cyan-950/40 inline-block"></span>
            <span>Line-of-Sight Horizon Swath</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            <span>Ground Station Contact Beam</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border border-amber-400 bg-amber-500/30 inline-block"></span>
            <span>Selected Scheduled Station</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
          <Info className="w-3 h-3 text-cyan-400" />
          <span>Real NASA GIBS WMS 1.1.1 &bull; EPSG:4326 Equirectangular Projection</span>
        </div>
      </div>

      {/* Real NASA Data Power Budget Panel */}
      {showPowerBudgetPanel && (
        <div className="mt-1">
          <PowerBudgetPanel
            elements={elements}
            cubeSat={cubeSat}
            derivedState={derivedState}
            spice={spice}
            isCompact={false}
          />
        </div>
      )}
    </div>
  );
};
