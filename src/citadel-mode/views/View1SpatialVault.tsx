import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createCitadelPostProcessor,
  disposeThreeContextComplete,
} from '../postprocessing/CitadelPostProcessor';
import { useErbilTelemetry, computeTelemetrySnapshot } from '../telemetry/ErbilTelemetryStream';
import { useCitadelStore } from '../../store/useCitadelStore';
import { useHotelOpsStore, isRoomReady } from '../../store/useHotelOpsStore';

interface ProjectedFloorLabel {
  floor: number;
  zone: string;
  sampleRoomNumber: string;
  x: number;
  y: number;
  visible: boolean;
}

const PARTICLE_COUNT = 50000;

const FLOOR_DEFS = [
  { floor: 1, zone: 'FLOOR_01 // LOBBY & ATRIUM', y: -12.5, sampleRoom: '102' },
  { floor: 2, zone: 'FLOOR_02 // EXECUTIVE WING', y: -7.5, sampleRoom: '201' },
  { floor: 3, zone: 'FLOOR_03 // LEVANTINE GALLERY', y: -2.5, sampleRoom: '301' },
  { floor: 4, zone: 'FLOOR_04 // CITADEL MERIDIAN', y: 2.5, sampleRoom: '401' },
  { floor: 5, zone: 'FLOOR_05 // DIPLOMATIC WING', y: 7.5, sampleRoom: '501' },
  { floor: 6, zone: 'FLOOR_06 // ROYAL PENTHOUSE', y: 12.5, sampleRoom: '601' },
];

