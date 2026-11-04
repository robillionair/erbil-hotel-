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

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 200);
    camera.position.set(0, 2, 34);
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
    postProcessor.bloomPass.strength = 1.05;

    // 4 Glowing Neon Spline Pipes Linking Workflow Columns [01] -> [02] -> [03] -> [04]
    const splineGroup = new THREE.Group();
    scene.add(splineGroup);

    const splineColors = ['#00f0ff', '#d4af37', '#00e676', '#ff1e7a'];
    for (let s = 0; s < 4; s++) {
      const yBase = (s - 1.5) * 4.2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-24, yBase, -4),
        new THREE.Vector3(-8, yBase + (s % 2 === 0 ? 2.5 : -2.5), 1),
        new THREE.Vector3(8, yBase + (s % 2 === 0 ? -2.5 : 2.5), 1),
        new THREE.Vector3(24, yBase, -4),
      ]);
      const pts = curve.getPoints(90);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(splineColors[s]),
        transparent: true,
        opacity: 0.45,
      });
      const line = new THREE.Line(geo, mat);
      splineGroup.add(line);
    }

    // 6,000 Particle Burst Stream Flowing Across the 4 Workflow Columns
    const particleCount = 6000;
    const posArr = new Float32Array(particleCount * 3);
    const colArr = new Float32Array(particleCount * 3);
    const velArr = new Float32Array(particleCount);

    const cPalette = splineColors.map((hex) => new THREE.Color(hex));

    for (let i = 0; i < particleCount; i++) {
      posArr[i * 3 + 0] = (Math.random() - 0.5) * 52;
      posArr[i * 3 + 1] = (Math.random() - 0.5) * 24;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
      velArr[i] = 4.5 + Math.random() * 9.0;

      const c = cPalette[i % cPalette.length];
      colArr[i * 3 + 0] = c.r;
      colArr[i * 3 + 1] = c.g;
      colArr[i * 3 + 2] = c.b;
    }

    const partGeo = new THREE.BufferGeometry();
    partGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    partGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

    const partMat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
    });
    const partPoints = new THREE.Points(partGeo, partMat);
    scene.add(partPoints);

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

      const positions = partGeo.attributes.position.array as Float32Array;
      const speedBoost = 1.0 + snap.shaderPulseIntensity * 2.2;

      for (let i = 0; i < particleCount; i++) {
        let x = positions[i * 3 + 0];
        x += velArr[i] * dt * speedBoost;
        if (x > 26) x = -26;
        positions[i * 3 + 0] = x;
        positions[i * 3 + 1] += Math.sin(elapsedSec * 2.0 + x * 0.25) * 0.025;
      }
      partGeo.attributes.position.needsUpdate = true;

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

  const occupiedList = rooms.filter((r) => r.occupancyStatus === 'occupied').slice(0, 5);
  const readyCount = rooms.filter(isRoomReady).length;

  return (
    <div
      onMouseMove={recordInteraction}
      className="relative w-full h-full bg-[#030305] overflow-hidden select-none"
    >
      {/* WebGL Neon Spline & Particle Burst Backdrop */}
      <div ref={bgCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Top View Title */}
      <div className="relative z-10 px-4 pt-3 pb-2 flex items-center justify-between font-mono border-b border-[#16161a] bg-[#030305]/80">
        <div className="text-[9px] tracking-[0.18em] text-[#686875] uppercase">
          VIEW 03 // PIPELINE STACK: 2.5D PERSPECTIVE OPERATIONS CARDS (`rotateX(16deg) rotateY(-14deg)`)
        </div>
        <div className="text-[10px] text-[#d4af37] tabular-nums">
          CLICK ANY CARD BUTTON TO ADVANCE LIVE WORKFLOW & TRIGGER SHADER BURST
        </div>
      </div>

      {/* 4 VERTICAL WORKFLOW COLUMNS WITH 3D PERSPECTIVE TILT */}
      <div
        className="relative z-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4 h-[calc(100%-36px)] overflow-y-auto"
        style={{ perspective: '1300px' }}
      >
        {/* COLUMN [01]: ARRIVAL & CHECK-IN / IN-HOUSE */}
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2 bg-[#040406]/95 border border-[#00f0ff]/60 font-mono flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#00f0ff] tracking-[0.14em]">
              [01] ARRIVAL & CHECK-IN
            </span>
            <span className="text-[10px] text-[#00e676] tabular-nums">{readyCount} READY</span>
          </div>

          <div className="space-y-3 pr-1">
            {occupiedList.map((rm) => (
              <div
                key={rm.roomNumber}
                style={{
                  transform: 'rotateX(16deg) rotateY(-14deg)',
                  transformStyle: 'preserve-3d',
                }}
                className="p-3 bg-[#050509]/92 border border-[#00f0ff]/60 hover:border-[#d4af37] transition duration-300 font-mono text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#00f0ff]">SUITE {rm.roomNumber}</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#00f0ff]/15 text-[#00f0ff]">
                    IN HOUSE
                  </span>
                </div>
                <div className="text-[11px] text-[#f4f0ea] font-semibold truncate mt-1">
                  {rm.currentGuestName}
                </div>
                <div className="text-[9px] text-[#787885] mt-0.5">
                  {rm.roomType} // {rm.baseRateIqd.toLocaleString()} IQD ({rm.discountPayPercent}%)
                </div>
                {/* SLA Progress Bar */}
                <div className="w-full h-1 bg-[#14141c] mt-2 overflow-hidden">
                  <div className="h-full bg-[#00f0ff]" style={{ width: '88%' }} />
                </div>
                <button
                  onClick={() => {
                    triggerShaderPulse(1.2);
                    checkOutRoom(rm.roomNumber);
                  }}
                  className="mt-2.5 w-full py-1.5 bg-[#0c141c] hover:bg-[#00f0ff] text-[#00f0ff] hover:text-[#030305] border border-[#00f0ff]/50 text-[9px] font-bold uppercase tracking-wider transition"
                >
                  1-CLICK CHECK OUT → TURNOVER
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN [02]: HOUSEKEEPING TURNOVER & SUPERVISOR INSPECT */}
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2 bg-[#040406]/95 border border-[#d4af37]/60 font-mono flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#d4af37] tracking-[0.14em]">
              [02] HOUSEKEEPING TURNOVER
            </span>
            <span className="text-[10px] text-[#d4af37] tabular-nums">
              {housekeepingTasks.length} QUEUED
            </span>
          </div>

          <div className="space-y-3 pr-1">
            {housekeepingTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                style={{
                  transform: 'rotateX(16deg) rotateY(-14deg)',
                  transformStyle: 'preserve-3d',
                }}
                className="p-3 bg-[#050509]/92 border border-[#d4af37]/60 hover:border-[#00e676] transition duration-300 font-mono text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#d4af37]">RM {task.roomNumber}</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#d4af37]/15 text-[#d4af37] uppercase">
                    {task.status}
                  </span>
                </div>
                <div className="text-[10px] text-[#f4f0ea] mt-1">{task.taskType}</div>
                <div className="text-[9px] text-[#787885] mt-0.5">
                  SLA WINDOW: {task.slaMinutesRemaining} MIN REMAINING
                </div>
                <div className="w-full h-1 bg-[#14141c] mt-2 overflow-hidden">
                  <div
                    className="h-full bg-[#d4af37]"
                    style={{ width: `${Math.min(100, task.slaMinutesRemaining * 4)}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                  {task.status !== 'awaiting_inspection' ? (
                    <button
                      onClick={() => {
                        triggerShaderPulse(1.1);
                        markCleaningFinishedAwaitingInspection(task.roomNumber);
                      }}
                      className="col-span-2 py-1.5 bg-[#161208] hover:bg-[#d4af37] text-[#d4af37] hover:text-[#030305] border border-[#d4af37]/60 text-[9px] font-bold uppercase tracking-wider transition"
                    >
                      FINISH CLEANING → INSPECT
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          triggerShaderPulse(1.25);
                          inspectRoomVerdict(task.roomNumber, 'passed');
                        }}
                        className="py-1.5 bg-[#00e676]/20 hover:bg-[#00e676] text-[#00e676] hover:text-[#030305] border border-[#00e676] text-[9px] font-bold uppercase"
                      >
                        ✓ PASS READY
                      </button>
                      <button
                        onClick={() => {
                          triggerShaderPulse(1.25);
                          inspectRoomVerdict(task.roomNumber, 'failed');
                        }}
                        className="py-1.5 bg-[#ff1e7a]/20 hover:bg-[#ff1e7a] text-[#ff1e7a] hover:text-white border border-[#ff1e7a] text-[9px] font-bold uppercase"
                      >
                        ✕ FAIL
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN [03]: ROOM SERVICE & DINING */}
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2 bg-[#040406]/95 border border-[#00e676]/60 font-mono flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#00e676] tracking-[0.14em]">
              [03] ROOM SERVICE & DINING
            </span>
            <span className="text-[10px] text-[#00e676] tabular-nums">
              {roomServiceOrders.length} ACTIVE
            </span>
          </div>

          <div className="space-y-3 pr-1">
            {roomServiceOrders.map((ord) => (
              <div
                key={ord.id}
                style={{
                  transform: 'rotateX(16deg) rotateY(-14deg)',
                  transformStyle: 'preserve-3d',
                }}
                className="p-3 bg-[#050509]/92 border border-[#00e676]/60 hover:border-[#d4af37] transition duration-300 font-mono text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#00e676]">SUITE {ord.roomNumber}</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#00e676]/15 text-[#00e676] uppercase">
                    {ord.status}
                  </span>
                </div>
                <div className="text-[11px] text-[#f4f0ea] truncate mt-1">{ord.guestName}</div>
                <div className="text-[9px] text-[#d4af37] mt-0.5">
                  {ord.totalIqd.toLocaleString()} IQD (${ord.totalUsd})
                </div>
                <div className="w-full h-1 bg-[#14141c] mt-2 overflow-hidden">
                  <div
                    className="h-full bg-[#00e676]"
                    style={{
                      width:
                        ord.status === 'queued'
                          ? '33%'
                          : ord.status === 'preparing'
                          ? '66%'
                          : '92%',
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    triggerShaderPulse(1.15);
                    advanceRoomServiceStatus(ord.id);
                  }}
                  className="mt-2.5 w-full py-1.5 bg-[#081610] hover:bg-[#00e676] text-[#00e676] hover:text-[#030305] border border-[#00e676]/60 text-[9px] font-bold uppercase tracking-wider transition"
                >
                  ADVANCE STAGE →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN [04]: ENGINEERING & MAINTENANCE */}
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2 bg-[#040406]/95 border border-[#ff1e7a]/60 font-mono flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#ff1e7a] tracking-[0.14em]">
              [04] ENGINEERING & MAINT
            </span>
            <span className="text-[10px] text-[#ff1e7a] tabular-nums">
              {maintenanceTickets.length} TICKETS
            </span>
          </div>

          <div className="space-y-3 pr-1">
            {maintenanceTickets.map((tkt) => (
              <div
                key={tkt.id}
                style={{
                  transform: 'rotateX(16deg) rotateY(-14deg)',
                  transformStyle: 'preserve-3d',
                }}
                className="p-3 bg-[#050509]/92 border border-[#ff1e7a]/60 hover:border-[#00f0ff] transition duration-300 font-mono text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#ff1e7a]">RM {tkt.roomNumber}</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-[#ff1e7a]/20 text-[#ff1e7a] uppercase">
                    {tkt.status}
                  </span>
                </div>
                <div className="text-[10px] text-[#f4f0ea] font-semibold mt-1">
                  {tkt.problemType}
                </div>
                <div className="text-[9px] text-[#787885] line-clamp-1 mt-0.5">{tkt.note}</div>
                <div className="w-full h-1 bg-[#14141c] mt-2 overflow-hidden">
                  <div
                    className="h-full bg-[#ff1e7a]"
                    style={{ width: tkt.status === 'fixed_awaiting_check' ? '85%' : '45%' }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2.5 text-[9px] font-bold">
                  <button
                    onClick={() => {
                      triggerShaderPulse(1.15);
                      updateMaintenanceTicketStatus(tkt.id, 'fixed_awaiting_check', role);
                    }}
                    className="py-1.5 bg-emerald-950 hover:bg-emerald-500 text-emerald-300 hover:text-black border border-emerald-500/50 uppercase"
                  >
                    MARK FIXED
                  </button>
                  <button
                    onClick={() => {
                      triggerShaderPulse(1.3);
                      updateMaintenanceTicketStatus(tkt.id, 'checked_ok', 'executive');
                    }}
                    className="py-1.5 bg-[#00e676]/20 hover:bg-[#00e676] text-[#00e676] hover:text-black border border-[#00e676] uppercase"
                  >
                    CHECKED — OK
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
