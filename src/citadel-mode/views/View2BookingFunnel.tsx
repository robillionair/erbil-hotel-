import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createCitadelPostProcessor,
  disposeThreeContextComplete,
} from '../postprocessing/CitadelPostProcessor';
import { useErbilTelemetry, computeTelemetrySnapshot } from '../telemetry/ErbilTelemetryStream';
import { useCitadelStore } from '../../store/useCitadelStore';
import { useHotelOpsStore, isRoomReady, BookingChannel } from '../../store/useHotelOpsStore';

const CHANNELS: { name: BookingChannel; color: string; yNorm: number }[] = [
  { name: 'Direct_Web', color: '#d4af37', yNorm: 0.16 },
  { name: 'Booking_OTA', color: '#ff8a3d', yNorm: 0.33 },
  { name: 'Embassy_Corp', color: '#00f0ff', yNorm: 0.5 },
  { name: 'Walk_In_VIP', color: '#00e676', yNorm: 0.67 },
  { name: 'Airport_Transfer', color: '#ff1e7a', yNorm: 0.84 },
];

interface PhotonPacket {
  filamentIdx: number;
  t: number; // 0.0 (left) -> 0.5 (singularity) -> 1.0 (right floor slot)
  speed: number;
  color: string;
  size: number;
  highEnergy: boolean;
}

