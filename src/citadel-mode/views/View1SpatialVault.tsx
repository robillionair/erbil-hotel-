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
  { floor: 1, zone: 'FLOOR_01_LOBBY', y: -12.5, sampleRoom: '102' },
  { floor: 2, zone: 'FLOOR_02_EXEC', y: -7.5, sampleRoom: '201' },
  { floor: 3, zone: 'FLOOR_03_GALLERY', y: -2.5, sampleRoom: '301' },
  { floor: 4, zone: 'FLOOR_04_MERIDIAN', y: 2.5, sampleRoom: '401' },
  { floor: 5, zone: 'FLOOR_05_DIPLOMATIC', y: 7.5, sampleRoom: '501' },
  { floor: 6, zone: 'FLOOR_06_PENTHOUSE', y: 12.5, sampleRoom: '601' },
];

export const View1SpatialVault: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const telemetry = useErbilTelemetry();
  const { selectedRoomNumber, setSelectedRoomNumber, recordInteraction } = useCitadelStore();
  const { rooms, checkOutRoom, markCleaningFinishedAwaitingInspection, inspectRoomVerdict, setRoomHvacTemp } =
    useHotelOpsStore();

  const [labels, setLabels] = useState<ProjectedFloorLabel[]>([]);
  const [focalDistance, setFocalDistance] = useState<number>(36.0);

  const selectedRoomObj = rooms.find((r) => r.roomNumber === selectedRoomNumber) || null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030305');

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 250);
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
    // 1. WIREFRAME ARCHITECTURAL TOWER (6 FLOORS L1-L6 + VERTICAL COLUMNS)
    // -------------------------------------------------------------------------
    const towerGroup = new THREE.Group();
    scene.add(towerGroup);

    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#283044'),
      transparent: true,
      opacity: 0.55,
    });
    const goldWireMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#d4af37'),
      transparent: true,
      opacity: 0.42,
    });

    FLOOR_DEFS.forEach((fd, idx) => {
      const slabGeo = new THREE.BoxGeometry(18 - idx * 0.4, 0.35, 12 - idx * 0.25);
      const edges = new THREE.EdgesGeometry(slabGeo);
      const slabWire = new THREE.LineSegments(edges, idx >= 4 ? goldWireMat : lineMat);
      slabWire.position.set(0, fd.y, 0);
      towerGroup.add(slabWire);
      slabGeo.dispose();
    });

    // Core spine & perimeter architectural pillars
    const spineGeo = new THREE.CylinderGeometry(2.2, 2.8, 30, 8, 6, true);
    const spineEdges = new THREE.EdgesGeometry(spineGeo);
    const spineWire = new THREE.LineSegments(spineEdges, lineMat);
    towerGroup.add(spineWire);
    spineGeo.dispose();

    // -------------------------------------------------------------------------
    // 2. 50,000 INSTANCED BUFFER GEOMETRY PARTICLES + CUSTOM DOF BOKEH SHADER
    // -------------------------------------------------------------------------
    const baseQuad = new THREE.PlaneGeometry(1, 1);
    const instancedGeo = new THREE.InstancedBufferGeometry();
    instancedGeo.index = baseQuad.index;
    instancedGeo.attributes.position = baseQuad.attributes.position;
    instancedGeo.attributes.uv = baseQuad.attributes.uv;

    const offsets = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const seeds = new Float32Array(PARTICLE_COUNT * 3); // [phase, radiusScale, floorIdx]

    const palette = [
      new THREE.Color('#d4af37'), // Citadel Gold
      new THREE.Color('#00f0ff'), // Occupied Cyan
      new THREE.Color('#00e676'), // Ready Emerald
      new THREE.Color('#ff1e7a'), // Urgent Turnover Magenta
      new THREE.Color('#ff8a3d'), // VIP Amber
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const floorSlot = i % 6;
      const floorY = FLOOR_DEFS[floorSlot].y;

      const angle = Math.random() * Math.PI * 2;
      const isCoreCluster = i < PARTICLE_COUNT * 0.78;
      const r = isCoreCluster
        ? 1.5 + Math.pow(Math.random(), 0.75) * 10.5
        : 11.0 + Math.random() * 16.0;

      const x = Math.cos(angle) * r + (Math.random() - 0.5) * 1.8;
      const z = Math.sin(angle) * (r * 0.72) + (Math.random() - 0.5) * 1.8;
      const y = floorY + (Math.random() - 0.5) * 3.8;

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
      seeds[i * 3 + 1] = 0.45 + Math.random() * 1.15;
      seeds[i * 3 + 2] = floorSlot;
    }

    instancedGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    instancedGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    instancedGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));

    const bokehShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFocalDepth: { value: 36.0 },
        uAperture: { value: 0.085 },
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
        varying float vCoc; // Circle of Confusion (0 = razor-sharp focal plane, 1 = wide bokeh disc)

        void main() {
          vUv = uv;
          vColor = aColor;

          float phase = aSeed.x;
          float scaleSeed = aSeed.y;

          // Subtle curl-like orbital drift modulated by SLA Drift Score
          float freq = 0.55 + uSlaDrift * 2.4;
          vec3 animatedPos = aOffset;
          animatedPos.x += sin(uTime * freq + phase) * (0.28 + uSlaDrift * 0.95);
          animatedPos.z += cos(uTime * freq * 0.9 + phase) * (0.28 + uSlaDrift * 0.95);
          animatedPos.y += sin(uTime * 0.8 + phase * 1.7) * (0.12 + uPulse * 0.35);

          vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
          float viewDist = -mvPosition.z;

          // Optical Depth-of-Field Circle of Confusion calculation
          float depthDelta = abs(viewDist - uFocalDepth);
          vCoc = clamp(depthDelta * uAperture, 0.0, 1.0);

          // Near focal plane = razor-sharp ~0.14 world units; Out of focus = soft circular bokeh disc
          float billboardSize = mix(0.13, 0.92, vCoc * vCoc) * scaleSeed * (1.0 + uPulse * 0.25);

          // Camera-facing billboard expansion in view space
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
          float sharpCore = smoothstep(0.48, 0.0, r);

          // Optical Bokeh Disc with subtle bright perimeter ring when out of focus
          float softDisc = smoothstep(1.0, 0.62, r);
          float apertureRing = smoothstep(0.58, 0.86, r) * smoothstep(1.0, 0.88, r);
          float bokehProfile = softDisc * (0.38 + 0.62 * apertureRing);

          float intensity = mix(sharpCore, bokehProfile, vCoc);
          float alpha = mix(0.95, 0.24, vCoc) * intensity;

          vec3 finalCol = mix(vec3(1.0, 0.99, 0.95), vColor, smoothstep(0.0, 0.55, r + vCoc * 0.35));
          gl_FragColor = vec4(finalCol * (1.25 - vCoc * 0.45), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particleMesh = new THREE.Mesh(instancedGeo, bokehShaderMat);
    towerGroup.add(particleMesh);

    // -------------------------------------------------------------------------
    // 3. INTERACTIVE CAMERA ORBIT & SMART FRAME THROTTLER LOOP
    // -------------------------------------------------------------------------
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
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      targetYaw -= dx * 0.006;
      targetPitch = Math.max(-0.35, Math.min(0.85, targetPitch + dy * 0.005));
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
        targetYaw += dt * (0.12 + snap.slaDriftScore * 0.18);
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
      bokehShaderMat.uniforms.uFocalDepth.value = radius - 2.5;

      // Project 3D Floor Cluster Centroids to 2D Screen Coordinates for HUD Callout Tags
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      const nextLabels: ProjectedFloorLabel[] = FLOOR_DEFS.map((fd) => {
        const worldVec = new THREE.Vector3(7.2, fd.y, 0);
        worldVec.project(camera);
        const sx = (worldVec.x * 0.5 + 0.5) * w;
        const sy = (-(worldVec.y * 0.5) + 0.5) * h;
        return {
          floor: fd.floor,
          zone: fd.zone,
          sampleRoomNumber: fd.sampleRoom,
          x: sx,
          y: sy,
          visible: worldVec.z < 1.0 && sx > 40 && sx < w - 160 && sy > 30 && sy < h - 30,
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
      domElem.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      baseQuad.dispose();
      disposeThreeContextComplete(scene, renderer, postProcessor);
    };
  }, [recordInteraction]);

  return (
    <div className="relative w-full h-full bg-[#030305] overflow-hidden select-none">
      {/* WebGL Viewport Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Optical DoF & Telemetry Overlay */}
      <div className="absolute top-3 left-3 pointer-events-none space-y-1 font-mono">
        <div className="text-[9px] tracking-[0.18em] text-[#686875] uppercase">
          VIEW 01 // SECOND BRAIN: 3D SPATIAL HOTEL VAULT (50,000 INSTANCED BOKEH NODES)
        </div>
        <div className="flex items-center gap-3 text-[11px] tabular-nums">
          <span className="text-[#d4af37]">
            OCCUPANCY: {telemetry.occupiedRooms}/{telemetry.totalRooms} ({telemetry.occupancyPercent}%)
          </span>
          <span className="text-[#00e676]">READY: {telemetry.readyRooms}</span>
          <span className="text-[#ff1e7a]">SLA DRIFT: {telemetry.slaDriftScore.toFixed(3)}</span>
        </div>
      </div>

      {/* Bottom-Left Optical Focus Slider */}
      <div className="absolute bottom-3 left-3 bg-[#040406]/90 border border-[#16161a] px-3 py-2 font-mono text-[10px] flex items-center gap-3">
        <span className="text-[#686875] uppercase tracking-wider">OPTICAL DOF PLANE:</span>
        <input
          type="range"
          min={18}
          max={54}
          step={0.5}
          value={focalDistance}
          onChange={(e) => setFocalDistance(Number(e.target.value))}
          className="w-24 accent-[#d4af37]"
        />
        <span className="text-[#d4af37] tabular-nums">{focalDistance.toFixed(1)}m</span>
      </div>

      {/* 3D-to-2D Projected HUD Callout Labels with 0.5px SVG Leader Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {labels.map(
          (lbl) =>
            lbl.visible && (
              <g key={lbl.floor}>
                <circle cx={lbl.x} cy={lbl.y} r={2.2} fill="#d4af37" />
                <polyline
                  points={`${lbl.x},${lbl.y} ${lbl.x + 18},${lbl.y - 12} ${lbl.x + 48},${lbl.y - 12}`}
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="0.5"
                  strokeOpacity="0.75"
                />
              </g>
            )
        )}
      </svg>

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
              transform: `translate3d(${Math.round(lbl.x + 50)}px, ${Math.round(lbl.y - 22)}px, 0)`,
            }}
            className="absolute top-0 left-0 px-2 py-1 bg-[#040406]/90 hover:bg-[#101018] border border-[#24242e] hover:border-[#d4af37] text-left font-mono transition group"
          >
            <div className="text-[9px] tracking-[0.14em] text-[#d4af37] font-bold flex items-center gap-1.5">
              <span>{lbl.zone}</span>
              <span className="text-[#00f0ff]">[{occCount}/8 OCC]</span>
            </div>
            <div className="text-[8px] text-[#888895] group-hover:text-[#f4f0ea] tabular-nums">
              READY: {readyCount} // CLICK TO CONTROL FLOOR
            </div>
          </button>
        );
      })}

      {/* Interactive Room Control Drawer */}
      {selectedRoomObj && (
        <div className="absolute top-3 right-3 bottom-3 w-80 bg-[#040406]/95 border border-[#262632] p-4 flex flex-col justify-between font-mono text-xs z-20">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#16161a] pb-2.5">
              <div>
                <div className="text-[9px] text-[#d4af37] tracking-[0.18em]">
                  LIVE ROOM CONTROL DRAWER
                </div>
                <div className="text-base font-bold text-[#f4f0ea]">
                  SUITE {selectedRoomObj.roomNumber} // {selectedRoomObj.floorZone}
                </div>
              </div>
              <button
                onClick={() => setSelectedRoomNumber(null)}
                className="px-2 py-0.5 bg-[#12121a] border border-[#282834] text-[#888895] hover:text-[#f4f0ea]"
              >
                ESC
              </button>
            </div>

            {/* Floor Room Switcher */}
            <div>
              <div className="text-[9px] text-[#686875] uppercase mb-1">
                SWITCH SUITE ON FLOOR {selectedRoomObj.floor}:
              </div>
              <div className="grid grid-cols-4 gap-1">
                {rooms
                  .filter((r) => r.floor === selectedRoomObj.floor)
                  .map((r) => (
                    <button
                      key={r.roomNumber}
                      onClick={() => setSelectedRoomNumber(r.roomNumber)}
                      className={`py-1 text-[10px] border ${
                        r.roomNumber === selectedRoomObj.roomNumber
                          ? 'bg-[#d4af37] text-[#030305] border-[#d4af37] font-bold'
                          : 'bg-[#08080c] text-[#9898a6] border-[#1c1c24]'
                      }`}
                    >
                      {r.roomNumber}
                    </button>
                  ))}
              </div>
            </div>

            <div className="p-2.5 bg-[#08080c] border border-[#16161a] space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#686875]">TYPE / RATE:</span>
                <span className="text-[#d4af37]">
                  {selectedRoomObj.roomType} ({selectedRoomObj.baseRateIqd.toLocaleString()} IQD)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#686875]">OCCUPANCY:</span>
                <span className="text-[#00f0ff] uppercase">{selectedRoomObj.occupancyStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#686875]">HOUSEKEEPING:</span>
                <span className="text-[#ff8a3d] uppercase">
                  {selectedRoomObj.housekeepingStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#686875]">INSPECTION:</span>
                <span className="text-[#00e676] uppercase">{selectedRoomObj.inspectionStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#686875]">RESIDENT:</span>
                <span className="text-[#f4f0ea] truncate max-w-[150px]">
                  {selectedRoomObj.currentGuestName || 'VACANT'}
                </span>
              </div>
            </div>

            {/* HVAC Setpoint */}
            <div className="p-2.5 bg-[#08080c] border border-[#16161a] flex items-center justify-between">
              <span className="text-[10px] text-[#888895]">
                HVAC TEMP: <strong className="text-[#00f0ff]">{selectedRoomObj.hvacTempC}°C</strong>
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    setRoomHvacTemp(selectedRoomObj.roomNumber, selectedRoomObj.hvacTempC - 0.5)
                  }
                  className="px-2 py-0.5 bg-[#12121a] border border-[#282834]"
                >
                  -0.5
                </button>
                <button
                  onClick={() =>
                    setRoomHvacTemp(selectedRoomObj.roomNumber, selectedRoomObj.hvacTempC + 0.5)
                  }
                  className="px-2 py-0.5 bg-[#12121a] border border-[#282834]"
                >
                  +0.5
                </button>
              </div>
            </div>
          </div>

          {/* 1-Click Operational Dispatch Actions */}
          <div className="space-y-1.5 pt-3 border-t border-[#16161a]">
            {selectedRoomObj.occupancyStatus === 'occupied' && (
              <button
                onClick={() => checkOutRoom(selectedRoomObj.roomNumber)}
                className="w-full py-2 bg-[#ff8a3d] text-[#030305] font-bold uppercase text-[10px] tracking-wider"
              >
                CHECK OUT GUEST & FLAG TURNOVER
              </button>
            )}
            {selectedRoomObj.housekeepingStatus !== 'clean' && (
              <button
                onClick={() => markCleaningFinishedAwaitingInspection(selectedRoomObj.roomNumber)}
                className="w-full py-2 bg-[#00f0ff] text-[#030305] font-bold uppercase text-[10px] tracking-wider"
              >
                MARK CLEANING DONE (QUEUE INSPECT)
              </button>
            )}
            {selectedRoomObj.inspectionStatus !== 'passed' && (
              <button
                onClick={() => inspectRoomVerdict(selectedRoomObj.roomNumber, 'passed')}
                className="w-full py-2 bg-[#00e676] text-[#030305] font-bold uppercase text-[10px] tracking-wider"
              >
                SUPERVISOR PASS (CERTIFY READY)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
