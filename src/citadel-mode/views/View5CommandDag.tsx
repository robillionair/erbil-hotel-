import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createCitadelPostProcessor,
  disposeThreeContextComplete,
} from '../postprocessing/CitadelPostProcessor';
import { useErbilTelemetry, computeTelemetrySnapshot } from '../telemetry/ErbilTelemetryStream';
import { useCitadelStore } from '../../store/useCitadelStore';
import { useHotelOpsStore, isRoomReady } from '../../store/useHotelOpsStore';

interface ConstellationNode {
  id: string;
  label: string;
  level: number; // 0=Root, 1=Dept, 2=Floor, 3=Room, 4=Task
  pos: THREE.Vector3;
  parentId: string | null;
  roomNumber?: string;
  floor?: number;
}

interface ProjectedDagCallout {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  color: string;
  roomNumber?: string;
  visible: boolean;
}

export const View5CommandDag: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const evapBurstRef = useRef<{ active: boolean; origin: THREE.Vector3; progress: number }>({
    active: false,
    origin: new THREE.Vector3(0, -6, 0),
    progress: 1.0,
  });

  const telemetry = useErbilTelemetry();
  const { recordInteraction, triggerShaderPulse, setSelectedRoomNumber } = useCitadelStore();
  const { housekeepingTasks, inspectRoomVerdict } = useHotelOpsStore();

  const [callouts, setCallouts] = useState<ProjectedDagCallout[]>([]);

  const pruneAndEvaporateTask = () => {
    recordInteraction();
    triggerShaderPulse(1.35);
    evapBurstRef.current = {
      active: true,
      origin: new THREE.Vector3((Math.random() - 0.5) * 14, -7, (Math.random() - 0.5) * 14),
      progress: 0.0,
    };

    const task = housekeepingTasks[0];
    if (task) {
      inspectRoomVerdict(task.roomNumber, 'passed');
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030305');

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 250);
    camera.position.set(26, 14, 34);
    camera.lookAt(0, -1, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const postProcessor = createCitadelPostProcessor(renderer, scene, camera, width, height);

    const dagGroup = new THREE.Group();
    scene.add(dagGroup);

    // -------------------------------------------------------------------------
    // 1. BUILD 3D HIERARCHICAL CONSTELLATION TOPOLOGY
    // -------------------------------------------------------------------------
    const nodes: ConstellationNode[] = [];
    const nodeMap = new Map<string, ConstellationNode>();
    const addNode = (n: ConstellationNode) => {
      nodes.push(n);
      nodeMap.set(n.id, n);
    };

    // Level 0: Root Citadel Core
    addNode({
      id: 'ROOT',
      label: 'ERBIL_CITADEL_CORE',
      level: 0,
      pos: new THREE.Vector3(0, 12.5, 0),
      parentId: null,
    });

    // Level 1: 4 Departments in a 3D ring
    const deptLabels = [
      'DEPT_01 // RECEPTION & YIELD',
      'DEPT_02 // HOUSEKEEPING OPS',
      'DEPT_03 // DIPLOMATIC & VIP',
      'DEPT_04 // ENGINEERING & F&B',
    ];
    for (let d = 0; d < 4; d++) {
      const a = (d / 4) * Math.PI * 2 + 0.4;
      addNode({
        id: `DEPT_${d}`,
        label: deptLabels[d],
        level: 1,
        pos: new THREE.Vector3(Math.cos(a) * 7.5, 6.8, Math.sin(a) * 7.5),
        parentId: 'ROOT',
      });
    }

    // Level 2: 6 Floors (L1 - L6)
    for (let fl = 1; fl <= 6; fl++) {
      const a = ((fl - 1) / 6) * Math.PI * 2;
      const parentDept = `DEPT_${(fl - 1) % 4}`;
      addNode({
        id: `FLOOR_${fl}`,
        label: `FLOOR_L${fl}`,
        level: 2,
        pos: new THREE.Vector3(Math.cos(a) * 13.5, 0.8, Math.sin(a) * 13.5),
        parentId: parentDept,
        floor: fl,
      });
    }

    // Level 3: 48 Room Nodes & Level 4: Active Task Nodes
    const snapInit = computeTelemetrySnapshot();
    snapInit.roomNodes.forEach((rm, idx) => {
      const floorParent = nodeMap.get(`FLOOR_${rm.floor}`)!;
      const subAngle = ((idx % 8) / 8) * Math.PI * 2 + rm.floor * 0.5;
      const localRadius = 4.2 + (idx % 2) * 1.4;
      const rx = floorParent.pos.x * 1.12 + Math.cos(subAngle) * localRadius;
      const rz = floorParent.pos.z * 1.12 + Math.sin(subAngle) * localRadius;
      const ry = -5.2 - (idx % 3) * 1.2;

      addNode({
        id: `RM_${rm.roomNumber}`,
        label: `SUITE_${rm.roomNumber}`,
        level: 3,
        pos: new THREE.Vector3(rx, ry, rz),
        parentId: `FLOOR_${rm.floor}`,
        roomNumber: rm.roomNumber,
        floor: rm.floor,
      });

      addNode({
        id: `TASK_${rm.roomNumber}`,
        label: `TASK_${rm.roomNumber}`,
        level: 4,
        pos: new THREE.Vector3(rx * 1.04, ry - 4.0, rz * 1.04),
        parentId: `RM_${rm.roomNumber}`,
        roomNumber: rm.roomNumber,
        floor: rm.floor,
      });
    });

    // -------------------------------------------------------------------------
    // 2. INSTANCED NODE SPHERES + PULSING ENERGY LINKS
    // -------------------------------------------------------------------------
    const sphereGeo = new THREE.IcosahedronGeometry(0.42, 2);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.92,
    });
    const instancedSpheres = new THREE.InstancedMesh(sphereGeo, sphereMat, nodes.length);
    dagGroup.add(instancedSpheres);

    // Build Link Segments
    const linkPositions: number[] = [];
    const linkColors: number[] = [];
    for (const n of nodes) {
      if (!n.parentId) continue;
      const p = nodeMap.get(n.parentId)!;
      linkPositions.push(p.pos.x, p.pos.y, p.pos.z, n.pos.x, n.pos.y, n.pos.z);
      linkColors.push(0.83, 0.68, 0.21, 0.0, 0.94, 1.0);
    }

    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute('position', new THREE.Float32BufferAttribute(linkPositions, 3));
    linkGeo.setAttribute('color', new THREE.Float32BufferAttribute(linkColors, 3));
    const linkMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
    });
    const linkSegments = new THREE.LineSegments(linkGeo, linkMat);
    dagGroup.add(linkSegments);

    // -------------------------------------------------------------------------
    // 3. 12,000 PULSING ENERGY PACKETS + DISSOLVING EVAPORATION PARTICLES
    // -------------------------------------------------------------------------
    const packetCount = 12000;
    const pktStart = new Float32Array(packetCount * 3);
    const pktEnd = new Float32Array(packetCount * 3);
    const pktColor = new Float32Array(packetCount * 3);
    const pktSeed = new Float32Array(packetCount * 2);

    const validLinks = nodes.filter((n) => n.parentId !== null);
    for (let i = 0; i < packetCount; i++) {
      const child = validLinks[i % validLinks.length];
      const parent = nodeMap.get(child.parentId!)!;

      pktStart[i * 3 + 0] = parent.pos.x;
      pktStart[i * 3 + 1] = parent.pos.y;
      pktStart[i * 3 + 2] = parent.pos.z;

      pktEnd[i * 3 + 0] = child.pos.x;
      pktEnd[i * 3 + 1] = child.pos.y;
      pktEnd[i * 3 + 2] = child.pos.z;

      const c =
        child.level === 4
          ? new THREE.Color('#ff1e7a')
          : child.level === 3
          ? new THREE.Color('#00f0ff')
          : new THREE.Color('#d4af37');
      pktColor[i * 3 + 0] = c.r;
      pktColor[i * 3 + 1] = c.g;
      pktColor[i * 3 + 2] = c.b;

      pktSeed[i * 2 + 0] = Math.random();
      pktSeed[i * 2 + 1] = 0.25 + Math.random() * 0.55;
    }

    const pktGeo = new THREE.BufferGeometry();
    pktGeo.setAttribute('position', new THREE.BufferAttribute(pktStart, 3));
    pktGeo.setAttribute('aEnd', new THREE.BufferAttribute(pktEnd, 3));
    pktGeo.setAttribute('aColor', new THREE.BufferAttribute(pktColor, 3));
    pktGeo.setAttribute('aSeed', new THREE.BufferAttribute(pktSeed, 2));

    const pktMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uPulse: { value: 0.15 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aEnd;
        attribute vec3 aColor;
        attribute vec2 aSeed;
        uniform float uTime;
        uniform float uPulse;
        uniform float uPixelRatio;

        varying vec3 vColor;

        void main() {
          vColor = aColor;
          float t = fract(aSeed.x + uTime * aSeed.y * (1.0 + uPulse * 1.4));
          vec3 pos = mix(position, aEnd, t);

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 1.75 * uPixelRatio * (30.0 / max(10.0, -mvPosition.z));
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
          gl_FragColor = vec4(vColor * 1.3, glow * 0.85);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    dagGroup.add(new THREE.Points(pktGeo, pktMat));

    // Orbit Controls
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let yaw = 0.5;
    let pitch = 0.36;

    const onDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
      recordInteraction();
    };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      yaw -= (e.clientX - prevX) * 0.006;
      pitch = Math.max(-0.2, Math.min(1.1, pitch + (e.clientY - prevY) * 0.005));
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

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();

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

      if (!isDragging) {
        yaw += dt * 0.12;
      }

      const dist = 42;
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        Math.cos(yaw) * Math.cos(pitch) * dist
      );
      camera.lookAt(0, -1, 0);

      // Update Instanced Sphere Transforms & Live Status Colors
      nodes.forEach((n, idx) => {
        dummy.position.copy(n.pos);
        let scale = 1.0;
        if (n.level === 0) {
          scale = 2.6 + Math.sin(elapsedSec * 3.5) * 0.25;
          tmpColor.set('#ffffff');
        } else if (n.level === 1) {
          scale = 1.65;
          tmpColor.set('#d4af37');
        } else if (n.level === 2) {
          scale = 1.35;
          tmpColor.set('#00f0ff');
        } else if (n.roomNumber) {
          const rm = roomLookup.get(n.roomNumber);
          scale = n.level === 3 ? 0.85 : 0.55;
          if (rm) {
            if (
              rm.maintenanceStatus === 'out_of_service' ||
              rm.housekeepingStatus !== 'clean' ||
              rm.inspectionStatus !== 'passed'
            ) {
              tmpColor.set('#ff1e7a');
              scale *= 1.35;
            } else if (rm.occupancyStatus === 'occupied') {
              tmpColor.set(rm.isVip ? '#d4af37' : '#00f0ff');
            } else if (isRoomReady(rm)) {
              tmpColor.set('#00e676');
            }
          }
        }
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        instancedSpheres.setMatrixAt(idx, dummy.matrix);
        instancedSpheres.setColorAt(idx, tmpColor);
      });
      instancedSpheres.instanceMatrix.needsUpdate = true;
      if (instancedSpheres.instanceColor) instancedSpheres.instanceColor.needsUpdate = true;

      pktMat.uniforms.uTime.value = elapsedSec;
      pktMat.uniforms.uPulse.value = snap.shaderPulseIntensity;

      // Project Key Constellation Nodes to 2D HUD Callouts
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      const keyNodes = nodes.filter((n) => n.level <= 2);
      const nextCallouts: ProjectedDagCallout[] = keyNodes.map((kn) => {
        const v = kn.pos.clone().project(camera);
        const sx = (v.x * 0.5 + 0.5) * w;
        const sy = (-(v.y * 0.5) + 0.5) * h;
        return {
          id: kn.id,
          label: kn.label,
          sub: kn.level === 0 ? 'MASTER SINGULARITY' : kn.level === 1 ? 'DIVISION' : 'FLOOR NODE',
          x: sx,
          y: sy,
          color: kn.level === 0 ? '#ffffff' : kn.level === 1 ? '#d4af37' : '#00f0ff',
          roomNumber: kn.floor ? `${kn.floor}01` : undefined,
          visible: v.z < 1.0 && sx > 60 && sx < w - 180 && sy > 80 && sy < h - 180,
        };
      });
      setCallouts(nextCallouts);

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

  return (
    <div className="relative w-full h-full bg-[#030305] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Telemetry Overlay */}
      <div className="absolute top-20 left-6 pointer-events-none hud-glass rounded-2xl px-4 py-3 space-y-1">
        <div className="font-mono text-[10px] tracking-[0.2em] text-[#00f0ff] uppercase">
          VIEW 05 // PRUNING & COMMAND DAG • 3D HOLOGRAPHIC CONSTELLATION (107 NODES)
        </div>
        <div className="flex items-center gap-4 font-mono text-xs">
          <span className="text-[#ff1e7a]">● CRIMSON = ACTIVE TURNOVER</span>
          <span className="text-[#00f0ff]">● CYAN/GOLD = IN-HOUSE</span>
          <span className="text-[#00e676]">● EMERALD = READY</span>
        </div>
      </div>

      {/* Projected 2D Callout Tags */}
      {callouts.map(
        (c) =>
          c.visible && (
            <button
              key={c.id}
              onClick={() => c.roomNumber && setSelectedRoomNumber(c.roomNumber)}
              style={{
                transform: `translate3d(${Math.round(c.x + 12)}px, ${Math.round(c.y - 14)}px, 0)`,
              }}
              className="absolute top-0 left-0 px-2.5 py-1 rounded-xl hud-glass text-left font-mono hover:border-[#d4af37] transition"
            >
              <div className="text-[9px] font-bold" style={{ color: c.color }}>
                {c.label}
              </div>
              <div className="text-[8px] text-white/50">{c.sub}</div>
            </button>
          )
      )}

      {/* Bottom Interactive Task Pruning & Evaporation Trigger */}
      <div className="absolute bottom-36 right-6">
        <button
          onClick={pruneAndEvaporateTask}
          className="px-5 py-2.5 rounded-full hud-glass border border-[#00e676]/60 hover:bg-[#00e676] text-[#00e676] hover:text-[#030305] font-mono text-xs font-semibold uppercase tracking-[0.14em] transition"
        >
          ✦ Prune & Evaporate Completed Turnover Node ({housekeepingTasks.length} Active)
        </button>
      </div>
    </div>
  );
};