export const View1SpatialVault: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const focalRef = useRef<number>(35.0);
  const telemetry = useErbilTelemetry();
  const { selectedRoomNumber, setSelectedRoomNumber, recordInteraction } = useCitadelStore();
  const {
    rooms,
    checkOutRoom,
    markCleaningFinishedAwaitingInspection,
    inspectRoomVerdict,
    setRoomHvacTemp,
  } = useHotelOpsStore();

  const [labels, setLabels] = useState<ProjectedFloorLabel[]>([]);
  const [focalDistance, setFocalDistance] = useState<number>(35.0);

  const selectedRoomObj = rooms.find((r) => r.roomNumber === selectedRoomNumber) || null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030305');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 250);
    camera.position.set(28, 12, 34);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const postProcessor = createCitadelPostProcessor(renderer, scene, camera, width, height);

    // -------------------------------------------------------------------------
    // 1. HOLOGRAPHIC ARCHITECTURAL FLOOR PLATES & CENTRAL CITADEL CORE
    // -------------------------------------------------------------------------
    const towerGroup = new THREE.Group();
    scene.add(towerGroup);

    const cyanWireMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#00f0ff'),
      transparent: true,
      opacity: 0.22,
    });
    const goldWireMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#d4af37'),
      transparent: true,
      opacity: 0.42,
    });

    FLOOR_DEFS.forEach((fd, idx) => {
      // Octagonal holographic floor ring
      const ringGeo = new THREE.RingGeometry(3.2, 11.8 - idx * 0.45, 32, 2);
      ringGeo.rotateX(-Math.PI / 2);
      const edges = new THREE.EdgesGeometry(ringGeo);
      const wire = new THREE.LineSegments(edges, idx >= 4 ? goldWireMat : cyanWireMat);
      wire.position.set(0, fd.y, 0);
      towerGroup.add(wire);
      ringGeo.dispose();
    });

    // Central Citadel Energy Core Column + Connecting Data Filaments
    const filamentPositions: number[] = [];
    const filamentColors: number[] = [];
    const snapInit = computeTelemetrySnapshot();

    snapInit.roomNodes.forEach((rm, idx) => {
      const floorY = FLOOR_DEFS[rm.floor - 1]?.y || 0;
      const angle = ((idx % 8) / 8) * Math.PI * 2 + rm.floor * 0.35;
      const rad = 8.5 - (rm.floor - 1) * 0.35;
      const rx = Math.cos(angle) * rad;
      const rz = Math.sin(angle) * rad;

      // Connect each room node to central Citadel Core (0, floorY * 0.65, 0)
      filamentPositions.push(rx, floorY, rz, 0, floorY * 0.65, 0);

      const col =
        rm.occupancyStatus === 'occupied'
          ? rm.isVip
            ? new THREE.Color('#d4af37')
            : new THREE.Color('#00f0ff')
          : new THREE.Color('#00e676');
      filamentColors.push(col.r, col.g, col.b, col.r * 0.3, col.g * 0.3, col.b * 0.3);
    });

    const filamentGeo = new THREE.BufferGeometry();
    filamentGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(filamentPositions, 3)
    );
    filamentGeo.setAttribute('color', new THREE.Float32BufferAttribute(filamentColors, 3));
    const filamentMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const filamentLines = new THREE.LineSegments(filamentGeo, filamentMat);
    towerGroup.add(filamentLines);

    // -------------------------------------------------------------------------
    // 2. 50,000 INSTANCED BOKEH PARTICLES + TRUE OPTICAL DOF GLSL SHADER
    // -------------------------------------------------------------------------
    const baseQuad = new THREE.PlaneGeometry(1, 1);
    const instancedGeo = new THREE.InstancedBufferGeometry();
    instancedGeo.index = baseQuad.index;
    instancedGeo.attributes.position = baseQuad.attributes.position;
    instancedGeo.attributes.uv = baseQuad.attributes.uv;

    const offsets = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const seeds = new Float32Array(PARTICLE_COUNT * 3);

    const palette = [
      new THREE.Color('#d4af37'), // Brushed Citadel Gold
      new THREE.Color('#00f0ff'), // Electric Cyan
      new THREE.Color('#00e676'), // Emerald Ready
      new THREE.Color('#ff1e7a'), // Crimson SLA
      new THREE.Color('#ff9e2c'), // Warm Amber
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const floorSlot = i % 6;
      const floorY = FLOOR_DEFS[floorSlot].y;

      const angle = Math.random() * Math.PI * 2;
      const isCoreCluster = i < PARTICLE_COUNT * 0.8;
      const r = isCoreCluster
        ? 1.2 + Math.pow(Math.random(), 0.72) * 11.0
        : 11.5 + Math.random() * 17.0;

      const x = Math.cos(angle) * r + (Math.random() - 0.5) * 1.6;
      const z = Math.sin(angle) * r + (Math.random() - 0.5) * 1.6;
      const y = floorY + (Math.random() - 0.5) * 3.6;

      offsets[i * 3 + 0] = x;
      offsets[i * 3 + 1] = y;
      offsets[i * 3 + 2] = z;

      const c =
        floorSlot >= 4
          ? palette[i % 2 === 0 ? 0 : 4]
          : palette[i % palette.length];
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      seeds[i * 3 + 0] = Math.random() * Math.PI * 2;
      seeds[i * 3 + 1] = 0.5 + Math.random() * 1.25;
      seeds[i * 3 + 2] = floorSlot;
    }

    instancedGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    instancedGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    instancedGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));

    const bokehShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFocalDepth: { value: 35.0 },
        uAperture: { value: 0.095 },
        uSlaDrift: { value: 0.12 },
        uPulse: { value: 0.15 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aOffset;
        attribute vec3 aColor;
        attribute vec3 aSeed;

        uniform float uTime;
        uniform float uFocalDepth;
        uniform float uAperture;
        uniform float uSlaDrift;
        uniform float uPulse;

        varying vec3 vColor;
        varying vec2 vUv;
        varying float vCoc;

        void main() {
          vUv = uv;
          vColor = aColor;

          float phase = aSeed.x;
          float scaleSeed = aSeed.y;

          float freq = 0.55 + uSlaDrift * 2.2;
          vec3 animatedPos = aOffset;
          animatedPos.x += sin(uTime * freq + phase) * (0.28 + uSlaDrift * 0.9);
          animatedPos.z += cos(uTime * freq * 0.9 + phase) * (0.28 + uSlaDrift * 0.9);
          animatedPos.y += sin(uTime * 0.85 + phase * 1.7) * (0.14 + uPulse * 0.4);

          vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
          float viewDist = -mvPosition.z;

          // Optical Circle of Confusion (0 = razor-sharp 1.5px core, 1 = wide translucent bokeh ring)
          float depthDelta = abs(viewDist - uFocalDepth);
          vCoc = clamp(depthDelta * uAperture, 0.0, 1.0);

          float billboardSize = mix(0.14, 1.05, vCoc * vCoc) * scaleSeed * (1.0 + uPulse * 0.3);
          mvPosition.xy += position.xy * billboardSize;

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying vec2 vUv;
        varying float vCoc;

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;

          // Razor-sharp white-hot core near focal plane
          float sharpCore = smoothstep(0.45, 0.0, r);

          // Soft circular bokeh disc with smoothstep aperture ring falloff
          float softDisc = smoothstep(1.0, 0.64, r);
          float apertureRing = smoothstep(0.55, 0.86, r) * smoothstep(1.0, 0.88, r);
          float bokehProfile = softDisc * (0.34 + 0.66 * apertureRing);

          float intensity = mix(sharpCore, bokehProfile, vCoc);
          float alpha = mix(0.96, 0.22, vCoc) * intensity;

          vec3 finalCol = mix(vec3(1.0, 0.99, 0.96), vColor, smoothstep(0.0, 0.52, r + vCoc * 0.35));
          gl_FragColor = vec4(finalCol * (1.35 - vCoc * 0.45), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particleMesh = new THREE.Mesh(instancedGeo, bokehShaderMat);
    towerGroup.add(particleMesh);

    // Camera orbit controls
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let targetYaw = 0.65;
    let targetPitch = 0.28;
    let currentYaw = 0.65;
    let currentPitch = 0.28;
    let radius = 38;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
      recordInteraction();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      targetYaw -= (e.clientX - prevX) * 0.006;
      targetPitch = Math.max(-0.35, Math.min(0.85, targetPitch + (e.clientY - prevY) * 0.005));
      prevX = e.clientX;
      prevY = e.clientY;
      recordInteraction();
    };
    const onPointerUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      radius = Math.max(22, Math.min(62, radius + e.deltaY * 0.02));
      recordInteraction();
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: true });

    let rafId = 0;
    let lastFrameTime = performance.now();
    let frameCounter = 0;
    let fpsTimer = performance.now();
    const startTime = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);

      const citadelState = useCitadelStore.getState();
      if (!citadelState.citadelMode || citadelState.targetFps === 0) return;

      const minFrameInterval = 1000 / citadelState.targetFps;
      const elapsedSinceLast = now - lastFrameTime;
      if (elapsedSinceLast < minFrameInterval - 1) return;

      const dt = Math.min(0.1, elapsedSinceLast / 1000);
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
        targetYaw += dt * (0.12 + snap.slaDriftScore * 0.16);
      }

      currentYaw += (targetYaw - currentYaw) * 0.08;
      currentPitch += (targetPitch - currentPitch) * 0.08;

      camera.position.x = Math.sin(currentYaw) * Math.cos(currentPitch) * radius;
      camera.position.y = Math.sin(currentPitch) * radius;
      camera.position.z = Math.cos(currentYaw) * Math.cos(currentPitch) * radius;
      camera.lookAt(0, 0, 0);

      bokehShaderMat.uniforms.uTime.value = elapsedSec;
      bokehShaderMat.uniforms.uSlaDrift.value = snap.slaDriftScore;
      bokehShaderMat.uniforms.uPulse.value = snap.shaderPulseIntensity;
      bokehShaderMat.uniforms.uFocalDepth.value = focalRef.current;

      // Project 3D Floor Cluster Centroids to 2D Screen Coordinates
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      const nextLabels: ProjectedFloorLabel[] = FLOOR_DEFS.map((fd) => {
        const worldVec = new THREE.Vector3(8.5, fd.y, 0);
        worldVec.project(camera);
        const sx = (worldVec.x * 0.5 + 0.5) * w;
        const sy = (-(worldVec.y * 0.5) + 0.5) * h;
        return {
          floor: fd.floor,
          zone: fd.zone,
          sampleRoomNumber: fd.sampleRoom,
          x: sx,
          y: sy,
          visible:
            worldVec.z < 1.0 && sx > 60 && sx < w - 240 && sy > 80 && sy < h - 180,
        };
      });
      setLabels(nextLabels);

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
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      baseQuad.dispose();
      disposeThreeContextComplete(scene, renderer, postProcessor);
    };
  }, [recordInteraction]);

  return (
    <div className="relative w-full h-full bg-[#030305] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Top-Left Glassmorphic Telemetry Pill */}
      <div className="absolute top-20 left-6 pointer-events-none hud-glass rounded-2xl px-4 py-3 space-y-1">
        <div className="font-mono text-[10px] tracking-[0.2em] text-[#d4af37] uppercase">
          VIEW 01 // SECOND BRAIN • 50,000 INSTANCED BOKEH VAULT
        </div>
        <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
          <span className="text-white/90">
            OCCUPANCY: <strong className="text-[#00f0ff]">{telemetry.occupancyPercent}%</strong>
          </span>
          <span className="text-[#00e676]">READY: {telemetry.readyRooms}</span>
          <span className="text-[#ff1e7a]">SLA DRIFT: {telemetry.slaDriftScore.toFixed(3)}</span>
        </div>
      </div>

      {/* Floating Optical Depth-of-Field Plane Control */}
      <div className="absolute bottom-36 left-6 hud-glass rounded-full px-4 py-2 font-mono text-[11px] flex items-center gap-3">
        <span className="text-white/55 uppercase tracking-wider">Optical Focal Plane</span>
        <input
          type="range"
          min={18}
          max={54}
          step={0.5}
          value={focalDistance}
          onChange={(e) => {
            const val = Number(e.target.value);
            setFocalDistance(val);
            focalRef.current = val;
          }}
          className="w-28 accent-[#d4af37] cursor-pointer"
        />
        <span className="text-[#d4af37] tabular-nums">{focalDistance.toFixed(1)}m</span>
      </div>

      {/* 0.5px SVG Leader Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {labels.map(
          (lbl) =>
            lbl.visible && (
              <g key={lbl.floor}>
                <circle cx={lbl.x} cy={lbl.y} r={2.5} fill="#d4af37" />
                <polyline
                  points={`${lbl.x},${lbl.y} ${lbl.x + 22},${lbl.y - 14} ${lbl.x + 56},${lbl.y - 14}`}
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="0.5"
                  strokeOpacity="0.85"
                />
              </g>
            )
        )}
      </svg>

      {/* Projected Floating Glass Callout Tags */}
      {labels.map((lbl) => {
        if (!lbl.visible) return null;
        const floorRooms = rooms.filter((r) => r.floor === lbl.floor);
        const occCount = floorRooms.filter((r) => r.occupancyStatus === 'occupied').length;
        const readyCount = floorRooms.filter(isRoomReady).length;
        return (
          <button
            key={lbl.floor}
            onClick={() => setSelectedRoomNumber(lbl.sampleRoomNumber)}
            style={{
              transform: `translate3d(${Math.round(lbl.x + 58)}px, ${Math.round(lbl.y - 26)}px, 0)`,
            }}
            className="absolute top-0 left-0 px-3 py-1.5 rounded-xl hud-glass hover:border-[#d4af37] text-left font-mono transition group"
          >
            <div className="text-[10px] tracking-[0.12em] text-[#d4af37] font-semibold flex items-center gap-2">
              <span>{lbl.zone}</span>
              <span className="text-[#00f0ff] tabular-nums">{occCount}/8 OCC</span>
            </div>
            <div className="text-[9px] text-white/55 group-hover:text-white tabular-nums">
              {readyCount} Certified Ready • Click to Inspect
            </div>
          </button>
        );
      })}

      {/* Floating Glassmorphic Room Control Drawer */}
      {selectedRoomObj && (
        <div className="absolute top-20 right-6 bottom-36 w-80 hud-glass rounded-3xl p-5 flex flex-col justify-between font-mono text-xs z-20">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="text-[10px] text-[#d4af37] tracking-[0.18em]">
                  SPATIAL SUITE TELEMETRY
                </div>
                <div className="font-serif text-2xl text-white font-normal mt-0.5">
                  Suite {selectedRoomObj.roomNumber}
                </div>
              </div>
              <button
                onClick={() => setSelectedRoomNumber(null)}
                className="px-2.5 py-1 rounded-full bg-white/10 text-white/70 hover:text-white text-[10px]"
              >
                ESC
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {rooms
                .filter((r) => r.floor === selectedRoomObj.floor)
                .map((r) => (
                  <button
                    key={r.roomNumber}
                    onClick={() => setSelectedRoomNumber(r.roomNumber)}
                    className={`py-1.5 rounded-xl text-[10px] transition ${
                      r.roomNumber === selectedRoomObj.roomNumber
                        ? 'bg-[#d4af37] text-[#030305] font-bold'
                        : 'bg-white/[0.04] text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {r.roomNumber}
                  </button>
                ))}
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-white/45">TIER:</span>
                <span className="text-[#d4af37]">{selectedRoomObj.roomType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/45">OCCUPANCY:</span>
                <span className="text-[#00f0ff] uppercase">{selectedRoomObj.occupancyStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/45">HOUSEKEEPING:</span>
                <span className="text-[#ff9e2c] uppercase">
                  {selectedRoomObj.housekeepingStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/45">RESIDENT:</span>
                <span className="text-white truncate max-w-[140px]">
                  {selectedRoomObj.currentGuestName || 'VACANT'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-white/70">
                HVAC: <strong className="text-[#00f0ff]">{selectedRoomObj.hvacTempC}°C</strong>
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() =>
                    setRoomHvacTemp(selectedRoomObj.roomNumber, selectedRoomObj.hvacTempC - 0.5)
                  }
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  -0.5
                </button>
                <button
                  onClick={() =>
                    setRoomHvacTemp(selectedRoomObj.roomNumber, selectedRoomObj.hvacTempC + 0.5)
                  }
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                >
                  +0.5
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-white/10">
            {selectedRoomObj.occupancyStatus === 'occupied' && (
              <button
                onClick={() => checkOutRoom(selectedRoomObj.roomNumber)}
                className="w-full py-2.5 rounded-xl bg-[#ff9e2c] text-[#030305] font-bold uppercase text-[10px] tracking-wider"
              >
                Check Out & Flag Turnover
              </button>
            )}
            {selectedRoomObj.housekeepingStatus !== 'clean' && (
              <button
                onClick={() => markCleaningFinishedAwaitingInspection(selectedRoomObj.roomNumber)}
                className="w-full py-2.5 rounded-xl bg-[#00f0ff] text-[#030305] font-bold uppercase text-[10px] tracking-wider"
              >
                Mark Cleaning Done
              </button>
            )}
            {selectedRoomObj.inspectionStatus !== 'passed' && (
              <button
                onClick={() => inspectRoomVerdict(selectedRoomObj.roomNumber, 'passed')}
                className="w-full py-2.5 rounded-xl bg-[#00e676] text-[#030305] font-bold uppercase text-[10px] tracking-wider"
              >
                Supervisor Pass Ready
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
