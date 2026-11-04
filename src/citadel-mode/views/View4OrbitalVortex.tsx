import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createCitadelPostProcessor,
  disposeThreeContextComplete,
} from '../postprocessing/CitadelPostProcessor';
import { useErbilTelemetry, computeTelemetrySnapshot } from '../telemetry/ErbilTelemetryStream';
import { useCitadelStore } from '../../store/useCitadelStore';
import { useHotelOpsStore } from '../../store/useHotelOpsStore';

const VORTEX_PARTICLE_COUNT = 65000;
const TRAIL_COUNT = 1200;

export const View4OrbitalVortex: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const telemetry = useErbilTelemetry();
  const { recordInteraction, triggerShaderPulse } = useCitadelStore();
  const {
    housekeepingTasks,
    maintenanceTickets,
    inspectRoomVerdict,
    reportDamageTicket,
  } = useHotelOpsStore();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030305');

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.5, 220);
    camera.position.set(0, 21, 33);
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

    const vortexGroup = new THREE.Group();
    scene.add(vortexGroup);

    // -------------------------------------------------------------------------
    // 1. 65,000 TOROIDAL CURL-NOISE PLASMA PARTICLES
    // -------------------------------------------------------------------------
    const torusCoords = new Float32Array(VORTEX_PARTICLE_COUNT * 3); // [u, v, radialLayer]
    const colors = new Float32Array(VORTEX_PARTICLE_COUNT * 3);

    const palette = [
      new THREE.Color('#ff9e2c'), // Citadel Gold-Amber
      new THREE.Color('#00f0ff'), // Electric Cyan
      new THREE.Color('#7928ca'), // Deep Violet
      new THREE.Color('#ff1e7a'), // Crimson
    ];

    for (let i = 0; i < VORTEX_PARTICLE_COUNT; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI * 2;
      const layer = 0.28 + Math.pow(Math.random(), 0.85) * 1.25;

      torusCoords[i * 3 + 0] = u;
      torusCoords[i * 3 + 1] = v;
      torusCoords[i * 3 + 2] = layer;

      const c = palette[i % palette.length];
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(torusCoords, 3));
    particleGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const vortexShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSlaDrift: { value: 0.15 },
        uPulse: { value: 0.15 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        uniform float uTime;
        uniform float uSlaDrift;
        uniform float uPulse;
        uniform vec2 uMouse;
        uniform float uPixelRatio;

        varying vec3 vColor;
        varying float vEnergy;

        vec3 curlDisplacement(vec3 p, float t, float drift) {
          float freq = 0.34 + drift * 0.92;
          float nx = sin(p.y * freq + t * 1.8) - cos(p.z * freq - t * 1.4);
          float ny = sin(p.z * freq + t * 1.6) - cos(p.x * freq + t * 2.0);
          float nz = sin(p.x * freq - t * 1.5) - cos(p.y * freq + t * 1.7);
          return vec3(nx, ny, nz);
        }

        void main() {
          float u0 = position.x;
          float v0 = position.y;
          float layer = position.z;

          float speed = 0.52 + uSlaDrift * 1.55 + uPulse * 0.7;
          float u = u0 + uTime * speed * (0.68 + 0.32 / (layer + 0.25));
          float v = v0 + uTime * (1.45 + uSlaDrift * 2.4) + u * 2.0;

          float majorR = 11.4;
          float pinch = 0.42 + 0.58 * pow(sin(u * 2.0 + uTime * 0.95) * 0.5 + 0.5, 1.45);
          float minorR = (1.55 + uSlaDrift * 4.4) * layer * pinch;

          vec3 torusPos;
          torusPos.x = (majorR + minorR * cos(v)) * cos(u);
          torusPos.z = (majorR + minorR * cos(v)) * sin(u);
          torusPos.y = minorR * sin(v) * 0.88;

          // Mouse gravitational attractor offset
          vec2 mouseWorld = uMouse * 14.0;
          float distToMouse = length(torusPos.xz - mouseWorld);
          float mousePull = smoothstep(10.0, 0.0, distToMouse) * 1.85;
          torusPos.y += mousePull * sin(uTime * 3.0 + distToMouse);

          vec3 curl = curlDisplacement(torusPos, uTime, uSlaDrift);
          float turbulenceAmp = (0.2 + uSlaDrift * 2.75 + uPulse * 1.5) * layer;
          vec3 finalPos = torusPos + curl * turbulenceAmp;

          vec3 crimsonSpike = vec3(1.0, 0.12, 0.48);
          vEnergy = clamp(length(curl) * 0.48 * (uSlaDrift + uPulse * 0.55) + mousePull * 0.3, 0.0, 1.0);
          vColor = mix(aColor, crimsonSpike, vEnergy * uSlaDrift);

          vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
          gl_PointSize = (1.6 + vEnergy * 1.8) * uPixelRatio * (30.0 / max(8.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vEnergy;

        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(p, p);
          if (r2 > 1.0) discard;

          float core = exp(-r2 * 3.5);
          vec3 col = mix(vColor, vec3(1.0, 0.99, 0.95), core * 0.6);
          gl_FragColor = vec4(col * 1.25, core * (0.48 + vEnergy * 0.45));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const vortexPoints = new THREE.Points(particleGeo, vortexShaderMat);
    vortexGroup.add(vortexPoints);

    // -------------------------------------------------------------------------
    // 2. DYNAMIC LINESEGMENTS VELOCITY TRAILS
    // -------------------------------------------------------------------------
    const trailPositions = new Float32Array(TRAIL_COUNT * 6);
    const trailColors = new Float32Array(TRAIL_COUNT * 6);
    const trailAngles = new Float32Array(TRAIL_COUNT * 3);

    for (let i = 0; i < TRAIL_COUNT; i++) {
      trailAngles[i * 3 + 0] = Math.random() * Math.PI * 2;
      trailAngles[i * 3 + 1] = Math.random() * Math.PI * 2;
      trailAngles[i * 3 + 2] = 0.6 + Math.random() * 1.2;

      const c = palette[i % palette.length];
      trailColors[i * 6 + 0] = c.r;
      trailColors[i * 6 + 1] = c.g;
      trailColors[i * 6 + 2] = c.b;
      trailColors[i * 6 + 3] = c.r * 0.1;
      trailColors[i * 6 + 4] = c.g * 0.1;
      trailColors[i * 6 + 5] = c.b * 0.1;
    }

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
    });
    const trailLines = new THREE.LineSegments(trailGeo, trailMat);
    vortexGroup.add(trailLines);

    // Camera Orbit + Mouse Attractor
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let yaw = 0.0;
    let pitch = 0.56;
    const mouseVec = new THREE.Vector2(0, 0);

    const onDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
      recordInteraction();
    };
    const onMove = (e: PointerEvent) => {
      mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseVec.y = (e.clientY / window.innerHeight) * 2 - 1;
      if (isDragging) {
        yaw -= (e.clientX - prevX) * 0.006;
        pitch = Math.max(0.12, Math.min(1.3, pitch + (e.clientY - prevY) * 0.005));
        prevX = e.clientX;
        prevY = e.clientY;
      }
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
        yaw += dt * 0.14;
      }

      const dist = 34;
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        Math.cos(yaw) * Math.cos(pitch) * dist
      );
      camera.lookAt(0, 0, 0);

      vortexShaderMat.uniforms.uTime.value = elapsedSec;
      vortexShaderMat.uniforms.uSlaDrift.value = snap.slaDriftScore;
      vortexShaderMat.uniforms.uPulse.value = snap.shaderPulseIntensity;
      vortexShaderMat.uniforms.uMouse.value.copy(mouseVec);

      // Update velocity trail segments
      const posAttr = trailGeo.attributes.position.array as Float32Array;
      const majorR = 11.4;
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const u0 = trailAngles[i * 3 + 0] + elapsedSec * (0.7 + snap.slaDriftScore);
        const v0 = trailAngles[i * 3 + 1] + elapsedSec * 1.9 + u0 * 2.0;
        const rTube = 2.2 * trailAngles[i * 3 + 2];

        const xHead = (majorR + rTube * Math.cos(v0)) * Math.cos(u0);
        const zHead = (majorR + rTube * Math.cos(v0)) * Math.sin(u0);
        const yHead = rTube * Math.sin(v0) * 0.85;

        const uTail = u0 - 0.11;
        const vTail = v0 - 0.22;
        const xTail = (majorR + rTube * Math.cos(vTail)) * Math.cos(uTail);
        const zTail = (majorR + rTube * Math.cos(vTail)) * Math.sin(uTail);
        const yTail = rTube * Math.sin(vTail) * 0.85;

        posAttr[i * 6 + 0] = xHead;
        posAttr[i * 6 + 1] = yHead;
        posAttr[i * 6 + 2] = zHead;
        posAttr[i * 6 + 3] = xTail;
        posAttr[i * 6 + 4] = yTail;
        posAttr[i * 6 + 5] = zTail;
      }
      trailGeo.attributes.position.needsUpdate = true;

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

  const stabilizeSlaRipple = () => {
    recordInteraction();
    triggerShaderPulse(1.15);
    const pendingTask = housekeepingTasks[0];
    if (pendingTask) {
      inspectRoomVerdict(pendingTask.roomNumber, 'passed');
    }
  };

  const injectSlaTurbulenceTicket = () => {
    recordInteraction();
    triggerShaderPulse(1.45);
    reportDamageTicket({
      roomNumber: '405',
      problemType: 'HVAC / Climate',
      priority: 'high',
      note: 'SLA drift spike injected from Vortex Singularity telemetry.',
      reportedBy: 'Citadel Singularity Monitor',
    });
  };

  return (
    <div className="relative w-full h-full bg-[#030305] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Telemetry Overlay */}
      <div className="absolute top-20 left-6 pointer-events-none hud-glass rounded-2xl px-4 py-3 space-y-1">
        <div className="font-mono text-[10px] tracking-[0.2em] text-[#ff9e2c] uppercase">
          VIEW 04 // ORBITAL VORTEX • 65,000 CURL-NOISE TOROIDAL SINGULARITY
        </div>
        <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
          <span className="text-[#ff1e7a]">
            SLA DRIFT: <strong>{telemetry.slaDriftScore.toFixed(3)}</strong>
          </span>
          <span className="text-[#ff9e2c]">
            OVERDUE HK: {telemetry.overdueHousekeepingCount}
          </span>
          <span className="text-[#00f0ff]">
            OPEN MAINT: {telemetry.openMaintenanceCount}
          </span>
        </div>
      </div>

      {/* Bottom Interactive SLA Coherence Pills */}
      <div className="absolute bottom-36 right-6 flex flex-wrap items-center gap-3 font-mono text-xs">
        <button
          onClick={injectSlaTurbulenceTicket}
          className="px-4 py-2.5 rounded-full hud-glass border border-[#ff1e7a]/60 hover:bg-[#ff1e7a] text-[#ff85b3] hover:text-white font-semibold uppercase tracking-wider transition"
        >
          + Inject SLA Turbulence ({maintenanceTickets.length} Open)
        </button>
        <button
          onClick={stabilizeSlaRipple}
          className="px-5 py-2.5 rounded-full hud-glass border border-[#00e676]/60 hover:bg-[#00e676] text-[#00e676] hover:text-[#030305] font-semibold uppercase tracking-wider transition"
        >
          ✓ Stabilize Laminar Flow ({housekeepingTasks.length} Queued)
        </button>
      </div>
    </div>
  );
};
