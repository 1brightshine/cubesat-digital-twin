/**
 * Keplerian Elements 3D Diagram Geometry and Label Sprite Utilities
 *
 * Generates exact 3D reference vectors, planes, curved angle arcs,
 * and high-DPI canvas sprite badges for the classical orbital elements:
 * - I, J, K axes (Vernal Equinox, Equatorial Y, Earth's North Polar Axis)
 * - Earth's Equatorial Plane disk with grid lines
 * - Ascending Node & Node Line vector N
 * - Right Ascension of the Ascending Node (RAAN) arc Ω
 * - Inclination arc i
 * - Perigee vector e
 * - Argument of Perigee arc ω
 * - Satellite position vector r
 * - True Anomaly arc θ (or ν)
 * - Angular Momentum vector h
 * - Velocity vector v
 */

import * as THREE from 'three';
import { KeplerianElements } from '../types';
import { EARTH_RADIUS_KM, degToRad, keplerianToECI, Vec3 } from './orbitalMechanics';

/**
 * High-DPI canvas-based text sprite badge for 3D diagram labels.
 * Depth-tested false so labels stay crisp, legible, and unoccluded.
 */
export function createDiagramTextSprite(
  title: string,
  sublabel?: string,
  accentColor: string = '#38bdf8',
  bgColor: string = 'rgba(10, 15, 30, 0.88)',
  borderColor: string = 'rgba(56, 189, 248, 0.65)'
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Sprite();

  canvas.width = 512;
  canvas.height = 140;

  // Clear background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw rounded pill badge container
  const x = 12;
  const y = 12;
  const w = canvas.width - 24;
  const h = canvas.height - 24;
  const radius = 20;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.lineWidth = 3.5;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  // Accent circular pip
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(x + 28, y + h / 2, 7, 0, Math.PI * 2);
  ctx.fill();

  // Primary title text
  ctx.font = 'bold 34px "JetBrains Mono", monospace, sans-serif';
  ctx.fillStyle = accentColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = sublabel ? 'bottom' : 'middle';
  ctx.fillText(title, x + 46, sublabel ? y + h / 2 + 1 : y + h / 2);

  // Optional explanatory sublabel
  if (sublabel) {
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1'; // slate-300
    ctx.textBaseline = 'top';
    ctx.fillText(sublabel, x + 46, y + h / 2 + 5);
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.68, 0.185, 1);
  return sprite;
}

/**
 * Converts ECI coordinates (km) to Three.js world coordinates
 */
export function eciKmToThreeVec(eci: Vec3): THREE.Vector3 {
  return new THREE.Vector3(
    eci.x / EARTH_RADIUS_KM,
    eci.z / EARTH_RADIUS_KM,
    eci.y / EARTH_RADIUS_KM
  );
}

/**
 * Builds points for a curved arc between two unit vectors in Three.js space
 */
export function generateArcPoints(
  startDir: THREE.Vector3,
  endDir: THREE.Vector3,
  radius: number,
  segments: number = 32
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const uStart = startDir.clone().normalize();
  const uEnd = endDir.clone().normalize();

  const cosTheta = Math.max(-1, Math.min(1, uStart.dot(uEnd)));
  const totalAngle = Math.acos(cosTheta);

  if (totalAngle < 0.001) {
    points.push(uStart.clone().multiplyScalar(radius));
    points.push(uEnd.clone().multiplyScalar(radius));
    return points;
  }

  let normal = new THREE.Vector3().crossVectors(uStart, uEnd);
  if (normal.lengthSq() < 0.0001) {
    normal = new THREE.Vector3(0, 1, 0);
  } else {
    normal.normalize();
  }

  for (let s = 0; s <= segments; s++) {
    const fraction = s / segments;
    const currentAngle = totalAngle * fraction;
    const pt = uStart.clone().applyAxisAngle(normal, currentAngle).multiplyScalar(radius);
    points.push(pt);
  }

  return points;
}

/**
 * Generates an arrowhead mesh at the end of an arc or line
 */
