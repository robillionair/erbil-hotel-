import { useMemo } from 'react';
import {
  useHotelOpsStore,
  isRoomReady,
  RoomNode,
  EXCHANGE_RATE_IQD,
} from '../../store/useHotelOpsStore';
import { useCitadelStore } from '../../store/useCitadelStore';
import { RealtimeOperationalEvent } from '../../lib/supabaseClient';

export interface ErbilTelemetrySnapshot {
  occupiedRooms: number;
  totalRooms: number;
  readyRooms: number;
  dirtyRooms: number;
  awaitingInspectionRooms: number;
  outOfServiceRooms: number;
  vipOccupiedRooms: number;
  occupancyRatio: number; // 0.0 to 1.0
  occupancyPercent: number; // 0.0 to 100.0
  adrIqd: number;
  adrUsd: number;
  revParIqd: number;
  revParUsd: number;
  dualCurrencyRevenue: {
    totalIqd: number;
    totalUsd: number;
    roomRevenueIqd: number;
    culinaryRevenueIqd: number;
    exchangeRate: number;
  };
  slaDriftScore: number; // 0.000 to 1.000
  channelFunnelPinchRatio: number; // 0.15 to 0.95
  roomNodes: RoomNode[];
  activeServiceOrderCount: number;
  openMaintenanceCount: number;
  overdueHousekeepingCount: number;
  shaderPulseIntensity: number;
  latestEvent: RealtimeOperationalEvent | null;
  eventLog: RealtimeOperationalEvent[];
}

export function computeTelemetrySnapshot(): ErbilTelemetrySnapshot {
  const ops = useHotelOpsStore.getState();
  const citadel = useCitadelStore.getState();
  return deriveMetrics(
    ops.rooms,
    ops.reservations,
    ops.housekeepingTasks,
    ops.maintenanceTickets,
    ops.roomServiceOrders,
    ops.eventLog,
    citadel.shaderPulseIntensity
  );
}

function deriveMetrics(
  rooms: RoomNode[],
  reservations: ReturnType<typeof useHotelOpsStore.getState>['reservations'],
  housekeepingTasks: ReturnType<typeof useHotelOpsStore.getState>['housekeepingTasks'],
  maintenanceTickets: ReturnType<typeof useHotelOpsStore.getState>['maintenanceTickets'],
  roomServiceOrders: ReturnType<typeof useHotelOpsStore.getState>['roomServiceOrders'],
  eventLog: RealtimeOperationalEvent[],
  shaderPulseIntensity: number
): ErbilTelemetrySnapshot {
  const totalRooms = rooms.length || 48;
  let occupiedRooms = 0;
  let readyRooms = 0;
  let dirtyRooms = 0;
  let awaitingInspectionRooms = 0;
  let outOfServiceRooms = 0;
  let vipOccupiedRooms = 0;

  for (const r of rooms) {
    if (r.occupancyStatus === 'occupied') {
      occupiedRooms++;
      if (r.isVip) vipOccupiedRooms++;
    }
    if (isRoomReady(r)) readyRooms++;
    if (r.housekeepingStatus === 'dirty' || r.housekeepingStatus === 'cleaning_in_progress') {
      dirtyRooms++;
    }
    if (r.inspectionStatus === 'awaiting_inspection' || r.inspectionStatus === 'failed') {
      awaitingInspectionRooms++;
    }
    if (r.maintenanceStatus === 'out_of_service') {
      outOfServiceRooms++;
    }
  }

  const occupancyRatio = occupiedRooms / totalRooms;
  const occupancyPercent = Number((occupancyRatio * 100).toFixed(1));

  const activeReservations = reservations.filter((res) => res.status !== 'checked_out');
  const roomRevenueIqd = activeReservations.reduce((sum, res) => sum + res.finalPaidIqd, 0);
  const culinaryRevenueIqd = roomServiceOrders.reduce((sum, ord) => sum + ord.totalIqd, 0);
  const totalIqd = roomRevenueIqd + culinaryRevenueIqd;
  const totalUsd = Number((totalIqd / EXCHANGE_RATE_IQD).toFixed(2));

  const adrIqd = occupiedRooms > 0 ? Math.round(roomRevenueIqd / occupiedRooms) : 100000;
  const adrUsd = Number((adrIqd / EXCHANGE_RATE_IQD).toFixed(2));
  const revParIqd = Math.round(roomRevenueIqd / totalRooms);
  const revParUsd = Number((revParIqd / EXCHANGE_RATE_IQD).toFixed(2));

  // SLA Drift Score (0.000 to 1.000) calculated from overdue housekeeping + pending maintenance + kitchen latency
  const overdueHousekeepingCount = housekeepingTasks.filter(
    (t) => t.status === 'dirty' || t.slaMinutesRemaining < 15
  ).length;
  const openMaintenanceCount = maintenanceTickets.filter((m) => m.status !== 'checked_ok').length;
  const activeServiceOrderCount = roomServiceOrders.filter((o) => o.status !== 'delivered').length;

  const rawDrift =
    overdueHousekeepingCount * 0.065 +
    openMaintenanceCount * 0.085 +
    outOfServiceRooms * 0.06 +
    activeServiceOrderCount * 0.035;
  const slaDriftScore = Number(Math.min(1.0, Math.max(0.012, rawDrift)).toFixed(3));

  const channelFunnelPinchRatio = Number(
    Math.min(0.95, Math.max(0.18, 0.25 + occupancyRatio * 0.65)).toFixed(3)
  );

  return {
    occupiedRooms,
    totalRooms,
    readyRooms,
    dirtyRooms,
    awaitingInspectionRooms,
    outOfServiceRooms,
    vipOccupiedRooms,
    occupancyRatio,
    occupancyPercent,
    adrIqd,
    adrUsd,
    revParIqd,
    revParUsd,
    dualCurrencyRevenue: {
      totalIqd,
      totalUsd,
      roomRevenueIqd,
      culinaryRevenueIqd,
      exchangeRate: EXCHANGE_RATE_IQD,
    },
    slaDriftScore,
    channelFunnelPinchRatio,
    roomNodes: rooms,
    activeServiceOrderCount,
    openMaintenanceCount,
    overdueHousekeepingCount,
    shaderPulseIntensity,
    latestEvent: eventLog[0] || null,
    eventLog,
  };
}

export function useErbilTelemetry(): ErbilTelemetrySnapshot {
  const rooms = useHotelOpsStore((s) => s.rooms);
  const reservations = useHotelOpsStore((s) => s.reservations);
  const housekeepingTasks = useHotelOpsStore((s) => s.housekeepingTasks);
  const maintenanceTickets = useHotelOpsStore((s) => s.maintenanceTickets);
  const roomServiceOrders = useHotelOpsStore((s) => s.roomServiceOrders);
  const eventLog = useHotelOpsStore((s) => s.eventLog);
  const shaderPulseIntensity = useCitadelStore((s) => s.shaderPulseIntensity);

  return useMemo(
    () =>
      deriveMetrics(
        rooms,
        reservations,
        housekeepingTasks,
        maintenanceTickets,
        roomServiceOrders,
        eventLog,
        shaderPulseIntensity
      ),
    [
      rooms,
      reservations,
      housekeepingTasks,
      maintenanceTickets,
      roomServiceOrders,
      eventLog,
      shaderPulseIntensity,
    ]
  );
}
