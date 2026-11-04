import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  BedDouble,
  LogIn,
  Sparkles,
  ClipboardCheck,
  Wrench,
  FileBarChart,
  Settings,
  Download,
  Upload,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Utensils,
} from 'lucide-react';
import {
  useHotelOpsStore,
  isRoomReady,
  RoomType,
  ExtraGuest,
  MaintenanceProblemType,
  BookingChannel,
  EXCHANGE_RATE_IQD,
} from '../store/useHotelOpsStore';
import { useAuthStore, AppLanguage } from '../store/useAuthStore';
import { useErbilTelemetry } from '../citadel-mode/telemetry/ErbilTelemetryStream';

type OpsModule =
  | 'dashboard'
  | 'rooms'
  | 'checkin'
  | 'housekeeping'
  | 'inspections'
  | 'maintenance'
  | 'stays'
  | 'reports'
  | 'settings';

const TRANSLATIONS: Record<
  AppLanguage,
  {
    hotelTitle: string;
    dashboard: string;
    rooms: string;
    checkin: string;
    housekeeping: string;
    inspections: string;
    maintenance: string;
    stays: string;
    reports: string;
    settings: string;
    readyRoomsLabel: string;
    noRoomsReady: string;
    inHouseCheckout: string;
  }
> = {
  en: {
    hotelTitle: 'ERBIL HOTEL // SWISS-GRID OPERATIONS',
    dashboard: '01. Dashboard',
    rooms: '02. Rooms by Floor',
    checkin: '03. Check-In / Out',
    housekeeping: '04. Housekeeping',
    inspections: '05. Inspections',
    maintenance: '06. Maintenance',
    stays: '07. Stays & Culinary',
    reports: '08. Daily Report',
    settings: '09. Settings & Backup',
    readyRoomsLabel: 'Ready rooms',
    noRoomsReady: 'No rooms ready for check-in',
    inHouseCheckout: 'In house now — check out',
  },
  ar: {
    hotelTitle: 'فندق أربيل // نظام إدارة العمليات الفندقية',
    dashboard: '01. لوحة القيادة',
    rooms: '02. الغرف حسب الطابق',
    checkin: '03. تسجيل الدخول / الخروج',
    housekeeping: '04. التدبير المنزلي',
    inspections: '05. فحص المشرف',
    maintenance: '06. الصيانة والأعطال',
    stays: '07. الإقامات والطلبات',
    reports: '08. التقرير اليومي',
    settings: '09. الإعدادات والنسخ الاحتياطي',
    readyRoomsLabel: 'الغرف الجاهزة',
    noRoomsReady: 'لا توجد غرف جاهزة لتسجيل الدخول',
    inHouseCheckout: 'النزلاء المقيمون حالياً — تسجيل الخروج',
  },
  ku: {
    hotelTitle: 'هۆتێلی هەولێر // سیستەمی بەڕێوەبردنی کاروباری هۆتێل',
    dashboard: '01. داشبۆردی سەرەکی',
    rooms: '02. ژوورەکان بەپێی نهۆم',
    checkin: '03. هاتنەژوورەوە / دەرچوون',
    housekeeping: '04. پاککردنەوە',
    inspections: '05. پشکنینی سەرپەرشتیار',
    maintenance: '06. چاککردنەوە',
    stays: '07. میوانەکان و خزمەتگوزاری',
    reports: '08. ڕاپۆرتی ڕۆژانە',
    settings: '09. ڕێکخستن و هەڵگرتن',
    readyRoomsLabel: 'ژوورە ئامادەکان',
    noRoomsReady: 'هیچ ژوورێک ئامادە نییە بۆ هاتنەژوورەوە',
    inHouseCheckout: 'میوانانی ئێستا لە هۆتێل — دەرچوون',
  },
};