export function createArrowHeadCone(
  color: number,
  radius: number = 0.035,
  height: number = 0.09
): THREE.Mesh {
  const coneGeo = new THREE.ConeGeometry(radius, height, 16);
  const coneMat = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
  });
  return new THREE.Mesh(coneGeo, coneMat);
}

/**
 * Creates a styled vector arrow (line + cone head)
 */
export function createDiagramVectorArrow(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number,
  dashed: boolean = false
): { group: THREE.Group; cone: THREE.Mesh; line: THREE.Line } {
  const group = new THREE.Group();
  const dir = end.clone().sub(start);
  const length = dir.length();
  const dirNorm = dir.clone().normalize();

  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  let mat: THREE.Material;
  if (dashed) {
    mat = new THREE.LineDashedMaterial({
      color,
      dashSize: 0.08,
      gapSize: 0.04,
      linewidth: 2.5,
      depthTest: false,
      transparent: true,
    });
  } else {
    mat = new THREE.LineBasicMaterial({
      color,
      linewidth: 2.5,
      depthTest: false,
      transparent: true,
    });
  }

  const line = new THREE.Line(geo, mat);
  if (dashed) line.computeLineDistances();
  group.add(line);

  // Cone head
  const cone = createArrowHeadCone(color, 0.038, 0.1);
  cone.position.copy(end);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirNorm);
  group.add(cone);

  return { group, cone, line };
}

/**
 * Builds the complete 3D Keplerian Elements diagram group
 */
