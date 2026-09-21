/**
 * NASA Deep Space Star Map & Galactic Environment Generator
 * Generates an equirectangular deep star field with the Milky Way galactic plane,
 * star clusters, and authentic astronomical spectral temperatures.
 */

import * as THREE from 'three';

let cachedStarTexture: THREE.CanvasTexture | null = null;

export function createNasaDeepSpaceTexture(): THREE.CanvasTexture {
  if (cachedStarTexture) {
    return cachedStarTexture;
  }

  const width = 4096;
  const height = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  // 1. Deep cosmic pitch-black foundation
  ctx.fillStyle = '#010204';
  ctx.fillRect(0, 0, width, height);

  // 2. Milky Way Galactic Plane (Accurate S-curve / tilted band across equirectangular projection)
  // Draw soft, layered galactic dust lanes and nebular clouds
  const drawMilkyWayCloud = (
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    colorStops: Array<[number, string]>
  ) => {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.scale(radiusX, radiusY);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    colorStops.forEach(([stop, col]) => grad.addColorStop(stop, col));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Galactic bulge (Sagittarius A* center)
  drawMilkyWayCloud(width * 0.48, height * 0.52, 650, 320, -0.25, [
    [0.0, 'rgba(255, 235, 200, 0.28)'],
    [0.2, 'rgba(215, 170, 230, 0.18)'],
    [0.45, 'rgba(70, 90, 160, 0.12)'],
    [0.75, 'rgba(20, 30, 70, 0.05)'],
    [1.0, 'rgba(0, 0, 0, 0)'],
  ]);

  // Cygnus & Perseus spiral arm clouds along galactic equator
  const galacticPoints: Array<[number, number, number, number, number, string]> = [
    [width * 0.15, height * 0.38, 550, 160, 0.4, 'rgba(90, 120, 210, 0.12)'],
    [width * 0.32, height * 0.45, 620, 190, 0.25, 'rgba(140, 160, 235, 0.15)'],
    [width * 0.65, height * 0.58, 680, 200, -0.22, 'rgba(130, 150, 220, 0.14)'],
    [width * 0.82, height * 0.68, 580, 170, -0.35, 'rgba(80, 110, 190, 0.11)'],
    [width * 0.96, height * 0.74, 450, 140, -0.4, 'rgba(70, 90, 170, 0.09)'],
    [width * 0.04, height * 0.32, 450, 140, 0.45, 'rgba(70, 90, 170, 0.09)'],
  ];

  galacticPoints.forEach(([x, y, rx, ry, rot, col]) => {
    drawMilkyWayCloud(x, y, rx, ry, rot, [
      [0.0, col],
      [0.5, col.replace(/[\d\.]+\)$/, '0.05)')],
      [1.0, 'rgba(0, 0, 0, 0)'],
    ]);
  });

  // Dark dust lanes (Rift through Cygnus & Ophiuchus)
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const dustLanes: Array<[number, number, number, number, number]> = [
    [width * 0.46, height * 0.53, 400, 45, -0.24],
    [width * 0.43, height * 0.50, 320, 35, -0.22],
    [width * 0.63, height * 0.59, 360, 40, -0.25],
    [width * 0.28, height * 0.43, 300, 35, 0.28],
  ];

  dustLanes.forEach(([x, y, rx, ry, rot]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(rx, ry);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, 'rgba(1, 2, 4, 0.75)');
    grad.addColorStop(0.6, 'rgba(1, 2, 4, 0.35)');
    grad.addColorStop(1, 'rgba(1, 2, 4, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // Magellanic Clouds (Large & Small) in southern hemisphere
  drawMilkyWayCloud(width * 0.72, height * 0.82, 140, 100, 0.2, [
    [0.0, 'rgba(180, 200, 240, 0.22)'],
    [0.6, 'rgba(120, 150, 210, 0.08)'],
    [1.0, 'rgba(0, 0, 0, 0)'],
  ]);
  drawMilkyWayCloud(width * 0.81, height * 0.86, 90, 70, -0.3, [
    [0.0, 'rgba(170, 190, 230, 0.18)'],
    [0.5, 'rgba(110, 140, 200, 0.06)'],
    [1.0, 'rgba(0, 0, 0, 0)'],
  ]);

  // Andromeda Galaxy (M31) in northern sky
  drawMilkyWayCloud(width * 0.22, height * 0.28, 75, 28, -0.6, [
    [0.0, 'rgba(255, 245, 220, 0.35)'],
    [0.4, 'rgba(200, 215, 255, 0.18)'],
    [1.0, 'rgba(0, 0, 0, 0)'],
  ]);

  // 3. Realistic Stellar Distribution: Spectral Classes & Luminosity
  // Spectral Colors: O/B (Blue-White), A (White), F/G (Warm Yellow/Sun), K (Orange), M (Red)
  const spectralColors = [
    '#d6e8ff', // B Class - Hot Blue
    '#ffffff', // A Class - Pure White
    '#ffffff',
    '#fffbe6', // F Class - Cream
    '#ffeaad', // G Class - Solar Yellow
    '#ffd4a3', // K Class - Orange
    '#ffb899', // M Class - Red Giant
  ];

  // Random seeded generator for deterministic astronomical look
  let seed = 42891;
  const pseudoRandom = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Plot 12,000 background stars
  const starCount = 12000;
  for (let i = 0; i < starCount; i++) {
    const x = pseudoRandom() * width;
    const y = pseudoRandom() * height;

    // Density modulation: concentrate more stars near galactic plane
    const distToGalacticPlane = Math.abs(y - (height * 0.5 + Math.sin((x / width) * Math.PI * 2) * height * 0.22));
    const galacticWeight = Math.max(0.15, 1 - distToGalacticPlane / (height * 0.45));
    if (pseudoRandom() > galacticWeight && pseudoRandom() > 0.4) {
      continue;
    }

    const mag = pseudoRandom();
    let radius = 0.5;
    let opacity = 0.4 + pseudoRandom() * 0.5;

    if (mag > 0.995) {
      // 1st / 2nd magnitude bright navigation stars (Canopus, Vega, Rigel, Arcturus, Alpha Centauri)
      radius = 2.2 + pseudoRandom() * 1.0;
      opacity = 0.98;
    } else if (mag > 0.96) {
      // Intermediate navigation stars
      radius = 1.3 + pseudoRandom() * 0.6;
      opacity = 0.85;
    } else if (mag > 0.85) {
      radius = 0.85 + pseudoRandom() * 0.4;
      opacity = 0.7;
    }

    const color = spectralColors[Math.floor(pseudoRandom() * spectralColors.length)];

    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Subtle 4-point diffraction spike for the top 50 brightest stars
    if (mag > 0.995) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 0.8;
      const spikeLen = radius * 3.8;
      ctx.beginPath();
      ctx.moveTo(x - spikeLen, y);
      ctx.lineTo(x + spikeLen, y);
      ctx.moveTo(x, y - spikeLen);
      ctx.lineTo(x, y + spikeLen);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1.0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  cachedStarTexture = texture;
  return texture;
}

/**
 * Creates the Celestial Sky Sphere Mesh
 */
export function createCelestialSphere(radius = 85): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 64, 64);
  const texture = createNasaDeepSpaceTexture();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const sphere = new THREE.Mesh(geometry, material);
  sphere.name = 'NASA_Celestial_Sphere';
  return sphere;
}
