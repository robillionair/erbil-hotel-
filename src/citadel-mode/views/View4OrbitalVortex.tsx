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

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 220);
    camera.position.set(0, 20, 32);
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
    postProcessor.bloomPass.strength = 1.15;
    postProcessor.bloomPass.radius = 0.62;

    const vortexGroup = new THREE.Group();
    scene.add(vortexGroup);

    // -------------------------------------------------------------------------
    // 1. 65,000 TOROIDAL CURL-NOISE PLASMA PARTICLES
    // -------------------------------------------------------------------------
    const torusCoords = new Float32Array(VORTEX_PARTICLE_COUNT * 3); // [u, v, radialLayer]
    const colors = new Float32Array(VORTEX_PARTICLE_COUNT * 3);

    const palette = [
      new THREE.Color('#00f0ff'), // White-Hot Cyan
      new THREE.Color('#d4af37'), // Citadel Gold
      new THREE.Color('#9b4dff'), // Plasma Violet
      new THREE.Color('#ff1e7a'), // Drift Magenta
    ];

    for (let i = 0; i < VORTEX_PARTICLE_COUNT; i++) {
      const u = Math.random() * Math.PI * 2; // Major ring angle
      const v = Math.random() * Math.PI * 2; // Minor tube angle
      const layer = 0.35 + Math.pow(Math.random(), 0.85) * 1.15;

      torusCoords[i * 3 + 0] = u;
      torusCoords[i * 3 + 1] = v;
      torusCoords[i * 3 + 2] = layer;

      const c = palette[i % palette.length];
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    // Dummy position attribute required by Three.js; actual position computed in vertex shader from aTorus
    particleGeo.setAttribute('position', new THREE.BufferAttribute(torusCoords, 3));
    particleGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const vortexShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSlaDrift: { value: 0.15 },
        uPulse: { value: 0.15 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        uniform float uTime;
        uniform float uSlaDrift;
        uniform float uPulse;
        uniform float uPixelRatio;

        varying vec3 vColor;
        varying float vEnergy;

        // 3D trigonometric curl-noise approximation for GPU toroidal turbulence
        vec3 curlDisplacement(vec3 p, float t, float drift) {
          float freq = 0.35 + drift * 0.85;
          float nx = sin(p.y * freq + t * 1.7) - cos(p.z * freq - t * 1.3);
          float ny = sin(p.z * freq + t * 1.5) - cos(p.x * freq + t * 1.9);
          float nz = sin(p.x * freq - t * 1.4) - cos(p.y * freq + t * 1.6);
          return vec3(nx, ny, nz);
        }

        void main() {
          float u0 = position.x;
          float v0 = position.y;
          float layer = position.z;

          // Angular velocity increases with SLA drift & operational pulses
          float speed = 0.48 + uSlaDrift * 1.45 + uPulse * 0.65;
          float u = u0 + uTime * speed * (0.65 + 0.35 / (layer + 0.3));
          float v = v0 + uTime * (1.35 + uSlaDrift * 2.2) + u * 2.0;

          // Major radius R and minor tube radius r with central singularity pinch
          float majorR = 11.2;
          float pinch = 0.45 + 0.55 * pow(sin(u * 2.0 + uTime * 0.9) * 0.5 + 0.5, 1.4);
          float minorR = (1.6 + uSlaDrift * 4.2) * layer * pinch;

          vec3 torusPos;
          torusPos.x = (majorR + minorR * cos(v)) * cos(u);
          torusPos.z = (majorR + minorR * cos(v)) * sin(u);
          torusPos.y = minorR * sin(v) * 0.85;

          // Add curl-noise spikes when SLA drift or pulse is high
          vec3 curl = curlDisplacement(torusPos, uTime, uSlaDrift);
          float turbulenceAmp = (0.18 + uSlaDrift * 2.6 + uPulse * 1.4) * layer;
          vec3 finalPos = torusPos + curl * turbulenceAmp;

          // Blend color toward hot magenta when SLA drift spikes
          vec3 magentaSpike = vec3(1.0, 0.12, 0.48);
          vEnergy = clamp(length(curl) * 0.45 * (uSlaDrift + uPulse * 0.5), 0.0, 1.0);
          vColor = mix(aColor, magentaSpike, vEnergy * uSlaDrift);

          vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
          gl_PointSize = (1.55 + vEnergy * 1.6) * uPixelRatio * (28.0 / max(8.0, -mvPosition.z));
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

          float core = exp(-r2 * 3.6);
          vec3 col = mix(vColor, vec3(1.0, 0.98, 0.95), core * 0.55);
          gl_FragColor = vec4(col, core * (0.45 + vEnergy * 0.45));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const vortexPoints = new THREE.Points(particleGeo, vortexShaderMat);
    vortexGroup.add(vortexPoints);

    // -------------------------------------------------------------------------
    // 2. TOROIDAL MAGNETIC CONTAINMENT LINE SEGMENTS
    // -------------------------------------------------------------------------
    const wireGeo = new THREE.TorusGeometry(11.2, 2.4, 16, 72);
    const wireEdges = new THREE.EdgesGeometry(wireGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#303854'),
      transparent: true,
      opacity: 0.25,
    });
    const wireCage = new THREE.LineSegments(wireEdges, wireMat);
    wireCage.rotation.x = Math.PI / 2;
    vortexGroup.add(wireCage);
    wireGeo.dispose();

    // Pointer camera orbit
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let yaw = 0.0;
    let pitch = 0.55;

    const onDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
      recordInteraction();
    };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      yaw -= (e.clientX - prevX) * 0.006;
      pitch = Math.max(0.1, Math.min(1.3, pitch + (e.clientY - prevY) * 0.005));
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

      wireCage.rotation.z = elapsedSec * 0.15;

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
    triggerShaderPulse(1.1);
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
      note: 'Simulated SLA drift spike injected from Vortex Singularity panel.',
      reportedBy: 'Citadel Singularity Monitor',
    });
  };

  return (
    <div className="relative w-full h-full bg-[#030305] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top HUD Telemetry */}
      <div className="absolute top-3 left-3 pointer-events-none font-mono space-y-1">
        <div className="text-[9px] tracking-[0.18em] text-[#686875] uppercase">
          VIEW 04 // ORBITAL VORTEX: SLA DRIFT SINGULARITY (65,000 CURL-NOISE TOROIDAL POINTS + LINESEGMENTS)
        </div>
        <div className="flex items-center gap-4 text-[11px] tabular-nums">
          <span className="text-[#ff1e7a]">
            SLA DRIFT SCORE: {telemetry.slaDriftScore.toFixed(3)}
          </span>
          <span className="text-[#d4af37]">
            OVERDUE HK: {telemetry.overdueHousekeepingCount}
          </span>
          <span className="text-[#00f0ff]">
            OPEN MAINT: {telemetry.openMaintenanceCount}
          </span>
        </div>
      </div>

      {/* Bottom Interactive SLA Coherence Control Bar */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 font-mono text-[10px]">
        <button
          onClick={injectSlaTurbulenceTicket}
          className="px-3 py-2 bg-[#160610] hover:bg-[#ff1e7a] text-[#ff1e7a] hover:text-white border border-[#ff1e7a] font-bold uppercase tracking-wider transition"
        >
          + INJECT MAINTENANCE SLA RIPPLE ({maintenanceTickets.length} OPEN)
        </button>
        <button
          onClick={stabilizeSlaRipple}
          className="px-3 py-2 bg-[#061610] hover:bg-[#00e676] text-[#00e676] hover:text-[#030305] border border-[#00e676] font-bold uppercase tracking-wider transition"
        >
          ✓ COMPLETE TURNOVER & STABILIZE LAMINAR FLOW ({housekeepingTasks.length} QUEUED)
        </button>
      </div>
    </div>
  );
};
