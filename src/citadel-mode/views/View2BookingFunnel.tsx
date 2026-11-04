import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createCitadelPostProcessor,
  disposeThreeContextComplete,
} from '../postprocessing/CitadelPostProcessor';
import { useErbilTelemetry, computeTelemetrySnapshot } from '../telemetry/ErbilTelemetryStream';
import { useCitadelStore } from '../../store/useCitadelStore';
import { useHotelOpsStore, isRoomReady, BookingChannel } from '../../store/useHotelOpsStore';

const CHANNELS: { name: BookingChannel; label: string; color: string; yPos: number }[] = [
  { name: 'Direct_Web', label: 'DIRECT_WEB_PORTAL', color: '#d4af37', yPos: 10.0 },
  { name: 'Embassy_Corp', label: 'EMBASSY_DIPLOMATIC', color: '#00f0ff', yPos: 5.0 },
  { name: 'Booking_OTA', label: 'OTA_GLOBAL_GDS', color: '#ff9e2c', yPos: 0.0 },
  { name: 'Walk_In_VIP', label: 'VIP_CONCIERGE_DESK', color: '#00e676', yPos: -5.0 },
  { name: 'Airport_Transfer', label: 'EBL_AIRPORT_CHAUFFEUR', color: '#ff1e7a', yPos: -10.0 },
];

const FILAMENT_COUNT = 128;
const PHOTON_COUNT = 15000;

