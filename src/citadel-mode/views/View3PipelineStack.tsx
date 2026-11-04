import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createCitadelPostProcessor,
  disposeThreeContextComplete,
} from '../postprocessing/CitadelPostProcessor';
import { useErbilTelemetry, computeTelemetrySnapshot } from '../telemetry/ErbilTelemetryStream';
import { useCitadelStore } from '../../store/useCitadelStore';
import { useHotelOpsStore, isRoomReady } from '../../store/useHotelOpsStore';
import { useAuthStore } from '../../store/useAuthStore';

const PARTICLE_COUNT = 20000;

const ProgressRingSvg: React.FC<{ percent: number; color: string }> = ({ percent, color }) => {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(5, percent)) / 100) * circumference;

  return (
    <svg className="w-8 h-8 -rotate-90 shrink-0">
      <circle
        cx="16"
        cy="16"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="2.2"
      />
      <circle
        cx="16"
        cy="16"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
};

export const View3PipelineStack: React.FC = () => {
  const bgCanvasRef = useRef<HTMLDivElement | null>(null);
  const telemetry = useErbilTelemetry();
  const { recordInteraction, triggerShaderPulse } = useCitadelStore();
  const { user } = useAuthStore();
  const role = user?.role || 'executive';

  const {
    rooms,
    housekeepingTasks,
    roomServiceOrders,
    maintenanceTickets,
    checkOutRoom,
    markCleaningFinishedAwaitingInspection,
    inspectRoomVerdict,
    advanceRoomServiceStatus,
    updateMaintenanceTicketStatus,
  } = useHotelOpsStore();

  useEffect(() => {
    const container = bgCanvasRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030305');

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 220);
    camera.position.set(0, 2, 36);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const postProcessor = createCitadelPostProcessor(renderer, scene, camera, width, height);

    const splineGroup = new THREE.Group();
    scene.add(splineGroup);

    // 8 Volumetric Neon Spline Conduits weaving through the 4 Holographic Planes
    const splineColors = ['#00f0ff', '#d4af37', '#00e676', '#ff1e7a'];
    for (let s = 0; s < 8; s++) {
      const yBase = (s - 3.5) * 2.6;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-28, yBase, -6),
        new THREE.Vector3(-9, yBase + (s % 2 === 0 ? 3.2 : -3.2), 2),
        new THREE.Vector3(9, yBase + (s % 2 === 0 ? -3.2 : 3.2), 2),
        new THREE.Vector3(28, yBase, -6),
      ]);
      const pts = curve.getPoints(100);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(splineColors[s % splineColors.length]),
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
      });
      splineGroup.add(new THREE.Line(geo, mat));
    }

    // 20,000 Flowing Pipeline Particles
    const posArr = new Float32Array(PARTICLE_COUNT * 3);
    const colArr = new Float32Array(PARTICLE_COUNT * 3);
    const seedArr = new Float32Array(PARTICLE_COUNT * 3);

    const cPalette = splineColors.map((hex) => new THREE.Color(hex));

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      posArr[i * 3 + 0] = (Math.random() - 0.5) * 58;
      posArr[i * 3 + 1] = (Math.random() - 0.5) * 24;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 14 - 3;

      seedArr[i * 3 + 0] = 4.0 + Math.random() * 10.0; // velocity
      seedArr[i * 3 + 1] = Math.random() * Math.PI * 2; // wave phase
      seedArr[i * 3 + 2] = 0.7 + Math.random() * 1.4; // size

      const c = cPalette[i % cPalette.length];
      colArr[i * 3 + 0] = c.r;
      colArr[i * 3 + 1] = c.g;
      colArr[i * 3 + 2] = c.b;
    }

    const partGeo = new THREE.BufferGeometry();
    partGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    partGeo.setAttribute('aColor', new THREE.BufferAttribute(colArr, 3));
    partGeo.setAttribute('aSeed', new THREE.BufferAttribute(seedArr, 3));

    const partMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uPulse: { value: 0.15 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uPulse;
        uniform float uPixelRatio;

        varying vec3 vColor;

        void main() {
          vColor = aColor;
          float speed = aSeed.x * (1.0 + uPulse * 1.6);
          float phase = aSeed.y;

          vec3 p = position;
          p.x = mod(p.x + 29.0 + uTime * speed, 58.0) - 29.0;
          p.y += sin(p.x * 0.22 + uTime * 1.8 + phase) * 1.35;
          p.z += cos(p.x * 0.18 + uTime * 1.4 + phase) * 1.2;

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 1.65 * aSeed.z * uPixelRatio * (32.0 / max(10.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(p, p);
          if (r2 > 1.0) discard;
          float glow = exp(-r2 * 3.5);
          gl_FragColor = vec4(vColor * 1.25, glow * 0.72);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    scene.add(new THREE.Points(partGeo, partMat));

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

      partMat.uniforms.uTime.value = elapsedSec;
      partMat.uniforms.uPulse.value = snap.shaderPulseIntensity;
      splineGroup.rotation.x = Math.sin(elapsedSec * 0.5) * 0.08;

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

  const occupiedList = rooms.filter((r) => r.occupancyStatus === 'occupied').slice(0, 4);
  const readyCount = rooms.filter(isRoomReady).length;

  return (
    <div
      onMouseMove={recordInteraction}
      className="relative w-full h-full bg-[#030305] overflow-hidden select-none"
    >
      {/* Full-Screen WebGL Volumetric Splines & 20,000 Particle Pipes */}
      <div ref={bgCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Top View Title Pill */}
      <div className="absolute top-20 left-6 z-10 pointer-events-none hud-glass rounded-2xl px-4 py-2.5">
        <div className="font-mono text-[10px] tracking-[0.2em] text-[#d4af37] uppercase">
          VIEW 03 // PIPELINE STACK • 20,000 PARTICLE PIPES & 3D HOLOGRAPHIC EXECUTION PLANES
        </div>
      </div>

      {/* 4 TILTED 3D HOLOGRAPHIC EXECUTION PLANES */}
      <div
        className="relative z-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 px-6 pt-36 pb-36 h-full overflow-y-auto"
        style={{ perspective: '1400px' }}
      >
        {/* PLANE [01]: ARRIVAL & CHECK-IN */}
        <div className="space-y-3.5">
          <div className="hud-glass rounded-2xl px-4 py-3 border-t border-[#00f0ff]/50 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-[#00f0ff] tracking-wider">
              01 // ARRIVAL & IN-HOUSE
            </span>
            <span className="font-mono text-[11px] text-[#00e676] tabular-nums">
              {readyCount} Ready
            </span>
          </div>

          {occupiedList.map((rm) => (
            <div
              key={rm.roomNumber}
              style={{
                transform: 'rotateX(14deg) rotateY(-12deg)',
                transformStyle: 'preserve-3d',
              }}
              className="rounded-2xl hud-glass p-4 border border-[#00f0ff]/35 hover:border-[#d4af37] transition-all duration-300 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-[#00f0ff]">
                    SUITE {rm.roomNumber}
                  </div>
                  <div className="text-sm font-medium text-white truncate max-w-[160px]">
                    {rm.currentGuestName}
                  </div>
                </div>
                <ProgressRingSvg percent={88} color="#00f0ff" />
              </div>
              <div className="font-mono text-[10px] text-white/50">
                {rm.roomType} • {rm.baseRateIqd.toLocaleString()} IQD
              </div>
              <button
                onClick={() => {
                  triggerShaderPulse(1.25);
                  checkOutRoom(rm.roomNumber);
                }}
                className="w-full py-2 rounded-xl bg-[#00f0ff]/15 hover:bg-[#00f0ff] text-[#00f0ff] hover:text-[#030305] border border-[#00f0ff]/40 font-mono text-[10px] font-semibold uppercase tracking-wider transition"
              >
                Check Out → Turnover
              </button>
            </div>
          ))}
        </div>

        {/* PLANE [02]: HOUSEKEEPING TURNOVER */}
        <div className="space-y-3.5">
          <div className="hud-glass rounded-2xl px-4 py-3 border-t border-[#d4af37]/50 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-[#d4af37] tracking-wider">
              02 // HOUSEKEEPING TURNOVER
            </span>
            <span className="font-mono text-[11px] text-[#d4af37] tabular-nums">
              {housekeepingTasks.length} Active
            </span>
          </div>

          {housekeepingTasks.slice(0, 4).map((task) => (
            <div
              key={task.id}
              style={{
                transform: 'rotateX(14deg) rotateY(-12deg)',
                transformStyle: 'preserve-3d',
              }}
              className="rounded-2xl hud-glass p-4 border border-[#d4af37]/35 hover:border-[#00e676] transition-all duration-300 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-[#d4af37]">
                    SUITE {task.roomNumber}
                  </div>
                  <div className="text-xs text-white/90">{task.taskType}</div>
                </div>
                <ProgressRingSvg
                  percent={Math.min(100, task.slaMinutesRemaining * 4)}
                  color="#d4af37"
                />
              </div>
              <div className="font-mono text-[10px] text-white/50">
                SLA Window: {task.slaMinutesRemaining}m • {task.status}
              </div>
              {task.status !== 'awaiting_inspection' ? (
                <button
                  onClick={() => {
                    triggerShaderPulse(1.2);
                    markCleaningFinishedAwaitingInspection(task.roomNumber);
                  }}
                  className="w-full py-2 rounded-xl bg-[#d4af37]/15 hover:bg-[#d4af37] text-[#d4af37] hover:text-[#030305] border border-[#d4af37]/40 font-mono text-[10px] font-semibold uppercase tracking-wider transition"
                >
                  Complete Clean → Inspect
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                  <button
                    onClick={() => {
                      triggerShaderPulse(1.3);
                      inspectRoomVerdict(task.roomNumber, 'passed');
                    }}
                    className="py-1.5 rounded-xl bg-[#00e676]/20 hover:bg-[#00e676] text-[#00e676] hover:text-[#030305] border border-[#00e676]/50 font-semibold"
                  >
                    ✓ Pass Ready
                  </button>
                  <button
                    onClick={() => {
                      triggerShaderPulse(1.3);
                      inspectRoomVerdict(task.roomNumber, 'failed');
                    }}
                    className="py-1.5 rounded-xl bg-[#ff1e7a]/20 hover:bg-[#ff1e7a] text-[#ff1e7a] hover:text-white border border-[#ff1e7a]/50 font-semibold"
                  >
                    ✕ Fail
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* PLANE [03]: IN-SUITE DINING */}
        <div className="space-y-3.5">
          <div className="hud-glass rounded-2xl px-4 py-3 border-t border-[#00e676]/50 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-[#00e676] tracking-wider">
              03 // IN-SUITE DINING
            </span>
            <span className="font-mono text-[11px] text-[#00e676] tabular-nums">
              {roomServiceOrders.length} Orders
            </span>
          </div>

          {roomServiceOrders.map((ord) => (
            <div
              key={ord.id}
              style={{
                transform: 'rotateX(14deg) rotateY(-12deg)',
                transformStyle: 'preserve-3d',
              }}
              className="rounded-2xl hud-glass p-4 border border-[#00e676]/35 hover:border-[#d4af37] transition-all duration-300 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-[#00e676]">
                    SUITE {ord.roomNumber}
                  </div>
                  <div className="text-xs text-white truncate max-w-[150px]">{ord.guestName}</div>
                </div>
                <ProgressRingSvg
                  percent={
                    ord.status === 'queued' ? 35 : ord.status === 'preparing' ? 68 : 94
                  }
                  color="#00e676"
                />
              </div>
              <div className="font-mono text-[10px] text-[#d4af37] tabular-nums">
                {ord.totalIqd.toLocaleString()} IQD (${ord.totalUsd}) • {ord.status.toUpperCase()}
              </div>
              <button
                onClick={() => {
                  triggerShaderPulse(1.2);
                  advanceRoomServiceStatus(ord.id);
                }}
                className="w-full py-2 rounded-xl bg-[#00e676]/15 hover:bg-[#00e676] text-[#00e676] hover:text-[#030305] border border-[#00e676]/40 font-mono text-[10px] font-semibold uppercase tracking-wider transition"
              >
                Advance Stage →
              </button>
            </div>
          ))}
        </div>

        {/* PLANE [04]: ENGINEERING SLA */}
        <div className="space-y-3.5">
          <div className="hud-glass rounded-2xl px-4 py-3 border-t border-[#ff1e7a]/50 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-[#ff1e7a] tracking-wider">
              04 // ENGINEERING SLA
            </span>
            <span className="font-mono text-[11px] text-[#ff1e7a] tabular-nums">
              {maintenanceTickets.length} Tickets
            </span>
          </div>

          {maintenanceTickets.map((tkt) => (
            <div
              key={tkt.id}
              style={{
                transform: 'rotateX(14deg) rotateY(-12deg)',
                transformStyle: 'preserve-3d',
              }}
              className="rounded-2xl hud-glass p-4 border border-[#ff1e7a]/35 hover:border-[#00f0ff] transition-all duration-300 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-[#ff1e7a]">
                    SUITE {tkt.roomNumber}
                  </div>
                  <div className="text-xs text-white font-medium">{tkt.problemType}</div>
                </div>
                <ProgressRingSvg
                  percent={tkt.status === 'fixed_awaiting_check' ? 88 : 45}
                  color="#ff1e7a"
                />
              </div>
              <div className="text-[11px] text-white/55 line-clamp-1">{tkt.note}</div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                <button
                  onClick={() => {
                    triggerShaderPulse(1.2);
                    updateMaintenanceTicketStatus(tkt.id, 'fixed_awaiting_check', role);
                  }}
                  className="py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-400 text-emerald-200 hover:text-[#030305] border border-emerald-400/40 font-semibold"
                >
                  Mark Fixed
                </button>
                <button
                  onClick={() => {
                    triggerShaderPulse(1.35);
                    updateMaintenanceTicketStatus(tkt.id, 'checked_ok', 'executive');
                  }}
                  className="py-1.5 rounded-xl bg-[#00e676]/20 hover:bg-[#00e676] text-[#00e676] hover:text-[#030305] border border-[#00e676]/50 font-semibold"
                >
                  Checked — OK
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
