/**
 * CesiumJS 3D Geospatial Orbit & Earth Mapping Visualizer
 * High-precision WGS84 globe, satellite tracking, ground footprint & contact passes
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  KeplerianElements,
  CubeSatSpec,
  OrbitDerivedState,
  SpiceGeometryState,
  AttitudeDynamicsState,
  PropagatorEngine,
  Sgp4PropagationResult,
  GroundStation,
} from '../types';
import {
  EARTH_RADIUS_KM,
  keplerianToECI,
  eciToLatLon,
  getGMST,
} from '../physics/orbitalMechanics';
import { GROUND_STATIONS } from '../data/presets';
import {
  Globe,
  Play,
  Pause,
  RotateCcw,
  Target,
  Maximize2,
  Navigation,
  Radio,
  Sparkles,
  MapPin,
  Compass,
} from 'lucide-react';

declare global {
  interface Window {
    Cesium?: any;
    CESIUM_BASE_URL?: string;
  }
}

interface CesiumOrbitViewerProps {
  elements: KeplerianElements;
  cubeSat: CubeSatSpec;
  derivedState: OrbitDerivedState;
  onTrueAnomalyChange: (nuDeg: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  simSpeedMultiplier: number;
  onSpeedChange: (speed: number) => void;
  spice?: SpiceGeometryState;
  attitude?: AttitudeDynamicsState;
  propagatorEngine?: PropagatorEngine;
  sgp4Result?: Sgp4PropagationResult | null;
  satrec?: any;
}

export const CesiumOrbitViewer: React.FC<CesiumOrbitViewerProps> = ({
  elements,
  cubeSat,
  derivedState,
  onTrueAnomalyChange,
  isPlaying,
  onTogglePlay,
  simSpeedMultiplier,
  onSpeedChange,
  spice,
  attitude,
  propagatorEngine = 'sgp4',
  sgp4Result,
  satrec,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const satEntityRef = useRef<any>(null);
  const orbitPolylineEntityRef = useRef<any>(null);
  const nadirLineEntityRef = useRef<any>(null);
  const footprintEntityRef = useRef<any>(null);
  const [isCesiumReady, setIsCesiumReady] = useState<boolean>(false);
  const [isTrackingSat, setIsTrackingSat] = useState<boolean>(false);
  const [showFootprint, setShowFootprint] = useState<boolean>(true);
  const [showGroundStations, setShowGroundStations] = useState<boolean>(true);

  // Keep live true anomaly and timestamp in refs for non-blocking animation
  const trueAnomalyRef = useRef<number>(elements.trueAnomaly);
  const lastTimeRef = useRef<number>(performance.now());
  const animFrameIdRef = useRef<number | null>(null);

  // Sync ref when elements change from outside
  useEffect(() => {
    trueAnomalyRef.current = elements.trueAnomaly;
  }, [elements.trueAnomaly]);

  // Check and wait for Cesium script
  useEffect(() => {
    let checkInterval: any;
    if (window.Cesium) {
      setIsCesiumReady(true);
    } else {
      checkInterval = setInterval(() => {
        if (window.Cesium) {
          setIsCesiumReady(true);
          clearInterval(checkInterval);
        }
      }, 100);
    }
    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  // Compute current cartesian position in WGS84 for Cesium
  const computeSatWgs84Position = useCallback(
    (nuDeg: number) => {
      if (!window.Cesium) return null;
      const Cesium = window.Cesium;

      // Determine ECI coordinates
      let posKm = { x: 0, y: 0, z: 0 };
      let altKm = derivedState.currentAltKm;
      let latDeg = 0;
      let lonDeg = 0;

      if (propagatorEngine === 'sgp4' && sgp4Result && sgp4Result.geodetic) {
        latDeg = sgp4Result.geodetic.latitude;
        lonDeg = sgp4Result.geodetic.longitude;
        altKm = sgp4Result.geodetic.altitudeKm;
      } else {
        const kep = keplerianToECI(elements, nuDeg);
        posKm = kep.position;
        const now = new Date();
        const gmst = getGMST(now);
        const geo = eciToLatLon(posKm, gmst);
        latDeg = geo.latitude;
        lonDeg = geo.longitude;
        altKm = geo.altitude;
      }

      const cartesian = Cesium.Cartesian3.fromDegrees(
        lonDeg,
        latDeg,
        Math.max(10000, altKm * 1000)
      );

      return {
        cartesian,
        latDeg,
        lonDeg,
        altKm,
      };
    },
    [elements, derivedState.currentAltKm, propagatorEngine, sgp4Result]
  );

  // Initialize Cesium Viewer
  useEffect(() => {
    if (!isCesiumReady || !containerRef.current || viewerRef.current) return;
    const Cesium = window.Cesium;

    try {
      // Build sleek Viewer with dark space styling
      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        scene3DOnly: true,
        skyAtmosphere: new Cesium.SkyAtmosphere(),
      });

      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020617');
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0b1329');

      try {
        if (Cesium.SingleTileImageryProvider) {
          const blueMarbleProvider = new Cesium.SingleTileImageryProvider({
            url: '/textures/earth-blue-marble.jpg',
            rectangle: Cesium.Rectangle.fromDegrees(-180.0, -90.0, 180.0, 90.0),
          });
          viewer.imageryLayers.addImageryProvider(blueMarbleProvider);
        }
      } catch (e) {
        console.warn('Cesium custom imagery provider notice:', e);
      }

      viewerRef.current = viewer;

      // 1. Add Satellite Entity
      const initialPos = computeSatWgs84Position(trueAnomalyRef.current);
      const satPositionProp = new Cesium.CallbackProperty(() => {
        const cur = computeSatWgs84Position(trueAnomalyRef.current);
        return cur ? cur.cartesian : Cesium.Cartesian3.fromDegrees(0, 0, 500000);
      }, false);

      const satEntity = viewer.entities.add({
        name: cubeSat.name,
        position: satPositionProp,
        point: {
          pixelSize: 12,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: cubeSat.name,
          font: '12px Plus Jakarta Sans, sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString('#38bdf8'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          pixelOffset: new Cesium.Cartesian2(0, -18),
        },
      });
      satEntityRef.current = satEntity;

      // 2. Add Orbit Polyline Track (Full loop)
      const orbitPositionsCallback = new Cesium.CallbackProperty(() => {
        const positions: any[] = [];
        const samples = 90;
        const now = new Date();
        const gmst = getGMST(now);

        for (let i = 0; i <= samples; i++) {
          const nu = (i / samples) * 360;
          const { position: eci } = keplerianToECI(elements, nu);
          const geo = eciToLatLon(eci, gmst);
          positions.push(
            Cesium.Cartesian3.fromDegrees(
              geo.longitude,
              geo.latitude,
              Math.max(10000, geo.altitude * 1000)
            )
          );
        }
        return positions;
      }, false);

      const orbitLine = viewer.entities.add({
        name: 'Orbital Path Track',
        polyline: {
          positions: orbitPositionsCallback,
          width: 2.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: Cesium.Color.fromCssColorString('#00f0ff'),
          }),
        },
      });
      orbitPolylineEntityRef.current = orbitLine;

      // 3. Nadir projection line to ground
      const nadirPositionsCallback = new Cesium.CallbackProperty(() => {
        const cur = computeSatWgs84Position(trueAnomalyRef.current);
        if (!cur) return [];
        const ground = Cesium.Cartesian3.fromDegrees(cur.lonDeg, cur.latDeg, 0);
        return [cur.cartesian, ground];
      }, false);

      const nadirLine = viewer.entities.add({
        name: 'Nadir Projection',
        polyline: {
          positions: nadirPositionsCallback,
          width: 1.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#f59e0b'),
            dashLength: 12,
          }),
        },
      });
      nadirLineEntityRef.current = nadirLine;

      // 4. Ground Stations Markers
      GROUND_STATIONS.forEach((gs: GroundStation) => {
        viewer.entities.add({
          name: gs.name,
          position: Cesium.Cartesian3.fromDegrees(gs.lon, gs.lat, 0),
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString('#10b981'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1.5,
          },
          label: {
            text: `${gs.id.toUpperCase()} (${gs.name})`,
            font: '10px JetBrains Mono, monospace',
            fillColor: Cesium.Color.fromCssColorString('#a7f3d0'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            pixelOffset: new Cesium.Cartesian2(0, 14),
          },
        });
      });

      // Default camera viewing full globe
      if (initialPos) {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            initialPos.lonDeg,
            initialPos.latDeg - 25,
            Math.max(12000000, (elements.a - EARTH_RADIUS_KM) * 1000 * 3.5)
          ),
          duration: 1.5,
        });
      }
    } catch (err) {
      console.error('Failed to initialize Cesium Viewer:', err);
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [isCesiumReady, elements, cubeSat.name, computeSatWgs84Position]);

  // Toggle Tracking Satellite in Cesium
  const handleToggleTrack = () => {
    if (!viewerRef.current || !satEntityRef.current) return;
    const viewer = viewerRef.current;
    if (isTrackingSat) {
      viewer.trackedEntity = undefined;
      setIsTrackingSat(false);
    } else {
      viewer.trackedEntity = satEntityRef.current;
      setIsTrackingSat(true);
    }
  };

  // Reset Camera to Global Overview
  const handleResetCamera = () => {
    if (!viewerRef.current) return;
    const Cesium = window.Cesium;
    if (!Cesium) return;
    viewerRef.current.trackedEntity = undefined;
    setIsTrackingSat(false);
    const cur = computeSatWgs84Position(trueAnomalyRef.current);
    const lon = cur ? cur.lonDeg : 0;
    const lat = cur ? cur.latDeg : 0;

    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat - 20, 18000000),
      duration: 1.2,
    });
  };

  // Smooth local simulation propagation loop
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    let lastNotifyTime = 0;

    const tick = (now: number) => {
      const deltaSec = lastTimeRef.current ? Math.min(0.1, (now - lastTimeRef.current) / 1000) : 0.016;
      lastTimeRef.current = now;

      // Rate: dNu = (360 / PeriodSec) * deltaSec * multiplier
      const periodSec = Math.max(10, derivedState.orbitalPeriodMin * 60);
      const dNu = (360 / periodSec) * deltaSec * simSpeedMultiplier;

      trueAnomalyRef.current = (trueAnomalyRef.current + dNu) % 360;

      // Throttle React notification to 150ms so UI stays updated without choking render thread
      if (now - lastNotifyTime > 150) {
        onTrueAnomalyChange(trueAnomalyRef.current);
        lastNotifyTime = now;
      }

      animId = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    animId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animId);
  }, [isPlaying, derivedState.orbitalPeriodMin, simSpeedMultiplier, onTrueAnomalyChange]);

  return (
    <div className="relative w-full flex-1 min-h-[500px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
      {/* Loading overlay if Cesium is still fetching */}
      {!isCesiumReady && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md text-slate-300 gap-3">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <div className="font-mono text-xs text-cyan-400">Loading CesiumJS 3D Geospatial Engine...</div>
          <p className="text-[11px] text-slate-500 max-w-xs text-center">
            Initializing WGS84 curved geospatial ellipsoid, satellite tracker, and atmospheric light model.
          </p>
        </div>
      )}

      {/* Cesium Mount Target */}
      <div ref={containerRef} className="w-full h-full min-h-[500px]" />

      {/* Top Left HUD: Cesium Geospatial Telemetry */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-900/85 backdrop-blur-md border border-cyan-500/30 rounded-xl px-3.5 py-2.5 shadow-xl text-xs max-w-xs">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold mb-1">
            <Globe className="w-4 h-4" />
            <span>CesiumJS WGS84 Geospatial Globe</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-slate-300">
            <div>
              <span className="text-slate-500">Lat: </span>
              {derivedState.subSatelliteLatitude.toFixed(2)}&deg;
            </div>
            <div>
              <span className="text-slate-500">Lon: </span>
              {derivedState.subSatelliteLongitude.toFixed(2)}&deg;
            </div>
            <div>
              <span className="text-slate-500">Alt: </span>
              {derivedState.currentAltKm.toFixed(1)} km
            </div>
            <div>
              <span className="text-slate-500">Vel: </span>
              {derivedState.currentVelocityKmS.toFixed(2)} km/s
            </div>
            <div className="col-span-2 pt-1 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Propagator:</span>
              <span className="text-cyan-300 font-bold uppercase">{propagatorEngine}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Right HUD: Controls & Camera Track */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={handleToggleTrack}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shadow-lg ${
            isTrackingSat
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
              : 'bg-slate-900/80 text-slate-300 border-slate-700/70 hover:bg-slate-800'
          }`}
          title="Track Satellite with Camera"
        >
          <Target className="w-3.5 h-3.5" />
          <span>{isTrackingSat ? 'Tracking Sat' : 'Track Sat'}</span>
        </button>

        <button
          onClick={handleResetCamera}
          className="p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/70 rounded-lg text-xs transition-colors shadow-lg"
          title="Global Overview"
        >
          <Navigation className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Floating Bar: Playback Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-xl shadow-2xl">
        <button
          onClick={onTogglePlay}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1" />

        <div className="flex items-center gap-1">
          {[1, 10, 50, 100, 500].map((spd) => (
            <button
              key={spd}
              onClick={() => onSpeedChange(spd)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                simSpeedMultiplier === spd
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
