import { create } from 'zustand';
import {
  supabase,
  isSupabaseConfigured,
  realtimeBus,
  RealtimeOperationalEvent,
  safeStorageGet,
  safeStorageSet,
} from '../lib/supabaseClient';
import { useCitadelStore } from './useCitadelStore';

export type RoomType = 'Single' | 'Twin' | 'Executive Suite' | 'Diplomatic Suite' | 'Royal Penthouse';
export type OccupancyStatus = 'vacant' | 'occupied';
export type HousekeepingStatus = 'clean' | 'dirty' | 'cleaning_in_progress';
export type InspectionStatus = 'passed' | 'failed' | 'awaiting_inspection';
export type MaintenanceStatus = 'in_service' | 'out_of_service';
export type BookingChannel = 'Direct_Web' | 'Booking_OTA' | 'Embassy_Corp' | 'Walk_In_VIP' | 'Airport_Transfer';

export interface ExtraGuest {
  id: string;
  fullName: string;
  idNumber: string;
}

export interface RoomNode {
  id: string;
  roomNumber: string;
  floor: number; // 1 to 6
  floorZone: string;
  roomType: RoomType;
  baseRateIqd: number;
  baseRateUsd: number;
  occupancyStatus: OccupancyStatus;
  housekeepingStatus: HousekeepingStatus;
  inspectionStatus: InspectionStatus;
  maintenanceStatus: MaintenanceStatus;
  isVip: boolean;
  hvacTempC: number;
  keycardActive: boolean;
  currentGuestName: string | null;
  currentGuestContact: string | null;
  currentGuestIdNumber: string | null;
  currentGuestCarNumber: string | null;
  extraGuests: ExtraGuest[];
  discountPayPercent: number; // e.g., 100 means 100%, 40 means 40% paid (40,000 IQD)
  updatedAt: string;
}

export interface ReservationRecord {
  id: string;
  bookingRef: string;
  roomNumber: string;
  floor: number;
  guestName: string;
  guestContact: string;
  guestIdNumber: string;
  guestCarNumber: string;
  extraGuests: ExtraGuest[];
  totalGuests: number;
  channel: BookingChannel;
  checkInDate: string;
  checkOutDate: string | null;
  nights: number;
  fullPriceIqd: number;
  discountPayPercent: number;
  finalPaidIqd: number;
  finalPaidUsd: number;
  status: 'confirmed' | 'checked_in' | 'checked_out';
  digitalKeyToken: string;
}

export interface HousekeepingTask {
  id: string;
  roomNumber: string;
  floor: number;
  assignedTo: string;
  taskType: 'Checkout Deep Turnover' | 'Daily Refresh' | 'VIP Turndown' | 'Re-Clean After Failed Inspection';
  status: 'dirty' | 'cleaning_in_progress' | 'awaiting_inspection' | 'passed' | 'failed';
  priority: 'normal' | 'high' | 'urgent_vip';
  slaMinutesRemaining: number;
  notes: string;
  createdAt: string;
}

export type MaintenanceProblemType =
  | 'HVAC / Climate'
  | 'Plumbing / Water'
  | 'Electrical / Lighting'
  | 'Smart Keycard Lock'
  | 'Furniture / Glazing';

export type MaintenanceTicketStatus =
  | 'working_on_it'
  | 'fixed_awaiting_check'
  | 'out_of_service'
  | 'needs_parts'
  | 'checked_ok';

