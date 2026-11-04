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

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 220);
    camera.position.set(0, 20, 35);
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

    const treasuryGroup = new THREE.Group();
    scene.add(treasuryGroup);

    // -------------------------------------------------------------------------
    // 1. 3D CONCENTRIC TILTED GYROSCOPE RINGS + PRECISION RADIAL TICK MARKS
    // -------------------------------------------------------------------------
    const ringRadii = [5.2, 8.4, 11.6, 14.8, 18.0, 21.2];
    const ringColors = ['#00e676', '#00f0ff', '#d4af37', '#ff9e2c', '#ff1e7a', '#d4af37'];
    const gyroRings: THREE.Group[] = [];

    ringRadii.forEach((rad, idx) => {
      const ringHolder = new THREE.Group();
      ringHolder.rotation.x = (idx % 2 === 0 ? 1 : -1) * 0.14;
      ringHolder.rotation.z = (idx % 3 - 1) * 0.1;

      // Primary Ring Loop
      const segments = 160;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s < segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(theta) * rad, 0, Math.sin(theta) * rad));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(ringColors[idx]),
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
      });
      ringHolder.add(new THREE.LineLoop(geo, mat));

      // Precision Radial Tick Marks
      const tickPts: number[] = [];
      const tickCount = 36 + idx * 12;
      for (let t = 0; t < tickCount; t++) {
        const theta = (t / tickCount) * Math.PI * 2;
        const innerR = rad - (t % 3 === 0 ? 0.65 : 0.3);
        const outerR = rad + (t % 3 === 0 ? 0.65 : 0.3);
        tickPts.push(
          Math.cos(theta) * innerR,
          0,
          Math.sin(theta) * innerR,
          Math.cos(theta) * outerR,
          0,
          Math.sin(theta) * outerR
        );
      }
      const tickGeo = new THREE.BufferGeometry();
      tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPts, 3));
      const tickMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(ringColors[idx]),
        transparent: true,
        opacity: 0.35,
      });
      ringHolder.add(new THREE.LineSegments(tickGeo, tickMat));

      treasuryGroup.add(ringHolder);
      gyroRings.push(ringHolder);
    });

    // -------------------------------------------------------------------------
    // 2. 35,000-PARTICLE THERMAL CURL-NOISE ATTRACTOR PLUME
    // -------------------------------------------------------------------------
    const plumeSeeds = new Float32Array(PLUME_PARTICLE_COUNT * 3); // [angle, heightProgress, radialSpread]
    const plumeColors = new Float32Array(PLUME_PARTICLE_COUNT * 3);

    const thermalPalette = [
      new THREE.Color('#00f0ff'), // Base Occupancy Cyan
      new THREE.Color('#00e676'), // Nominal Yield Emerald
      new THREE.Color('#d4af37'), // Brushed Citadel Gold
      new THREE.Color('#ff9e2c'), // High ADR Thermal Amber
      new THREE.Color('#ff1e7a'), // Sovereign Penthouse Magenta Core
    ];

    for (let i = 0; i < PLUME_PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const hProg = Math.random();
      const spread = 0.22 + Math.pow(Math.random(), 0.9) * 1.18;

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

          float h = fract(h0 + uTime * (0.14 + uOccupancyRatio * 0.2 + uPulse * 0.28));
          float spin = theta0 + uTime * (0.7 + (1.0 - h) * 1.55) + h * 6.28318;

          float funnelProfile = mix(14.0, 2.0, sin(h * 3.14159) * 0.85) * spread;
          float r = funnelProfile * (0.62 + uOccupancyRatio * 0.58);

          vec3 pos;
          pos.x = cos(spin) * r + sin(uTime * 2.2 + h * 12.0) * (0.48 + uPulse * 0.9);
          pos.z = sin(spin) * r + cos(uTime * 2.0 + h * 12.0) * (0.48 + uPulse * 0.9);
          pos.y = -9.0 + h * 22.0;

          vHeat = smoothstep(0.08, 0.92, h) * (0.72 + uPulse * 0.55);
          vColor = mix(aColor, vec3(1.0, 0.97, 0.88), pow(1.0 - spread * 0.5, 2.0) * 0.7);

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (1.55 + vHeat * 1.5) * uPixelRatio * (30.0 / max(8.0, -mvPosition.z));
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
          gl_FragColor = vec4(vColor * 1.25, glow * (0.45 + vHeat * 0.48));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const plumePoints = new THREE.Points(plumeGeo, plumeShaderMat);
    treasuryGroup.add(plumePoints);

    // Camera Orbit
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let yaw = 0.0;
    let pitch = 0.52;

    const onDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
      recordInteraction();
    };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      yaw -= (e.clientX - prevX) * 0.006;
      pitch = Math.max(0.1, Math.min(1.25, pitch + (e.clientY - prevY) * 0.005));
      prevX = e.clientX;
      prevY = e.clientY;
      recordInteraction();
    };
    const onUp = () => {
      isDragging = false;
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

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

      if (!isDragging) {
        yaw += dt * 0.1;
      }

      const dist = 36;
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        Math.cos(yaw) * Math.cos(pitch) * dist
      );
      camera.lookAt(0, 1.5, 0);

      gyroRings.forEach((grp, idx) => {
        const dir = idx % 2 === 0 ? 1 : -1;
        grp.rotation.y = elapsedSec * dir * (0.2 + idx * 0.045);
        grp.rotation.x = Math.sin(elapsedSec * 0.4 + idx) * 0.16;
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
      domElem.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', handleResize);
      disposeThreeContextComplete(scene, renderer, postProcessor);
    };
  }, [recordInteraction]);

  const injectHighYieldCulinarySettlement = () => {
    recordInteraction();
    triggerShaderPulse(1.4);
    placeRoomServiceOrder({
      roomNumber: '601',
      guestName: 'Sheikh Farhad Al-Sabah // Sovereign Banquet',
      items: [
        { name: 'Royal Mesopotamian Lamb Quzi Banquet', priceIqd: 145000, qty: 1 },
        { name: 'Vintage Saffron & Cardamom Ritual', priceIqd: 55000, qty: 1 },
      ],
    });
  };

  return (
    <div className="relative w-full h-full bg-[#030305] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Telemetry Overlay */}
      <div className="absolute top-20 left-6 pointer-events-none hud-glass rounded-2xl px-4 py-3 space-y-1">
        <div className="font-mono text-[10px] tracking-[0.2em] text-[#d4af37] uppercase">
          VIEW 06 // YIELD & TREASURY LAB • 3D POLAR GYROSCOPE & 35,000 THERMAL PLUME
        </div>
        <div className="flex flex-wrap items-center gap-4 font-mono text-xs tabular-nums">
          <span className="text-[#d4af37] font-semibold">
            IQD: {telemetry.dualCurrencyRevenue.totalIqd.toLocaleString()} IQD
          </span>
          <span className="text-[#00e676] font-semibold">
            USD: ${telemetry.dualCurrencyRevenue.totalUsd.toLocaleString()} USD
          </span>
          <span className="text-[#00f0ff]">
            FX: 1 USD = {telemetry.dualCurrencyRevenue.exchangeRate.toLocaleString()} IQD
          </span>
        </div>
      </div>

      {/* Floating Glassmorphic Treasury Ledger Card */}
      <div className="absolute top-20 right-6 w-76 hud-glass rounded-3xl p-5 font-mono text-xs space-y-3 tabular-nums">
        <div className="text-[10px] text-[#d4af37] tracking-[0.18em] uppercase border-b border-white/10 pb-2">
          3D Polar Gyroscope Matrix
        </div>
        <div className="flex justify-between">
          <span className="text-[#00e676]">RING 01 • OCCUPANCY:</span>
          <span className="text-white font-semibold">{telemetry.occupancyPercent}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#00f0ff]">RING 02 • LIVE ADR:</span>
          <span className="text-white font-semibold">
            {telemetry.adrIqd.toLocaleString()} IQD (${telemetry.adrUsd})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#d4af37]">RING 03 • LIVE REVPAR:</span>
          <span className="text-white font-semibold">
            {telemetry.revParIqd.toLocaleString()} IQD (${telemetry.revParUsd})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#ff9e2c]">RING 04 • SUITE FOLIOS:</span>
          <span className="text-white/90">
            {telemetry.dualCurrencyRevenue.roomRevenueIqd.toLocaleString()} IQD
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#ff1e7a]">RING 05 • DINING F&B:</span>
          <span className="text-white/90">
            {telemetry.dualCurrencyRevenue.culinaryRevenueIqd.toLocaleString()} IQD
          </span>
        </div>

        <button
          onClick={injectHighYieldCulinarySettlement}
          className="w-full py-2.5 rounded-2xl bg-[#d4af37]/15 hover:bg-[#d4af37] text-[#d4af37] hover:text-[#030305] border border-[#d4af37]/50 font-semibold uppercase text-[10px] tracking-wider transition"
        >
          + Settle Penthouse Banquet (+200,000 IQD)
        </button>
      </div>
    </div>
  );
};
