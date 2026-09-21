/**
 * High-precision deep-space coordinate grid texture fallback
 * Used only if satellite imagery is still initializing.
 * All random/blocky polygon approximations have been completely removed.
 */

import * as THREE from 'three';

export function createProceduralEarthTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep Space Oceanic Gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#061325');
  oceanGrad.addColorStop(0.3, '#0b1d3a');
  oceanGrad.addColorStop(0.5, '#07152b');
  oceanGrad.addColorStop(0.7, '#0b1d3a');
  oceanGrad.addColorStop(1, '#061325');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. High-precision Geodesic WGS-84 Coordinate Grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
  ctx.lineWidth = 1;

  // Parallels (every 15 degrees)
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Meridians (every 30 degrees)
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Equator
  const equatorY = height / 2;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, equatorY);
  ctx.lineTo(width, equatorY);
  ctx.stroke();

  // Prime Meridian (Greenwich 0 deg)
  const primeMeridianX = width / 2;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(primeMeridianX, 0);
  ctx.lineTo(primeMeridianX, height);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