export interface MaintenanceTicket {
  id: string;
  roomNumber: string;
  floor: number;
  problemType: MaintenanceProblemType;
  priority: 'low' | 'medium' | 'high' | 'critical_oos';
  status: MaintenanceTicketStatus;
  reportedBy: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomServiceOrder {
  id: string;
  roomNumber: string;
  floor: number;
  guestName: string;
  items: { name: string; priceIqd: number; qty: number }[];
  totalIqd: number;
  totalUsd: number;
  status: 'queued' | 'preparing' | 'in_transit' | 'delivered';
  orderedAt: string;
}

export const EXCHANGE_RATE_IQD = 1310;

// STRICT READY RULE: Vacant + Clean + Inspection Passed + In Service
export function isRoomReady(room: RoomNode): boolean {
  return (
    room.occupancyStatus === 'vacant' &&
    room.housekeepingStatus === 'clean' &&
    room.inspectionStatus === 'passed' &&
    room.maintenanceStatus === 'in_service'
  );
}

const FLOOR_ZONES: Record<number, string> = {
  1: 'FLOOR_01_LOBBY',
  2: 'FLOOR_02_EXEC',
  3: 'FLOOR_03_GALLERY',
  4: 'FLOOR_04_MERIDIAN',
  5: 'FLOOR_05_DIPLOMATIC',
  6: 'FLOOR_06_PENTHOUSE',
};

function buildInitial48Rooms(baseOwnerPriceIqd = 100000): RoomNode[] {
  const rooms: RoomNode[] = [];
  const seededGuests: Record<
    string,
    {
      name: string;
      contact: string;
      idNum: string;
      car: string;
      discount: number;
      extra: ExtraGuest[];
      channel?: BookingChannel;
    }
  > = {
    '102': {
      name: 'Karwan Barzani',
      contact: '+964 750 412 8890',
      idNum: 'IRQ-EBL-88219',
      car: 'EBL 44912',
      discount: 100,
      extra: [{ id: 'eg-1', fullName: 'halo Barzani', idNumber: 'IRQ-EBL-88220' }],
    },
    '105': {
      name: 'Dilan Talabani',
      contact: '+964 770 119 3321',
      idNum: 'IRQ-SLM-19204',
      car: 'SLM 90211',
      discount: 80,
      extra: [],
    },
    '201': {
      name: 'Dr. Rebwar Mustafa',
      contact: '+964 750 882 1900',
      idNum: 'IRQ-EBL-33910',
      car: 'EBL 10045',
      discount: 100,
      extra: [],
    },
    '203': {
      name: 'Shwan Dizayee',
      contact: '+964 750 321 7741',
      idNum: 'IRQ-EBL-77412',
      car: 'EBL 77019',
      discount: 90,
      extra: [],
    },
    '207': {
      name: 'Aso Hawrami',
      contact: '+964 770 554 1188',
      idNum: 'IRQ-SLM-55411',
      car: 'SLM 31029',
      discount: 100,
      extra: [{ id: 'eg-2', fullName: 'Payam Hawrami', idNumber: 'IRQ-SLM-55499' }],
    },
    '301': {
      name: 'Haval Zebari',
      contact: '+964 750 911 2201',
      idNum: 'IRQ-DHK-91122',
      car: 'DHK 50211',
      discount: 100,
      extra: [],
    },
    '304': {
      name: 'Narin Qadir',
      contact: '+964 770 401 9981',
      idNum: 'IRQ-SLM-40199',
      car: 'SLM 88321',
      discount: 75,
      extra: [],
    },
    '306': {
      name: 'Soran Karim',
      contact: '+964 750 612 4490',
      idNum: 'IRQ-EBL-61244',
      car: 'EBL 61244',
      discount: 100,
      extra: [],
    },
    '401': {
      name: 'Tariq Al-Mansoor',
      contact: '+964 780 112 9001',
      idNum: 'IRQ-BGD-11290',
      car: 'BGD 11002',
      discount: 100,
      extra: [],
    },
    '404': {
      name: 'Zana Jaff',
      contact: '+964 770 889 1234',
      idNum: 'IRQ-SLM-88912',
      car: 'SLM 45019',
      discount: 100,
      extra: [],
    },
    '406': {
      name: 'Lana Othman',
      contact: '+964 750 773 1920',
      idNum: 'IRQ-EBL-77319',
      car: 'EBL 92014',
      discount: 85,
      extra: [],
    },
    '501': {
      name: 'Envoy Henri Laurent',
      contact: '+964 750 001 9920',
      idNum: 'DIP-FRA-88201',
      car: 'CD 019 EBL',
      discount: 100,
      extra: [{ id: 'eg-3', fullName: 'Attaché Claire Moreau', idNumber: 'DIP-FRA-88209' }],
    },
    '502': {
      name: 'Consul Elena Vance',
      contact: '+964 750 009 4412',
      idNum: 'DIP-EU-44102',
      car: 'CD 042 EBL',
      discount: 100,
      extra: [],
    },
    '505': {
      name: 'Brig. Gen. Kawa Amin',
      contact: '+964 770 900 1122',
      idNum: 'IRQ-GOV-90011',
      car: 'GOV 1102',
      discount: 100,
      extra: [],
    },
    '601': {
      name: 'Sheikh Farhad Al-Sabah',
      contact: '+964 750 999 0001',
      idNum: 'VIP-KWT-00019',
      car: 'VIP 0001',
      discount: 100,
      extra: [{ id: 'eg-4', fullName: 'Nasser Al-Sabah', idNumber: 'VIP-KWT-00022' }],
    },
    '602': {
      name: 'Marcus Sterling // Sovereign Fund',
      contact: '+964 750 888 4100',
      idNum: 'GBR-LON-99410',
      car: 'EBL 0009',
      discount: 100,
      extra: [],
    },
    '604': {
      name: 'Rojan Nakshabandi',
      contact: '+964 750 310 5599',
      idNum: 'IRQ-EBL-31055',
      car: 'EBL 31055',
      discount: 60,
      extra: [],
    },
    '607': {
      name: 'Aria Rostami',
      contact: '+964 770 219 8840',
      idNum: 'IRQ-SLM-21988',
      car: 'SLM 7711',
      discount: 100,
      extra: [],
    },
  };

  const dirtyRooms = new Set(['104', '303', '403', '507']);
  const cleaningRooms = new Set(['107']);
  const awaitingInspRooms = new Set(['104', '107', '204', '403', '507']);
  const failedInspRooms = new Set(['303']);
  const oosRooms = new Set(['206', '504']);

  for (let floor = 1; floor <= 6; floor++) {
    for (let idx = 1; idx <= 8; idx++) {
      const roomNumber = `${floor}0${idx}`;
      const guest = seededGuests[roomNumber];
      const isOccupied = Boolean(guest);
      const isVip = floor >= 5 || roomNumber === '401';

      let roomType: RoomType = idx % 2 === 1 ? 'Single' : 'Twin';
      let rateIqd = baseOwnerPriceIqd;
      if (roomNumber === '401' || roomNumber === '502' || roomNumber === '508' || roomNumber === '603' || roomNumber === '607') {
        roomType = 'Executive Suite';
        rateIqd = 150000;
      } else if (roomNumber === '501' || roomNumber === '602') {
        roomType = 'Diplomatic Suite';
        rateIqd = 220000;
      } else if (roomNumber === '601' || roomNumber === '608') {
        roomType = 'Royal Penthouse';
        rateIqd = 350000;
      }

      let hkStatus: HousekeepingStatus = 'clean';
      if (dirtyRooms.has(roomNumber)) hkStatus = 'dirty';
      if (cleaningRooms.has(roomNumber)) hkStatus = 'cleaning_in_progress';

      let inspStatus: InspectionStatus = 'passed';
      if (awaitingInspRooms.has(roomNumber)) inspStatus = 'awaiting_inspection';
      if (failedInspRooms.has(roomNumber)) inspStatus = 'failed';

      const maintStatus: MaintenanceStatus = oosRooms.has(roomNumber) ? 'out_of_service' : 'in_service';

      rooms.push({
        id: `rm-${roomNumber}`,
        roomNumber,
        floor,
        floorZone: FLOOR_ZONES[floor],
        roomType,
        baseRateIqd: rateIqd,
        baseRateUsd: Number((rateIqd / EXCHANGE_RATE_IQD).toFixed(2)),
        occupancyStatus: isOccupied ? 'occupied' : 'vacant',
        housekeepingStatus: hkStatus,
        inspectionStatus: inspStatus,
        maintenanceStatus: maintStatus,
        isVip,
        hvacTempC: isOccupied ? Number((20.0 + (idx % 3) * 0.6).toFixed(1)) : 21.5,
        keycardActive: isOccupied,
        currentGuestName: guest ? guest.name : null,
        currentGuestContact: guest ? guest.contact : null,
        currentGuestIdNumber: guest ? guest.idNum : null,
        currentGuestCarNumber: guest ? guest.car : null,
        extraGuests: guest ? guest.extra : [],
        discountPayPercent: guest ? guest.discount : 100,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return rooms;
}

const INITIAL_HOUSEKEEPING_TASKS: HousekeepingTask[] = [
  {
    id: 'hk-104',
    roomNumber: '104',
    floor: 1,
    assignedTo: 'Squad Alpha // Sirwan',
    taskType: 'Checkout Deep Turnover',
    status: 'dirty',
    priority: 'high',
    slaMinutesRemaining: 14,
    notes: 'Guest checked out 15m ago. Full linen turnover required.',
    createdAt: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: 'hk-107',
    roomNumber: '107',
    floor: 1,
    assignedTo: 'Squad Alpha // Chinar',
    taskType: 'Checkout Deep Turnover',
    status: 'cleaning_in_progress',
    priority: 'normal',
    slaMinutesRemaining: 22,
    notes: 'Sanitizing travertine bath surfaces.',
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'hk-204',
    roomNumber: '204',
    floor: 2,
    assignedTo: 'Squad Bravo // Avan',
    taskType: 'Daily Refresh',
    status: 'awaiting_inspection',
    priority: 'normal',
    slaMinutesRemaining: 18,
    notes: 'Cleaning finished by Avan. Waiting for Supervisor Pass/Fail.',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'hk-303',
    roomNumber: '303',
    floor: 3,
    assignedTo: 'Squad Bravo // Avan',
    taskType: 'Re-Clean After Failed Inspection',
    status: 'dirty',
    priority: 'urgent_vip',
    slaMinutesRemaining: 8,
    notes: 'Supervisor flagged mirror streak & minibar restock.',
    createdAt: new Date(Date.now() - 2400000).toISOString(),
  },
  {
    id: 'hk-403',
    roomNumber: '403',
    floor: 4,
    assignedTo: 'Squad Delta // Rebin',
    taskType: 'Checkout Deep Turnover',
    status: 'dirty',
    priority: 'high',
    slaMinutesRemaining: 19,
    notes: 'Prepare Twin configuration.',
    createdAt: new Date(Date.now() - 1000000).toISOString(),
  },
  {
    id: 'hk-507',
    roomNumber: '507',
    floor: 5,
    assignedTo: 'Diplomatic Wing Crew',
    taskType: 'VIP Turndown',
    status: 'dirty',
    priority: 'urgent_vip',
    slaMinutesRemaining: 11,
    notes: 'Embassy delegation arriving at 18:00.',
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
];

const INITIAL_MAINTENANCE_LOGS: MaintenanceTicket[] = [
  {
    id: 'mnt-206',
    roomNumber: '206',
    floor: 2,
    problemType: 'HVAC / Climate',
    priority: 'critical_oos',
    status: 'out_of_service',
    reportedBy: 'Haval Karim (Front Desk)',
    note: 'Chiller valve actuator replacement required. Room blocked from check-in.',
    createdAt: new Date(Date.now() - 5400000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'mnt-504',
    roomNumber: '504',
    floor: 5,
    problemType: 'Smart Keycard Lock',
    priority: 'critical_oos',
    status: 'out_of_service',
    reportedBy: 'Narin Qadir (Supervisor)',
    note: 'RFID bezel firmware recalibration needed.',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'mnt-305',
    roomNumber: '305',
    floor: 3,
    problemType: 'Electrical / Lighting',
    priority: 'medium',
    status: 'fixed_awaiting_check',
    reportedBy: 'Engineering // Barham',
    note: 'Replaced warm sconce dimmer driver. Waiting for Supervisor Checked-OK.',
    createdAt: new Date(Date.now() - 4000000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
  },
];

const INITIAL_ROOM_SERVICE: RoomServiceOrder[] = [
  {
    id: 'rs-601',
    roomNumber: '601',
    floor: 6,
    guestName: 'Sheikh Farhad Al-Sabah',
    items: [
      { name: 'Mesopotamian Lamb Quzi & Saffron Rice', priceIqd: 45000, qty: 2 },
      { name: 'Cardamom Qahwa Service & Baklava Platter', priceIqd: 28000, qty: 1 },
    ],
    totalIqd: 118000,
    totalUsd: 90.08,
    status: 'preparing',
    orderedAt: new Date(Date.now() - 780000).toISOString(),
  },
  {
    id: 'rs-501',
    roomNumber: '501',
    floor: 5,
    guestName: 'Envoy Henri Laurent',
    items: [
      { name: 'grilled Tigris Masgouf Fillet', priceIqd: 52000, qty: 1 },
      { name: 'Sparkling Pomegranate Elixir', priceIqd: 14000, qty: 2 },
    ],
    totalIqd: 80000,
    totalUsd: 61.07,
    status: 'in_transit',
    orderedAt: new Date(Date.now() - 1100000).toISOString(),
  },
  {
    id: 'rs-401',
    roomNumber: '401',
    floor: 4,
    guestName: 'Tariq Al-Mansoor',
    items: [{ name: 'Artisanal Mezze & Warm Samoon', priceIqd: 34000, qty: 1 }],
    totalIqd: 34000,
    totalUsd: 25.95,
    status: 'queued',
    orderedAt: new Date(Date.now() - 420000).toISOString(),
  },
];

interface HotelOpsState {
  rooms: RoomNode[];
  reservations: ReservationRecord[];
  housekeepingTasks: HousekeepingTask[];
  maintenanceTickets: MaintenanceTicket[];
  roomServiceOrders: RoomServiceOrder[];
  eventLog: RealtimeOperationalEvent[];
  ownerBasePriceIqd: number;
  exchangeRateIqd: number;

  // Actions
  initializeRealtimeSync: () => void;
  checkInGuest: (params: {
    roomNumber: string;
    guestName: string;
    guestContact: string;
    guestIdNumber: string;
    guestCarNumber: string;
    extraGuests: ExtraGuest[];
    discountPayPercent: number;
    nights: number;
    channel: BookingChannel;
  }) => { ok: boolean; error?: string; bookingRef?: string };
  checkOutRoom: (roomNumber: string) => void;
  setRoomType: (roomNumber: string, roomType: RoomType) => void;
  setFloorRoomTypes: (floor: number, roomType: RoomType) => void;
  setOwnerBasePriceIqd: (priceIqd: number) => void;
  setRoomHvacTemp: (roomNumber: string, tempC: number) => void;

  // Housekeeping & Inspection workflow
  markCleaningStarted: (roomNumber: string) => void;
  markCleaningFinishedAwaitingInspection: (roomNumber: string) => void;
  inspectRoomVerdict: (roomNumber: string, verdict: 'passed' | 'failed') => void;

  // Maintenance big-button workflow
  reportDamageTicket: (params: {
    roomNumber: string;
    problemType: MaintenanceProblemType;
    priority: 'low' | 'medium' | 'high' | 'critical_oos';
    note?: string;
    reportedBy?: string;
  }) => void;
  updateMaintenanceTicketStatus: (
    ticketId: string,
    status: MaintenanceTicketStatus,
    actorRole: string
  ) => { ok: boolean; message: string };

  // Room service workflow
  placeRoomServiceOrder: (params: {
    roomNumber: string;
    guestName: string;
    items: { name: string; priceIqd: number; qty: number }[];
  }) => void;
  advanceRoomServiceStatus: (orderId: string) => void;

  // Backup / Restore / Reset
  exportBackupJson: () => string;
  importBackupJson: (rawJson: string) => boolean;
  resetAllHotelData: () => void;
}

const STORAGE_KEY_OPS = 'erbil_citadel_ops_state_v4';

const initialSeedRooms = buildInitial48Rooms(100000);

const INITIAL_RESERVATIONS: ReservationRecord[] = initialSeedRooms
  .filter((r) => r.occupancyStatus === 'occupied' && r.currentGuestName)
  .map((r, i) => {
    const paidIqd = Math.round((r.baseRateIqd * r.discountPayPercent) / 100);
    const channels: BookingChannel[] = [
      'Direct_Web',
      'Booking_OTA',
      'Embassy_Corp',
      'Walk_In_VIP',
      'Airport_Transfer',
    ];
    return {
      id: `res-seed-${r.roomNumber}`,
      bookingRef: `EBL-${202600 + i}`,
      roomNumber: r.roomNumber,
      floor: r.floor,
      guestName: r.currentGuestName!,
      guestContact: r.currentGuestContact || '+964 750 816 9999',
      guestIdNumber: r.currentGuestIdNumber || `IRQ-ID-${r.roomNumber}`,
      guestCarNumber: r.currentGuestCarNumber || `EBL ${r.roomNumber}`,
      extraGuests: r.extraGuests,
      totalGuests: 1 + r.extraGuests.length,
      channel: channels[i % channels.length],
      checkInDate: new Date(Date.now() - (i + 1) * 3600000 * 5).toISOString(),
      checkOutDate: null,
      nights: (i % 4) + 1,
      fullPriceIqd: r.baseRateIqd,
      discountPayPercent: r.discountPayPercent,
      finalPaidIqd: paidIqd,
      finalPaidUsd: Number((paidIqd / EXCHANGE_RATE_IQD).toFixed(2)),
      status: 'checked_in',
      digitalKeyToken: `CITADEL-KEY-${r.roomNumber}-${(9182 + i * 37).toString(16).toUpperCase()}`,
    };
  });

const persistedOps = safeStorageGet<{
  rooms: RoomNode[];
  reservations: ReservationRecord[];
  housekeepingTasks: HousekeepingTask[];
  maintenanceTickets: MaintenanceTicket[];
  roomServiceOrders: RoomServiceOrder[];
  ownerBasePriceIqd: number;
} | null>(STORAGE_KEY_OPS, null);

function persistOpsSnapshot(state: HotelOpsState) {
  safeStorageSet(STORAGE_KEY_OPS, {
    rooms: state.rooms,
    reservations: state.reservations,
    housekeepingTasks: state.housekeepingTasks,
    maintenanceTickets: state.maintenanceTickets,
    roomServiceOrders: state.roomServiceOrders,
    ownerBasePriceIqd: state.ownerBasePriceIqd,
  });
}

export const useHotelOpsStore = create<HotelOpsState>((set, get) => ({
  rooms: persistedOps?.rooms || initialSeedRooms,
  reservations: persistedOps?.reservations || INITIAL_RESERVATIONS,
  housekeepingTasks: persistedOps?.housekeepingTasks || INITIAL_HOUSEKEEPING_TASKS,
  maintenanceTickets: persistedOps?.maintenanceTickets || INITIAL_MAINTENANCE_LOGS,
  roomServiceOrders: persistedOps?.roomServiceOrders || INITIAL_ROOM_SERVICE,
  ownerBasePriceIqd: persistedOps?.ownerBasePriceIqd || 100000,
  exchangeRateIqd: EXCHANGE_RATE_IQD,
  eventLog: [
    {
      id: 'EVT-BOOT-01',
      timestamp: Date.now() - 45000,
      type: 'CHECK_IN',
      roomNumber: '601',
      floor: 6,
      channel: 'Walk_In_VIP',
      amountIqd: 350000,
      amountUsd: 267.18,
      latencyMs: 11,
      summary: 'ROYAL PENTHOUSE 601 // VIP ARRIVAL & KEYCARD ENCRYPTED',
      severity: 'emerald',
    },
    {
      id: 'EVT-BOOT-02',
      timestamp: Date.now() - 28000,
      type: 'ROOM_SERVICE_ORDER',
      roomNumber: '501',
      floor: 5,
      amountIqd: 80000,
      amountUsd: 61.07,
      latencyMs: 12,
      summary: 'DIPLOMATIC SUITE 501 // CULINARY DISPATCH IN TRANSIT',
      severity: 'nominal',
    },
    {
      id: 'EVT-BOOT-03',
      timestamp: Date.now() - 12000,
      type: 'MAINTENANCE_UPDATE',
      roomNumber: '206',
      floor: 2,
      latencyMs: 9,
      summary: 'ROOM 206 // HVAC ACTUATOR FLAGGED OUT-OF-SERVICE',
      severity: 'critical',
    },
  ],

  initializeRealtimeSync: () => {
    realtimeBus.subscribe((evt) => {
      set((state) => ({
        eventLog: [evt, ...state.eventLog].slice(0, 60),
      }));
      useCitadelStore.getState().triggerShaderPulse(evt.severity === 'critical' ? 1.35 : 1.0);
    });

    if (isSupabaseConfigured && supabase) {
      supabase
        .channel('erbil-citadel-realtime')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          realtimeBus.emit({
            type: 'TREASURY_SETTLEMENT',
            summary: `SUPABASE REALTIME SYNC // TABLE: ${payload.table.toUpperCase()} [${payload.eventType}]`,
            severity: 'nominal',
          });
        })
        .subscribe();
    }
  },

  checkInGuest: ({
    roomNumber,
    guestName,
    guestContact,
    guestIdNumber,
    guestCarNumber,
    extraGuests,
    discountPayPercent,
    nights,
    channel,
  }) => {
    const state = get();
    const room = state.rooms.find((r) => r.roomNumber === roomNumber);
    if (!room) {
      return { ok: false, error: `Room ${roomNumber} does not exist.` };
    }

    // Strict Ready Rule Validation
    if (!isRoomReady(room)) {
      return {
        ok: false,
        error: `Room ${roomNumber} is NOT Ready for Check-In (Occupancy: ${room.occupancyStatus}, HK: ${room.housekeepingStatus}, Inspection: ${room.inspectionStatus}, Maint: ${room.maintenanceStatus}).`,
      };
    }

    if (!guestName.trim() || !guestIdNumber.trim()) {
      return {
        ok: false,
        error: 'Main Guest Full Name and ID Number are strictly required.',
      };
    }

    for (const eg of extraGuests) {
      if (!eg.fullName.trim() || !eg.idNumber.trim()) {
        return {
          ok: false,
          error: 'Every additional guest in the room must have both Full Name and ID Number.',
        };
      }
    }

    const clampedDiscount = Math.max(10, Math.min(100, Number(discountPayPercent) || 100));
    const fullPriceIqd = room.baseRateIqd * Math.max(1, nights);
    const finalPaidIqd = Math.round((fullPriceIqd * clampedDiscount) / 100);
    const finalPaidUsd = Number((finalPaidIqd / EXCHANGE_RATE_IQD).toFixed(2));
    const bookingRef = `EBL-${Math.floor(100000 + Math.random() * 900000)}`;
    const digitalKeyToken = `CITADEL-KEY-${roomNumber}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const newReservation: ReservationRecord = {
      id: `res-${Date.now()}`,
      bookingRef,
      roomNumber,
      floor: room.floor,
      guestName: guestName.trim(),
      guestContact: guestContact.trim(),
      guestIdNumber: guestIdNumber.trim(),
      guestCarNumber: guestCarNumber.trim(),
      extraGuests,
      totalGuests: 1 + extraGuests.length,
      channel,
      checkInDate: new Date().toISOString(),
      checkOutDate: null,
      nights: Math.max(1, nights),
      fullPriceIqd,
      discountPayPercent: clampedDiscount,
      finalPaidIqd,
      finalPaidUsd,
      status: 'checked_in',
      digitalKeyToken,
    };

    const updatedRooms = state.rooms.map((r) =>
      r.roomNumber === roomNumber
        ? {
            ...r,
            occupancyStatus: 'occupied' as OccupancyStatus,
            keycardActive: true,
            currentGuestName: guestName.trim(),
            currentGuestContact: guestContact.trim(),
            currentGuestIdNumber: guestIdNumber.trim(),
            currentGuestCarNumber: guestCarNumber.trim(),
            extraGuests,
            discountPayPercent: clampedDiscount,
            updatedAt: new Date().toISOString(),
          }
        : r
    );

    set({
      rooms: updatedRooms,
      reservations: [newReservation, ...state.reservations],
    });
    persistOpsSnapshot(get());

    realtimeBus.emit({
      type: 'CHECK_IN',
      roomNumber,
      floor: room.floor,
      channel,
      amountIqd: finalPaidIqd,
      amountUsd: finalPaidUsd,
      summary: `CHECK-IN RM ${roomNumber} // ${guestName.toUpperCase()} (${1 + extraGuests.length} PAX) [${finalPaidIqd.toLocaleString()} IQD]`,
      severity: 'emerald',
    });

    return { ok: true, bookingRef };
  },

  checkOutRoom: (roomNumber) => {
    const state = get();
    const room = state.rooms.find((r) => r.roomNumber === roomNumber);
    if (!room) return;

    const guestName = room.currentGuestName || 'Guest';

    // When a guest checks out, room becomes Vacant + Dirty + Awaiting Inspection automatically
    const updatedRooms = state.rooms.map((r) =>
      r.roomNumber === roomNumber
        ? {
            ...r,
            occupancyStatus: 'vacant' as OccupancyStatus,
            housekeepingStatus: 'dirty' as HousekeepingStatus,
            inspectionStatus: 'awaiting_inspection' as InspectionStatus,
            keycardActive: false,
            currentGuestName: null,
            currentGuestContact: null,
            currentGuestIdNumber: null,
            currentGuestCarNumber: null,
            extraGuests: [],
            discountPayPercent: 100,
            updatedAt: new Date().toISOString(),
          }
        : r
    );

    const updatedReservations = state.reservations.map((res) =>
      res.roomNumber === roomNumber && res.status === 'checked_in'
        ? { ...res, status: 'checked_out' as const, checkOutDate: new Date().toISOString() }
        : res
    );

    const newHkTask: HousekeepingTask = {
      id: `hk-${Date.now()}`,
      roomNumber,
      floor: room.floor,
      assignedTo: `Floor ${room.floor} Turnover Squad`,
      taskType: 'Checkout Deep Turnover',
      status: 'dirty',
      priority: room.isVip ? 'urgent_vip' : 'high',
      slaMinutesRemaining: 25,
      notes: `Auto-dispatched after checkout of ${guestName}.`,
      createdAt: new Date().toISOString(),
    };

    set({
      rooms: updatedRooms,
      reservations: updatedReservations,
      housekeepingTasks: [
        newHkTask,
        ...state.housekeepingTasks.filter((t) => t.roomNumber !== roomNumber),
      ],
    });
    persistOpsSnapshot(get());

    realtimeBus.emit({
      type: 'CHECK_OUT',
      roomNumber,
      floor: room.floor,
      summary: `CHECK-OUT RM ${roomNumber} // ${guestName.toUpperCase()} -> AUTO-FLAGGED DIRTY FOR TURNOVER`,
      severity: 'elevated',
    });
  },

  setRoomType: (roomNumber, roomType) => {
    const state = get();
    const updatedRooms = state.rooms.map((r) =>
      r.roomNumber === roomNumber ? { ...r, roomType, updatedAt: new Date().toISOString() } : r
    );
    set({ rooms: updatedRooms });
    persistOpsSnapshot(get());
  },

  setFloorRoomTypes: (floor, roomType) => {
    const state = get();
    const updatedRooms = state.rooms.map((r) =>
      r.floor === floor ? { ...r, roomType, updatedAt: new Date().toISOString() } : r
    );
    set({ rooms: updatedRooms });
    persistOpsSnapshot(get());
  },

  setOwnerBasePriceIqd: (priceIqd) => {
    const cleanPrice = Math.max(25000, Number(priceIqd) || 100000);
    const usd = Number((cleanPrice / EXCHANGE_RATE_IQD).toFixed(2));
    const state = get();
    const updatedRooms = state.rooms.map((r) =>
      r.roomType === 'Single' || r.roomType === 'Twin'
        ? { ...r, baseRateIqd: cleanPrice, baseRateUsd: usd }
        : r
    );
    set({ ownerBasePriceIqd: cleanPrice, rooms: updatedRooms });
    persistOpsSnapshot(get());
  },

  setRoomHvacTemp: (roomNumber, tempC) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.roomNumber === roomNumber ? { ...r, hvacTempC: Number(tempC.toFixed(1)) } : r
      ),
    }));
    persistOpsSnapshot(get());
  },

  markCleaningStarted: (roomNumber) => {
    const state = get();
    const room = state.rooms.find((r) => r.roomNumber === roomNumber);
    if (!room) return;

    set({
      rooms: state.rooms.map((r) =>
        r.roomNumber === roomNumber
          ? {
              ...r,
              housekeepingStatus: 'cleaning_in_progress',
              inspectionStatus: 'awaiting_inspection',
              updatedAt: new Date().toISOString(),
            }
          : r
      ),
      housekeepingTasks: state.housekeepingTasks.map((t) =>
        t.roomNumber === roomNumber ? { ...t, status: 'cleaning_in_progress' } : t
      ),
    });
    persistOpsSnapshot(get());

    realtimeBus.emit({
      type: 'HOUSEKEEPING_UPDATE',
      roomNumber,
      floor: room.floor,
      summary: `HOUSEKEEPING ACTIVE // RM ${roomNumber} TURNOVER IN PROGRESS`,
      severity: 'nominal',
    });
  },

  markCleaningFinishedAwaitingInspection: (roomNumber) => {
    const state = get();
    const room = state.rooms.find((r) => r.roomNumber === roomNumber);
    if (!room) return;

    // Cleaned room goes to "Awaiting inspection" — it is NOT ready yet until Supervisor passes it
    const existingTask = state.housekeepingTasks.find((t) => t.roomNumber === roomNumber);
    const updatedTasks: HousekeepingTask[] = existingTask
      ? state.housekeepingTasks.map((t) =>
          t.roomNumber === roomNumber
            ? {
                ...t,
                status: 'awaiting_inspection',
                notes: 'Cleaning completed. Awaiting Supervisor Pass/Fail check.',
              }
            : t
        )
      : [
          {
            id: `hk-${Date.now()}`,
            roomNumber,
            floor: room.floor,
            assignedTo: 'Housekeeping Crew',
            taskType: 'Daily Refresh',
            status: 'awaiting_inspection',
            priority: 'normal',
            slaMinutesRemaining: 15,
            notes: 'Cleaning completed. Awaiting Supervisor Pass/Fail check.',
            createdAt: new Date().toISOString(),
          },
          ...state.housekeepingTasks,
        ];

    set({
      rooms: state.rooms.map((r) =>
        r.roomNumber === roomNumber
          ? {
              ...r,
              housekeepingStatus: 'clean',
              inspectionStatus: 'awaiting_inspection',
              updatedAt: new Date().toISOString(),
            }
          : r
      ),
      housekeepingTasks: updatedTasks,
    });
    persistOpsSnapshot(get());

    realtimeBus.emit({
      type: 'HOUSEKEEPING_UPDATE',
      roomNumber,
      floor: room.floor,
      summary: `CLEANING DONE RM ${roomNumber} // QUEUED FOR SUPERVISOR INSPECTION`,
      severity: 'nominal',
    });
  },

  inspectRoomVerdict: (roomNumber, verdict) => {
    const state = get();
    const room = state.rooms.find((r) => r.roomNumber === roomNumber);
    if (!room) return;

    if (verdict === 'passed') {
      set({
        rooms: state.rooms.map((r) =>
          r.roomNumber === roomNumber
            ? {
                ...r,
                housekeepingStatus: 'clean',
                inspectionStatus: 'passed',
                updatedAt: new Date().toISOString(),
              }
            : r
        ),
        housekeepingTasks: state.housekeepingTasks.filter((t) => t.roomNumber !== roomNumber),
      });
      persistOpsSnapshot(get());

      realtimeBus.emit({
        type: 'INSPECTION_VERDICT',
        roomNumber,
        floor: room.floor,
        summary: `INSPECTION PASSED RM ${roomNumber} // ROOM CERTIFIED READY FOR CHECK-IN`,
        severity: 'emerald',
      });
    } else {
      // Failed = goes back to housekeeping for cleaning again
      set({
        rooms: state.rooms.map((r) =>
          r.roomNumber === roomNumber
            ? {
                ...r,
                housekeepingStatus: 'dirty',
                inspectionStatus: 'failed',
                updatedAt: new Date().toISOString(),
              }
            : r
        ),
        housekeepingTasks: state.housekeepingTasks.map((t) =>
          t.roomNumber === roomNumber
            ? {
                ...t,
                status: 'dirty',
                taskType: 'Re-Clean After Failed Inspection',
                priority: 'urgent_vip',
                notes: 'Inspection FAILED by Supervisor. Immediate re-clean required.',
              }
            : t
        ),
      });
      persistOpsSnapshot(get());

      realtimeBus.emit({
        type: 'INSPECTION_VERDICT',
        roomNumber,
        floor: room.floor,
        summary: `INSPECTION FAILED RM ${roomNumber} // RETURNED TO HOUSEKEEPING QUEUE`,
        severity: 'critical',
      });
    }
  },

  reportDamageTicket: ({ roomNumber, problemType, priority, note = '', reportedBy = 'Staff' }) => {
    const state = get();
    const room = state.rooms.find((r) => r.roomNumber === roomNumber);
    if (!room) return;

    const isOos = priority === 'critical_oos';
    const newTicket: MaintenanceTicket = {
      id: `mnt-${Date.now()}`,
      roomNumber,
      floor: room.floor,
      problemType,
      priority,
      status: isOos ? 'out_of_service' : 'working_on_it',
      reportedBy,
      note: note.trim() || `${problemType} issue reported via quick-tap board.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set({
      maintenanceTickets: [newTicket, ...state.maintenanceTickets],
      rooms: state.rooms.map((r) =>
        r.roomNumber === roomNumber && isOos
          ? { ...r, maintenanceStatus: 'out_of_service', updatedAt: new Date().toISOString() }
          : r
      ),
    });
    persistOpsSnapshot(get());

    realtimeBus.emit({
      type: 'MAINTENANCE_UPDATE',
      roomNumber,
      floor: room.floor,
      summary: `DAMAGE TICKET RM ${roomNumber} // ${problemType.toUpperCase()} [${priority.toUpperCase()}]`,
      severity: isOos ? 'critical' : 'elevated',
    });
  },

