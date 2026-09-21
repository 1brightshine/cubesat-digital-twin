/**
 * Interactive 3D WebGL Orbit Visualizer using Three.js & CesiumJS
 * High-performance orbital mechanics rendering, attitude dynamics, and geospatial mapping
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import {
  KeplerianElements,
  CubeSatSpec,
  OrbitDerivedState,
  SpiceGeometryState,
  AttitudeDynamicsState,
  PropagatorEngine,
  Sgp4PropagationResult,
} from '../types';
import {
  EARTH_RADIUS_KM,
  keplerianToECI,
  generateOrbitCurvePoints,
  getNasaUmbraOccultation,
  Vec3,
} from '../physics/orbitalMechanics';
import { generateSgp4OrbitPoints, propagateSgp4AtTime } from '../physics/sgp4Propagator';
import { generateOrekitTrajectory } from '../physics/orekitPerturbations';
import { createProceduralEarthTexture } from '../utils/earthTexture';
import {
  Play,
  Pause,
  RotateCcw,
  Compass,
  Eye,
  ZoomIn,
  ZoomOut,
  Layers,
  Sun,
  Moon,
  Globe2,
  Radio,
  Satellite,
  Sparkles,
} from 'lucide-react';
import { NASA_MAP_LAYERS } from '../services/nasaMapService';
import { CesiumOrbitViewer } from './CesiumOrbitViewer';
import { createCelestialSphere } from '../utils/spaceEnvironment';
import { MissionControlOverlay } from './MissionControlOverlay';
import { buildKeplerianDiagramScene } from '../physics/keplerianDiagramGeometry';
import { KeplerianElementsGuideModal } from './KeplerianElementsGuideModal';

interface Orbit3DViewerProps {
  elements: KeplerianElements;
  cubeSat: CubeSatSpec;
  derivedState: OrbitDerivedState;
  onTrueAnomalyChange: (nuDeg: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  simSpeedMultiplier: number;
  onSpeedChange: (speed: number) => void;
  selectedLayerId?: string;
  onSelectLayer?: (layerId: string) => void;
  onUpdateElements?: (elements: KeplerianElements) => void;
  onOpenKeplerianGuideModal?: () => void;
  // NASA Astrodynamics Stack
  spice?: SpiceGeometryState;
  attitude?: AttitudeDynamicsState;
  propagatorEngine?: PropagatorEngine;
  sgp4Result?: Sgp4PropagationResult | null;
  onOpenCelestrakModal?: () => void;
  satrec?: satellite.SatRec | null;
  // Mission Control Overlay Modals & Drawers
  simDate?: Date;
  onOpenSpiceModal?: () => void;
  onOpenTleModal?: () => void;
  onOpenKeplerianDrawer?: () => void;
  onOpenGroundTrackModal?: () => void;
  onOpenLifetimeModal?: () => void;
  onOpenSpiceAttitudeModal?: () => void;
  onOpenPowerBudgetModal?: () => void;
  onReturnToLanding?: () => void;
}

export const Orbit3DViewer: React.FC<Orbit3DViewerProps> = ({
  elements,
  cubeSat,
  derivedState,
  onTrueAnomalyChange,
  isPlaying,
  onTogglePlay,
  simSpeedMultiplier,
  onSpeedChange,
  selectedLayerId = 'blue-marble-bathymetry',
  onSelectLayer,
  onUpdateElements,
  onOpenKeplerianGuideModal,
  spice,
  attitude,
  propagatorEngine = 'sgp4',
  sgp4Result,
  satrec,
  simDate,
  onOpenCelestrakModal,
  onOpenSpiceModal,
  onOpenTleModal,
  onOpenKeplerianDrawer,
  onOpenGroundTrackModal,
  onOpenLifetimeModal,
  onOpenSpiceAttitudeModal,
  onOpenPowerBudgetModal,
  onReturnToLanding,
}) => {
  // Toggle between Three.js Spacecraft Studio and CesiumJS Geospatial Globe
  const [renderEngine, setRenderEngine] = useState<'three' | 'cesium'>('three');

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Object references in 3D scene
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const orbitLineRef = useRef<THREE.Line | null>(null);
  const satelliteGroupRef = useRef<THREE.Group | null>(null);
  const satAttitudeGroupRef = useRef<THREE.Group | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const footprintRingRef = useRef<THREE.Line | null>(null);
  const perigeeMarkerRef = useRef<THREE.Mesh | null>(null);
  const apogeeMarkerRef = useRef<THREE.Mesh | null>(null);
  const nadirLineRef = useRef<THREE.Line | null>(null);
  const velocityArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const equatorRingRef = useRef<THREE.Line | null>(null);
  const dragSailMeshRef = useRef<THREE.Mesh | null>(null);
  const shadowConeGroupRef = useRef<THREE.Group | null>(null);
  const sunMarkerGroupRef = useRef<THREE.Group | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const bodyAxesHelperRef = useRef<THREE.AxesHelper | null>(null);

  // Satellite subcomponents refs for exploded view & dynamic scaling
  const satBodyMeshRef = useRef<THREE.Mesh | null>(null);
  const satLeftPanelRef = useRef<THREE.Mesh | null>(null);
  const satRightPanelRef = useRef<THREE.Mesh | null>(null);
  const satLensMeshRef = useRef<THREE.Mesh | null>(null);
  const satWingLeftRef = useRef<THREE.Mesh | null>(null);
  const satWingRightRef = useRef<THREE.Mesh | null>(null);
  const satAntennaRef = useRef<THREE.Mesh | null>(null);

  // Visual toggles
  const [showVelocityVector, setShowVelocityVector] = useState(true);
  const [showNadirProjection, setShowNadirProjection] = useState(true);
  const [showEquatorPlane, setShowEquatorPlane] = useState(true);
  const [showApsides, setShowApsides] = useState(true);
  const [showShadowCone, setShowShadowCone] = useState(true);
  const [showBodyAxes, setShowBodyAxes] = useState(true);
  const [showDarkSideLight, setShowDarkSideLight] = useState(false);
  const [showSunLight, setShowSunLight] = useState(true);
  const [showKeplerianDiagram, setShowKeplerianDiagram] = useState(true);
  const [isKeplerianGuideOpen, setIsKeplerianGuideOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'free' | 'plane' | 'polar' | 'chase' | 'geospatial'>('free');

  // Keplerian elements 3D diagram scene reference
  const keplerianDiagramRef = useRef<{
    group: THREE.Group;
    updateDynamic: (nuDeg: number, satPosThree: THREE.Vector3, satVelThree: THREE.Vector3) => void;
    dispose: () => void;
  } | null>(null);

  // Light refs for dynamic dark side illumination
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const cameraHeadlightRef = useRef<THREE.PointLight | null>(null);

  // Active Map layer state
  const [activeLayerId, setActiveLayerId] = useState<string>(selectedLayerId);
  const [showMapMenu, setShowMapMenu] = useState<boolean>(false);
  const [isTextureLoading, setIsTextureLoading] = useState<boolean>(false);
  const textureCacheRef = useRef<Record<string, THREE.Texture>>({});

  // Spherical camera coordinates for free orbit view
  const sphericalRef = useRef({
    radius: 3.5,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
  });
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // High-performance simulation synchronization refs (completely unlinks 60fps Three.js animation from React re-renders)
  const isPlayingRef = useRef<boolean>(isPlaying);
  const simSpeedRef = useRef<number>(simSpeedMultiplier);
  const currentAnomalyRef = useRef<number>(elements.trueAnomaly);
  const lastNotifyTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const derivedStateRef = useRef<OrbitDerivedState>(derivedState);
  const elementsRef = useRef<KeplerianElements>(elements);
  const satrecRef = useRef<satellite.SatRec | null | undefined>(satrec);
  const propagatorEngineRef = useRef<PropagatorEngine>(propagatorEngine);
  const cameraModeRef = useRef<'free' | 'plane' | 'polar' | 'chase' | 'geospatial'>(cameraMode);
  const onTrueAnomalyChangeRef = useRef(onTrueAnomalyChange);
  const attitudeRef = useRef(attitude);
  const spiceRef = useRef(spice);

  // Keep refs synchronized with React props
  useEffect(() => {
    onTrueAnomalyChangeRef.current = onTrueAnomalyChange;
  }, [onTrueAnomalyChange]);

  useEffect(() => {
    attitudeRef.current = attitude;
  }, [attitude]);

  useEffect(() => {
    spiceRef.current = spice;
  }, [spice]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    simSpeedRef.current = simSpeedMultiplier;
  }, [simSpeedMultiplier]);

  useEffect(() => {
    derivedStateRef.current = derivedState;
  }, [derivedState]);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    satrecRef.current = satrec;
  }, [satrec]);

  useEffect(() => {
    propagatorEngineRef.current = propagatorEngine;
  }, [propagatorEngine]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  // Sync true anomaly slider input from user
  useEffect(() => {
    currentAnomalyRef.current = elements.trueAnomaly;
    if (!isPlayingRef.current) {
      updateSatelliteDirectRef.current(elements.trueAnomaly);
    }
  }, [elements.trueAnomaly]);

  // Dynamically update lighting when Directional Sunlight or Dark Side Light changes
  useEffect(() => {
    if (sunLightRef.current) {
      sunLightRef.current.visible = showSunLight;
      sunLightRef.current.intensity = showSunLight ? 3.4 : 0;
    }
    if (sunMarkerGroupRef.current) {
      sunMarkerGroupRef.current.visible = showSunLight;
    }
    if (shadowConeGroupRef.current) {
      shadowConeGroupRef.current.visible = showShadowCone && showSunLight;
    }
    if (ambientLightRef.current) {
      if (showSunLight) {
        // Deep space realistic lighting: 0.04 in shadow unless dark side light is active
        ambientLightRef.current.intensity = showDarkSideLight ? 0.72 : 0.04;
      } else {
        // Directional sunlight off: balanced ambient illumination for shadow-free inspection
        ambientLightRef.current.intensity = showDarkSideLight ? 0.8 : 0.55;
      }
    }
    if (cameraHeadlightRef.current) {
      // Flashlight attached to camera view point illuminating dark side directly
      cameraHeadlightRef.current.intensity = showDarkSideLight ? 2.4 : 0;
      cameraHeadlightRef.current.visible = showDarkSideLight;
    }
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [showSunLight, showDarkSideLight, showShadowCone]);

  // Convert ECI (X, Y, Z) to Three.js coordinates:
  // ECI: X -> X_three, Y -> Z_three, Z -> Y_three (Z is Earth polar axis)
  const eciToThree = useCallback((eciX: number, eciY: number, eciZ: number): THREE.Vector3 => {
    return new THREE.Vector3(
      eciX / EARTH_RADIUS_KM,
      eciZ / EARTH_RADIUS_KM,
      eciY / EARTH_RADIUS_KM
    );
  }, []);

  // Update Camera based on spherical coords
  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.up.set(0, 1, 0);
    cameraRef.current.lookAt(0, 0, 0);
  }, []);

  // Direct, silky-smooth 60fps satellite positioning & LVLH attitude calculation
  const updateSatelliteDirect = useCallback(
    (nuDeg: number) => {
      if (!satelliteGroupRef.current || !sceneRef.current) return;

      const satGroup = satelliteGroupRef.current;
      let posKm = { x: 0, y: 0, z: 0 };
      let velKm = { x: 0, y: 0, z: 0 };

      // Exact mathematical state evaluation
      if (propagatorEngineRef.current === 'sgp4' && satrecRef.current) {
        const periodSec = satrecRef.current.no > 0 ? (2 * Math.PI * 60) / satrecRef.current.no : 5400;
        const fraction = (nuDeg % 360) / 360;
        const epoch = elementsRef.current.epochDate || new Date();
        const evalTime = new Date(epoch.getTime() + fraction * periodSec * 1000);
        const res = propagateSgp4AtTime(satrecRef.current, evalTime);
        if (res && res.positionECI) {
          posKm = res.positionECI;
          velKm = res.velocityECI;
        } else {
          const kep = keplerianToECI(elementsRef.current, nuDeg);
          posKm = kep.position;
          velKm = kep.velocity;
        }
      } else {
        const kep = keplerianToECI(elementsRef.current, nuDeg);
        posKm = kep.position;
        velKm = kep.velocity;
      }

      // Convert to Three.js space
      const satPosThree = eciToThree(posKm.x, posKm.y, posKm.z);
      satGroup.position.copy(satPosThree);

      // Velocity in Three.js space
      const velThree = new THREE.Vector3(
        velKm.x / EARTH_RADIUS_KM,
        velKm.z / EARTH_RADIUS_KM,
        velKm.y / EARTH_RADIUS_KM
      );
      const velDir = velThree.clone().normalize();

      // Construct continuous orthonormal LVLH reference frame (NO GIMBAL LOCK, NO FLIPPING)
      // 1. Radial outward vector
      const uRadial = satPosThree.clone().normalize();
      // 2. Nadir vector (points to Earth)
      const uNadir = uRadial.clone().negate();
      // 3. Cross-track / Orbit normal vector
      const uCross = new THREE.Vector3().crossVectors(velDir, uRadial).normalize();
      // 4. In-flight along-track orthonormal vector (tangent to orbit)
      const uAlongOrtho = new THREE.Vector3().crossVectors(uRadial, uCross).normalize();

      // Orthonormal Spacecraft Basis:
      // Local X: Cross-Track (uCross)
      // Local Y: Radial Zenith (uRadial) -> Nadir is -Y
      // Local Z: Along-Track Flight Velocity (uAlongOrtho)
      const basisMat = new THREE.Matrix4();
      basisMat.makeBasis(uCross, uRadial, uAlongOrtho);
      satGroup.quaternion.setFromRotationMatrix(basisMat);

      // Inner Attitude Group (Tumbling, Nadir-pointing, Sun-pointing, etc.)
      const currentAttitude = attitudeRef.current;
      const currentSpice = spiceRef.current;
      if (satAttitudeGroupRef.current && currentAttitude) {
        if (currentAttitude.mode === 'nadir') {
          // Camera lens is on +Z face; rotate so +Z points toward Nadir (local -Y)
          satAttitudeGroupRef.current.rotation.set(-Math.PI / 2, 0, 0);
        } else if (currentAttitude.mode === 'sun-pointing' && currentSpice?.sunVectorECI) {
          // Solar wings on +/-X face point at Sun
          const sunThree = eciToThree(
            currentSpice.sunVectorECI[0],
            currentSpice.sunVectorECI[1],
            currentSpice.sunVectorECI[2]
          ).normalize();
          // Inverse transform Sun into satellite local frame
          const sunLocal = sunThree.clone().applyQuaternion(satGroup.quaternion.clone().invert());
          satAttitudeGroupRef.current.lookAt(sunLocal);
        } else {
          // Dynamic tumbling with Euler angles
          satAttitudeGroupRef.current.rotation.set(
            (currentAttitude.eulerDeg[0] * Math.PI) / 180,
            (currentAttitude.eulerDeg[1] * Math.PI) / 180,
            (currentAttitude.eulerDeg[2] * Math.PI) / 180
          );
        }
      }

      // Update Nadir ground line & sensor footprint
      const nadirGroundThree = uRadial.clone(); // Radius 1.0 (Earth surface)
      if (nadirLineRef.current) {
        nadirLineRef.current.geometry.setFromPoints([satPosThree, nadirGroundThree]);
        nadirLineRef.current.geometry.attributes.position.needsUpdate = true;
        nadirLineRef.current.computeLineDistances();
      }

      if (footprintRingRef.current) {
        footprintRingRef.current.position.copy(nadirGroundThree);
        footprintRingRef.current.lookAt(satPosThree);
      }

      // Update Velocity Arrow
      if (velocityArrowRef.current) {
        velocityArrowRef.current.position.copy(satPosThree);
        velocityArrowRef.current.setDirection(uAlongOrtho);
      }

      // Update dynamic Keplerian elements diagram components (satellite vector r, true anomaly arc θ)
      if (keplerianDiagramRef.current) {
        keplerianDiagramRef.current.updateDynamic(nuDeg, satPosThree, uAlongOrtho);
      }

      // Smooth Chase & Geospatial Camera Tracking
      if (cameraRef.current) {
        const mode = cameraModeRef.current;
        if (mode === 'chase') {
          // Camera sits smoothly behind the spacecraft and above it in the radial direction
          const camOffset = satPosThree
            .clone()
            .addScaledVector(uAlongOrtho, -0.75)
            .addScaledVector(uRadial, 0.28);
          cameraRef.current.position.copy(camOffset);
          cameraRef.current.up.copy(uRadial); // Radial outward is UP
          cameraRef.current.lookAt(satPosThree);
        } else if (mode === 'geospatial') {
          // Nadir down-looking camera
          const geoCamPos = satPosThree.clone().multiplyScalar(1.22);
          cameraRef.current.position.copy(geoCamPos);
          cameraRef.current.up.copy(uAlongOrtho);
          cameraRef.current.lookAt(nadirGroundThree);
        }
      }
    },
    [eciToThree]
  );

  const updateSatelliteDirectRef = useRef(updateSatelliteDirect);
  useEffect(() => {
    updateSatelliteDirectRef.current = updateSatelliteDirect;
  }, [updateSatelliteDirect]);

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      100
    );
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    // 3.5 Giant Celestial Background Sphere with NASA Deep Star Map & Milky Way
    const celestialSphere = createCelestialSphere(85);
    scene.add(celestialSphere);

    // 4. Scientifically Accurate Deep Space Lighting
    // Pitch-black space: default ambient light is 0.04 so the shadowed side of Earth (Umbra) is dark
    const ambientLight = new THREE.AmbientLight(0xffffff, showDarkSideLight ? 0.72 : 0.04);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    // Inspector Flashlight / Headlamp attached to camera for dark side visibility
    const cameraHeadlight = new THREE.PointLight(0xffffff, showDarkSideLight ? 2.4 : 0, 50);
    cameraHeadlight.position.set(0, 0, 0);
    cameraHeadlight.visible = showDarkSideLight;
    cameraHeadlightRef.current = cameraHeadlight;
    camera.add(cameraHeadlight);
    scene.add(camera);

    // Single high-intensity DirectionalLight representing the Sun
    // Casts sharp, harsh shadows across Earth model and CubeSat
    const sunLight = new THREE.DirectionalLight(0xffffff, showSunLight ? 3.4 : 0);
    sunLight.position.set(12, 4, 3);
    sunLight.visible = showSunLight;
    sunLightRef.current = sunLight;
    scene.add(sunLight);

    // 5. Earth Globe with Authentic NASA Visible Earth Satellite Imagery
    const earthRadius = 1.0;
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    const initialTextureUrl = currentMapLayer.url || '/textures/earth-blue-marble.jpg';
    const earthTexture = textureLoader.load(
      initialTextureUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        if (earthMeshRef.current) {
          const mat = earthMeshRef.current.material as THREE.MeshStandardMaterial;
          mat.map = tex;
          mat.needsUpdate = true;
        }
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      },
      undefined,
      (err) => {
        console.warn('Initial NASA texture load notification:', err);
      }
    );
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    textureCacheRef.current[activeLayerId] = earthTexture;

    // Load Earth Night City Lights for Umbra side
    const nightTexture = textureLoader.load(
      '/textures/earth-night.jpg',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        if (earthMeshRef.current) {
          const mat = earthMeshRef.current.material as THREE.MeshStandardMaterial;
          mat.emissiveMap = tex;
          mat.emissive = new THREE.Color(0xffd599);
          mat.emissiveIntensity = 0.85;
          mat.needsUpdate = true;
        }
      },
      undefined,
      (err) => console.warn('Night texture notice:', err)
    );
    nightTexture.colorSpace = THREE.SRGBColorSpace;

    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.02,
      emissiveMap: nightTexture,
      emissive: new THREE.Color(0xffd599),
      emissiveIntensity: 0.85,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMeshRef.current = earthMesh;
    scene.add(earthMesh);

    // Atmosphere Glow Halo
    const atmosGeo = new THREE.SphereGeometry(earthRadius * 1.025, 48, 48);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // Equatorial Plane Grid Ring
    const equatorGeo = new THREE.RingGeometry(earthRadius * 1.002, earthRadius * 1.006, 64);
    const equatorMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const equatorRing = new THREE.Mesh(equatorGeo, equatorMat);
    equatorRing.rotation.x = Math.PI / 2;
    equatorRingRef.current = equatorRing as any;
    scene.add(equatorRing);

    // Sensor Footprint circle on Earth surface
    const fpGeo = new THREE.RingGeometry(0.08, 0.088, 32);
    const fpMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
    });
    const fpRing = new THREE.Line(fpGeo, fpMat);
    fpRing.visible = false;
    footprintRingRef.current = fpRing;
    scene.add(fpRing);

    // 6. Orbit Line (Dynamic Closed Polyline with Shadow Transition Vertex Colors)
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      linewidth: 2,
    });
    const orbitGeo = new THREE.BufferGeometry();
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    orbitLineRef.current = orbitLine;
    scene.add(orbitLine);

    // 7. Perigee & Apogee Markers
    const periGeo = new THREE.SphereGeometry(0.042, 16, 16);
    const periMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const periMesh = new THREE.Mesh(periGeo, periMat);
    perigeeMarkerRef.current = periMesh;
    scene.add(periMesh);

    const apoGeo = new THREE.SphereGeometry(0.042, 16, 16);
    const apoMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const apoMesh = new THREE.Mesh(apoGeo, apoMat);
    apogeeMarkerRef.current = apoMesh;
    scene.add(apoMesh);

    // 8. Nadir Projection Line
    const nadirGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const nadirMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.04,
      gapSize: 0.03,
      transparent: true,
      opacity: 0.8,
    });
    const nadirLine = new THREE.Line(nadirGeo, nadirMat);
    nadirLineRef.current = nadirLine;
    scene.add(nadirLine);

    // 9. CubeSat 3D Model Group
    const satGroup = new THREE.Group();
    const satAttitudeGroup = new THREE.Group();
    satAttitudeGroupRef.current = satAttitudeGroup;
    satGroup.add(satAttitudeGroup);

    // CubeSat Body Chassis
    const bodyGeo = new THREE.BoxGeometry(0.07, 0.07, 0.12);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x222630,
      metalness: 0.9,
      roughness: 0.2,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    satBodyMeshRef.current = bodyMesh;
    satAttitudeGroup.add(bodyMesh);

    // Solar panels on sides
    const panelGeo = new THREE.BoxGeometry(0.005, 0.06, 0.11);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.1,
      metalness: 0.8,
    });
    const leftPanel = new THREE.Mesh(panelGeo, panelMat);
    leftPanel.position.set(-0.038, 0, 0);
    satLeftPanelRef.current = leftPanel;
    satAttitudeGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(panelGeo, panelMat);
    rightPanel.position.set(0.038, 0, 0);
    satRightPanelRef.current = rightPanel;
    satAttitudeGroup.add(rightPanel);

    // Optical Earth Observation Payload Camera Lens
    const lensGeo = new THREE.CylinderGeometry(0.016, 0.02, 0.018, 16);
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      metalness: 0.9,
      roughness: 0.1,
    });
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.position.set(0, 0, 0.068);
    lensMesh.rotation.x = Math.PI / 2;
    satLensMeshRef.current = lensMesh;
    satAttitudeGroup.add(lensMesh);

    // Deployable Solar Wings
    const wingGeo = new THREE.BoxGeometry(0.12, 0.002, 0.08);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.8,
      roughness: 0.2,
    });
    const wingLeft = new THREE.Mesh(wingGeo, wingMat);
    wingLeft.position.set(-0.11, 0, 0);
    satWingLeftRef.current = wingLeft;
    satAttitudeGroup.add(wingLeft);

    const wingRight = new THREE.Mesh(wingGeo, wingMat);
    wingRight.position.set(0.11, 0, 0);
    satWingRightRef.current = wingRight;
    satAttitudeGroup.add(wingRight);

    // Dipole Antenna Rods
    const antGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.15, 8);
    const antMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const ant1 = new THREE.Mesh(antGeo, antMat);
    ant1.position.set(0, 0.05, 0.06);
    ant1.rotation.x = Math.PI / 4;
    satAntennaRef.current = ant1;
    satAttitudeGroup.add(ant1);

    // Deployed Drag Sail
    const sailGeo = new THREE.PlaneGeometry(0.35, 0.35);
    const sailMat = new THREE.MeshStandardMaterial({
      color: 0xd946ef,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      metalness: 0.7,
      roughness: 0.3,
    });
    const dragSailMesh = new THREE.Mesh(sailGeo, sailMat);
    dragSailMesh.position.set(0, 0, -0.1);
    dragSailMesh.visible = false;
    dragSailMeshRef.current = dragSailMesh;
    satAttitudeGroup.add(dragSailMesh);

    // Spacecraft Body Coordinate Axes (+X Red Roll, +Y Green Pitch, +Z Blue Yaw)
    const bodyAxes = new THREE.AxesHelper(0.18);
    bodyAxesHelperRef.current = bodyAxes;
    satAttitudeGroup.add(bodyAxes);

    satelliteGroupRef.current = satGroup;
    scene.add(satGroup);

    // 10. Velocity Vector Arrow
    const velArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      0.35,
      0x10b981,
      0.08,
      0.05
    );
    velocityArrowRef.current = velArrow;
    scene.add(velArrow);

    // 11. NASA Earth Shadow Cone (Umbra & Penumbra Dual-Cone Model)
    // Modeled using NASA NAIF SPICE geometry constants:
    // Earth Radius R_E = 1.0 (6,378.137 km)
    // Taper rate tan(alpha_u) = 0.004612 rad. Over cone length L = 8.0, r_top = 1.0 - 8 * 0.004612 = 0.963
    // Penumbra flare tan(alpha_p) = 0.004697 rad. Over cone length L = 8.0, r_top = 1.0 + 8 * 0.004697 = 1.038
    const shadowGroup = new THREE.Group();
    const coneLength = 8.0;

    // Conical Umbra Core
    const umbraGeo = new THREE.CylinderGeometry(0.963, 1.0, coneLength, 36, 1, true);
    const umbraMat = new THREE.MeshBasicMaterial({
      color: 0x312e81,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const umbraMesh = new THREE.Mesh(umbraGeo, umbraMat);
    umbraMesh.position.y = coneLength / 2;
    shadowGroup.add(umbraMesh);

    // Penumbra Outer Occultation Fringe
    const penumbraGeo = new THREE.CylinderGeometry(1.038, 1.0, coneLength, 36, 1, true);
    const penumbraMat = new THREE.MeshBasicMaterial({
      color: 0x4338ca,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const penumbraMesh = new THREE.Mesh(penumbraGeo, penumbraMat);
    penumbraMesh.position.y = coneLength / 2;
    shadowGroup.add(penumbraMesh);

    // Day/Night Terminator Boundary Circle on Earth
    const terminatorGeo = new THREE.RingGeometry(0.996, 1.004, 64);
    const terminatorMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const terminatorRing = new THREE.Mesh(terminatorGeo, terminatorMat);
    terminatorRing.rotation.x = Math.PI / 2;
    shadowGroup.add(terminatorRing);

    // Central Anti-Sun Shadow Axis Guide
    const shadowAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, coneLength + 0.5, 0),
    ]);
    const shadowAxisMat = new THREE.LineDashedMaterial({
      color: 0x6366f1,
      dashSize: 0.3,
      gapSize: 0.15,
      transparent: true,
      opacity: 0.4,
    });
    const shadowAxisLine = new THREE.Line(shadowAxisGeo, shadowAxisMat);
    shadowAxisLine.computeLineDistances();
    shadowGroup.add(shadowAxisLine);

    shadowConeGroupRef.current = shadowGroup;
    scene.add(shadowGroup);

    // 12. Sun Visual 3D Marker
    const sunMarkerGroup = new THREE.Group();
    const sunBallGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const sunBallMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const sunBall = new THREE.Mesh(sunBallGeo, sunBallMat);
    sunMarkerGroup.add(sunBall);
    sunMarkerGroupRef.current = sunMarkerGroup;
    scene.add(sunMarkerGroup);

    // 13. Moon 3D Marker
    const moonGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.9,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMeshRef.current = moonMesh;
    scene.add(moonMesh);

    // Resize Observer
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    // Unified, Silky-Smooth 60 FPS Render & Animation Loop
    const animate = (now: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      // Rotate Earth slowly on spin axis (Y in Three.js)
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += 0.00025;
      }

      // Smooth simulation advancement
      if (isPlayingRef.current) {
        const deltaSec = lastFrameTimeRef.current
          ? Math.min(0.08, (now - lastFrameTimeRef.current) / 1000)
          : 0.016;
        lastFrameTimeRef.current = now;

        const periodSec = Math.max(10, derivedStateRef.current.orbitalPeriodMin * 60);
        const dNu = (360 / periodSec) * deltaSec * simSpeedRef.current;
        currentAnomalyRef.current = (currentAnomalyRef.current + dNu) % 360;

        // Position satellite at exact 60fps frame
        updateSatelliteDirectRef.current(currentAnomalyRef.current);

        // Throttle React notification to ~150ms so UI updates without locking up
        if (now - lastNotifyTimeRef.current > 150) {
          if (onTrueAnomalyChangeRef.current) {
            onTrueAnomalyChangeRef.current(currentAnomalyRef.current);
          }
          lastNotifyTimeRef.current = now;
        }
      } else {
        lastFrameTimeRef.current = now;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
    };
  }, []); // Run ONCE on mount: never tear down renderer or dispose texture during simulation!

  // Update Orbit Path and Markers whenever Keplerian Elements, Propagator or Orbit Geometry change
  useEffect(() => {
    if (!orbitLineRef.current || !perigeeMarkerRef.current || !apogeeMarkerRef.current) return;

    let threePoints: THREE.Vector3[] = [];
    let eciPoints: Vec3[] = [];

    if (propagatorEngine === 'sgp4' && satrec) {
      // High-precision SGP4/SDP4 propagation orbit curve
      const sgp4Points = generateSgp4OrbitPoints(satrec, elements.epochDate || new Date(), 180);
      eciPoints = sgp4Points;
      threePoints = sgp4Points.map((p) => eciToThree(p.x, p.y, p.z));
    } else if (propagatorEngine === 'orekit-numerical') {
      const peri = keplerianToECI(elements, 0);
      const sunVec = spice?.sunVectorECI || [1.496e8, 0, 0];
      const moonVec = spice?.moonVectorECI || [3.844e5, 0, 0];
      const periodSec = derivedState.orbitalPeriodMin * 60;
      const orekitPoints = generateOrekitTrajectory(
        peri.position,
        peri.velocity,
        periodSec,
        sunVec,
        moonVec,
        cubeSat,
        140
      );
      eciPoints = orekitPoints;
      threePoints = orekitPoints.map((p) => eciToThree(p.x, p.y, p.z));
    } else {
      // Analytical Keplerian osculating ellipse
      const pointsECI = generateOrbitCurvePoints(elements, 180);
      eciPoints = pointsECI;
      threePoints = pointsECI.map((p) => eciToThree(p.x, p.y, p.z));
    }

    if (threePoints.length > 0) {
      orbitLineRef.current.geometry.setFromPoints(threePoints);

      // Compute vertex colors demonstrating sunlight / shadow transition on orbit path
      const colors: number[] = [];
      const simEpoch = simDate || elements.epochDate || new Date();

      for (let idx = 0; idx < threePoints.length; idx++) {
        if (!showSunLight) {
          // Uniform vibrant cyan when directional sunlight source is disabled
          colors.push(0.0, 0.94, 1.0);
        } else {
          const ptECI = eciPoints[idx] || { x: 0, y: 0, z: 0 };
          const occultation = getNasaUmbraOccultation(ptECI, simEpoch);

          if (occultation.inUmbra) {
            // Earth Umbra core shadow on orbit path: deep violet-indigo
            colors.push(0.38, 0.26, 0.72);
          } else if (occultation.inPenumbra) {
            // Penumbra shadow transition zone: gradient interpolation
            const f = Math.max(0, Math.min(1, occultation.sunlightFraction));
            const r = 0.38 * (1 - f) + 0.0 * f;
            const g = 0.26 * (1 - f) + 0.94 * f;
            const b = 0.72 * (1 - f) + 1.0 * f;
            colors.push(r, g, b);
          } else {
            // Direct sunlight zone on orbit path: high-visibility luminous cyan
            colors.push(0.0, 0.94, 1.0);
          }
        }
      }

      orbitLineRef.current.geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(colors, 3)
      );
      orbitLineRef.current.geometry.attributes.position.needsUpdate = true;
      if (orbitLineRef.current.geometry.attributes.color) {
        orbitLineRef.current.geometry.attributes.color.needsUpdate = true;
      }
    }

    // Perigee marker (nu = 0)
    const periECI = keplerianToECI(elements, 0).position;
    const periThree = eciToThree(periECI.x, periECI.y, periECI.z);
    perigeeMarkerRef.current.position.copy(periThree);

    // Apogee marker (nu = 180)
    const apoECI = keplerianToECI(elements, 180).position;
    const apoThree = eciToThree(apoECI.x, apoECI.y, apoECI.z);
    apogeeMarkerRef.current.position.copy(apoThree);

    // Adjust camera radius if orbit is large
    const apoDistance = apoThree.length();
    if (apoDistance > 2.5 && sphericalRef.current.radius < apoDistance * 1.6) {
      sphericalRef.current.radius = apoDistance * 1.7;
      updateCameraPosition();
    }

    // Update Keplerian Elements 3D Reference Diagram
    if (sceneRef.current) {
      if (keplerianDiagramRef.current) {
        sceneRef.current.remove(keplerianDiagramRef.current.group);
        keplerianDiagramRef.current.dispose();
        keplerianDiagramRef.current = null;
      }
      const newDiagram = buildKeplerianDiagramScene(elements);
      newDiagram.group.visible = showKeplerianDiagram;
      sceneRef.current.add(newDiagram.group);
      keplerianDiagramRef.current = newDiagram;
    }

    // Force satellite to immediately align with updated orbit
    updateSatelliteDirect(currentAnomalyRef.current);
  }, [
    elements.a,
    elements.e,
    elements.i,
    elements.raan,
    elements.argPerigee,
    showKeplerianDiagram,
    propagatorEngine,
    satrec,
    eciToThree,
    updateCameraPosition,
    updateSatelliteDirect,
    spice,
    derivedState.orbitalPeriodMin,
    cubeSat,
    showSunLight,
    simDate,
  ]);

  // Update SPICE planetary vectors (Sun, Moon, Earth Shadow Cone)
  useEffect(() => {
    let sunDir = new THREE.Vector3(1, 0.4, 0.2).normalize();
    if (spice && spice.sunVectorECI) {
      sunDir = eciToThree(
        spice.sunVectorECI[0],
        spice.sunVectorECI[1],
        spice.sunVectorECI[2]
      ).normalize();
    }

    if (sunLightRef.current) {
      sunLightRef.current.position.set(sunDir.x * 16, sunDir.y * 16, sunDir.z * 16);
      sunLightRef.current.visible = showSunLight;
      sunLightRef.current.intensity = showSunLight ? 3.4 : 0;
    }

    if (sunMarkerGroupRef.current) {
      sunMarkerGroupRef.current.position.set(sunDir.x * 20, sunDir.y * 20, sunDir.z * 20);
      sunMarkerGroupRef.current.lookAt(new THREE.Vector3(0, 0, 0));
      sunMarkerGroupRef.current.visible = showSunLight;
    }

    if (shadowConeGroupRef.current) {
      const antiSunDir = new THREE.Vector3(-sunDir.x, -sunDir.y, -sunDir.z).normalize();
      shadowConeGroupRef.current.position.set(0, 0, 0);
      shadowConeGroupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), antiSunDir);
      shadowConeGroupRef.current.visible = showShadowCone && showSunLight;
    }

    if (moonMeshRef.current && spice && spice.moonVectorECI) {
      const moonThree = eciToThree(
        spice.moonVectorECI[0],
        spice.moonVectorECI[1],
        spice.moonVectorECI[2]
      ).normalize();
      moonMeshRef.current.position.set(moonThree.x * 4.5, moonThree.y * 4.5, moonThree.z * 4.5);
    }
  }, [spice, eciToThree, showShadowCone]);

  // Update visual element toggles
  useEffect(() => {
    if (equatorRingRef.current) equatorRingRef.current.visible = showEquatorPlane;
    if (perigeeMarkerRef.current) perigeeMarkerRef.current.visible = showApsides;
    if (apogeeMarkerRef.current) apogeeMarkerRef.current.visible = showApsides;
    if (shadowConeGroupRef.current) shadowConeGroupRef.current.visible = showShadowCone;
    if (bodyAxesHelperRef.current) bodyAxesHelperRef.current.visible = showBodyAxes;
    if (velocityArrowRef.current) velocityArrowRef.current.visible = showVelocityVector;
    if (nadirLineRef.current) nadirLineRef.current.visible = showNadirProjection;
    if (keplerianDiagramRef.current) keplerianDiagramRef.current.group.visible = showKeplerianDiagram;
    if (dragSailMeshRef.current) {
      dragSailMeshRef.current.visible = cubeSat.hasDragSail;
      if (cubeSat.hasDragSail) {
        const sailScale = Math.min(1.8, Math.max(0.6, Math.sqrt(cubeSat.dragSailArea)));
        dragSailMeshRef.current.scale.set(sailScale, sailScale, 1);
      }
    }
  }, [
    showEquatorPlane,
    showApsides,
    showShadowCone,
    showBodyAxes,
    showVelocityVector,
    showNadirProjection,
    showKeplerianDiagram,
    cubeSat.hasDragSail,
    cubeSat.dragSailArea,
  ]);

  // Morph CubeSat 3D model scale & exploded view separation in real time
  useEffect(() => {
    if (!satAttitudeGroupRef.current) return;

    // 1. Morph scale based on Form Factor
    let sx = 1.0;
    let sy = 1.0;
    let sz = 1.0;
    if (cubeSat.formFactor === '1U') {
      sx = 0.75;
      sy = 0.75;
      sz = 0.65;
    } else if (cubeSat.formFactor === '3U') {
      sx = 1.0;
      sy = 1.0;
      sz = 1.0;
    } else if (cubeSat.formFactor === '6U') {
      sx = 1.3;
      sy = 1.1;
      sz = 1.25;
    } else if (cubeSat.formFactor === '12U') {
      sx = 1.6;
      sy = 1.4;
      sz = 1.5;
    }
    satAttitudeGroupRef.current.scale.set(sx, sy, sz);

    // 2. Exploded View offsets
    const isExploded = !!cubeSat.explodedView;
    const dist = isExploded ? (cubeSat.explodedDistance ?? 0.6) : 0;

    if (satLeftPanelRef.current) {
      satLeftPanelRef.current.position.set(-0.038 - dist * 0.08, 0, 0);
    }
    if (satRightPanelRef.current) {
      satRightPanelRef.current.position.set(0.038 + dist * 0.08, 0, 0);
    }
    if (satLensMeshRef.current) {
      satLensMeshRef.current.position.set(0, 0, 0.068 + dist * 0.1);
    }
    if (satWingLeftRef.current) {
      satWingLeftRef.current.position.set(-0.11 - dist * 0.12, 0, 0);
    }
    if (satWingRightRef.current) {
      satWingRightRef.current.position.set(0.11 + dist * 0.12, 0, 0);
    }
    if (satAntennaRef.current) {
      satAntennaRef.current.position.set(0, 0.05 + dist * 0.06, 0.06 + dist * 0.06);
    }
  }, [
    cubeSat.formFactor,
    cubeSat.explodedView,
    cubeSat.explodedDistance,
    cubeSat.dimensionsCm,
  ]);

  // Dynamically load & stream real NASA GIBS map texture to Earth globe
  const currentMapLayer =
    NASA_MAP_LAYERS.find((l) => l.id === activeLayerId) || NASA_MAP_LAYERS[0];

  const handleSelectMapLayer = (layerId: string) => {
    setActiveLayerId(layerId);
    setShowMapMenu(false);
    if (onSelectLayer) onSelectLayer(layerId);
  };

  useEffect(() => {
    if (!earthMeshRef.current) return;

    if (textureCacheRef.current[activeLayerId]) {
      const cached = textureCacheRef.current[activeLayerId];
      const mat = earthMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.map = cached;
      mat.needsUpdate = true;
      return;
    }

    if (currentMapLayer.url) {
      setIsTextureLoading(true);
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(
        currentMapLayer.url,
        (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          textureCacheRef.current[activeLayerId] = loadedTex;
          if (earthMeshRef.current) {
            const currentMat = earthMeshRef.current.material as THREE.MeshStandardMaterial;
            currentMat.map = loadedTex;
            if (activeLayerId === 'black-marble-night') {
              currentMat.emissive = new THREE.Color(0xffe599);
              currentMat.emissiveMap = loadedTex;
              currentMat.emissiveIntensity = 0.75;
            } else {
              currentMat.emissive = new THREE.Color(0x000000);
              currentMat.emissiveMap = null;
            }
            currentMat.needsUpdate = true;
          }
          setIsTextureLoading(false);
        },
        undefined,
        () => {
          setIsTextureLoading(false);
        }
      );
    }
  }, [activeLayerId, currentMapLayer.url]);

  // Mouse / Touch Interaction for Free Orbit Camera
  const handleMouseDown = (e: React.MouseEvent) => {
    if (cameraMode !== 'free') setCameraMode('free');
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    sphericalRef.current.theta -= dx * 0.008;
    sphericalRef.current.phi = Math.max(
      0.05,
      Math.min(Math.PI - 0.05, sphericalRef.current.phi - dy * 0.008)
    );

    updateCameraPosition();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    sphericalRef.current.radius = Math.max(
      1.4,
      Math.min(25.0, sphericalRef.current.radius + e.deltaY * 0.004)
    );
    updateCameraPosition();
  };

  // Preset Views
  const setViewPreset = (view: 'free' | 'plane' | 'polar' | 'chase' | 'geospatial') => {
    setCameraMode(view);
    if (view === 'plane') {
      const incRad = (elements.i * Math.PI) / 180;
      sphericalRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, Math.PI / 2 - incRad));
      sphericalRef.current.theta = (elements.raan * Math.PI) / 180;
      updateCameraPosition();
    } else if (view === 'polar') {
      sphericalRef.current.phi = 0.05;
      updateCameraPosition();
    } else if (view === 'free') {
      sphericalRef.current.phi = Math.PI / 3;
      sphericalRef.current.theta = Math.PI / 4;
      updateCameraPosition();
    }
  };

  const zoomIn = useCallback(() => {
    sphericalRef.current.radius = Math.max(1.4, sphericalRef.current.radius * 0.85);
    updateCameraPosition();
  }, [updateCameraPosition]);

  const zoomOut = useCallback(() => {
    sphericalRef.current.radius = Math.min(25.0, sphericalRef.current.radius * 1.2);
    updateCameraPosition();
  }, [updateCameraPosition]);

  // Global Keyboard Shortcuts for Zoom In (+), Zoom Out (-), and Camera Reset (0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in form inputs or sliders
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0' || e.key === 'Home' || e.code === 'Numpad0') {
        e.preventDefault();
        setViewPreset('free');
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        setShowShadowCone((v) => !v);
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setShowDarkSideLight((v) => !v);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setShowSunLight((v) => !v);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setShowKeplerianDiagram((v) => !v);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomIn, zoomOut]);

  // If user selects CesiumJS engine, render Cesium Viewer
  if (renderEngine === 'cesium') {
    return (
      <div className="relative w-full h-full min-h-[520px] flex flex-col">
        {/* Engine Switcher Bar */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1 rounded-xl shadow-xl">
            <button
              onClick={() => setRenderEngine('three')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Satellite className="w-3.5 h-3.5 text-cyan-400" />
              <span>Three.js Spacecraft Studio</span>
            </button>
            <button
              onClick={() => setRenderEngine('cesium')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
            >
              <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>CesiumJS Geospatial 3D</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>CesiumJS WGS84 Dynamic Globe Engine</span>
          </div>
        </div>

        <CesiumOrbitViewer
          elements={elements}
          cubeSat={cubeSat}
          derivedState={derivedState}
          onTrueAnomalyChange={onTrueAnomalyChange}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          simSpeedMultiplier={simSpeedMultiplier}
          onSpeedChange={onSpeedChange}
          spice={spice}
          attitude={attitude}
          propagatorEngine={propagatorEngine}
          sgp4Result={sgp4Result}
          satrec={satrec}
        />
      </div>
    );
  }

  return (
    <div
      id="orbit-3d-container"
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] bg-black overflow-hidden flex flex-col select-none"
    >
      {/* 3D Canvas */}
      <canvas
        id="orbit-webgl-canvas"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none block"
      />

      {/* Futuristic Aerospace Mission Control Dashboard Overlay */}
      <MissionControlOverlay
        simDate={simDate || elements.epochDate || new Date()}
        elements={elements}
        cubeSat={cubeSat}
        derivedState={derivedState}
        spice={
          spice || {
            betaAngleDeg: 28.5,
            inEclipse: derivedState.inEclipse,
            eclipseState: derivedState.inEclipse ? 'umbra' : 'sunlight',
            sunVectorECI: [1.496e8, 0, 0],
            subSolarLat: 0,
            subSolarLon: 0,
            earthSunDistKm: 1.496e8,
            solarPhaseAngleDeg: 0,
            solarFluxWm2: derivedState.inEclipse ? 0 : 1361,
            solarPowerOutputWatts: derivedState.inEclipse ? 0 : 42,
            moonVectorECI: [384400, 0, 0],
            earthMoonDistKm: 384400,
            eclipseFraction: derivedState.inEclipse ? 0 : 1,
            sunlightFraction: derivedState.inEclipse ? 0 : 1,
          }
        }
        attitude={attitude}
        propagatorEngine={propagatorEngine}
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        simSpeedMultiplier={simSpeedMultiplier}
        onSpeedChange={onSpeedChange}
        onTrueAnomalyChange={(nu) => {
          currentAnomalyRef.current = nu;
          updateSatelliteDirect(nu);
          onTrueAnomalyChange(nu);
        }}
        cameraMode={cameraMode}
        onSelectCameraMode={(mode) => setViewPreset(mode)}
        onResetCamera={() => setViewPreset('free')}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        showVelocityVector={showVelocityVector}
        onToggleVelocityVector={() => setShowVelocityVector((v) => !v)}
        showNadirProjection={showNadirProjection}
        onToggleNadirProjection={() => setShowNadirProjection((v) => !v)}
        showEquatorPlane={showEquatorPlane}
        onToggleEquatorPlane={() => setShowEquatorPlane((v) => !v)}
        showApsides={showApsides}
        onToggleApsides={() => setShowApsides((v) => !v)}
        showShadowCone={showShadowCone}
        onToggleShadowCone={() => setShowShadowCone((v) => !v)}
        showBodyAxes={showBodyAxes}
        onToggleBodyAxes={() => setShowBodyAxes((v) => !v)}
        showDarkSideLight={showDarkSideLight}
        onToggleDarkSideLight={() => setShowDarkSideLight((v) => !v)}
        showSunLight={showSunLight}
        onToggleSunLight={() => setShowSunLight((v) => !v)}
        showKeplerianDiagram={showKeplerianDiagram}
        onToggleKeplerianDiagram={() => setShowKeplerianDiagram((v) => !v)}
        onOpenKeplerianGuide={() => {
          if (onOpenKeplerianGuideModal) {
            onOpenKeplerianGuideModal();
          } else {
            setIsKeplerianGuideOpen(true);
          }
        }}
        onOpenCelestrak={onOpenCelestrakModal || (() => {})}
        onOpenSpiceModal={onOpenSpiceModal || (() => {})}
        onOpenTleModal={onOpenTleModal || (() => {})}
        onOpenKeplerianDrawer={onOpenKeplerianDrawer || (() => {})}
        onOpenGroundTrackModal={onOpenGroundTrackModal || (() => {})}
        onOpenLifetimeModal={onOpenLifetimeModal || (() => {})}
        onOpenSpiceAttitudeModal={onOpenSpiceAttitudeModal || (() => {})}
        onOpenPowerBudgetModal={onOpenPowerBudgetModal}
        onReturnToLanding={onReturnToLanding}
      />

      {/* Keplerian Elements Guide for Everyone Modal */}
      {isKeplerianGuideOpen && (
        <KeplerianElementsGuideModal
          elements={elements}
          derivedState={derivedState}
          showDiagram={showKeplerianDiagram}
          onToggleDiagram={() => setShowKeplerianDiagram((v) => !v)}
          onClose={() => setIsKeplerianGuideOpen(false)}
          onApplyElements={(newElements: KeplerianElements) => {
            if (onUpdateElements) {
              onUpdateElements(newElements);
            }
          }}
        />
      )}
    </div>
  );
};
