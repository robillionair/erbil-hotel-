import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createCitadelPostProcessor,
  disposeThreeContextComplete,
} from '../postprocessing/CitadelPostProcessor';
import { useErbilTelemetry, computeTelemetrySnapshot } from '../telemetry/ErbilTelemetryStream';
import { useCitadelStore } from '../../store/useCitadelStore';
import { isRoomReady } from '../../store/useHotelOpsStore';

interface DagNode {
  id: string;
  label: string;
  level: number; // 0=Root, 1=Dept, 2=Floor, 3=Room, 4=Task
  xNorm: number;
  yNorm: number;
  parentId: string | null;
  roomNumber?: string;
  floor?: number;
}

export const View5CommandDag: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const telemetry = useErbilTelemetry();
  const { recordInteraction, setSelectedRoomNumber } = useCitadelStore();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const dpr = Math.min((window.devicePixelRatio || 1) * 2, 3);

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = Math.floor(width * dpr);
    offscreenCanvas.height = Math.floor(height * dpr);
    const ctx = offscreenCanvas.getContext('2d')!;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const canvasTexture = new THREE.CanvasTexture(offscreenCanvas);
    canvasTexture.minFilter = THREE.LinearFilter;
    canvasTexture.magFilter = THREE.LinearFilter;

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadMat = new THREE.MeshBasicMaterial({ map: canvasTexture });
    scene.add(new THREE.Mesh(quadGeo, quadMat));

    const postProcessor = createCitadelPostProcessor(renderer, scene, camera, width, height);
    postProcessor.bloomPass.strength = 0.68;
    postProcessor.bloomPass.threshold = 0.25;

    // Build Hierarchical DAG Topology:
    // L0: ERBIL_CITADEL_CORE
    // L1: 3 Operational Divisions (RECEPTION_YIELD, HOUSEKEEPING_OPS, ENGINEERING_CULINARY)
    // L2: 6 Floors (FLOORS_L1 to L6)
    // L3: 48 Individual Rooms (101..608)
    // L4: Active Service/Turnover Task leaves
    const nodes: DagNode[] = [];
    const nodeMap = new Map<string, DagNode>();

    const addNode = (n: DagNode) => {
      nodes.push(n);
      nodeMap.set(n.id, n);
    };

    // Level 0: Root
    addNode({
      id: 'ROOT',
      label: 'ERBIL_CITADEL_CORE // MASTER DAG',
      level: 0,
      xNorm: 0.5,
      yNorm: 0.09,
      parentId: null,
    });

    // Level 1: 3 Departments
    const depts = [
      { id: 'DEPT_0', label: 'DEPT_01 // RECEPTION & YIELD', x: 0.22 },
      { id: 'DEPT_1', label: 'DEPT_02 // HOUSEKEEPING & INSPECT', x: 0.5 },
      { id: 'DEPT_2', label: 'DEPT_03 // DIPLOMATIC & PENTHOUSE', x: 0.78 },
    ];
    depts.forEach((d) => {
      addNode({
        id: d.id,
        label: d.label,
        level: 1,
        xNorm: d.x,
        yNorm: 0.24,
        parentId: 'ROOT',
      });
    });

    // Level 2: 6 Floors (L1 - L6)
    for (let fl = 1; fl <= 6; fl++) {
      const parentDept = `DEPT_${Math.floor((fl - 1) / 2)}`;
      const xNorm = 0.1 + (fl - 1) * (0.8 / 5);
      addNode({
        id: `FLOOR_${fl}`,
        label: `FL_0${fl}`,
        level: 2,
        xNorm,
        yNorm: 0.44,
        parentId: parentDept,
        floor: fl,
      });
    }

    // Level 3: 48 Individual Rooms (8 per floor)
    const snapInit = computeTelemetrySnapshot();
    snapInit.roomNodes.forEach((rm, idx) => {
      const xNorm = 0.04 + (idx / 47) * 0.92;
      const yJitter = (idx % 2) * 0.035;
      addNode({
        id: `RM_${rm.roomNumber}`,
        label: rm.roomNumber,
        level: 3,
        xNorm,
        yNorm: 0.68 + yJitter,
        parentId: `FLOOR_${rm.floor}`,
        roomNumber: rm.roomNumber,
        floor: rm.floor,
      });

      // Level 4: Active Task Leaf Node below every room
      addNode({
        id: `TASK_${rm.roomNumber}`,
        label: `TSK_${rm.roomNumber}`,
        level: 4,
        xNorm,
        yNorm: 0.88 + (idx % 2) * 0.025,
        parentId: `RM_${rm.roomNumber}`,
        roomNumber: rm.roomNumber,
        floor: rm.floor,
      });
    });

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
      const roomLookup = new Map(snap.roomNodes.map((r) => [r.roomNumber, r]));

      const W = offscreenCanvas.width;
      const H = offscreenCanvas.height;

      ctx.save();
      ctx.fillStyle = '#030305';
      ctx.fillRect(0, 0, W, H);

      // Draw Horizontal Hierarchy Layer Hairlines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      [0.09, 0.24, 0.44, 0.7, 0.89].forEach((yn) => {
        ctx.beginPath();
        ctx.moveTo(0, yn * H);
        ctx.lineTo(W, yn * H);
        ctx.stroke();
      });

      // Draw Links (Parent -> Child)
      for (const n of nodes) {
        if (!n.parentId) continue;
        const p = nodeMap.get(n.parentId);
        if (!p) continue;

        const x0 = p.xNorm * W;
        const y0 = p.yNorm * H;
        const x1 = n.xNorm * W;
        const y1 = n.yNorm * H;

        let isCrimsonActive = false;
        let linkColor = '#00e676';

        if (n.roomNumber) {
          const rm = roomLookup.get(n.roomNumber);
          if (rm) {
            if (
              rm.maintenanceStatus === 'out_of_service' ||
              rm.housekeepingStatus !== 'clean' ||
              rm.inspectionStatus !== 'passed'
            ) {
              isCrimsonActive = true;
              linkColor = '#ff1e7a';
            } else if (rm.occupancyStatus === 'occupied') {
              linkColor = rm.isVip ? '#d4af37' : '#00f0ff';
            } else if (isRoomReady(rm)) {
              linkColor = '#00e676';
            }
          }
        } else {
          linkColor = '#d4af37';
        }

        // Skip level-4 task links if room has no active service/turnover task
        if (n.level === 4 && !isCrimsonActive) {
          ctx.globalAlpha = 0.08;
        } else {
          ctx.globalAlpha = isCrimsonActive ? 0.82 : 0.34;
        }

        ctx.strokeStyle = linkColor;
        ctx.lineWidth = (isCrimsonActive ? 1.15 : 0.55) * dpr;

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        const midY = (y0 + y1) * 0.5;
        ctx.bezierCurveTo(x0, midY, x1, midY, x1, y1);
        ctx.stroke();

        // Animated signal pulse along active crimson/magenta branches
        if (isCrimsonActive) {
          const u = fract(elapsedSec * 0.9 + (n.xNorm * 7.3));
          const inv = 1 - u;
          const px =
            inv * inv * inv * x0 +
            3 * inv * inv * u * x0 +
            3 * inv * u * u * x1 +
            u * u * u * x1;
          const py =
            inv * inv * inv * y0 +
            3 * inv * inv * u * midY +
            3 * inv * u * u * midY +
            u * u * u * y1;
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px, py, 2.2 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Nodes
      ctx.globalAlpha = 1.0;
      ctx.textAlign = 'center';

      for (const n of nodes) {
        const x = n.xNorm * W;
        const y = n.yNorm * H;

        let color = '#d4af37';
        let radius = 4 * dpr;

        if (n.level === 0) {
          color = '#ffffff';
          radius = 7 * dpr;
        } else if (n.level === 1) {
          color = '#d4af37';
          radius = 5.5 * dpr;
        } else if (n.level === 2) {
          color = '#00f0ff';
          radius = 5 * dpr;
        } else if (n.roomNumber) {
          const rm = roomLookup.get(n.roomNumber);
          radius = n.level === 3 ? 3.2 * dpr : 2.2 * dpr;
          if (rm) {
            if (
              rm.maintenanceStatus === 'out_of_service' ||
              rm.housekeepingStatus !== 'clean' ||
              rm.inspectionStatus !== 'passed'
            ) {
              color = '#ff1e7a';
              radius = (n.level === 3 ? 4.2 : 3.4) * dpr;
            } else if (rm.occupancyStatus === 'occupied') {
              color = rm.isVip ? '#d4af37' : '#00f0ff';
            } else {
              color = '#00e676';
            }
          }
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (n.level <= 2) {
          ctx.fillStyle = '#f4f0ea';
          ctx.font = `600 ${Math.round(9 * dpr)}px "JetBrains Mono", monospace`;
          ctx.fillText(n.label, x, y - 9 * dpr);
        } else if (n.level === 3) {
          ctx.fillStyle = color;
          ctx.font = `500 ${Math.round(7.5 * dpr)}px "JetBrains Mono", monospace`;
          ctx.fillText(n.label, x, y - 6 * dpr);
        }
      }

      ctx.restore();

      canvasTexture.needsUpdate = true;
      postProcessor.update(elapsedSec, snap.shaderPulseIntensity);
    };

    function fract(v: number) {
      return v - Math.floor(v);
    }

    rafId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      const nw = container.clientWidth || window.innerWidth;
      const nh = container.clientHeight || window.innerHeight;
      offscreenCanvas.width = Math.floor(nw * dpr);
      offscreenCanvas.height = Math.floor(nh * dpr);
      renderer.setSize(nw, nh);
      postProcessor.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      canvasTexture.dispose();
      disposeThreeContextComplete(scene, renderer, postProcessor);
    };
  }, []);

  return (
    <div
      onMouseMove={recordInteraction}
      className="relative w-full h-full bg-[#030305] overflow-hidden select-none"
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Top HUD Header */}
      <div className="absolute top-3 left-3 pointer-events-none font-mono space-y-1">
        <div className="text-[9px] tracking-[0.18em] text-[#686875] uppercase">
          VIEW 05 // COMMAND DAG: HIERARCHICAL OPERATIONS TREE (CORE → DEPTS → FLOORS L1-L6 → 48 SUITES → TASKS)
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-[#ff1e7a]">● CRIMSON/MAGENTA = ACTIVE TURNOVER / OOS</span>
          <span className="text-[#00f0ff]">● CYAN/GOLD = SETTLED IN-HOUSE FOLIO</span>
          <span className="text-[#00e676]">● EMERALD = CERTIFIED READY</span>
        </div>
      </div>

      {/* Quick Room Node Selector Strip */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-[#040406]/90 border border-[#16161a] px-3 py-1.5 font-mono text-[10px]">
        <span className="text-[#686875]">ACTIVE DAG TELEMETRY NODES: 103 TOTAL</span>
        <div className="flex items-center gap-2">
          <span className="text-[#888895]">INSPECT NODE:</span>
          {['104', '206', '303', '501', '601'].map((rm) => (
            <button
              key={rm}
              onClick={() => setSelectedRoomNumber(rm)}
              className="px-2 py-0.5 bg-[#0c0c14] hover:bg-[#d4af37] text-[#d4af37] hover:text-[#030305] border border-[#262634]"
            >
              RM {rm}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