  updateMaintenanceTicketStatus: (ticketId, status, actorRole) => {
    const state = get();
    const ticket = state.maintenanceTickets.find((t) => t.id === ticketId);
    if (!ticket) return { ok: false, message: 'Ticket not found.' };

    // Safety Rule: Only executive / supervisor / front_desk manager can close a ticket ('checked_ok') or release from out_of_service
    if (status === 'checked_ok' && actorRole !== 'executive' && actorRole !== 'front_desk') {
      return {
        ok: false,
        message: 'Safety Rule: Maintenance cannot close a ticket alone. A Supervisor or Executive must tap "Checked — OK".',
      };
    }

    const updatedTickets =
      status === 'checked_ok'
        ? state.maintenanceTickets.filter((t) => t.id !== ticketId)
        : state.maintenanceTickets.map((t) =>
            t.id === ticketId ? { ...t, status, updatedAt: new Date().toISOString() } : t
          );

    let updatedRooms = state.rooms;
    if (status === 'out_of_service') {
      updatedRooms = state.rooms.map((r) =>
        r.roomNumber === ticket.roomNumber
          ? { ...r, maintenanceStatus: 'out_of_service', updatedAt: new Date().toISOString() }
          : r
      );
    } else if (status === 'checked_ok') {
      updatedRooms = state.rooms.map((r) =>
        r.roomNumber === ticket.roomNumber
          ? { ...r, maintenanceStatus: 'in_service', updatedAt: new Date().toISOString() }
          : r
      );
    }

    set({
      maintenanceTickets: updatedTickets,
      rooms: updatedRooms,
    });
    persistOpsSnapshot(get());

    realtimeBus.emit({
      type: 'MAINTENANCE_UPDATE',
      roomNumber: ticket.roomNumber,
      floor: ticket.floor,
      summary: `MAINTENANCE RM ${ticket.roomNumber} // STATUS -> ${status.toUpperCase()}`,
      severity: status === 'out_of_service' ? 'critical' : status === 'checked_ok' ? 'emerald' : 'nominal',
    });

    return { ok: true, message: `Ticket updated to ${status}` };
  },

