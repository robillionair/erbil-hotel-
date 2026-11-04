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

const VIEW_TABS: { id: CitadelViewId; short: string; title: string }[] = [
  { id: 1, short: '01 // SPATIAL VAULT', title: '3D Bokeh Point Cloud & Tower' },
  { id: 2, short: '02 // NEURAL FUNNEL', title: '85 Bezier Channel Compiler' },
  { id: 3, short: '03 // PIPELINE STACK', title: '2.5D Operations Workflow' },
  { id: 4, short: '04 // ORBITAL VORTEX', title: '65k Curl-Noise SLA Singularity' },
  { id: 5, short: '05 // COMMAND DAG', title: 'Hierarchical Operations Tree' },
  { id: 6, short: '06 // TREASURY LAB', title: 'Radial RevPAR & Thermal Plume' },
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
  const deltaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Auto-Cycle Director Mode Timer
  useEffect(() => {
    if (!autoCycle) return;
    const timer = window.setInterval(() => {
      const next = ((useCitadelStore.getState().activeView % 6) + 1) as CitadelViewId;
      setActiveView(next);
    }, 9000);
    return () => clearInterval(timer);
  }, [autoCycle, setActiveView]);

  // High-DPI (devicePixelRatio * 2) Perimeter Micro-Widgets Canvas Loop
  useEffect(() => {
    let rafId = 0;
    const dpr = Math.min((window.devicePixelRatio || 1) * 2, 4);
    const startTime = performance.now();

    const drawWidgets = (now: number) => {
      rafId = requestAnimationFrame(drawWidgets);
      const snap = computeTelemetrySnapshot();
      const t = (now - startTime) * 0.001;

      // -----------------------------------------------------------------------
      // WIDGET 1: L1-L6 FLOOR ROOM ALLOCATION MATRIX (6px x 6px cells, 1px gap)
      // -----------------------------------------------------------------------
      const mCanvas = matrixCanvasRef.current;
      if (mCanvas) {
        const cw = mCanvas.clientWidth || 300;
        const ch = mCanvas.clientHeight || 110;
        if (mCanvas.width !== Math.floor(cw * dpr) || mCanvas.height !== Math.floor(ch * dpr)) {
          mCanvas.width = Math.floor(cw * dpr);
          mCanvas.height = Math.floor(ch * dpr);
        }
        const ctx = mCanvas.getContext('2d')!;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#040406';
        ctx.fillRect(0, 0, cw, ch);

        const cellSize = 6;
        const gap = 1;
        const startX = 48;
        const startY = 18;

        ctx.font = '600 8px "JetBrains Mono", monospace';

        for (let floor = 6; floor >= 1; floor--) {
          const rowIdx = 6 - floor;
          const y = startY + rowIdx * (cellSize + gap + 5);

          ctx.fillStyle = '#686875';
          ctx.fillText(`FL_L${floor}`, 8, y + 6);

          const floorRooms = snap.roomNodes.filter((r) => r.floor === floor);
          floorRooms.forEach((rm, colIdx) => {
            // Render 3 sub-blocks per room to create an ultra-dense 24x6 micro-cell matrix
            for (let sub = 0; sub < 3; sub++) {
              const x = startX + (colIdx * 3 + sub) * (cellSize + gap);
              let color = '#00e676'; // Vacant Clean / Ready Emerald
              if (rm.maintenanceStatus === 'out_of_service') {
                color = '#18181f'; // Maintenance
              } else if (
                rm.housekeepingStatus !== 'clean' ||
                rm.inspectionStatus !== 'passed'
              ) {
                color = '#ff1e7a'; // Vacant Dirty / Urgent Turnover Magenta
              } else if (rm.occupancyStatus === 'occupied') {
                color = rm.isVip ? '#ff8a3d' : '#00f0ff'; // VIP Amber or Standard Cyan
              } else if (isRoomReady(rm)) {
                color = '#00e676';
              }

              ctx.fillStyle = color;
              ctx.fillRect(x, y, cellSize, cellSize);
            }
          });
        }

        // Matrix Legend on the right side of canvas
        const legX = startX + 24 * (cellSize + gap) + 14;
        const legendItems = [
          { color: '#ff8a3d', text: `VIP OCC (${snap.vipOccupiedRooms})` },
          { color: '#00f0ff', text: `STD OCC (${snap.occupiedRooms - snap.vipOccupiedRooms})` },
          { color: '#00e676', text: `READY (${snap.readyRooms})` },
          { color: '#ff1e7a', text: `TURNOVER (${snap.dirtyRooms})` },
          { color: '#18181f', text: `MAINT (${snap.outOfServiceRooms})` },
        ];
        legendItems.forEach((item, idx) => {
          const ly = 20 + idx * 14;
          ctx.fillStyle = item.color;
          ctx.fillRect(legX, ly, 6, 6);
          ctx.strokeStyle = '#32323e';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(legX, ly, 6, 6);
          ctx.fillStyle = '#9898a6';
          ctx.fillText(item.text, legX + 10, ly + 6);
        });

        ctx.restore();
      }

      // -----------------------------------------------------------------------
      // WIDGET 2: LIVE OPERATIONS DELTA STREAM CANVAS (~12ms DB Write Latency)
      // -----------------------------------------------------------------------
      const dCanvas = deltaCanvasRef.current;
      if (dCanvas) {
        const cw = dCanvas.clientWidth || 380;
        const ch = dCanvas.clientHeight || 110;
        if (dCanvas.width !== Math.floor(cw * dpr) || dCanvas.height !== Math.floor(ch * dpr)) {
          dCanvas.width = Math.floor(cw * dpr);
          dCanvas.height = Math.floor(ch * dpr);
        }
        const ctx = dCanvas.getContext('2d')!;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#040406';
        ctx.fillRect(0, 0, cw, ch);

        ctx.font = '500 8.5px "JetBrains Mono", monospace';
        const events = snap.eventLog.slice(0, 5);
        events.forEach((ev, idx) => {
          const y = 22 + idx * 16;
          const timeStr = new Date(ev.timestamp).toTimeString().slice(0, 8);

          ctx.fillStyle = '#585866';
          ctx.fillText(timeStr, 8, y);

          ctx.fillStyle =
            ev.severity === 'critical'
              ? '#ff1e7a'
              : ev.severity === 'emerald'
              ? '#00e676'
              : ev.severity === 'elevated'
              ? '#ff8a3d'
              : '#00f0ff';

          const summaryClip =
            ev.summary.length > 44 ? ev.summary.slice(0, 44) + '…' : ev.summary;
          ctx.fillText(summaryClip, 62, y);

          ctx.fillStyle = '#d4af37';
          ctx.textAlign = 'right';
          ctx.fillText(`${ev.latencyMs}ms`, cw - 8, y);
          ctx.textAlign = 'left';
        });

        ctx.restore();
      }

      // -----------------------------------------------------------------------
      // WIDGET 3: SUB-PIXEL REVENUE & SLA WAVEFORMS (0.6px Dual Bezier Area)
      // -----------------------------------------------------------------------
      const wCanvas = waveCanvasRef.current;
      if (wCanvas) {
        const cw = wCanvas.clientWidth || 340;
        const ch = wCanvas.clientHeight || 110;
        if (wCanvas.width !== Math.floor(cw * dpr) || wCanvas.height !== Math.floor(ch * dpr)) {
          wCanvas.width = Math.floor(cw * dpr);
          wCanvas.height = Math.floor(ch * dpr);
        }
        const ctx = wCanvas.getContext('2d')!;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#040406';
        ctx.fillRect(0, 0, cw, ch);

        // Subtle horizontal reference lines
        ctx.strokeStyle = '#14141c';
        ctx.lineWidth = 0.5;
        [28, 54, 80].forEach((gy) => {
          ctx.beginPath();
          ctx.moveTo(8, gy);
          ctx.lineTo(cw - 8, gy);
          ctx.stroke();
        });

        const drawWaveLayer = (
          strokeColor: string,
          fillRgba: string,
          phaseOffset: number,
          ampScale: number
        ) => {
          const pts: { x: number; y: number }[] = [];
          const count = 16;
          for (let i = 0; i <= count; i++) {
            const x = 8 + (i / count) * (cw - 16);
            const wave =
              Math.sin(i * 0.65 + t * 1.6 + phaseOffset) * 14 * ampScale +
              Math.cos(i * 1.2 - t * 1.1) * 7 * ampScale;
            const y = ch * 0.58 - wave;
            pts.push({ x, y });
          }

          // Area fill
          ctx.beginPath();
          ctx.moveTo(pts[0].x, ch - 8);
          ctx.lineTo(pts[0].x, pts[0].y);
          for (let i = 0; i < pts.length - 1; i++) {
            const xc = (pts[i].x + pts[i + 1].x) * 0.5;
            const yc = (pts[i].y + pts[i + 1].y) * 0.5;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
          }
          ctx.lineTo(pts[pts.length - 1].x, ch - 8);
          ctx.closePath();
          ctx.fillStyle = fillRgba;
          ctx.fill();

          // 0.6px Anti-Aliased Bezier Stroke
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

        // Layer 1: Hourly Check-In & Yield Velocity (Cyan)
        drawWaveLayer('#00f0ff', 'rgba(0, 240, 255, 0.09)', 0.0, 0.8 + snap.occupancyRatio * 0.5);
        // Layer 2: Housekeeping Turnaround Efficiency (Citadel Gold)
        drawWaveLayer('#d4af37', 'rgba(212, 175, 55, 0.08)', 2.1, 0.7 + snap.slaDriftScore * 0.6);

        ctx.font = '600 8px "JetBrains Mono", monospace';
        ctx.fillStyle = '#00f0ff';
        ctx.fillText(`VEL: ${(snap.occupancyPercent * 0.42).toFixed(1)} PAX/HR`, 12, 14);
        ctx.fillStyle = '#d4af37';
        ctx.fillText(`EFFICIENCY: ${(100 - snap.slaDriftScore * 28).toFixed(1)}%`, cw - 115, 14);

        ctx.restore();
      }
    };

    rafId = requestAnimationFrame(drawWidgets);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      onMouseMove={recordInteraction}
      onKeyDown={recordInteraction}
      className="w-screen h-[calc(100vh-44px)] bg-[#141418] grid grid-rows-[34px_1fr_118px] gap-[1px] overflow-hidden select-none font-mono"
    >
      {/* ROW 1: VIEW SWITCHER (1-6) + AUTO-CYCLE DIRECTOR + FPS PACER TELEMETRY */}
      <div className="bg-[#040406] px-3 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1">
          {VIEW_TABS.map((v) => {
            const active = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`px-2.5 py-1 text-[10px] tracking-[0.12em] uppercase transition border ${
                  active
                    ? 'bg-[#12121a] text-[#d4af37] border-[#d4af37]'
                    : 'bg-[#040406] text-[#686875] border-[#16161a] hover:text-[#f4f0ea]'
                }`}
              >
                [{v.short}]
              </button>
            );
          })}
          <button
            onClick={toggleAutoCycle}
            className={`ml-2 px-2.5 py-1 text-[10px] tracking-[0.12em] uppercase border transition ${
              autoCycle
                ? 'bg-[#00e676]/15 text-[#00e676] border-[#00e676]'
                : 'bg-[#040406] text-[#686875] border-[#16161a] hover:text-[#f4f0ea]'
            }`}
          >
            [DIRECTOR AUTO-CYCLE: {autoCycle ? 'ON' : 'OFF'}]
          </button>
        </div>

        <div className="flex items-center gap-4 text-[10px] tabular-nums shrink-0">
          <span className="text-[#686875]">
            POST-FX: <strong className="text-[#d4af37]">BLOOM + CHROMA 0.0012 + SMAA</strong>
          </span>
          <span className="text-[#686875]">
            FRAME PACER:{' '}
            <strong className={targetFps === 60 ? 'text-[#00e676]' : 'text-[#ff8a3d]'}>
              {measuredFps} FPS (TARGET {targetFps})
            </strong>
          </span>
        </div>
      </div>

      {/* ROW 2: CENTERPIECE WEBGL / CANVAS ENGINE VIEWPORT */}
      <div className="bg-[#030305] relative w-full h-full overflow-hidden">
        {activeView === 1 && <View1SpatialVault />}
        {activeView === 2 && <View2BookingFunnel />}
        {activeView === 3 && <View3PipelineStack />}
        {activeView === 4 && <View4OrbitalVortex />}
        {activeView === 5 && <View5CommandDag />}
        {activeView === 6 && <View6TreasuryLab />}
      </div>

      {/* ROW 3: PERIMETER HUD HIGH-DPI (devicePixelRatio * 2) CANVAS MICRO-WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[#141418] h-full">
        {/* Micro-Widget 1: L1-L6 Floor Room Allocation Matrix */}
        <div className="bg-[#040406] relative flex flex-col">
          <div className="px-2.5 pt-1.5 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.14em] text-[#686875]">
              01 // L1–L6 FLOOR ROOM ALLOCATION MATRIX (6PX MICRO-CELLS)
            </span>
            <span className="text-[9px] text-[#00e676] tabular-nums">
              {telemetry.readyRooms}/{telemetry.totalRooms} READY
            </span>
          </div>
          <canvas ref={matrixCanvasRef} className="w-full flex-1 block" />
        </div>

        {/* Micro-Widget 2: Live Operations Delta Stream */}
        <div className="bg-[#040406] relative flex flex-col">
          <div className="px-2.5 pt-1.5 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.14em] text-[#686875]">
              02 // LIVE OPERATIONS DELTA STREAM & SUPABASE WRITE LATENCY
            </span>
            <span className="text-[9px] text-[#d4af37] tabular-nums">~11ms SYNC</span>
          </div>
          <canvas ref={deltaCanvasRef} className="w-full flex-1 block" />
        </div>

        {/* Micro-Widget 3: Sub-Pixel Revenue & SLA Waveforms */}
        <div className="bg-[#040406] relative flex flex-col">
          <div className="px-2.5 pt-1.5 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-[0.14em] text-[#686875]">
              03 // SUB-PIXEL REVENUE & SLA WAVEFORMS (0.6PX BEZIER)
            </span>
            <span className="text-[9px] text-[#00f0ff] tabular-nums">
              ${telemetry.dualCurrencyRevenue.totalUsd.toLocaleString()} USD
            </span>
          </div>
          <canvas ref={waveCanvasRef} className="w-full flex-1 block" />
        </div>
      </div>
    </div>
  );
};