export const View2BookingFunnel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const telemetry = useErbilTelemetry();
  const { recordInteraction, triggerShaderPulse } = useCitadelStore();
  const { rooms, checkInGuest } = useHotelOpsStore();

  const triggerSimulatedBookingPulse = () => {
    recordInteraction();
    triggerShaderPulse(1.3);
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
    const dpr = Math.min((window.devicePixelRatio || 1) * 2, 3);

    // Offscreen High-DPI 2D Canvas (devicePixelRatio * 2)
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = Math.floor(width * dpr);
    offscreenCanvas.height = Math.floor(height * dpr);
    const ctx = offscreenCanvas.getContext('2d')!;

    // WebGL Scene + Fullscreen Quad routed through CitadelPostProcessor
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
    const quadMesh = new THREE.Mesh(quadGeo, quadMat);
    scene.add(quadMesh);

    const postProcessor = createCitadelPostProcessor(renderer, scene, camera, width, height);
    postProcessor.bloomPass.strength = 0.72;
    postProcessor.bloomPass.threshold = 0.22;

    // Build 85 inbound-to-outbound filament definitions
    const filaments = Array.from({ length: 85 }, (_, i) => {
      const chIndex = i % CHANNELS.length;
      const floorIndex = i % 6; // Floors L1 - L6
      const jitterLeft = ((i * 17) % 100) / 100 - 0.5;
      const jitterRight = ((i * 29) % 100) / 100 - 0.5;
      return {
        chIndex,
        floorIndex,
        color: CHANNELS[chIndex].color,
        leftYNorm: CHANNELS[chIndex].yNorm + jitterLeft * 0.11,
        rightYNorm: 0.14 + floorIndex * 0.142 + jitterRight * 0.06,
        pinchOffset: ((i - 42) / 42) * 26,
      };
    });

    // Active Photon Packets flowing along the cubic bezier curves
    const packets: PhotonPacket[] = Array.from({ length: 140 }, (_, i) => ({
      filamentIdx: i % filaments.length,
      t: Math.random(),
      speed: 0.16 + Math.random() * 0.24,
      color: filaments[i % filaments.length].color,
      size: 1.5 + Math.random() * 1.8,
      highEnergy: i % 9 === 0,
    }));

    // Helper: Evaluate Cubic Bezier at parameter u in [0,1]
    const evalCubicBezier = (
      u: number,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x3: number,
      y3: number
    ) => {
      const inv = 1 - u;
      const b0 = inv * inv * inv;
      const b1 = 3 * inv * inv * u;
      const b2 = 3 * inv * u * u;
      const b3 = u * u * u;
      return {
        x: b0 * x0 + b1 * x1 + b2 * x2 + b3 * x3,
        y: b0 * y0 + b1 * y1 + b2 * y2 + b3 * y3,
      };
    };

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
      const elapsedSinceLast = now - lastFrameTime;
      if (elapsedSinceLast < minInterval - 1) return;

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

      const W = offscreenCanvas.width;
      const H = offscreenCanvas.height;

      ctx.save();
      ctx.fillStyle = '#030305';
      ctx.fillRect(0, 0, W, H);

      // Subtle vertical measurement grid hairlines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let gx = 1; gx < 8; gx++) {
        const xPos = (W / 8) * gx;
        ctx.beginPath();
        ctx.moveTo(xPos, 0);
        ctx.lineTo(xPos, H);
        ctx.stroke();
      }

      const leftX = W * 0.11;
      const centerX = W * 0.5;
      const centerY = H * 0.5;
      const rightX = W * 0.88;

      // Dynamic pinch tightness driven by occupancy compression & pulse
      const pinchTightness = Math.max(0.22, 1.0 - snap.channelFunnelPinchRatio * 0.68);

      // Draw 85 ultra-thin (0.45px logical * dpr) glowing cubic bezier filaments
      ctx.lineWidth = 0.45 * dpr;
      for (let i = 0; i < filaments.length; i++) {
        const f = filaments[i];
        const yLeft = f.leftYNorm * H;
        const yMid = centerY + f.pinchOffset * dpr * pinchTightness;
        const yRight = f.rightYNorm * H;

        ctx.strokeStyle = f.color;
        ctx.globalAlpha = 0.24 + snap.shaderPulseIntensity * 0.18;

        // Left half: Channel -> Central Singularity Node
        ctx.beginPath();
        ctx.moveTo(leftX, yLeft);
        ctx.bezierCurveTo(
          leftX + (centerX - leftX) * 0.55,
          yLeft,
          centerX - (centerX - leftX) * 0.42,
          yMid,
          centerX,
          yMid
        );
        ctx.stroke();

        // Right half: Central Singularity Node -> Floor L1-L6 Slot
        ctx.beginPath();
        ctx.moveTo(centerX, yMid);
        ctx.bezierCurveTo(
          centerX + (rightX - centerX) * 0.42,
          yMid,
          rightX - (rightX - centerX) * 0.55,
          yRight,
          rightX,
          yRight
        );
        ctx.stroke();
      }

      // Update & Render High-Velocity Photon Packets
      ctx.globalAlpha = 1.0;
      for (let i = 0; i < packets.length; i++) {
        const p = packets[i];
        p.t += dt * p.speed * (1.0 + snap.shaderPulseIntensity * 1.45);
        if (p.t > 1.0) {
          p.t -= 1.0;
        }

        const f = filaments[p.filamentIdx];
        const yLeft = f.leftYNorm * H;
        const yMid = centerY + f.pinchOffset * dpr * pinchTightness;
        const yRight = f.rightYNorm * H;

        let pt: { x: number; y: number };
        if (p.t < 0.5) {
          const u = p.t * 2.0;
          pt = evalCubicBezier(
            u,
            leftX,
            yLeft,
            leftX + (centerX - leftX) * 0.55,
            yLeft,
            centerX - (centerX - leftX) * 0.42,
            yMid,
            centerX,
            yMid
          );
        } else {
          const u = (p.t - 0.5) * 2.0;
          pt = evalCubicBezier(
            u,
            centerX,
            yMid,
            centerX + (rightX - centerX) * 0.42,
            yMid,
            rightX - (rightX - centerX) * 0.55,
            yRight,
            rightX,
            yRight
          );
        }

        const distToSingularity = Math.abs(p.t - 0.5);
        const coreBoost = distToSingularity < 0.08 ? 1.8 : 1.0;

        ctx.fillStyle = distToSingularity < 0.06 ? '#ffffff' : p.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size * dpr * coreBoost * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      // Central White-Hot Singularity Node: ERBIL.YIELD.ENGINE // LIVE ALLOCATION
      const singRadius = (24 + Math.sin(elapsedSec * 4.0) * 3 + snap.shaderPulseIntensity * 18) * dpr;
      const grad = ctx.createRadialGradient(centerX, centerY, 2 * dpr, centerX, centerY, singRadius * 2.4);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      grad.addColorStop(0.28, 'rgba(212, 175, 55, 0.72)');
      grad.addColorStop(0.65, 'rgba(0, 240, 255, 0.18)');
      grad.addColorStop(1, 'rgba(3, 3, 5, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, singRadius * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Singularity Precision Reticle Ring
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 0.8 * dpr;
      ctx.beginPath();
      ctx.arc(centerX, centerY, singRadius * 1.15, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = `600 ${Math.round(9 * dpr)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#f4f0ea';
      ctx.textAlign = 'center';
      ctx.fillText('ERBIL.YIELD.ENGINE // LIVE ALLOCATION', centerX, centerY - singRadius * 1.5);
      ctx.fillStyle = '#d4af37';
      ctx.fillText(
        `PINCH RATIO: ${snap.channelFunnelPinchRatio.toFixed(3)} // ADR: ${snap.adrIqd.toLocaleString()} IQD`,
        centerX,
        centerY + singRadius * 1.65
      );

      // Left Demand Source Nodes
      ctx.textAlign = 'right';
      CHANNELS.forEach((ch) => {
        const cy = ch.yNorm * H;
        ctx.fillStyle = ch.color;
        ctx.beginPath();
        ctx.arc(leftX, cy, 3.5 * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f4f0ea';
        ctx.font = `600 ${Math.round(9.5 * dpr)}px "JetBrains Mono", monospace`;
        ctx.fillText(ch.name.toUpperCase(), leftX - 10 * dpr, cy + 3 * dpr);
      });

      // Right Floor L1-L6 Inventory Nodes
      ctx.textAlign = 'left';
      for (let fIdx = 0; fIdx < 6; fIdx++) {
        const floorNum = fIdx + 1;
        const fy = (0.14 + fIdx * 0.142) * H;
        const floorRooms = snap.roomNodes.filter((r) => r.floor === floorNum);
        const occ = floorRooms.filter((r) => r.occupancyStatus === 'occupied').length;
        const rdy = floorRooms.filter(isRoomReady).length;

        ctx.fillStyle = '#00e676';
        ctx.beginPath();
        ctx.arc(rightX, fy, 3.5 * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f4f0ea';
        ctx.font = `600 ${Math.round(9.5 * dpr)}px "JetBrains Mono", monospace`;
        ctx.fillText(`FLOOR L${floorNum} [${occ}/8 OCC]`, rightX + 10 * dpr, fy - 1 * dpr);
        ctx.fillStyle = '#00e676';
        ctx.font = `400 ${Math.round(8.5 * dpr)}px "JetBrains Mono", monospace`;
        ctx.fillText(`READY SLOTS: ${rdy}`, rightX + 10 * dpr, fy + 11 * dpr);
      }

      ctx.restore();

      canvasTexture.needsUpdate = true;
      postProcessor.update(elapsedSec, snap.shaderPulseIntensity);
    };

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

      {/* Top HUD Overlay */}
      <div className="absolute top-3 left-3 pointer-events-none font-mono space-y-1">
        <div className="text-[9px] tracking-[0.18em] text-[#686875] uppercase">
          VIEW 02 // NEURAL FUNNEL: RESERVATION & YIELD COMPILER (85 CUBIC BEZIER FILAMENTS @ 0.45PX)
        </div>
        <div className="flex items-center gap-4 text-[11px] tabular-nums">
          <span className="text-[#d4af37]">
            REVPAR: {telemetry.revParIqd.toLocaleString()} IQD (${telemetry.revParUsd})
          </span>
          <span className="text-[#00f0ff]">
            PINCH RATIO: {telemetry.channelFunnelPinchRatio.toFixed(3)}
          </span>
          <span className="text-[#00e676]">READY INVENTORY: {telemetry.readyRooms} SUITES</span>
        </div>
      </div>

      {/* Interactive Live Booking Photon Trigger Button */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2 font-mono text-[10px]">
        <button
          onClick={triggerSimulatedBookingPulse}
          className="px-3.5 py-2 bg-[#08080e] hover:bg-[#d4af37] text-[#d4af37] hover:text-[#030305] border border-[#d4af37] font-bold uppercase tracking-[0.14em] transition"
        >
          ⚡ FIRE LIVE BOOKING PHOTON BURST ({telemetry.readyRooms} READY)
        </button>
      </div>
    </div>
  );
};
