import { create } from 'zustand';

export type CitadelViewId = 1 | 2 | 3 | 4 | 5 | 6;

interface CitadelState {
  citadelMode: boolean;
  activeView: CitadelViewId;
  autoCycle: boolean;
  targetFps: 60 | 24 | 0;
  measuredFps: number;
  lastInteractionTime: number;
  selectedRoomNumber: string | null;
  shaderPulseIntensity: number;
  lastPulseTimestamp: number;
  gpuDisposeGeneration: number;

  toggleCitadelMode: (force?: boolean) => void;
  setActiveView: (view: CitadelViewId) => void;
  toggleAutoCycle: () => void;
  recordInteraction: () => void;
  evaluateFrameThrottle: (isWindowFocused: boolean) => void;
  setMeasuredFps: (fps: number) => void;
  setSelectedRoomNumber: (roomNumber: string | null) => void;
  triggerShaderPulse: (intensity?: number) => void;
  decayShaderPulse: (dt: number) => void;
}

export const useCitadelStore = create<CitadelState>((set, get) => ({
  citadelMode: false,
  activeView: 1,
  autoCycle: false,
  targetFps: 60,
  measuredFps: 60,
  lastInteractionTime: Date.now(),
  selectedRoomNumber: null,
  shaderPulseIntensity: 0.15,
  lastPulseTimestamp: Date.now(),
  gpuDisposeGeneration: 0,

  toggleCitadelMode: (force) => {
    const current = get().citadelMode;
    const next = typeof force === 'boolean' ? force : !current;
    set((state) => ({
      citadelMode: next,
      targetFps: next ? 60 : 0,
      lastInteractionTime: Date.now(),
      // Increment generation on OFF so every WebGL view explicitly sees cold unmount signal
      gpuDisposeGeneration: !next ? state.gpuDisposeGeneration + 1 : state.gpuDisposeGeneration,
    }));
  },

  setActiveView: (activeView) =>
    set({
      activeView,
      lastInteractionTime: Date.now(),
      targetFps: 60,
    }),

  toggleAutoCycle: () =>
    set((state) => ({
      autoCycle: !state.autoCycle,
      lastInteractionTime: Date.now(),
      targetFps: 60,
    })),

  recordInteraction: () => {
    const state = get();
    if (!state.citadelMode) return;
    if (state.targetFps !== 60 || Date.now() - state.lastInteractionTime > 500) {
      set({
        lastInteractionTime: Date.now(),
        targetFps: 60,
      });
    }
  },

  evaluateFrameThrottle: (isWindowFocused) => {
    const state = get();
    if (!state.citadelMode || !isWindowFocused || document.hidden) {
      if (state.targetFps !== 0) {
        set({ targetFps: 0, measuredFps: 0 });
      }
      return;
    }

    const idleMs = Date.now() - state.lastInteractionTime;
    const desired: 60 | 24 = idleMs > 5000 ? 24 : 60;
    if (state.targetFps !== desired) {
      set({ targetFps: desired });
    }
  },

  setMeasuredFps: (measuredFps) => set({ measuredFps }),

  setSelectedRoomNumber: (selectedRoomNumber) =>
    set({
      selectedRoomNumber,
      lastInteractionTime: Date.now(),
      targetFps: 60,
    }),

  triggerShaderPulse: (intensity = 1.0) =>
    set({
      shaderPulseIntensity: Math.min(1.5, intensity),
      lastPulseTimestamp: Date.now(),
      lastInteractionTime: Date.now(),
      targetFps: 60,
    }),

  decayShaderPulse: (dt) => {
    const current = get().shaderPulseIntensity;
    if (current > 0.05) {
      set({ shaderPulseIntensity: Math.max(0.05, current - dt * 0.45) });
    }
  },
}));
