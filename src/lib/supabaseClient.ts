import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project-id')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    })
  : null;

export interface RealtimeOperationalEvent {
  id: string;
  timestamp: number;
  type:
    | 'ACCOUNT_CREATED'
    | 'ROOM_BOOKED'
    | 'CHECK_IN'
    | 'CHECK_OUT'
    | 'HOUSEKEEPING_UPDATE'
    | 'INSPECTION_VERDICT'
    | 'MAINTENANCE_UPDATE'
    | 'ROOM_SERVICE_ORDER'
    | 'TREASURY_SETTLEMENT';
  roomNumber?: string;
  floor?: number;
  channel?: string;
  amountIqd?: number;
  amountUsd?: number;
  latencyMs: number;
  summary: string;
  severity: 'nominal' | 'elevated' | 'critical' | 'emerald';
}

type EventListener = (event: RealtimeOperationalEvent) => void;

class LocalRealtimeBus {
  private listeners: Set<EventListener> = new Set();

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: Omit<RealtimeOperationalEvent, 'id' | 'timestamp' | 'latencyMs'>) {
    const fullEvent: RealtimeOperationalEvent = {
      ...event,
      id: `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      timestamp: Date.now(),
      latencyMs: Math.floor(8 + Math.random() * 9), // ~8-16ms realistic DB write latency
    };
    this.listeners.forEach((fn) => fn(fullEvent));
    return fullEvent;
  }
}

export const realtimeBus = new LocalRealtimeBus();

export function safeStorageGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeStorageSet<T>(key: string, value: T): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