export function buildKeplerianDiagramScene(elements: KeplerianElements) {
  const diagramGroup = new THREE.Group();
  diagramGroup.name = 'keplerian-elements-diagram';

  const nu = elements.trueAnomaly;
  const iRad = degToRad(elements.i);
  const raanRad = degToRad(elements.raan);
  const argPerigeeRad = degToRad(elements.argPerigee);

  const perigeeAlt = elements.a * (1 - elements.e) - EARTH_RADIUS_KM;

  // 1. EARTH'S EQUATORIAL PLANE DISC
  const planeGroup = new THREE.Group();
  const maxPlaneRadius = 2.4;

  // Semi-transparent shaded disk
  const discGeo = new THREE.RingGeometry(1.002, maxPlaneRadius, 64);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x334155, // slate-700
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const discMesh = new THREE.Mesh(discGeo, discMat);
  discMesh.rotation.x = Math.PI / 2; // Lie in Three.js XZ plane (Y = 0)
  planeGroup.add(discMesh);

  // Outer rim line
  const rimGeo = new THREE.BufferGeometry().setFromPoints(
    new THREE.Path().absarc(0, 0, maxPlaneRadius, 0, Math.PI * 2, true).getPoints(64).map(
      (p) => new THREE.Vector3(p.x, 0, p.y)
    )
  );
  const rimMat = new THREE.LineBasicMaterial({
    color: 0x64748b, // slate-500
    transparent: true,
    opacity: 0.6,
    linewidth: 1.5,
    depthTest: false,
  });
  planeGroup.add(new THREE.Line(rimGeo, rimMat));

  // Concentric subtle grid rings
  [1.35, 1.7, 2.05].forEach((r) => {
    const ringPts = new THREE.Path().absarc(0, 0, r, 0, Math.PI * 2, true).getPoints(48).map(
      (p) => new THREE.Vector3(p.x, 0, p.y)
    );
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    const ringLine = new THREE.Line(
      ringGeo,
      new THREE.LineDashedMaterial({
        color: 0x475569,
        dashSize: 0.08,
        gapSize: 0.05,
        transparent: true,
        opacity: 0.35,
        depthTest: false,
      })
    );
    ringLine.computeLineDistances();
    planeGroup.add(ringLine);
  });

  // Equatorial Plane label badge
  const equatorLabel = createDiagramTextSprite(
    "Earth's equatorial plane",
    "Reference plane (Z = 0)",
    '#94a3b8',
    'rgba(15, 23, 42, 0.85)',
    'rgba(100, 116, 139, 0.6)'
  );
  equatorLabel.position.set(1.5, 0.05, -1.35);
  planeGroup.add(equatorLabel);

  diagramGroup.add(planeGroup);

  // 2. K_HAT: EARTH'S NORTH POLAR AXIS (Z in ECI -> +Y in Three.js)
  const kArrow = createDiagramVectorArrow(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 2.35, 0),
    0x38bdf8
  );
  diagramGroup.add(kArrow.group);

  const kLabel = createDiagramTextSprite(
    "K̂ Earth's north polar axis",
    'Z-axis (Celestial North)',
    '#38bdf8',
    'rgba(10, 15, 30, 0.9)',
    'rgba(56, 189, 248, 0.7)'
  );
  kLabel.position.set(0, 2.52, 0);
  diagramGroup.add(kLabel);

  // 3. I_HAT: VERNAL EQUINOX DIRECTION (X in ECI -> +X in Three.js)
  const iArrow = createDiagramVectorArrow(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(2.35, 0, 0),
    0x10b981
  );
  diagramGroup.add(iArrow.group);

  const iLabel = createDiagramTextSprite(
    'Î (Vernal equinox γ)',
    'X-axis (First Point of Aries ♈)',
    '#10b981',
    'rgba(6, 30, 20, 0.9)',
    'rgba(16, 185, 129, 0.7)'
  );
  iLabel.position.set(2.55, 0.05, 0);
  diagramGroup.add(iLabel);

  // 4. J_HAT: EQUATORIAL AXIS (Y in ECI -> +Z in Three.js)
  const jArrow = createDiagramVectorArrow(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 2.35),
    0x0ea5e9,
    true
  );
  diagramGroup.add(jArrow.group);

  const jLabel = createDiagramTextSprite(
    'Ĵ (Y-axis)',
    'Equatorial 90° East',
    '#0ea5e9',
    'rgba(8, 25, 45, 0.9)',
    'rgba(14, 165, 233, 0.7)'
  );
  jLabel.position.set(0, 0.05, 2.52);
  diagramGroup.add(jLabel);

  // 5. ASCENDING NODE & NODE LINE VECTOR N
  // In Three.js: (cos(raan), 0, sin(raan))
  const nodeLineThree = new THREE.Vector3(
    Math.cos(raanRad),
    0,
    Math.sin(raanRad)
  ).normalize();

  // Opposite node line (descending node)
  const nodeLineOpposite = nodeLineThree.clone().multiplyScalar(-1);
  const dashedNodeBackGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    nodeLineOpposite.clone().multiplyScalar(1.9),
  ]);
  const dashedNodeBackLine = new THREE.Line(
    dashedNodeBackGeo,
    new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.06,
      gapSize: 0.04,
      transparent: true,
      opacity: 0.45,
      depthTest: false,
    })
  );
  dashedNodeBackLine.computeLineDistances();
  diagramGroup.add(dashedNodeBackLine);

  const nArrow = createDiagramVectorArrow(
    new THREE.Vector3(0, 0, 0),
    nodeLineThree.clone().multiplyScalar(2.35),
    0xf59e0b
  );
  diagramGroup.add(nArrow.group);

  const nLabel = createDiagramTextSprite(
    'N Node line',
    'Intersection of orbit & equator',
    '#f59e0b',
    'rgba(30, 20, 5, 0.9)',
    'rgba(245, 158, 11, 0.7)'
  );
  nLabel.position.copy(nodeLineThree.clone().multiplyScalar(2.55));
  diagramGroup.add(nLabel);

  // Ascending Node Point on Orbit
  const nodeNu = (-elements.argPerigee + 360) % 360;
  const nodeECI = keplerianToECI(elements, nodeNu);
  const nodePosThree = eciKmToThreeVec(nodeECI.position);

  // Glowing sphere marker for Ascending Node
  const nodeMarkerGeo = new THREE.SphereGeometry(0.045, 16, 16);
  const nodeMarkerMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    depthTest: false,
  });
  const nodeMarker = new THREE.Mesh(nodeMarkerGeo, nodeMarkerMat);
  nodeMarker.position.copy(nodePosThree);
  diagramGroup.add(nodeMarker);

  const nodeRingGeo = new THREE.RingGeometry(0.06, 0.078, 24);
  const nodeRingMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const nodeRing = new THREE.Mesh(nodeRingGeo, nodeRingMat);
  nodeRing.position.copy(nodePosThree);
  nodeRing.rotation.x = Math.PI / 2;
  diagramGroup.add(nodeRing);

  const ascNodeLabel = createDiagramTextSprite(
    'Ascending node',
    `Crossing equator (South → North)`,
    '#ffffff',
    'rgba(30, 20, 5, 0.92)',
    'rgba(245, 158, 11, 0.8)'
  );
  ascNodeLabel.position.copy(nodePosThree.clone().add(new THREE.Vector3(0.18, 0.14, 0.18)));
  diagramGroup.add(ascNodeLabel);

  // 6. RAAN ARC Ω (from +X (Î) to Node Line N in equatorial plane)
  const raanArcPoints: THREE.Vector3[] = [];
  const raanRadius = 1.45;
  const numArcSegments = Math.max(8, Math.round(elements.raan / 5));
  for (let s = 0; s <= numArcSegments; s++) {
    const angle = (degToRad(elements.raan) * s) / numArcSegments;
    raanArcPoints.push(new THREE.Vector3(Math.cos(angle) * raanRadius, 0, Math.sin(angle) * raanRadius));
  }
  const raanArcLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(raanArcPoints),
    new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      linewidth: 2.5,
      depthTest: false,
    })
  );
  diagramGroup.add(raanArcLine);

  // Small arrowhead on RAAN arc pointing towards N
  if (elements.raan > 5 && raanArcPoints.length > 1) {
    const lastPt = raanArcPoints[raanArcPoints.length - 1];
    const prevPt = raanArcPoints[raanArcPoints.length - 2];
    const arcDir = lastPt.clone().sub(prevPt).normalize();
    const raanCone = createArrowHeadCone(0xf59e0b, 0.028, 0.07);
    raanCone.position.copy(lastPt);
    raanCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), arcDir);
    diagramGroup.add(raanCone);
  }

  const midRaanAngle = degToRad(elements.raan / 2);
  const raanLabel = createDiagramTextSprite(
    `Ω = ${elements.raan.toFixed(1)}°`,
    'RAAN (Right Ascension of Node)',
    '#f59e0b',
    'rgba(30, 20, 5, 0.9)',
    'rgba(245, 158, 11, 0.7)'
  );
  raanLabel.position.set(
    Math.cos(midRaanAngle) * (raanRadius + 0.32),
    0.04,
    Math.sin(midRaanAngle) * (raanRadius + 0.32)
  );
  diagramGroup.add(raanLabel);

  // 7. INCLINATION ARC i (angle between equatorial plane and orbital plane)
  // Drawn near the ascending node: sweeping up from equator into orbital plane
  const incArcPoints: THREE.Vector3[] = [];
  const incArcRadius = 0.55;
  const incCenter = nodeLineThree.clone().multiplyScalar(1.6);
  // Equatorial perpendicular
  const uEqPerp = new THREE.Vector3(-Math.sin(raanRad), 0, Math.cos(raanRad)).normalize();

  // Vector in orbital plane perpendicular to node line (pointing upwards)
  const hVectorThree = new THREE.Vector3(
    Math.sin(raanRad) * Math.sin(iRad),
    Math.cos(iRad),
    -Math.cos(raanRad) * Math.sin(iRad)
  ).normalize();
  const uOrbUp = new THREE.Vector3().crossVectors(nodeLineThree, hVectorThree).normalize();

  const numIncSegments = Math.max(8, Math.round(elements.i / 5));
  for (let s = 0; s <= numIncSegments; s++) {
    const fraction = s / numIncSegments;
    const currentAngle = iRad * fraction;
    // Rotate uEqPerp into uOrbUp around nodeLineThree
    const dir = uEqPerp.clone().applyAxisAngle(nodeLineThree, currentAngle);
    incArcPoints.push(incCenter.clone().add(dir.clone().multiplyScalar(incArcRadius)));
  }

  const incArcLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(incArcPoints),
    new THREE.LineBasicMaterial({
      color: 0xfacc15,
      linewidth: 2.5,
      depthTest: false,
    })
  );
  diagramGroup.add(incArcLine);

  if (elements.i > 3 && incArcPoints.length > 1) {
    const lastInc = incArcPoints[incArcPoints.length - 1];
    const prevInc = incArcPoints[incArcPoints.length - 2];
    const incDir = lastInc.clone().sub(prevInc).normalize();
    const incCone = createArrowHeadCone(0xfacc15, 0.026, 0.065);
    incCone.position.copy(lastInc);
    incCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), incDir);
    diagramGroup.add(incCone);
  }

  const midIncPt = incArcPoints[Math.floor(incArcPoints.length / 2)] || incCenter;
  const incLabel = createDiagramTextSprite(
    `i = ${elements.i.toFixed(1)}°`,
    'Inclination (Orbit Tilt)',
    '#facc15',
    'rgba(30, 25, 5, 0.9)',
    'rgba(250, 204, 21, 0.7)'
  );
  incLabel.position.copy(midIncPt.clone().add(new THREE.Vector3(0.08, 0.15, 0.08)));
  diagramGroup.add(incLabel);

  // 8. PERIGEE VECTOR e & ARGUMENT OF PERIGEE ARC ω
  const periECI = keplerianToECI(elements, 0);
  const perigeeThree = eciKmToThreeVec(periECI.position);
  const perigeeDirThree = perigeeThree.clone().normalize();
  const perigeeDist = perigeeThree.length();

  const perigeeArrow = createDiagramVectorArrow(
    new THREE.Vector3(0, 0, 0),
    perigeeDirThree.clone().multiplyScalar(perigeeDist + 0.45),
    0xa855f7
  );
  diagramGroup.add(perigeeArrow.group);

  const periMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false })
  );
  periMarker.position.copy(perigeeThree);
  diagramGroup.add(periMarker);

  const eLabel = createDiagramTextSprite(
    `e Perigee (${perigeeAlt.toFixed(0)} km)`,
    'Closest point to Earth',
    '#a855f7',
    'rgba(25, 10, 35, 0.9)',
    'rgba(168, 85, 247, 0.7)'
  );
  eLabel.position.copy(perigeeDirThree.clone().multiplyScalar(perigeeDist + 0.65));
  diagramGroup.add(eLabel);

  // Argument of Perigee Arc ω (from Node Line N to Perigee e in orbital plane)
  const argPPoints = generateArcPoints(nodeLineThree, perigeeDirThree, 1.35, 32);
  const argPLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(argPPoints),
    new THREE.LineBasicMaterial({
      color: 0xa855f7,
      linewidth: 2.5,
      depthTest: false,
    })
  );
  diagramGroup.add(argPLine);

  if (elements.argPerigee > 5 && argPPoints.length > 1) {
    const lastP = argPPoints[argPPoints.length - 1];
    const prevP = argPPoints[argPPoints.length - 2];
    const pDir = lastP.clone().sub(prevP).normalize();
    const pCone = createArrowHeadCone(0xa855f7, 0.028, 0.07);
    pCone.position.copy(lastP);
    pCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pDir);
    diagramGroup.add(pCone);
  }

  const midArgPPt = argPPoints[Math.floor(argPPoints.length / 2)] || nodeLineThree;
  const argPLabel = createDiagramTextSprite(
    `ω = ${elements.argPerigee.toFixed(1)}°`,
    'Argument of Perigee',
    '#a855f7',
    'rgba(25, 10, 35, 0.9)',
    'rgba(168, 85, 247, 0.7)'
  );
  argPLabel.position.copy(midArgPPt.clone().multiplyScalar(1.22));
  diagramGroup.add(argPLabel);

  // 9. ANGULAR MOMENTUM VECTOR h (Normal to orbital plane: r × v)
  const hArrow = createDiagramVectorArrow(
    new THREE.Vector3(0, 0, 0),
    hVectorThree.clone().multiplyScalar(2.25),
    0x38bdf8
  );
  diagramGroup.add(hArrow.group);

  const hLabel = createDiagramTextSprite(
    'h Angular momentum',
    'r × v (Perpendicular to orbit)',
    '#38bdf8',
    'rgba(10, 15, 30, 0.9)',
    'rgba(56, 189, 248, 0.7)'
  );
  hLabel.position.copy(hVectorThree.clone().multiplyScalar(2.42));
  diagramGroup.add(hLabel);

  // 10. DYNAMIC ELEMENTS: SATELLITE POSITION VECTOR r, TRUE ANOMALY ARC θ, VELOCITY VECTOR v
  // Satellite vector r line
  const rLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const rLineMat = new THREE.LineBasicMaterial({
    color: 0xf43f5e,
    linewidth: 2.5,
    depthTest: false,
  });
  const rLine = new THREE.Line(rLineGeo, rLineMat);
  diagramGroup.add(rLine);

  const rLabel = createDiagramTextSprite(
    'r Satellite',
    'Position vector from Earth center',
    '#f43f5e',
    'rgba(35, 10, 20, 0.9)',
    'rgba(244, 63, 94, 0.7)'
  );
  diagramGroup.add(rLabel);

  // True anomaly arc θ line
  const thetaArcGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const thetaArcMat = new THREE.LineBasicMaterial({
    color: 0xf43f5e,
    linewidth: 2.5,
    depthTest: false,
  });
  const thetaArcLine = new THREE.Line(thetaArcGeo, thetaArcMat);
  diagramGroup.add(thetaArcLine);

  const thetaCone = createArrowHeadCone(0xf43f5e, 0.028, 0.07);
  diagramGroup.add(thetaCone);

  const thetaLabel = createDiagramTextSprite(
    `θ = ${nu.toFixed(1)}°`,
    'True Anomaly (Clock Position)',
    '#f43f5e',
    'rgba(35, 10, 20, 0.9)',
    'rgba(244, 63, 94, 0.7)'
  );
  diagramGroup.add(thetaLabel);

  // Dynamic update function called at 60 FPS as satellite advances
  const updateDynamic = (
    currentNuDeg: number,
    satPosThree: THREE.Vector3,
    satVelThree: THREE.Vector3
  ) => {
    // 1. Update position vector r line
    rLine.geometry.setFromPoints([new THREE.Vector3(0, 0, 0), satPosThree]);
    rLine.geometry.attributes.position.needsUpdate = true;

    // Position r label near satellite
    rLabel.position.copy(satPosThree.clone().add(satPosThree.clone().normalize().multiplyScalar(0.22)));

    // 2. Update True Anomaly Arc θ
    const currentSatDir = satPosThree.clone().normalize();
    const thetaPoints = generateArcPoints(perigeeDirThree, currentSatDir, 1.22, 28);
    if (thetaPoints.length > 1) {
      thetaArcLine.geometry.setFromPoints(thetaPoints);
      thetaArcLine.geometry.attributes.position.needsUpdate = true;

      const lastTheta = thetaPoints[thetaPoints.length - 1];
      const prevTheta = thetaPoints[thetaPoints.length - 2];
      const tDir = lastTheta.clone().sub(prevTheta).normalize();
      thetaCone.position.copy(lastTheta);
      thetaCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tDir);
      thetaCone.visible = currentNuDeg > 3;

      const midThetaPt = thetaPoints[Math.floor(thetaPoints.length / 2)];
      if (midThetaPt) {
        thetaLabel.position.copy(midThetaPt.clone().multiplyScalar(1.18));
      }
    }
  };

  const dispose = () => {
    diagramGroup.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  };

  return {
    group: diagramGroup,
    updateDynamic,
    dispose,
  };
}
