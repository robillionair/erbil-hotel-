import React, { useEffect, useRef } from 'react';
import { useCitadelStore, CitadelViewId } from '../store/useCitadelStore';
import { useErbilTelemetry, computeTelemetrySnapshot } from './telemetry/ErbilTelemetryStream';
import { isRoomReady } from '../store/useHotelOpsStore';
import { View1SpatialVault } from './views/View1SpatialVault';
import { View2BookingFunnel } from './views/View2BookingFunnel';
import { View3PipelineStack } from './views/View3PipelineStack';
import { View4OrbitalVortex } from './views/View4OrbitalVortex';
import { View5CommandDag } from './views/View5CommandDag';
import { View6TreasuryLab } from './views/View6TreasuryLab';

const VIEW_TABS: { id: CitadelViewId; code: string; label: string }[] = [
  { id: 1, code: '01', label: 'Spatial Vault' },
  { id: 2, code: '02', label: 'Neural Funnel' },
  { id: 3, code: '03', label: 'Pipeline Stack' },
  { id: 4, code: '04', label: 'Orbital Vortex' },
  { id: 5, code: '05', label: 'Command DAG' },
  { id: 6, code: '06', label: 'Treasury Lab' },
];

export const CitadelShell: React.FC = () => {
  const {
    activeView,
    setActiveView,
    autoCycle,
    toggleAutoCycle,
    targetFps,
    measuredFps,
    recordInteraction,
    setSelectedRoomNumber,
  } = useCitadelStore();

  const telemetry = useErbilTelemetry();

  const matrixCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tickerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keyboard 1-6 View Switcher
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName || '')) {
        return;
      }
      if (e.key >= '1' && e.key <= '6') {
        setActiveView(Number(e.key) as CitadelViewId);
      } else if (e.key === 'Escape') {
        setSelectedRoomNumber(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setActiveView, setSelectedRoomNumber]);

  // Director Auto-Cycle Timer
  useEffect(() => {
    if (!autoCycle) return;
    const timer = window.setInterval(() => {
      const next = ((useCitadelStore.getState().activeView % 6) + 1) as CitadelViewId;
      setActiveView(next);
    }, 9000);
    return () => clearInterval(timer);
  }, [autoCycle, setActiveView]);

  // High-DPI (devicePixelRatio * 2) Floating Bottom Telemetry Dock Loop
  useEffect(() => {
    let rafId = 0;
    const dpr = Math.min((window.devicePixelRatio || 1) * 2, 4);
    const startTime = performance.now();

    const drawDock = (now: number) => {
      rafId = requestAnimationFrame(drawDock);
      const snap = computeTelemetrySnapshot();
      const t = (now - startTime) * 0.001;

      // -----------------------------------------------------------------------
      // DOCK PANEL 1: L1-L6 MICRO-CELL ALLOCATION MATRIX (4px x 4px optical cells)
      // -----------------------------------------------------------------------
      const mCanvas = matrixCanvasRef.current;
      if (mCanvas) {
        const cw = mCanvas.clientWidth || 300;
        const ch = mCanvas.clientHeight || 86;
        if (mCanvas.width !== Math.floor(cw * dpr) || mCanvas.height !== Math.floor(ch * dpr)) {
          mCanvas.width = Math.floor(cw * dpr);
          mCanvas.height = Math.floor(ch * dpr);
        }
        const ctx = mCanvas.getContext('2d')!;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cw, ch);

        const cellSize = 4;
        const gap = 2;
        const startX = 36;
        const startY = 8;

        ctx.font = '500 8px "JetBrains Mono", monospace';

        for (let floor = 6; floor >= 1; floor--) {
          const rowIdx = 6 - floor;
          const y = startY + rowIdx * (cellSize + gap + 6);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.fillText(`L0${floor}`, 6, y + 4);

          const floorRooms = snap.roomNodes.filter((r) => r.floor === floor);
          floorRooms.forEach((rm, colIdx) => {
            for (let sub = 0; sub < 3; sub++) {
              const x = startX + (colIdx * 3 + sub) * (cellSize + gap);
              let color = '#00e676';
              if (rm.maintenanceStatus === 'out_of_service') {
                color = 'rgba(255, 255, 255, 0.14)';
              } else if (
                rm.housekeepingStatus !== 'clean' ||
                rm.inspectionStatus !== 'passed'
              ) {
                color = '#ff1e7a';
              } else if (rm.occupancyStatus === 'occupied') {
                color = rm.isVip ? '#ff9e2c' : '#00f0ff';
              } else if (isRoomReady(rm)) {
                color = '#00e676';
              }

              ctx.shadowColor = color;
              ctx.shadowBlur = 4;
              ctx.fillStyle = color;
              ctx.fillRect(x, y, cellSize, cellSize);
            }
          });
        }

        // Optical Legend
        ctx.shadowBlur = 0;
        const legX = startX + 24 * (cellSize + gap) + 14;
        const legend = [
          { c: '#ff9e2c', l: `VIP (${snap.vipOccupiedRooms})` },
          { c: '#00f0ff', l: `OCC (${snap.occupiedRooms - snap.vipOccupiedRooms})` },
          { c: '#00e676', l: `RDY (${snap.readyRooms})` },
          { c: '#ff1e7a', l: `SLA (${snap.dirtyRooms})` },
        ];
        legend.forEach((item, idx) => {
          const ly = 12 + idx * 16;
          ctx.fillStyle = item.c;
          ctx.fillRect(legX, ly, 4, 4);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.fillText(item.l, legX + 8, ly + 4);
        });

        ctx.restore();
      }

      // -----------------------------------------------------------------------
      // DOCK PANEL 2: DUAL-LAYER ANTI-ALIASED BEZIER WAVEFORMS (0.6px stroke)
      // -----------------------------------------------------------------------
      const wCanvas = waveCanvasRef.current;
      if (wCanvas) {
        const cw = wCanvas.clientWidth || 340;
        const ch = wCanvas.clientHeight || 86;
        if (wCanvas.width !== Math.floor(cw * dpr) || wCanvas.height !== Math.floor(ch * dpr)) {
          wCanvas.width = Math.floor(cw * dpr);
          wCanvas.height = Math.floor(ch * dpr);
        }
        const ctx = wCanvas.getContext('2d')!;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cw, ch);

        const drawWaveLayer = (
          strokeColor: string,
          gradTop: string,
          phaseOffset: number,
          ampScale: number
        ) => {
          const pts: { x: number; y: number }[] = [];
          const count = 20;
          for (let i = 0; i <= count; i++) {
            const x = 6 + (i / count) * (cw - 12);
            const wave =
              Math.sin(i * 0.6 + t * 1.8 + phaseOffset) * 14 * ampScale +
              Math.cos(i * 1.15 - t * 1.2) * 6 * ampScale;
            const y = ch * 0.56 - wave;
            pts.push({ x, y });
          }

          const grad = ctx.createLinearGradient(0, 8, 0, ch);
          grad.addColorStop(0, gradTop);
          grad.addColorStop(1, 'rgba(3, 3, 5, 0.0)');

          ctx.beginPath();
          ctx.moveTo(pts[0].x, ch - 4);
          ctx.lineTo(pts[0].x, pts[0].y);
          for (let i = 0; i < pts.length - 1; i++) {
            const xc = (pts[i].x + pts[i + 1].x) * 0.5;
            const yc = (pts[i].y + pts[i + 1].y) * 0.5;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
          }
          ctx.lineTo(pts[pts.length - 1].x, ch - 4);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 0; i < pts.length - 1; i++) {
            const xc = (pts[i].x + pts[i + 1].x) * 0.5;
            const yc = (pts[i].y + pts[i + 1].y) * 0.5;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
          }
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        };

        drawWaveLayer('#00f0ff', 'rgba(0, 240, 255, 0.22)', 0.0, 0.8 + snap.occupancyRatio * 0.45);
        drawWaveLayer('#d4af37', 'rgba(212, 175, 55, 0.18)', 2.1, 0.75 + snap.slaDriftScore * 0.5);
        drawWaveLayer('#ff1e7a', 'rgba(255, 30, 122, 0.12)', 4.2, 0.45 + snap.shaderPulseIntensity * 0.4);

        ctx.restore();
      }

      // -----------------------------------------------------------------------
      // DOCK PANEL 3: LIVE TELEMETRY EVENT TICKER (~11ms Write Latencies)
      // -----------------------------------------------------------------------
      const tCanvas = tickerCanvasRef.current;
      if (tCanvas) {
        const cw = tCanvas.clientWidth || 380;
        const ch = tCanvas.clientHeight || 86;
        if (tCanvas.width !== Math.floor(cw * dpr) || tCanvas.height !== Math.floor(ch * dpr)) {
          tCanvas.width = Math.floor(cw * dpr);
          tCanvas.height = Math.floor(ch * dpr);
        }
        const ctx = tCanvas.getContext('2d')!;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cw, ch);

        ctx.font = '500 8.5px "JetBrains Mono", monospace';
        const events = snap.eventLog.slice(0, 4);
        events.forEach((ev, idx) => {
          const y = 16 + idx * 17;
          const timeStr = new Date(ev.timestamp).toTimeString().slice(0, 8);

          const dotCol =
            ev.severity === 'critical'
              ? '#ff1e7a'
              : ev.severity === 'emerald'
              ? '#00e676'
              : ev.severity === 'elevated'
              ? '#ff9e2c'
              : '#00f0ff';

          ctx.fillStyle = dotCol;
          ctx.beginPath();
          ctx.arc(10, y - 3, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.fillText(timeStr, 18, y);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
          const clip = ev.summary.length > 42 ? ev.summary.slice(0, 42) + '…' : ev.summary;
          ctx.fillText(clip, 68, y);

          ctx.fillStyle = '#d4af37';
          ctx.textAlign = 'right';
          ctx.fillText(`${ev.latencyMs}ms`, cw - 8, y);
          ctx.textAlign = 'left';
        });

        ctx.restore();
      }
    };

    rafId = requestAnimationFrame(drawDock);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      onMouseMove={recordInteraction}
      onKeyDown={recordInteraction}
      className="relative w-screen h-[calc(100vh-56px)] bg-[#030305] overflow-hidden select-none"
    >
      {/* EDGE-TO-EDGE 100VW x 100VH WEBGL CENTERPIECE CANVAS */}
      <div className="absolute inset-0 w-full h-full">
        {activeView === 1 && <View1SpatialVault />}
        {activeView === 2 && <View2BookingFunnel />}
        {activeView === 3 && <View3PipelineStack />}
        {activeView === 4 && <View4OrbitalVortex />}
        {activeView === 5 && <View5CommandDag />}
        {activeView === 6 && <View6TreasuryLab />}
      </div>

      {/* FLOATING TOP SUB-PIXEL GLASSMORPHIC VIEW SWITCHER */}
      <div className="absolute top-4 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="hud-glass rounded-full p-1 flex items-center gap-1 pointer-events-auto overflow-x-auto">
          {VIEW_TABS.map((v) => {
            const active = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  active
                    ? 'bg-gradient-to-r from-[#d4af37] to-[#b89225] text-[#030305] font-semibold shadow-lg'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                <span className="font-mono text-[10px] opacity-75">{v.code}</span>
                <span>{v.label}</span>
              </button>
            );
          })}
          <button
            onClick={toggleAutoCycle}
            className={`ml-1 px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
              autoCycle
                ? 'bg-[#00e676]/20 text-[#00e676] border border-[#00e676]/50'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Auto-Cycle {autoCycle ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Right Optical Post-FX & FPS Pill */}
        <div className="hud-glass rounded-full px-4 py-2 font-mono text-[11px] flex items-center gap-4 tabular-nums pointer-events-auto">
          <span className="text-white/55 hidden sm:inline">
            HDR BLOOM <strong className="text-[#d4af37]">1.35</strong> • CHROMA{' '}
            <strong className="text-[#00f0ff]">0.0014</strong>
          </span>
          <span className={targetFps === 60 ? 'text-[#00e676]' : 'text-[#ff9e2c]'}>
            ● {measuredFps} FPS
          </span>
        </div>
      </div>

      {/* FLOATING HIGH-DPI BOTTOM TELEMETRY DOCK */}
      <div className="absolute bottom-4 left-6 right-6 z-20 grid grid-cols-1 md:grid-cols-3 gap-4 pointer-events-none">
        {/* Dock Panel 1: L1-L6 Micro-Cell Allocation Matrix */}
        <div className="hud-glass rounded-2xl p-3 flex flex-col pointer-events-auto">
          <div className="flex items-center justify-between px-1 pb-1 font-mono text-[9px] tracking-[0.14em] uppercase">
            <span className="text-white/55">L1–L6 Optical Allocation Matrix (4px Cells)</span>
            <span className="text-[#00e676] tabular-nums">
              {telemetry.readyRooms}/{telemetry.totalRooms} READY
            </span>
          </div>
          <canvas ref={matrixCanvasRef} className="w-full h-[82px] block" />
        </div>

        {/* Dock Panel 2: Dual-Layer Anti-Aliased Bezier Waveforms */}
        <div className="hud-glass rounded-2xl p-3 flex flex-col pointer-events-auto">
          <div className="flex items-center justify-between px-1 pb-1 font-mono text-[9px] tracking-[0.14em] uppercase">
            <span className="text-white/55">RevPAR Velocity & SLA Coherence (0.6px Bezier)</span>
            <span className="text-[#d4af37] tabular-nums">
              ${telemetry.dualCurrencyRevenue.totalUsd.toLocaleString()} USD
            </span>
          </div>
          <canvas ref={waveCanvasRef} className="w-full h-[82px] block" />
        </div>

        {/* Dock Panel 3: Live Telemetry Event Ticker */}
        <div className="hud-glass rounded-2xl p-3 flex flex-col pointer-events-auto">
          <div className="flex items-center justify-between px-1 pb-1 font-mono text-[9px] tracking-[0.14em] uppercase">
            <span className="text-white/55">Realtime Operations Delta Stream</span>
            <span className="text-[#00f0ff] tabular-nums">~11ms DB SYNC</span>
          </div>
          <canvas ref={tickerCanvasRef} className="w-full h-[82px] block" />
        </div>
      </div>
    </div>
  );
};