export const View2BookingFunnel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shockwaveRef = useRef<number>(0);
  const telemetry = useErbilTelemetry();
  const { recordInteraction, triggerShaderPulse } = useCitadelStore();
  const { rooms, checkInGuest } = useHotelOpsStore();

  const triggerBookingShockwave = () => {
    recordInteraction();
    triggerShaderPulse(1.45);
    shockwaveRef.current = 0.01;

    const readyRoom = rooms.find(isRoomReady);
    if (readyRoom) {
      const sampleNames = [
        'Envoy Tariq Barzani',
        'Consul Nadia Al-Khatib',
        'Dr. Sirwan Jaff',
        'Sovereign Delegate K. Othman',
      ];
      const randomChannel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)].name;
      checkInGuest({
        roomNumber: readyRoom.roomNumber,
        guestName: sampleNames[Math.floor(Math.random() * sampleNames.length)],
        guestContact: '+964 750 816 9999',
        guestIdNumber: `IRQ-VIP-${Math.floor(10000 + Math.random() * 89999)}`,
        guestCarNumber: `EBL ${readyRoom.roomNumber}`,
        extraGuests: [],
        discountPayPercent: 100,
        nights: 2,
        channel: randomChannel,
      });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030305');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 250);
    camera.position.set(0, 2, 42);
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

    const funnelGroup = new THREE.Group();
    scene.add(funnelGroup);

    // -------------------------------------------------------------------------
    // 1. 128 VOLUMETRIC 3D CUBIC BEZIER FILAMENTS
    // -------------------------------------------------------------------------
    const filamentDefs: {
      p0: THREE.Vector3;
      p1: THREE.Vector3;
      p2: THREE.Vector3;
      p3: THREE.Vector3;
      color: THREE.Color;
    }[] = [];

    for (let i = 0; i < FILAMENT_COUNT; i++) {
      const ch = CHANNELS[i % CHANNELS.length];
      const floorIdx = i % 6;
      const rightY = 10.5 - floorIdx * 4.2;

      const zLeft = ((i % 16) / 15 - 0.5) * 14.0;
      const zRight = (((i * 7) % 16) / 15 - 0.5) * 14.0;
      const yPinch = (((i * 13) % 32) / 31 - 0.5) * 2.8;
      const zPinch = (((i * 19) % 32) / 31 - 0.5) * 2.8;

      const p0 = new THREE.Vector3(-26, ch.yPos + (Math.random() - 0.5) * 2.2, zLeft);
      const p1 = new THREE.Vector3(-7, yPinch * 1.4, zPinch * 1.4);
      const p2 = new THREE.Vector3(7, yPinch * 1.4, zPinch * 1.4);
      const p3 = new THREE.Vector3(26, rightY + (Math.random() - 0.5) * 1.8, zRight);

      const col = new THREE.Color(ch.color);
      filamentDefs.push({ p0, p1, p2, p3, color: col });

      const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
      const pts = curve.getPoints(64);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
      });
      funnelGroup.add(new THREE.Line(geo, mat));
    }

    // -------------------------------------------------------------------------
    // 2. 15,000 GPU CUBIC-BEZIER STREAMING PHOTON PARTICLES
    // -------------------------------------------------------------------------
    const aP0 = new Float32Array(PHOTON_COUNT * 3);
    const aP1 = new Float32Array(PHOTON_COUNT * 3);
    const aP2 = new Float32Array(PHOTON_COUNT * 3);
    const aP3 = new Float32Array(PHOTON_COUNT * 3);
    const aColor = new Float32Array(PHOTON_COUNT * 3);
    const aSeed = new Float32Array(PHOTON_COUNT * 3); // [phaseOffset, speed, size]

    for (let i = 0; i < PHOTON_COUNT; i++) {
      const f = filamentDefs[i % filamentDefs.length];
      aP0[i * 3 + 0] = f.p0.x;
      aP0[i * 3 + 1] = f.p0.y;
      aP0[i * 3 + 2] = f.p0.z;

      aP1[i * 3 + 0] = f.p1.x;
      aP1[i * 3 + 1] = f.p1.y;
      aP1[i * 3 + 2] = f.p1.z;

      aP2[i * 3 + 0] = f.p2.x;
      aP2[i * 3 + 1] = f.p2.y;
      aP2[i * 3 + 2] = f.p2.z;

      aP3[i * 3 + 0] = f.p3.x;
      aP3[i * 3 + 1] = f.p3.y;
      aP3[i * 3 + 2] = f.p3.z;

      aColor[i * 3 + 0] = f.color.r;
      aColor[i * 3 + 1] = f.color.g;
      aColor[i * 3 + 2] = f.color.b;

      aSeed[i * 3 + 0] = Math.random();
      aSeed[i * 3 + 1] = 0.14 + Math.random() * 0.28;
      aSeed[i * 3 + 2] = 0.8 + Math.random() * 1.5;
    }

    const photonGeo = new THREE.BufferGeometry();
    photonGeo.setAttribute('position', new THREE.BufferAttribute(aP0, 3));
    photonGeo.setAttribute('aP1', new THREE.BufferAttribute(aP1, 3));
    photonGeo.setAttribute('aP2', new THREE.BufferAttribute(aP2, 3));
    photonGeo.setAttribute('aP3', new THREE.BufferAttribute(aP3, 3));
    photonGeo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
    photonGeo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 3));

    const photonMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uPinchRatio: { value: 0.5 },
        uPulse: { value: 0.15 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aP1;
        attribute vec3 aP2;
        attribute vec3 aP3;
        attribute vec3 aColor;
        attribute vec3 aSeed;

        uniform float uTime;
        uniform float uPinchRatio;
        uniform float uPulse;
        uniform float uPixelRatio;

        varying vec3 vColor;
        varying float vCoreHeat;

        vec3 evalBezier(float t, vec3 p0, vec3 p1, vec3 p2, vec3 p3) {
          float inv = 1.0 - t;
          return inv * inv * inv * p0 +
                 3.0 * inv * inv * t * p1 +
                 3.0 * inv * t * t * p2 +
                 t * t * t * p3;
        }

        void main() {
          float phase = aSeed.x;
          float speed = aSeed.y * (1.0 + uPulse * 1.4);
          float t = fract(phase + uTime * speed);

          // Dynamically compress middle control points toward central singularity (0,0,0)
          float pinchScale = mix(1.3, 0.22, uPinchRatio);
          vec3 c1 = vec3(aP1.x, aP1.y * pinchScale, aP1.z * pinchScale);
          vec3 c2 = vec3(aP2.x, aP2.y * pinchScale, aP2.z * pinchScale);

          vec3 pos = evalBezier(t, position, c1, c2, aP3);

          // Intense white-hot compression near singularity t = 0.5
          float distMid = abs(t - 0.5);
          vCoreHeat = smoothstep(0.24, 0.0, distMid);
          vColor = mix(aColor, vec3(1.0, 0.99, 0.94), vCoreHeat * 0.85);

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = (1.6 + vCoreHeat * 2.4) * aSeed.z * uPixelRatio * (34.0 / max(10.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vCoreHeat;

        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(p, p);
          if (r2 > 1.0) discard;

          float glow = exp(-r2 * 3.5);
          gl_FragColor = vec4(vColor * (1.15 + vCoreHeat * 0.8), glow * (0.65 + vCoreHeat * 0.35));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const photonPoints = new THREE.Points(photonGeo, photonMat);
    funnelGroup.add(photonPoints);

    // -------------------------------------------------------------------------
    // 3. CENTRAL WHITE-HOT SINGULARITY CORE & SHOCKWAVE RING
    // -------------------------------------------------------------------------
    const coreGeo = new THREE.IcosahedronGeometry(1.55, 3);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fff9e6'),
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    funnelGroup.add(coreMesh);

    const shockGeo = new THREE.RingGeometry(1.6, 2.0, 64);
    const shockMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#00f0ff'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    const shockMesh = new THREE.Mesh(shockGeo, shockMat);
    funnelGroup.add(shockMesh);

    // Mouse Parallax Drift
    let mouseX = 0;
    let mouseY = 0;
    const onPointerMove = (e: PointerEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2.0;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2.0;
      recordInteraction();
    };
    window.addEventListener('pointermove', onPointerMove);

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

      // Smooth 3D camera parallax
      camera.position.x += (mouseX * 9.0 - camera.position.x) * 0.05;
      camera.position.y += (-mouseY * 6.5 + 1.5 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      photonMat.uniforms.uTime.value = elapsedSec;
      photonMat.uniforms.uPinchRatio.value = snap.channelFunnelPinchRatio;
      photonMat.uniforms.uPulse.value = snap.shaderPulseIntensity;

      coreMesh.rotation.y = elapsedSec * 1.2;
      coreMesh.rotation.x = elapsedSec * 0.7;
      const coreScale = 1.0 + Math.sin(elapsedSec * 4.5) * 0.1 + snap.shaderPulseIntensity * 0.45;
      coreMesh.scale.setScalar(coreScale);

      // Shockwave expansion
      if (shockwaveRef.current > 0) {
        shockwaveRef.current += dt * 1.8;
        const s = 1.0 + shockwaveRef.current * 14.0;
        shockMesh.scale.setScalar(s);
        shockMat.opacity = Math.max(0, 1.0 - shockwaveRef.current);
        if (shockwaveRef.current >= 1.0) {
          shockwaveRef.current = 0;
          shockMat.opacity = 0;
        }
      }

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
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', handleResize);
      disposeThreeContextComplete(scene, renderer, postProcessor);
    };
  }, [recordInteraction]);

  return (
    <div className="relative w-full h-full bg-[#030305] overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full" />

      {/* Top-Left Telemetry Overlay */}
      <div className="absolute top-20 left-6 pointer-events-none hud-glass rounded-2xl px-4 py-3 space-y-1">
        <div className="font-mono text-[10px] tracking-[0.2em] text-[#d4af37] uppercase">
          VIEW 02 // NEURAL FUNNEL • 3D GPU SANKEY & 15,000 PHOTON COMPILER
        </div>
        <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
          <span className="text-white/90">
            REVPAR: <strong className="text-[#d4af37]">{telemetry.revParIqd.toLocaleString()} IQD</strong>
          </span>
          <span className="text-[#00f0ff]">
            PINCH RATIO: {telemetry.channelFunnelPinchRatio.toFixed(3)}
          </span>
          <span className="text-[#00e676]">READY SUITES: {telemetry.readyRooms}</span>
        </div>
      </div>

      {/* Left Channel Labels */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 space-y-5 pointer-events-none hidden lg:block">
        {CHANNELS.map((ch) => (
          <div key={ch.name} className="flex items-center gap-2.5 font-mono text-[10px]">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: ch.color, boxShadow: `0 0 12px ${ch.color}` }}
            />
            <span className="text-white/80 tracking-wider">{ch.label}</span>
          </div>
        ))}
      </div>

      {/* Right Floor Inventory Labels */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 space-y-4 pointer-events-none hidden lg:block">
        {[1, 2, 3, 4, 5, 6].map((fl) => {
          const flRooms = rooms.filter((r) => r.floor === fl);
          const occ = flRooms.filter((r) => r.occupancyStatus === 'occupied').length;
          const rdy = flRooms.filter(isRoomReady).length;
          return (
            <div
              key={fl}
              className="hud-glass rounded-xl px-3 py-1.5 font-mono text-[10px] text-right tabular-nums"
            >
              <div className="text-white font-semibold">
                FLOOR L{fl} • <span className="text-[#00f0ff]">{occ}/8 OCC</span>
              </div>
              <div className="text-[#00e676] text-[9px]">{rdy} READY SLOTS</div>
            </div>
          );
        })}
      </div>

      {/* Interactive Shockwave Booking Trigger */}
      <div className="absolute bottom-36 right-6">
        <button
          onClick={triggerBookingShockwave}
          className="px-5 py-2.5 rounded-full hud-glass border border-[#d4af37]/60 hover:bg-[#d4af37] text-[#d4af37] hover:text-[#030305] font-mono text-xs font-semibold uppercase tracking-[0.14em] shadow-[0_0_30px_rgba(212,175,55,0.25)] transition"
        >
          ⚡ Fire Live Booking Shockwave ({telemetry.readyRooms} Ready)
        </button>
      </div>
    </div>
  );
};