export const StandardOpsDashboard: React.FC = () => {
  const { user, setLanguage, toggleSimpleMode } = useAuthStore();
  const lang: AppLanguage = user?.language || 'en';
  const t = TRANSLATIONS[lang];
  const role = user?.role || 'executive';
  const canSeePrivateGuestDetails = role === 'executive' || role === 'front_desk';

  const {
    rooms,
    reservations,
    housekeepingTasks,
    maintenanceTickets,
    roomServiceOrders,
    ownerBasePriceIqd,
    checkInGuest,
    checkOutRoom,
    setRoomType,
    setFloorRoomTypes,
    setOwnerBasePriceIqd,
    markCleaningStarted,
    markCleaningFinishedAwaitingInspection,
    inspectRoomVerdict,
    reportDamageTicket,
    updateMaintenanceTicketStatus,
    advanceRoomServiceStatus,
    exportBackupJson,
    importBackupJson,
    resetAllHotelData,
  } = useHotelOpsStore();

  const telemetry = useErbilTelemetry();

  const [activeModule, setActiveModule] = useState<OpsModule>('dashboard');

  // ROOMS PAGE STATE: Rooms stay hidden until a floor is clicked
  const [clickedFloor, setClickedFloor] = useState<number | null>(null);
  const [roomStatusFilter, setRoomStatusFilter] = useState<'ALL' | 'READY' | 'OCCUPIED' | 'DIRTY' | 'OOS'>('ALL');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('ALL');

  // CHECK-IN FORM STATE
  const readyRooms = useMemo(() => rooms.filter(isRoomReady), [rooms]);
  const occupiedRooms = useMemo(
    () => rooms.filter((r) => r.occupancyStatus === 'occupied'),
    [rooms]
  );

  const [selectedReadyRoom, setSelectedReadyRoom] = useState<string>(
    readyRooms[0]?.roomNumber || ''
  );
  const [ciName, setCiName] = useState('');
  const [ciContact, setCiContact] = useState('+964 750 ');
  const [ciIdNumber, setCiIdNumber] = useState('');
  const [ciCarNumber, setCiCarNumber] = useState('');
  const [ciDiscountPct, setCiDiscountPct] = useState(100);
  const [ciNights, setCiNights] = useState(1);
  const [ciChannel, setCiChannel] = useState<BookingChannel>('Walk_In_VIP');
  const [ciExtraGuests, setCiExtraGuests] = useState<ExtraGuest[]>([]);
  const [ciMessage, setCiMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // MAINTENANCE REPORT TAPS STATE
  const [dmgRoom, setDmgRoom] = useState('101');
  const [dmgProblem, setDmgProblem] = useState<MaintenanceProblemType>('HVAC / Climate');
  const [dmgPriority, setDmgPriority] = useState<'low' | 'medium' | 'high' | 'critical_oos'>('high');
  const [dmgNote, setDmgNote] = useState('');
  const [maintNotice, setMaintNotice] = useState<string | null>(null);

  // SETTINGS / START FRESH STATE
  const [resetConfirmStep, setResetConfirmStep] = useState<0 | 1 | 2>(0);
  const [resetTypedPhrase, setResetTypedPhrase] = useState('');
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const effectiveSelectedReadyRoom = useMemo(() => {
    if (readyRooms.some((r) => r.roomNumber === selectedReadyRoom)) {
      return selectedReadyRoom;
    }
    return readyRooms[0]?.roomNumber || '';
  }, [readyRooms, selectedReadyRoom]);

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCiMessage(null);
    if (!effectiveSelectedReadyRoom) {
      setCiMessage({ ok: false, text: t.noRoomsReady });
      return;
    }

    const res = checkInGuest({
      roomNumber: effectiveSelectedReadyRoom,
      guestName: ciName,
      guestContact: ciContact,
      guestIdNumber: ciIdNumber,
      guestCarNumber: ciCarNumber,
      extraGuests: ciExtraGuests,
      discountPayPercent: ciDiscountPct,
      nights: ciNights,
      channel: ciChannel,
    });

    if (!res.ok) {
      setCiMessage({ ok: false, text: res.error || 'Check-in blocked.' });
    } else {
      setCiMessage({
        ok: true,
        text: `Check-In Confirmed for Room ${effectiveSelectedReadyRoom}! Booking Ref: ${res.bookingRef}`,
      });
      setCiName('');
      setCiIdNumber('');
      setCiCarNumber('');
      setCiExtraGuests([]);
    }
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erbil-hotel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSettingsMsg('Backup downloaded cleanly to your computer.');
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importBackupJson(String(reader.result || ''));
      setSettingsMsg(
        ok
          ? 'Backup restored! All hotel rooms, stays, and tasks updated.'
          : 'Invalid backup file format.'
      );
    };
    reader.readAsText(file);
  };

  const chosenRoomObj = rooms.find((r) => r.roomNumber === effectiveSelectedReadyRoom);
  const fullCheckinPrice = (chosenRoomObj?.baseRateIqd || ownerBasePriceIqd) * Math.max(1, ciNights);
  const finalCheckinPay = Math.round((fullCheckinPrice * ciDiscountPct) / 100);

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#060609] text-[#f4f0ea] flex flex-col lg:flex-row">
      {/* LEFT SWISS-GRID SIDEBAR (Hidden in Simple Mode) */}
      {!user?.simpleMode && (
        <aside className="w-full lg:w-64 bg-[#040406] border-b lg:border-b-0 lg:border-r border-[#16161a] flex flex-col justify-between shrink-0">
          <div>
            {/* Brand Header */}
            <div className="p-4 border-b border-[#16161a] flex items-center gap-3">
              <img
                src="/assets/logo/erbil-hotel-logo.jpeg"
                alt="Erbil Hotel"
                className="w-10 h-10 object-cover border border-[#d4af37]"
              />
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#d4af37] truncate">
                  SALEM ST // SULAYMANIYAH
                </div>
                <div className="font-serif text-base font-semibold text-[#f4f0ea] truncate">
                  Erbil Hotel Ops
                </div>
              </div>
            </div>

            {/* Language Switcher (EN / AR / KU RTL) */}
            <div className="p-3 border-b border-[#16161a] bg-[#08080c]">
              <div className="font-mono text-[9px] uppercase tracking-widest text-[#686875] mb-1.5">
                LANGUAGE / زمان / اللغة
              </div>
              <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
                {(
                  [
                    { code: 'en', label: 'EN' },
                    { code: 'ar', label: 'العربية' },
                    { code: 'ku', label: 'کوردی' },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    className={`py-1 border transition ${
                      lang === l.code
                        ? 'bg-[#d4af37] text-[#030305] border-[#d4af37] font-bold'
                        : 'bg-[#040406] text-[#888895] border-[#1c1c24] hover:text-[#f4f0ea]'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation Modules */}
            <nav className="p-2 space-y-1 font-mono text-xs">
              {(
                [
                  { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
                  { id: 'rooms', label: t.rooms, icon: BedDouble },
                  { id: 'checkin', label: t.checkin, icon: LogIn },
                  { id: 'housekeeping', label: t.housekeeping, icon: Sparkles },
                  { id: 'inspections', label: t.inspections, icon: ClipboardCheck },
                  { id: 'maintenance', label: t.maintenance, icon: Wrench },
                  { id: 'stays', label: t.stays, icon: Utensils },
                  { id: 'reports', label: t.reports, icon: FileBarChart },
                  { id: 'settings', label: t.settings, icon: Settings },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveModule(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition ${
                      active
                        ? 'bg-[#12121a] text-[#d4af37] border-l-2 border-[#d4af37]'
                        : 'text-[#888895] hover:bg-[#0c0c12] hover:text-[#f4f0ea]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Simple Mode Toggle & Live Status */}
          <div className="p-4 border-t border-[#16161a] space-y-2.5 font-mono text-[10px]">
            <button
              onClick={toggleSimpleMode}
              className="w-full py-2 px-3 bg-[#0e0e14] hover:bg-[#161620] border border-[#24242e] text-[#00f0ff] uppercase tracking-wider"
            >
              Switch to Easy Simple Screen
            </button>
            <div className="p-2.5 bg-[#00e676]/10 border border-[#00e676]/30 text-[#00e676]">
              ● Real hotel data — saved on this computer
            </div>
          </div>
        </aside>
      )}

      {/* MAIN WORKSPACE */}
      <main className="flex-1 p-5 sm:p-8 overflow-y-auto space-y-6">
        {/* Top Simple Mode Exit Banner if active */}
        {user?.simpleMode && (
          <div className="p-3 bg-[#101018] border border-[#00f0ff]/40 flex items-center justify-between font-mono text-xs">
            <span className="text-[#00f0ff]">
              SIMPLE MODE (EASY SCREEN) ACTIVE FOR ROLE: {role.toUpperCase()}
            </span>
            <button
              onClick={toggleSimpleMode}
              className="px-3 py-1 bg-[#00f0ff] text-[#030305] font-bold uppercase"
            >
              Return to Full 9-Module App
            </button>
          </div>
        )}

        {/* MODULE 1: DASHBOARD */}
        {activeModule === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#16161a] pb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d4af37]">
                  REAL-TIME HOTEL OPERATIONS OVERVIEW
                </div>
                <h2 className="font-serif text-3xl text-[#f4f0ea] mt-0.5">{t.hotelTitle}</h2>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  onClick={() => setActiveModule('checkin')}
                  className="px-4 py-2 bg-[#00e676] text-[#030305] font-bold uppercase tracking-wider"
                >
                  + Quick Check-In ({telemetry.readyRooms} Ready)
                </button>
                <button
                  onClick={() => setActiveModule('maintenance')}
                  className="px-4 py-2 bg-[#12121a] border border-[#2a2a36] text-[#f4f0ea] uppercase tracking-wider"
                >
                  Report Damage
                </button>
              </div>
            </div>

            {/* 8 KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-4 bg-[#0a0a0e] border border-[#00e676]/40">
                <div className="text-[10px] text-[#888895] uppercase">READY ROOMS (CERTIFIED)</div>
                <div className="text-3xl font-bold text-[#00e676] mt-1 tabular-nums">
                  {telemetry.readyRooms}
                </div>
                <div className="text-[10px] text-[#686875] mt-1">
                  Vacant + Clean + Passed + In Service
                </div>
              </div>

              <div className="p-4 bg-[#0a0a0e] border border-[#00f0ff]/40">
                <div className="text-[10px] text-[#888895] uppercase">OCCUPIED ROOMS</div>
                <div className="text-3xl font-bold text-[#00f0ff] mt-1 tabular-nums">
                  {telemetry.occupiedRooms} / {telemetry.totalRooms}
                </div>
                <div className="text-[10px] text-[#686875] mt-1">
                  Occupancy: {telemetry.occupancyPercent}% ({telemetry.vipOccupiedRooms} VIP)
                </div>
              </div>

              <div className="p-4 bg-[#0a0a0e] border border-[#ff8a3d]/40">
                <div className="text-[10px] text-[#888895] uppercase">DIRTY / AWAITING INSPECT</div>
                <div className="text-3xl font-bold text-[#ff8a3d] mt-1 tabular-nums">
                  {telemetry.dirtyRooms} / {telemetry.awaitingInspectionRooms}
                </div>
                <div className="text-[10px] text-[#686875] mt-1">
                  Active Turnover Queue
                </div>
              </div>

              <div className="p-4 bg-[#0a0a0e] border border-[#ff1e7a]/40">
                <div className="text-[10px] text-[#888895] uppercase">OUT OF SERVICE (OOS)</div>
                <div className="text-3xl font-bold text-[#ff1e7a] mt-1 tabular-nums">
                  {telemetry.outOfServiceRooms}
                </div>
                <div className="text-[10px] text-[#686875] mt-1">
                  Open Repair Tickets: {telemetry.openMaintenanceCount}
                </div>
              </div>
            </div>

            {/* Dual-Currency Treasury & SLA Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              <div className="p-4 bg-[#0a0a0e] border border-[#1c1c24]">
                <div className="text-[10px] text-[#888895] uppercase">CUMULATIVE REVENUE (IQD / USD)</div>
                <div className="text-xl font-bold text-[#d4af37] mt-1 tabular-nums">
                  {telemetry.dualCurrencyRevenue.totalIqd.toLocaleString()} IQD
                </div>
                <div className="text-xs text-[#00e676] mt-0.5 tabular-nums">
                  ${telemetry.dualCurrencyRevenue.totalUsd.toLocaleString()} USD (@ 1,310 IQD)
                </div>
              </div>
              <div className="p-4 bg-[#0a0a0e] border border-[#1c1c24]">
                <div className="text-[10px] text-[#888895] uppercase">ADR & REVPAR METRICS</div>
                <div className="text-xl font-bold text-[#f4f0ea] mt-1 tabular-nums">
                  ADR: {telemetry.adrIqd.toLocaleString()} IQD (${telemetry.adrUsd})
                </div>
                <div className="text-xs text-[#00f0ff] mt-0.5 tabular-nums">
                  RevPAR: {telemetry.revParIqd.toLocaleString()} IQD (${telemetry.revParUsd})
                </div>
              </div>
              <div className="p-4 bg-[#0a0a0e] border border-[#1c1c24]">
                <div className="text-[10px] text-[#888895] uppercase">OPERATIONAL SLA DRIFT INDEX</div>
                <div className="text-xl font-bold text-[#00e676] mt-1 tabular-nums">
                  {telemetry.slaDriftScore.toFixed(3)} DRIFT
                </div>
                <div className="text-xs text-[#888895] mt-0.5">
                  Active Room Service Orders: {telemetry.activeServiceOrderCount}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODULE 2: ROOMS PAGE (Strictly hidden until a floor is clicked, no long floor structure box) */}
        {activeModule === 'rooms' && (
          <div className="space-y-6">
            {/* Admin Room Types by Floor Panel */}
            {role === 'executive' && (
              <div className="p-4 bg-[#0a0a0e] border border-[#d4af37]/40 space-y-3">
                <div className="font-mono text-xs font-bold text-[#d4af37] uppercase tracking-wider">
                  Room Types by Floor — Admin Bulk Configuration
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono text-xs">
                  {[1, 2, 3, 4, 5, 6].map((fl) => (
                    <div key={fl} className="p-2.5 bg-[#050508] border border-[#1e1e28] space-y-1.5">
                      <div className="text-[#f4f0ea] font-bold">Floor {fl}</div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setFloorRoomTypes(fl, 'Single')}
                          className="flex-1 py-1 bg-[#12121a] hover:bg-[#d4af37] hover:text-[#030305] border border-[#2a2a36] text-[10px]"
                        >
                          All Single
                        </button>
                        <button
                          onClick={() => setFloorRoomTypes(fl, 'Twin')}
                          className="flex-1 py-1 bg-[#12121a] hover:bg-[#00f0ff] hover:text-[#030305] border border-[#2a2a36] text-[10px]"
                        >
                          All Twin
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters & Floor Selector Buttons */}
            <div className="p-4 bg-[#0a0a0e] border border-[#1c1c24] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#888895]">
                    CLICK A FLOOR NUMBER TO REVEAL ITS ROOMS
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 font-mono text-xs">
                    {[1, 2, 3, 4, 5, 6].map((fl) => (
                      <button
                        key={fl}
                        onClick={() => setClickedFloor(clickedFloor === fl ? null : fl)}
                        className={`px-4 py-2 border font-bold transition ${
                          clickedFloor === fl
                            ? 'bg-[#d4af37] text-[#030305] border-[#d4af37]'
                            : 'bg-[#050508] text-[#f4f0ea] border-[#262632] hover:border-[#d4af37]'
                        }`}
                      >
                        Floor {fl} ({fl}01–{fl}08)
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status & Room Type Filters */}
                <div className="flex flex-wrap gap-2 font-mono text-xs">
                  <select
                    value={roomStatusFilter}
                    onChange={(e) => setRoomStatusFilter(e.target.value as typeof roomStatusFilter)}
                    className="bg-[#050508] border border-[#262632] px-3 py-2 text-[#f4f0ea]"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="READY">Ready (Green)</option>
                    <option value="OCCUPIED">Occupied</option>
                    <option value="DIRTY">Dirty / Cleaning</option>
                    <option value="OOS">Out of Service (Red)</option>
                  </select>
                  <select
                    value={roomTypeFilter}
                    onChange={(e) => setRoomTypeFilter(e.target.value)}
                    className="bg-[#050508] border border-[#262632] px-3 py-2 text-[#f4f0ea]"
                  >
                    <option value="ALL">All Room Types</option>
                    <option value="Single">Single</option>
                    <option value="Twin">Twin</option>
                    <option value="Executive Suite">Executive Suite</option>
                    <option value="Diplomatic Suite">Diplomatic Suite</option>
                    <option value="Royal Penthouse">Royal Penthouse</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Room Cards (Strictly hidden until a floor is clicked) */}
            {clickedFloor === null ? (
              <div className="p-12 bg-[#0a0a0e] border border-[#1c1c24] text-center font-mono text-sm text-[#888895]">
                Select a Floor (Floor 1 – Floor 6) above to inspect its rooms.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                {rooms
                  .filter((r) => r.floor === clickedFloor)
                  .filter((r) => {
                    if (roomStatusFilter === 'READY') return isRoomReady(r);
                    if (roomStatusFilter === 'OCCUPIED') return r.occupancyStatus === 'occupied';
                    if (roomStatusFilter === 'DIRTY') return r.housekeepingStatus !== 'clean';
                    if (roomStatusFilter === 'OOS') return r.maintenanceStatus === 'out_of_service';
                    return true;
                  })
                  .filter((r) => (roomTypeFilter === 'ALL' ? true : r.roomType === roomTypeFilter))
                  .map((rm) => {
                    const ready = isRoomReady(rm);
                    const isOos = rm.maintenanceStatus === 'out_of_service';
                    const isDirty = rm.housekeepingStatus !== 'clean' || rm.inspectionStatus !== 'passed';

                    return (
                      <div
                        key={rm.roomNumber}
                        className={`p-4 bg-[#0a0a0e] border space-y-3 ${
                          isOos
                            ? 'border-[#ff1e7a]'
                            : ready
                            ? 'border-[#00e676]'
                            : isDirty
                            ? 'border-[#ff8a3d]'
                            : 'border-[#00f0ff]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-[#f4f0ea]">
                            RM {rm.roomNumber}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 font-bold uppercase ${
                              isOos
                                ? 'bg-[#ff1e7a]/20 text-[#ff1e7a]'
                                : ready
                                ? 'bg-[#00e676]/20 text-[#00e676]'
                                : rm.occupancyStatus === 'occupied'
                                ? 'bg-[#00f0ff]/20 text-[#00f0ff]'
                                : 'bg-[#ff8a3d]/20 text-[#ff8a3d]'
                            }`}
                          >
                            {isOos
                              ? 'OUT OF SERVICE'
                              : ready
                              ? 'READY'
                              : rm.occupancyStatus === 'occupied'
                              ? 'OCCUPIED'
                              : 'NEEDS TURNOVER'}
                          </span>
                        </div>

                        {/* Separate Statuses Display */}
                        <div className="text-[11px] space-y-1 text-[#9898a6] border-t border-b border-[#181820] py-2">
                          <div className="flex justify-between">
                            <span>Floor / Type:</span>
                            <span className="text-[#d4af37]">
                              FL {rm.floor} // {rm.roomType}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Occupancy:</span>
                            <span className="text-[#f4f0ea] uppercase">{rm.occupancyStatus}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Housekeeping:</span>
                            <span className="text-[#f4f0ea] uppercase">
                              {rm.housekeepingStatus}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Inspection:</span>
                            <span className="text-[#f4f0ea] uppercase">{rm.inspectionStatus}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Maintenance:</span>
                            <span className="text-[#f4f0ea] uppercase">{rm.maintenanceStatus}</span>
                          </div>
                        </div>

                        {/* Guest Details Privacy Rule */}
                        {rm.occupancyStatus === 'occupied' && (
                          <div className="p-2 bg-[#050508] border border-[#1c1c24] text-[10px] space-y-0.5">
                            <div className="text-[#00f0ff] font-bold">
                              Guest: {rm.currentGuestName}
                            </div>
                            {canSeePrivateGuestDetails && (
                              <>
                                <div>ID: {rm.currentGuestIdNumber}</div>
                                <div>Tel: {rm.currentGuestContact}</div>
                                <div>Car: {rm.currentGuestCarNumber || 'N/A'}</div>
                                {rm.extraGuests.length > 0 && (
                                  <div className="text-[#d4af37]">
                                    +{rm.extraGuests.length} Extra Guest(s)
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Admin Room Type Changer */}
                        {role === 'executive' && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-[#686875]">Change Type:</span>
                            <select
                              value={rm.roomType}
                              onChange={(e) =>
                                setRoomType(rm.roomNumber, e.target.value as RoomType)
                              }
                              className="bg-[#050508] border border-[#262632] px-2 py-1 text-[10px] text-[#f4f0ea]"
                            >
                              <option value="Single">Single</option>
                              <option value="Twin">Twin</option>
                              <option value="Executive Suite">Executive Suite</option>
                              <option value="Diplomatic Suite">Diplomatic Suite</option>
                              <option value="Royal Penthouse">Royal Penthouse</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* MODULE 3: CHECK-IN / CHECK-OUT BOARD */}
        {activeModule === 'checkin' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Choose a READY room & Check-In Form */}
            <div className="lg:col-span-7 bg-[#0a0a0e] border border-[#1c1c24] p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#181820] pb-3">
                <h3 className="font-serif text-2xl text-[#f4f0ea]">
                  Reception Check-In Board
                </h3>
                <span className="px-3 py-1 bg-[#00e676]/15 border border-[#00e676] text-[#00e676] font-mono text-xs font-bold">
                  {t.readyRoomsLabel}: {readyRooms.length}
                </span>
              </div>

              {readyRooms.length === 0 ? (
                <div className="p-6 bg-[#ff1e7a]/10 border border-[#ff1e7a] text-[#ff1e7a] font-mono text-sm">
                  {t.noRoomsReady}
                </div>
              ) : (
                <form onSubmit={handleCheckInSubmit} className="space-y-4 font-mono text-xs">
                  <div>
                    <label className="block text-[10px] uppercase text-[#888895] mb-1.5">
                      Choose a Room for Check-In (Shows ONLY Ready Rooms)
                    </label>
                    <select
                      value={effectiveSelectedReadyRoom}
                      onChange={(e) => setSelectedReadyRoom(e.target.value)}
                      className="w-full bg-[#050508] border border-[#00e676]/60 px-3 py-2.5 text-sm text-[#f4f0ea]"
                    >
                      {readyRooms.map((r) => (
                        <option key={r.roomNumber} value={r.roomNumber}>
                          Room {r.roomNumber} (Floor {r.floor} — {r.roomType}) —{' '}
                          {r.baseRateIqd.toLocaleString()} IQD [READY]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-[#888895] uppercase mb-1">
                        Full Name (Required) *
                      </label>
                      <input
                        type="text"
                        required
                        value={ciName}
                        onChange={(e) => setCiName(e.target.value)}
                        placeholder="Guest Full Name"
                        className="w-full bg-[#050508] border border-[#262632] px-3 py-2 text-[#f4f0ea]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#888895] uppercase mb-1">
                        ID / Passport Number (Required) *
                      </label>
                      <input
                        type="text"
                        required
                        value={ciIdNumber}
                        onChange={(e) => setCiIdNumber(e.target.value)}
                        placeholder="IRQ-ID-..."
                        className="w-full bg-[#050508] border border-[#262632] px-3 py-2 text-[#f4f0ea]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#888895] uppercase mb-1">
                        Contact Number
                      </label>
                      <input
                        type="text"
                        value={ciContact}
                        onChange={(e) => setCiContact(e.target.value)}
                        className="w-full bg-[#050508] border border-[#262632] px-3 py-2 text-[#f4f0ea]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#888895] uppercase mb-1">
                        Car Plate Number
                      </label>
                      <input
                        type="text"
                        value={ciCarNumber}
                        onChange={(e) => setCiCarNumber(e.target.value)}
                        placeholder="EBL / SLM Plate"
                        className="w-full bg-[#050508] border border-[#262632] px-3 py-2 text-[#f4f0ea]"
                      />
                    </div>
                  </div>

                  {/* Extra Guests Builder */}
                  <div className="p-3 bg-[#050508] border border-[#1c1c24] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span>
                        Automatic Guest Count:{' '}
                        <strong className="text-[#d4af37]">{1 + ciExtraGuests.length}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCiExtraGuests((prev) => [
                            ...prev,
                            { id: `eg-${Date.now()}-${prev.length}`, fullName: '', idNumber: '' },
                          ])
                        }
                        className="px-3 py-1.5 bg-[#14141e] border border-[#d4af37] text-[#d4af37] font-bold uppercase flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add another guest
                      </button>
                    </div>
                    {ciExtraGuests.map((eg, i) => (
                      <div key={eg.id} className="grid grid-cols-12 gap-2">
                        <input
                          type="text"
                          required
                          placeholder={`Extra Guest #${i + 2} Full Name *`}
                          value={eg.fullName}
                          onChange={(e) =>
                            setCiExtraGuests((prev) =>
                              prev.map((item) =>
                                item.id === eg.id ? { ...item, fullName: e.target.value } : item
                              )
                            )
                          }
                          className="col-span-5 bg-[#0a0a0e] border border-[#262632] px-2 py-1.5"
                        />
                        <input
                          type="text"
                          required
                          placeholder={`Extra Guest #${i + 2} ID Number *`}
                          value={eg.idNumber}
                          onChange={(e) =>
                            setCiExtraGuests((prev) =>
                              prev.map((item) =>
                                item.id === eg.id ? { ...item, idNumber: e.target.value } : item
                              )
                            )
                          }
                          className="col-span-5 bg-[#0a0a0e] border border-[#262632] px-2 py-1.5"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCiExtraGuests((prev) => prev.filter((item) => item.id !== eg.id))
                          }
                          className="col-span-2 bg-[#ff1e7a]/20 border border-[#ff1e7a] text-[#ff1e7a] flex items-center justify-center"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Discount % & Price Summary */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-[#050508] border border-[#1c1c24]">
                    <div>
                      <label className="block text-[10px] text-[#888895]">Discount % Paid</label>
                      <input
                        type="number"
                        min={10}
                        max={100}
                        value={ciDiscountPct}
                        onChange={(e) => setCiDiscountPct(Number(e.target.value) || 100)}
                        className="mt-1 w-full bg-[#0a0a0e] border border-[#262632] px-2 py-1 text-[#d4af37]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#888895]">Channel</label>
                      <select
                        value={ciChannel}
                        onChange={(e) => setCiChannel(e.target.value as BookingChannel)}
                        className="mt-1 w-full bg-[#0a0a0e] border border-[#262632] px-2 py-1"
                      >
                        <option value="Walk_In_VIP">Walk_In_VIP</option>
                        <option value="Direct_Web">Direct_Web</option>
                        <option value="Booking_OTA">Booking_OTA</option>
                        <option value="Embassy_Corp">Embassy_Corp</option>
                        <option value="Airport_Transfer">Airport_Transfer</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#888895]">
                        Full: {fullCheckinPrice.toLocaleString()} IQD ({ciDiscountPct}%)
                      </div>
                      <div className="text-sm font-bold text-[#00e676] mt-1">
                        Pays: {finalCheckinPay.toLocaleString()} IQD
                      </div>
                    </div>
                  </div>

                  {ciMessage && (
                    <div
                      className={`p-3 border ${
                        ciMessage.ok
                          ? 'bg-[#00e676]/10 border-[#00e676] text-[#00e676]'
                          : 'bg-[#ff1e7a]/10 border-[#ff1e7a] text-[#ff1e7a]'
                      }`}
                    >
                      {ciMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#00e676] hover:bg-[#2ef08d] text-[#030305] font-bold uppercase tracking-widest"
                  >
                    CONFIRM CHECK-IN TO ROOM {effectiveSelectedReadyRoom}
                  </button>
                </form>
              )}
            </div>

            {/* Right 5 Cols: In House Now — Check Out */}
            <div className="lg:col-span-5 bg-[#0a0a0e] border border-[#1c1c24] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#181820] pb-3">
                <h3 className="font-serif text-xl text-[#f4f0ea]">{t.inHouseCheckout}</h3>
                <span className="font-mono text-xs text-[#00f0ff]">
                  Occupied: {occupiedRooms.length}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1 font-mono text-xs">
                {occupiedRooms.map((rm) => (
                  <div
                    key={rm.roomNumber}
                    className="p-3 bg-[#050508] border border-[#1e1e28] flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#00f0ff]">RM {rm.roomNumber}</span>
                        <span className="text-[#f4f0ea] font-semibold">
                          {rm.currentGuestName}
                        </span>
                      </div>
                      {canSeePrivateGuestDetails && (
                        <div className="text-[10px] text-[#888895] mt-0.5">
                          ID: {rm.currentGuestIdNumber} | Guests: {1 + rm.extraGuests.length} |{' '}
                          {rm.discountPayPercent}% Rate
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => checkOutRoom(rm.roomNumber)}
                      className="px-3 py-1.5 bg-[#ff8a3d] hover:bg-[#ffa05d] text-[#030305] font-bold uppercase text-[10px] shrink-0"
                    >
                      Check Out
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODULE 4: HOUSEKEEPING */}
        {activeModule === 'housekeeping' && (
          <div className="space-y-4">
            <h3 className="font-serif text-2xl text-[#f4f0ea]">
              Housekeeping Cleaning Queue (Cleaned Rooms Move to Awaiting Inspection)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
              {rooms
                .filter((r) => r.housekeepingStatus !== 'clean' || r.inspectionStatus === 'failed')
                .map((rm) => (
                  <div
                    key={rm.roomNumber}
                    className="p-4 bg-[#0a0a0e] border border-[#ff8a3d]/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-[#f4f0ea]">Room {rm.roomNumber}</span>
                      <span className="px-2 py-0.5 bg-[#ff8a3d]/20 text-[#ff8a3d] uppercase text-[10px]">
                        {rm.housekeepingStatus}
                      </span>
                    </div>
                    <div className="text-[#888895]">
                      Floor {rm.floor} // {rm.roomType}
                    </div>
                    <div className="flex gap-2 pt-2">
                      {rm.housekeepingStatus === 'dirty' && (
                        <button
                          onClick={() => markCleaningStarted(rm.roomNumber)}
                          className="flex-1 py-2.5 bg-[#00f0ff] text-[#030305] font-bold uppercase"
                        >
                          Start Cleaning
                        </button>
                      )}
                      <button
                        onClick={() => markCleaningFinishedAwaitingInspection(rm.roomNumber)}
                        className="flex-1 py-2.5 bg-[#00e676] text-[#030305] font-bold uppercase"
                      >
                        Mark Cleaning Done
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* MODULE 5: SUPERVISOR INSPECTIONS */}
        {activeModule === 'inspections' && (
          <div className="space-y-4">
            <h3 className="font-serif text-2xl text-[#f4f0ea]">
              Supervisor Room Inspections (Pass = Certified Ready | Fail = Return to Housekeeping)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
              {rooms
                .filter((r) => r.inspectionStatus === 'awaiting_inspection')
                .map((rm) => (
                  <div
                    key={rm.roomNumber}
                    className="p-4 bg-[#0a0a0e] border border-[#d4af37]/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-[#f4f0ea]">Room {rm.roomNumber}</span>
                      <span className="px-2 py-0.5 bg-[#d4af37]/20 text-[#d4af37] text-[10px]">
                        AWAITING INSPECTION
                      </span>
                    </div>
                    <div className="text-[#888895]">
                      Housekeeping Status: {rm.housekeepingStatus.toUpperCase()}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => inspectRoomVerdict(rm.roomNumber, 'passed')}
                        className="py-2.5 bg-[#00e676] text-[#030305] font-bold uppercase"
                      >
                        ✓ PASSED (MAKE READY)
                      </button>
                      <button
                        onClick={() => inspectRoomVerdict(rm.roomNumber, 'failed')}
                        className="py-2.5 bg-[#ff1e7a] text-[#f4f0ea] font-bold uppercase"
                      >
                        ✕ FAILED (RE-CLEAN)
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* MODULE 6: DAMAGE / MAINTENANCE — BIG BUTTONS ONLY */}
        {activeModule === 'maintenance' && (
          <div className="space-y-6 font-mono">
            {/* Tap-Only Damage Reporter */}
            <div className="p-5 bg-[#0a0a0e] border border-[#1c1c24] space-y-4">
              <h3 className="font-serif text-2xl text-[#f4f0ea] font-sans">
                Report Damage — Big Tap Workflow
              </h3>

              <div>
                <div className="text-[10px] text-[#888895] uppercase mb-1.5">1. Tap the Room</div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {rooms.map((r) => (
                    <button
                      key={r.roomNumber}
                      type="button"
                      onClick={() => setDmgRoom(r.roomNumber)}
                      className={`px-2.5 py-1 text-xs border ${
                        dmgRoom === r.roomNumber
                          ? 'bg-[#d4af37] text-[#030305] border-[#d4af37] font-bold'
                          : 'bg-[#050508] text-[#888895] border-[#22222c]'
                      }`}
                    >
                      {r.roomNumber}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#888895] uppercase mb-1.5">
                  2. Tap the Problem Type
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {(
                    [
                      'HVAC / Climate',
                      'Plumbing / Water',
                      'Electrical / Lighting',
                      'Smart Keycard Lock',
                      'Furniture / Glazing',
                    ] as const
                  ).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setDmgProblem(pt)}
                      className={`p-2.5 border font-bold ${
                        dmgProblem === pt
                          ? 'bg-[#00f0ff] text-[#030305] border-[#00f0ff]'
                          : 'bg-[#050508] text-[#f4f0ea] border-[#262632]'
                      }`}
                    >
                      {pt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#888895] uppercase mb-1.5">
                  3. Tap the Priority
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {(
                    [
                      { id: 'low', label: 'LOW PRIORITY' },
                      { id: 'medium', label: 'MEDIUM PRIORITY' },
                      { id: 'high', label: 'HIGH PRIORITY' },
                      { id: 'critical_oos', label: 'CRITICAL (MARK OUT OF SERVICE)' },
                    ] as const
                  ).map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => setDmgPriority(pr.id)}
                      className={`p-2.5 border font-bold ${
                        dmgPriority === pr.id
                          ? 'bg-[#ff1e7a] text-[#f4f0ea] border-[#ff1e7a]'
                          : 'bg-[#050508] text-[#888895] border-[#262632]'
                      }`}
                    >
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  reportDamageTicket({
                    roomNumber: dmgRoom,
                    problemType: dmgProblem,
                    priority: dmgPriority,
                    note: dmgNote,
                    reportedBy: user?.fullName || 'Staff',
                  });
                  setDmgNote('');
                  setMaintNotice(`Damage ticket created for Room ${dmgRoom}`);
                }}
                className="w-full py-3.5 bg-[#ff1e7a] hover:bg-[#ff398b] text-[#f4f0ea] font-bold text-sm uppercase tracking-widest"
              >
                4. REPORT DAMAGE (ROOM {dmgRoom})
              </button>
            </div>

            {maintNotice && (
              <div className="p-3 bg-[#d4af37]/15 border border-[#d4af37] text-[#d4af37] text-xs">
                {maintNotice}
              </div>
            )}

            {/* Active Tickets with 4 Big Status Buttons + Supervisor Checked-OK */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {maintenanceTickets.map((tkt) => (
                <div
                  key={tkt.id}
                  className="p-4 bg-[#0a0a0e] border border-[#262632] space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-[#f4f0ea]">
                      RM {tkt.roomNumber} // {tkt.problemType}
                    </span>
                    <span className="px-2 py-0.5 bg-[#ff1e7a]/20 text-[#ff1e7a] uppercase text-[10px]">
                      {tkt.status}
                    </span>
                  </div>
                  <p className="text-[#888895]">{tkt.note}</p>

                  {/* 4 BIG BUTTONS */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        const r = updateMaintenanceTicketStatus(tkt.id, 'working_on_it', role);
                        setMaintNotice(r.message);
                      }}
                      className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase"
                    >
                      Working on it
                    </button>
                    <button
                      onClick={() => {
                        const r = updateMaintenanceTicketStatus(
                          tkt.id,
                          'fixed_awaiting_check',
                          role
                        );
                        setMaintNotice(r.message);
                      }}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase"
                    >
                      Fixed (Send for Check)
                    </button>
                    <button
                      onClick={() => {
                        const r = updateMaintenanceTicketStatus(tkt.id, 'out_of_service', role);
                        setMaintNotice(r.message);
                      }}
                      className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase"
                    >
                      Out of service
                    </button>
                    <button
                      onClick={() => {
                        const r = updateMaintenanceTicketStatus(tkt.id, 'needs_parts', role);
                        setMaintNotice(r.message);
                      }}
                      className="py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase"
                    >
                      Needs parts
                    </button>
                  </div>

                  {/* Supervisor Verification Button */}
                  {(role === 'executive' || role === 'front_desk') && (
                    <div className="pt-2 border-t border-[#1c1c24] flex gap-2">
                      <button
                        onClick={() => {
                          const r = updateMaintenanceTicketStatus(tkt.id, 'checked_ok', role);
                          setMaintNotice(r.message);
                        }}
                        className="flex-1 py-2 bg-[#00e676] text-[#030305] font-bold uppercase"
                      >
                        Supervisor: Checked — OK (Close & Release Room)
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODULE 7: STAYS & ROOM SERVICE */}
        {activeModule === 'stays' && (
          <div className="space-y-6 font-mono text-xs">
            <h3 className="font-serif text-2xl text-[#f4f0ea] font-sans">
              Active Culinary Orders & Guest Stays
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {roomServiceOrders.map((ord) => (
                <div key={ord.id} className="p-4 bg-[#0a0a0e] border border-[#d4af37]/40 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span className="text-[#d4af37]">RM {ord.roomNumber}</span>
                    <span className="text-[#00f0ff] uppercase">{ord.status}</span>
                  </div>
                  <div className="text-[#f4f0ea]">{ord.guestName}</div>
                  <div className="text-[#00e676] font-bold">
                    {ord.totalIqd.toLocaleString()} IQD (${ord.totalUsd})
                  </div>
                  <button
                    onClick={() => advanceRoomServiceStatus(ord.id)}
                    className="w-full py-2 bg-[#14141e] hover:bg-[#d4af37] hover:text-[#030305] border border-[#d4af37] text-[#d4af37] font-bold uppercase"
                  >
                    Advance Order Stage →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODULE 8: DAILY REPORT */}
        {activeModule === 'reports' && (
          <div className="p-6 bg-[#0a0a0e] border border-[#1c1c24] space-y-5 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#181820] pb-4">
              <div>
                <div className="text-[10px] text-[#d4af37]">OFFICIAL ERBIL HOTEL DAILY REPORT</div>
                <h3 className="font-serif text-2xl text-[#f4f0ea] font-sans">
                  Daily Operational & Treasury Audit — {new Date().toLocaleDateString()}
                </h3>
              </div>
              <div className="text-right">
                <div className="text-[#00e676] font-bold">
                  Total Revenue: {telemetry.dualCurrencyRevenue.totalIqd.toLocaleString()} IQD
                </div>
                <div className="text-[#888895]">
                  ≈ ${telemetry.dualCurrencyRevenue.totalUsd.toLocaleString()} USD
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-[#050508] border border-[#1c1c24]">
                Ready Rooms: <strong className="text-[#00e676]">{telemetry.readyRooms}</strong>
              </div>
              <div className="p-3 bg-[#050508] border border-[#1c1c24]">
                Occupied: <strong className="text-[#00f0ff]">{telemetry.occupiedRooms}</strong>
              </div>
              <div className="p-3 bg-[#050508] border border-[#1c1c24]">
                Dirty / Cleaning: <strong className="text-[#ff8a3d]">{telemetry.dirtyRooms}</strong>
              </div>
              <div className="p-3 bg-[#050508] border border-[#1c1c24]">
                Out of Service:{' '}
                <strong className="text-[#ff1e7a]">{telemetry.outOfServiceRooms}</strong>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#d4af37] mb-2 uppercase">
                In-House Guests & Extra Companions
              </h4>
              <div className="space-y-2">
                {occupiedRooms.map((r) => (
                  <div
                    key={r.roomNumber}
                    className="p-3 bg-[#050508] border border-[#181820] flex flex-wrap justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-[#00f0ff]">RM {r.roomNumber}:</span>{' '}
                      <span className="text-[#f4f0ea]">{r.currentGuestName}</span>
                      {canSeePrivateGuestDetails && r.extraGuests.length > 0 && (
                        <span className="text-[#d4af37] ml-2">
                          + Extra:{' '}
                          {r.extraGuests.map((eg) => `${eg.fullName} (${eg.idNumber})`).join(', ')}
                        </span>
                      )}
                    </div>
                    {canSeePrivateGuestDetails && (
                      <div className="text-[#888895]">
                        ID: {r.currentGuestIdNumber} | Tel: {r.currentGuestContact} | Car:{' '}
                        {r.currentGuestCarNumber}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODULE 9: SETTINGS, BACKUP, RESTORE, START FRESH */}
        {activeModule === 'settings' && (
          <div className="space-y-6 font-mono text-xs">
            <div className="p-6 bg-[#0a0a0e] border border-[#1c1c24] space-y-4">
              <h3 className="font-serif text-2xl text-[#f4f0ea] font-sans">
                Hotel Details, Standard Tariff & Data Backup
              </h3>
              <p className="text-[#888895]">
                Erbil Hotel — Salem Street, Sulaymaniyah, next to City Star (35.5581216,
                45.4269216). Ground = Lobby, Floor 1–6 = Operational Citadel Suites & Rooms.
              </p>

              <div className="flex flex-wrap items-end gap-4 pt-2">
                <div>
                  <label className="block text-[10px] text-[#888895] uppercase mb-1">
                    Owner Standard Room Price (IQD)
                  </label>
                  <input
                    type="number"
                    value={ownerBasePriceIqd}
                    onChange={(e) => setOwnerBasePriceIqd(Number(e.target.value) || 100000)}
                    className="bg-[#050508] border border-[#d4af37] px-3 py-2 text-sm text-[#d4af37] font-bold"
                  />
                </div>
                <button
                  onClick={handleDownloadBackup}
                  className="px-4 py-2.5 bg-[#00e676] text-[#030305] font-bold uppercase flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Backup (.json)
                </button>
                <label className="px-4 py-2.5 bg-[#00f0ff] text-[#030305] font-bold uppercase flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" /> Restore from Backup
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleUploadBackup}
                    className="hidden"
                  />
                </label>
              </div>

              {settingsMsg && (
                <div className="p-3 bg-[#00e676]/10 border border-[#00e676] text-[#00e676]">
                  {settingsMsg}
                </div>
              )}
            </div>

            {/* Start Fresh — Owner 2-Step Confirmation + Typing "Erbil Hotel" */}
            <div className="p-6 bg-[#0a0a0e] border border-[#ff1e7a]/50 space-y-4">
              <div className="text-[#ff1e7a] font-bold uppercase">
                Start Fresh — Reset Hotel Operational State
              </div>
              {resetConfirmStep === 0 && (
                <button
                  onClick={() => setResetConfirmStep(1)}
                  className="px-4 py-2 bg-[#ff1e7a]/20 border border-[#ff1e7a] text-[#ff1e7a] font-bold uppercase"
                >
                  Start fresh — erase and reset hotel data
                </button>
              )}
              {resetConfirmStep === 1 && (
                <div className="space-y-3">
                  <p className="text-[#ff8a3d]">
                    Confirmation 1 of 2: This resets rooms, stays, tickets, and tasks to factory
                    seed state. Are you sure?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResetConfirmStep(2)}
                      className="px-4 py-2 bg-[#ff1e7a] text-white font-bold uppercase"
                    >
                      Yes, proceed to final confirmation
                    </button>
                    <button
                      onClick={() => setResetConfirmStep(0)}
                      className="px-4 py-2 bg-[#16161e] text-[#888895]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {resetConfirmStep === 2 && (
                <div className="space-y-3">
                  <p className="text-[#ff1e7a]">
                    Confirmation 2 of 2: Type <strong>Erbil Hotel</strong> below to confirm reset:
                  </p>
                  <input
                    type="text"
                    value={resetTypedPhrase}
                    onChange={(e) => setResetTypedPhrase(e.target.value)}
                    placeholder="Type: Erbil Hotel"
                    className="bg-[#050508] border border-[#ff1e7a] px-3 py-2 text-[#f4f0ea]"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={resetTypedPhrase !== 'Erbil Hotel'}
                      onClick={() => {
                        resetAllHotelData();
                        setResetConfirmStep(0);
                        setResetTypedPhrase('');
                        setSettingsMsg('Hotel data reset to clean seed state.');
                      }}
                      className="px-4 py-2 bg-[#ff1e7a] disabled:opacity-40 text-white font-bold uppercase"
                    >
                      Confirm Erase & Reset
                    </button>
                    <button
                      onClick={() => setResetConfirmStep(0)}
                      className="px-4 py-2 bg-[#16161e] text-[#888895]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
