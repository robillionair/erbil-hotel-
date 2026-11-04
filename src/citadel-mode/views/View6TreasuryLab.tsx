import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createCitadelPostProcessor,
  disposeThreeContextComplete,
} from '../postprocessing/CitadelPostProcessor';
import { useErbilTelemetry, computeTelemetrySnapshot } from '../telemetry/ErbilTelemetryStream';
import { useCitadelStore } from '../../store/useCitadelStore';
import { useHotelOpsStore } from '../../store/useHotelOpsStore';

const PLUME_PARTICLE_COUNT = 35000;

export const View6TreasuryLab: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const telemetry = useErbilTelemetry();
  const { recordInteraction, triggerShaderPulse } = useCitadelStore();
  const { placeRoomServiceOrder } = useHotelOpsStore();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030305');

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 220);
    camera.position.set(0, 22, 34);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const postProcessor = createCitadelPostProcessor(renderer, scene, camera, width, height);
    postProcessor.bloomPass.strength = 1.1;

    const treasuryGroup = new THREE.Group();
    scene.add(treasuryGroup);

    // -------------------------------------------------------------------------
    // 1. CONCENTRIC ROTATING POLAR DATA RINGS
    // -------------------------------------------------------------------------
    const ringRadii = [5.0, 8.2, 11.4, 14.6, 17.8, 21.0];
    const ringColors = ['#00e676', '#00f0ff', '#d4af37', '#ff8a3d', '#ff1e7a', '#d4af37'];
    const ringMeshes: THREE.LineLoop[] = [];

    ringRadii.forEach((rad, idx) => {
      const segments = 128;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s < segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        const notch = s % 8 === 0 ? 0.45 : 0.0;
        pts.push(
          new THREE.Vector3(
            Math.cos(theta) * (rad + notch),
            (idx - 2.5) * 0.35,
            Math.sin(theta) * (rad + notch)
          )
        );
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(ringColors[idx]),
        transparent: true,
        opacity: 0.48,
      });
      const loop = new THREE.LineLoop(geo, mat);
      treasuryGroup.add(loop);
      ringMeshes.push(loop);
    });

    // -------------------------------------------------------------------------
    // 2. 35,000-PARTICLE THERMAL ATTRACTOR PLUME (YIELD vs FLOOR DEPTH)
    // -------------------------------------------------------------------------
    const plumeSeeds = new Float32Array(PLUME_PARTICLE_COUNT * 3); // [angle, heightProgress, radialSpread]
    const plumeColors = new Float32Array(PLUME_PARTICLE_COUNT * 3);

    const thermalPalette = [
      new THREE.Color('#00f0ff'), // Base Occupancy Cyan
      new THREE.Color('#00e676'), // Nominal Yield Emerald
      new THREE.Color('#d4af37'), // Brushed Citadel Gold
      new THREE.Color('#ff8a3d'), // High ADR Thermal Amber
      new THREE.Color('#ff1e7a'), // Sovereign Penthouse Magenta Core
    ];

    for (let i = 0; i < PLUME_PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const hProg = Math.random(); // 0 (floor 1 base) -> 1 (floor 6 penthouse crown)
      const spread = 0.25 + Math.pow(Math.random(), 0.9) * 1.15;

      plumeSeeds[i * 3 + 0] = theta;
      plumeSeeds[i * 3 + 1] = hProg;
      plumeSeeds[i * 3 + 2] = spread;

      const cIdx = Math.min(
        thermalPalette.length - 1,
        Math.floor(hProg * thermalPalette.length)
      );
      const c = thermalPalette[cIdx];
      plumeColors[i * 3 + 0] = c.r;
      plumeColors[i * 3 + 1] = c.g;
      plumeColors[i * 3 + 2] = c.b;
    }

    const plumeGeo = new THREE.BufferGeometry();
    plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumeSeeds, 3));
    plumeGeo.setAttribute('aColor', new THREE.BufferAttribute(plumeColors, 3));

    const plumeShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uOccupancyRatio: { value: 0.45 },
        uPulse: { value: 0.15 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        uniform float uTime;
        uniform float uOccupancyRatio;
        uniform float uPulse;
        uniform float uPixelRatio;

        varying vec3 vColor;
        varying float vHeat;

        void main() {
          float theta0 = position.x;
          float h0 = position.y;
          float spread = position.z;

          // Continuous upward thermal convection loop
          float h = fract(h0 + uTime * (0.14 + uOccupancyRatio * 0.18 + uPulse * 0.25));
          float spin = theta0 + uTime * (0.65 + (1.0 - h) * 1.45) + h * 6.28318;

          // Thermal attractor funnel shape: wide at base rings, pinched at mid-height, flaring at crown
          float funnelProfile = mix(13.5, 2.2, sin(h * 3.14159) * 0.82) * spread;
          float r = funnelProfile * (0.65 + uOccupancyRatio * 0.55);

          vec3 pos;
          pos.x = cos(spin) * r + sin(uTime * 2.1 + h * 12.0) * (0.45 + uPulse * 0.8);
          pos.z = sin(spin) * r + cos(uTime * 1.9 + h * 12.0) * (0.45 + uPulse * 0.8);
          pos.y = -8.5 + h * 21.0;

          vHeat = smoothstep(0.1, 0.9, h) * (0.7 + uPulse * 0.5);
          vColor = mix(aColor, vec3(1.0, 0.96, 0.85), pow(1.0 - spread * 0.5, 2.0) * 0.65);

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (1.5 + vHeat * 1.4) * uPixelRatio * (28.0 / max(8.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vHeat;

        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(p, p);
          if (r2 > 1.0) discard;

          float glow = exp(-r2 * 3.4);
          gl_FragColor = vec4(vColor, glow * (0.42 + vHeat * 0.45));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const plumePoints = new THREE.Points(plumeGeo, plumeShaderMat);
    treasuryGroup.add(plumePoints);

    let rafId = 0;
    let lastFrameTime = performance.now();
    let frameCounter = 0;
    let fpsTimer = performance.now();
    const startTime = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);

      const citadelState = useCitadelStore.getState();
      if (!citadelState.citadelMode || citadelState.targetFps === 0) return;

      const minInterval = 1000 / citadelState.targetFps;
      const elapsed = now - lastFrameTime;
      if (elapsed < minInterval - 1) return;

      const dt = Math.min(0.1, elapsed / 1000);
      lastFrameTime = now;
      frameCounter++;

      if (now - fpsTimer >= 500) {
        citadelState.setMeasuredFps(Math.round((frameCounter * 1000) / (now - fpsTimer)));
        frameCounter = 0;
        fpsTimer = now;
      }

      citadelState.decayShaderPulse(dt);

      const snap = computeTelemetrySnapshot();
      const elapsedSec = (now - startTime) * 0.001;

      ringMeshes.forEach((loop, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        loop.rotation.y = elapsedSec * dir * (0.18 + idx * 0.04);
      });

      plumeShaderMat.uniforms.uTime.value = elapsedSec;
      plumeShaderMat.uniforms.uOccupancyRatio.value = snap.occupancyRatio;
      plumeShaderMat.uniforms.uPulse.value = snap.shaderPulseIntensity;

      postProcessor.update(elapsedSec, snap.shaderPulseIntensity);
    };

    rafId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const nw = container.clientWidth || window.innerWidth;
      const nh = container.clientHeight || window.innerHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      postProcessor.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      disposeThreeContextComplete(scene, renderer, postProcessor);
    };
  }, []);

  const injectHighYieldCulinarySettlement = () => {
    recordInteraction();
    triggerShaderPulse(1.35);
    placeRoomServiceOrder({
      roomNumber: '601',
      guestName: 'Sheikh Farhad Al-Sabah // Penthouse Banquet',
      items: [
        { name: 'Sovereign Lamb Quzi Banquet Platter', priceIqd: 145000, qty: 1 },
        { name: 'Vintage Saffron & Cardamom Ritual', priceIqd: 55000, qty: 1 },
      ],
    });
  };

  return (
    <div
      onMouseMove={recordInteraction}
      className="relative w-full h-full bg-[#030305] overflow-hidden select-none"
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Top HUD Telemetry */}
      <div className="absolute top-3 left-3 pointer-events-none font-mono space-y-1">
        <div className="text-[9px] tracking-[0.18em] text-[#686875] uppercase">
          VIEW 06 // TREASURY & YIELD LAB: RADIAL REVPAR MATRIX (POLAR RINGS + 35,000 THERMAL ATTRACTOR PLUME)
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px] tabular-nums">
          <span className="text-[#d4af37] font-bold">
            TOTAL IQD: {telemetry.dualCurrencyRevenue.totalIqd.toLocaleString()} IQD
          </span>
          <span className="text-[#00e676] font-bold">
            TOTAL USD: ${telemetry.dualCurrencyRevenue.totalUsd.toLocaleString()} USD
          </span>
          <span className="text-[#00f0ff]">
            EXCHANGE: 1 USD = {telemetry.dualCurrencyRevenue.exchangeRate.toLocaleString()} IQD
          </span>
        </div>
      </div>

      {/* Right Radial Ring Legend & Live Dual-Currency Ledger */}
      <div className="absolute top-12 right-3 w-72 bg-[#040406]/90 border border-[#16161a] p-3 font-mono text-[10px] space-y-2 tabular-nums">
        <div className="text-[9px] text-[#d4af37] tracking-[0.16em] uppercase border-b border-[#16161a] pb-1">
          POLAR RING TELEMETRY MAPPING
        </div>
        <div className="flex justify-between">
          <span className="text-[#00e676]">RING 01 // OCCUPANCY %:</span>
          <span className="text-[#f4f0ea] font-bold">{telemetry.occupancyPercent}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#00f0ff]">RING 02 // LIVE ADR:</span>
          <span className="text-[#f4f0ea] font-bold">
            {telemetry.adrIqd.toLocaleString()} IQD (${telemetry.adrUsd})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#d4af37]">RING 03 // LIVE REVPAR:</span>
          <span className="text-[#f4f0ea] font-bold">
            {telemetry.revParIqd.toLocaleString()} IQD (${telemetry.revParUsd})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#ff8a3d]">RING 04 // ROOM FOLIOS:</span>
          <span className="text-[#f4f0ea]">
            {telemetry.dualCurrencyRevenue.roomRevenueIqd.toLocaleString()} IQD
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#ff1e7a]">RING 05 // CULINARY F&B:</span>
          <span className="text-[#f4f0ea]">
            {telemetry.dualCurrencyRevenue.culinaryRevenueIqd.toLocaleString()} IQD
          </span>
        </div>
        <button
          onClick={injectHighYieldCulinarySettlement}
          className="mt-2 w-full py-2 bg-[#141006] hover:bg-[#d4af37] text-[#d4af37] hover:text-[#030305] border border-[#d4af37] font-bold uppercase tracking-wider transition"
        >
          + SETTLE VIP PENTHOUSE BANQUET (+200,000 IQD)
        </button>
      </div>
    </div>
  );
};