  placeRoomServiceOrder: ({ roomNumber, guestName, items }) => {
    const state = get();
    const room = state.rooms.find((r) => r.roomNumber === roomNumber);
    const floor = room ? room.floor : Number(roomNumber[0]) || 1;
    const totalIqd = items.reduce((acc, item) => acc + item.priceIqd * item.qty, 0);
    const totalUsd = Number((totalIqd / EXCHANGE_RATE_IQD).toFixed(2));

    const newOrder: RoomServiceOrder = {
      id: `rs-${Date.now()}`,
      roomNumber,
      floor,
      guestName,
      items,
      totalIqd,
      totalUsd,
      status: 'preparing',
      orderedAt: new Date().toISOString(),
    };

    set({
      roomServiceOrders: [newOrder, ...state.roomServiceOrders],
    });
    persistOpsSnapshot(get());

    realtimeBus.emit({
      type: 'ROOM_SERVICE_ORDER',
      roomNumber,
      floor,
      amountIqd: totalIqd,
      amountUsd: totalUsd,
      summary: `CULINARY ORDER RM ${roomNumber} // ${items.length} ITEMS (${totalIqd.toLocaleString()} IQD)`,
      severity: 'emerald',
    });
  },

  advanceRoomServiceStatus: (orderId) => {
    const state = get();
    const order = state.roomServiceOrders.find((o) => o.id === orderId);
    if (!order) return;

    const nextMap: Record<RoomServiceOrder['status'], RoomServiceOrder['status']> = {
      queued: 'preparing',
      preparing: 'in_transit',
      in_transit: 'delivered',
      delivered: 'delivered',
    };

    const nextStatus = nextMap[order.status];
    const updated =
      nextStatus === 'delivered'
        ? state.roomServiceOrders.filter((o) => o.id !== orderId)
        : state.roomServiceOrders.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o));

    set({ roomServiceOrders: updated });
    persistOpsSnapshot(get());

    realtimeBus.emit({
      type: 'ROOM_SERVICE_ORDER',
      roomNumber: order.roomNumber,
      floor: order.floor,
      summary: `ROOM SERVICE RM ${order.roomNumber} // DISPATCH -> ${nextStatus.toUpperCase()}`,
      severity: nextStatus === 'delivered' ? 'emerald' : 'nominal',
    });
  },

  exportBackupJson: () => {
    const state = get();
    return JSON.stringify(
      {
        version: '4.0.0-CITADEL',
        exportedAt: new Date().toISOString(),
        hotel: 'Erbil Hotel, Salem Street, Sulaymaniyah / Erbil Citadel Operations',
        ownerBasePriceIqd: state.ownerBasePriceIqd,
        rooms: state.rooms,
        reservations: state.reservations,
        housekeepingTasks: state.housekeepingTasks,
        maintenanceTickets: state.maintenanceTickets,
        roomServiceOrders: state.roomServiceOrders,
      },
      null,
      2
    );
  },

  importBackupJson: (rawJson) => {
    try {
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed.rooms)) return false;
      set({
        rooms: parsed.rooms,
        reservations: parsed.reservations || [],
        housekeepingTasks: parsed.housekeepingTasks || [],
        maintenanceTickets: parsed.maintenanceTickets || [],
        roomServiceOrders: parsed.roomServiceOrders || [],
        ownerBasePriceIqd: parsed.ownerBasePriceIqd || 100000,
      });
      persistOpsSnapshot(get());
      return true;
    } catch {
      return false;
    }
  },

  resetAllHotelData: () => {
    const freshRooms = buildInitial48Rooms(100000);
    set({
      rooms: freshRooms,
      reservations: INITIAL_RESERVATIONS,
      housekeepingTasks: INITIAL_HOUSEKEEPING_TASKS,
      maintenanceTickets: INITIAL_MAINTENANCE_LOGS,
      roomServiceOrders: INITIAL_ROOM_SERVICE,
      ownerBasePriceIqd: 100000,
    });
    persistOpsSnapshot(get());
  },
}));
