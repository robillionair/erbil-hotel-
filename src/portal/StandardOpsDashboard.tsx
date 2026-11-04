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
  Plus,
  Trash2,
  Utensils,
  X,
  Thermometer,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
} from 'lucide-react';
import {
  useHotelOpsStore,
  isRoomReady,
  RoomType,
  RoomNode,
  ExtraGuest,
  MaintenanceProblemType,
  BookingChannel,
} from '../store/useHotelOpsStore';
import { useAuthStore, AppLanguage } from '../store/useAuthStore';
import { useErbilTelemetry } from '../citadel-mode/telemetry/ErbilTelemetryStream';

type OpsModule =
  | 'matrix'
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
    matrix: string;
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
    hotelTitle: 'Erbil Hotel • Spatial Operations Command',
    matrix: 'Spatial Floor Matrix',
    checkin: 'Reception Check-In',
    housekeeping: 'Housekeeping',
    inspections: 'Inspections',
    maintenance: 'Maintenance',
    stays: 'Culinary & Stays',
    reports: 'Daily Audit',
    settings: 'Settings & Vault',
    readyRoomsLabel: 'Certified Ready Rooms',
    noRoomsReady: 'No rooms currently certified ready for check-in',
    inHouseCheckout: 'Active In-House Folios — Check Out',
  },
  ar: {
    hotelTitle: 'فندق أربيل • مركز إدارة العمليات المكانية',
    matrix: 'مصفوفة الطوابق والغرف',
    checkin: 'تسجيل الدخول والخروج',
    housekeeping: 'التدبير المنزلي',
    inspections: 'فحص المشرف',
    maintenance: 'الصيانة والأعطال',
    stays: 'الإقامات والطلبات',
    reports: 'التقرير اليومي',
    settings: 'الإعدادات والنسخ الاحتياطي',
    readyRoomsLabel: 'الغرف الجاهزة المعتمدة',
    noRoomsReady: 'لا توجد غرف جاهزة لتسجيل الدخول',
    inHouseCheckout: 'النزلاء المقيمون حالياً — تسجيل الخروج',
  },
  ku: {
    hotelTitle: 'هۆتێلی هەولێر • ناوەندی بەڕێوەبردنی کاروباری هۆتێل',
    matrix: 'تۆڕی نهۆم و ژوورەکان',
    checkin: 'هاتنەژوورەوە و دەرچوون',
    housekeeping: 'پاککردنەوە',
    inspections: 'پشکنینی سەرپەرشتیار',
    maintenance: 'چاککردنەوە',
    stays: 'میوانەکان و خزمەتگوزاری',
    reports: 'ڕاپۆرتی ڕۆژانە',
    settings: 'ڕێکخستن و هەڵگرتن',
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
    housekeepingTasks,
    maintenanceTickets,
    roomServiceOrders,
    ownerBasePriceIqd,
    checkInGuest,
    checkOutRoom,
    setRoomType,
    setFloorRoomTypes,
    setOwnerBasePriceIqd,
    setRoomHvacTemp,
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

  const [activeModule, setActiveModule] = useState<OpsModule>('matrix');
  const [selectedFloor, setSelectedFloor] = useState<number | 'ALL'>('ALL');
  const [roomStatusFilter, setRoomStatusFilter] = useState<
    'ALL' | 'READY' | 'OCCUPIED' | 'DIRTY' | 'OOS'
  >('ALL');
  const [inspectedRoomNumber, setInspectedRoomNumber] = useState<string | null>(null);

  const inspectedRoom: RoomNode | null = useMemo(
    () => rooms.find((r) => r.roomNumber === inspectedRoomNumber) || null,
    [rooms, inspectedRoomNumber]
  );

  // Check-In Form State
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

  // Maintenance State
  const [dmgRoom, setDmgRoom] = useState('101');
  const [dmgProblem, setDmgProblem] = useState<MaintenanceProblemType>('HVAC / Climate');
  const [dmgPriority, setDmgPriority] = useState<'low' | 'medium' | 'high' | 'critical_oos'>('high');
  const [dmgNote, setDmgNote] = useState('');
  const [maintNotice, setMaintNotice] = useState<string | null>(null);

  // Settings / Reset State
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
    <div className="min-h-[calc(100vh-56px)] text-[#f4f0ea] px-4 sm:px-8 py-6 max-w-[1600px] mx-auto space-y-6 relative">
      {/* =====================================================================
          1. FLOATING TRANSLUCENT LINEAR/RAYCAST COMMAND HEADER & KPI STRIP
      ===================================================================== */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/assets/logo/erbil-hotel-logo.jpeg"
              alt="Erbil Hotel"
              className="w-11 h-11 rounded-2xl object-cover border border-[#d4af37]/50 shadow-lg"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse" />
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#d4af37]">
                  Realtime Operations Workspace
                </span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl text-white font-light">
                {t.hotelTitle}
              </h1>
            </div>
          </div>

          {/* Language & Simple Mode Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="glass-pill rounded-full p-1 flex items-center gap-1 text-xs">
              <Globe className="w-3.5 h-3.5 text-[#d4af37] ml-2 mr-1" />
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
                  className={`px-3 py-1 rounded-full transition ${
                    lang === l.code
                      ? 'bg-[#d4af37] text-[#030305] font-semibold'
                      : 'text-white/65 hover:text-white'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <button
              onClick={toggleSimpleMode}
              className="glass-pill px-4 py-2 rounded-full text-xs font-medium text-[#00f0ff] hover:border-[#00f0ff]/50 transition"
            >
              {user?.simpleMode ? 'Full Workspace Mode' : 'Easy Focus Mode'}
            </button>
          </div>
        </div>

        {/* Sleek 5-Column Glassmorphic Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-[#00e676]/30 shadow-[0_0_30px_rgba(0,230,118,0.06)]">
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Certified Ready</span>
              <span className="w-2 h-2 rounded-full bg-[#00e676]" />
            </div>
            <div className="font-mono text-2xl font-semibold text-[#00e676] mt-1 tabular-nums">
              {telemetry.readyRooms} <span className="text-xs text-white/40">/ {telemetry.totalRooms}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-[#00f0ff]/30 shadow-[0_0_30px_rgba(0,240,255,0.06)]">
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Occupied ({telemetry.occupancyPercent}%)</span>
              <span className="w-2 h-2 rounded-full bg-[#00f0ff]" />
            </div>
            <div className="font-mono text-2xl font-semibold text-[#00f0ff] mt-1 tabular-nums">
              {telemetry.occupiedRooms}{' '}
              <span className="text-xs text-[#d4af37]">({telemetry.vipOccupiedRooms} VIP)</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-[#ff9e2c]/30">
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Turnover / Inspect</span>
              <span className="w-2 h-2 rounded-full bg-[#ff9e2c]" />
            </div>
            <div className="font-mono text-2xl font-semibold text-[#ff9e2c] mt-1 tabular-nums">
              {telemetry.dirtyRooms} <span className="text-xs text-white/40">/ {telemetry.awaitingInspectionRooms} Insp</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-[#ff1e7a]/30">
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Out of Service</span>
              <span className="w-2 h-2 rounded-full bg-[#ff1e7a]" />
            </div>
            <div className="font-mono text-2xl font-semibold text-[#ff1e7a] mt-1 tabular-nums">
              {telemetry.outOfServiceRooms}{' '}
              <span className="text-xs text-white/40">({telemetry.openMaintenanceCount} Tkt)</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-[#d4af37]/30 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Live Treasury</span>
              <span className="font-mono text-[10px] text-[#d4af37]">1,310 IQD</span>
            </div>
            <div className="font-mono text-lg font-semibold text-[#d4af37] mt-1 tabular-nums truncate">
              {telemetry.dualCurrencyRevenue.totalIqd.toLocaleString()} IQD
            </div>
            <div className="font-mono text-[11px] text-[#00e676] tabular-nums">
              ≈ ${telemetry.dualCurrencyRevenue.totalUsd.toLocaleString()} USD
            </div>
          </div>
        </div>

        {/* Floating Module Navigation Pills */}
        {!user?.simpleMode && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
            {(
              [
                { id: 'matrix', label: t.matrix, icon: BedDouble },
                { id: 'checkin', label: t.checkin, icon: LogIn },
                { id: 'housekeeping', label: t.housekeeping, icon: Sparkles },
                { id: 'inspections', label: t.inspections, icon: ClipboardCheck },
                { id: 'maintenance', label: t.maintenance, icon: Wrench },
                { id: 'stays', label: t.stays, icon: Utensils },
                { id: 'reports', label: t.reports, icon: FileBarChart },
                { id: 'settings', label: t.settings, icon: Settings },
              ] as const
            ).map((mod) => {
              const Icon = mod.icon;
              const active = activeModule === mod.id;
              return (
                <button
                  key={mod.id}
                  onClick={() => setActiveModule(mod.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-medium flex items-center gap-2 shrink-0 transition-all ${
                    active
                      ? 'bg-gradient-to-r from-[#d4af37] to-[#b89225] text-[#030305] font-semibold shadow-lg shadow-[#d4af37]/20'
                      : 'bg-white/[0.03] hover:bg-white/[0.07] text-white/70 hover:text-white border border-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{mod.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          MODULE 1: SPATIAL FLOOR MATRIX (FLOORS L1–L6) + AMBIENT GLOW CARDS
      ===================================================================== */}
      {activeModule === 'matrix' && (
        <div className="space-y-6">
          {/* Floor Selector Pills & Status Filter */}
          <div className="glass-panel rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/50 mr-2">Floor Level:</span>
              <button
                onClick={() => setSelectedFloor('ALL')}
                className={`px-4 py-2 rounded-full text-xs font-medium transition ${
                  selectedFloor === 'ALL'
                    ? 'bg-white text-[#030305] font-semibold shadow'
                    : 'glass-pill text-white/70 hover:text-white'
                }`}
              >
                All Floors L1–L6 (48)
              </button>
              {[1, 2, 3, 4, 5, 6].map((fl) => (
                <button
                  key={fl}
                  onClick={() => setSelectedFloor(fl)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition ${
                    selectedFloor === fl
                      ? 'bg-[#d4af37] text-[#030305] font-semibold shadow'
                      : 'glass-pill text-white/70 hover:text-white'
                  }`}
                >
                  Floor L{fl} ({fl}01–{fl}08)
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'READY', label: 'Ready', dot: 'bg-[#00e676]' },
                  { id: 'OCCUPIED', label: 'Occupied', dot: 'bg-[#00f0ff]' },
                  { id: 'DIRTY', label: 'Turnover', dot: 'bg-[#ff1e7a]' },
                  { id: 'OOS', label: 'Out of Service', dot: 'bg-rose-500' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  onClick={() => setRoomStatusFilter(st.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition ${
                    roomStatusFilter === st.id
                      ? 'bg-white/15 border border-white/40 text-white font-medium'
                      : 'bg-white/[0.03] border border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {'dot' in st && <span className={`w-2 h-2 rounded-full ${st.dot}`} />}
                  <span>{st.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Spatial Grid of Glassmorphic Room Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {rooms
              .filter((r) => (selectedFloor === 'ALL' ? true : r.floor === selectedFloor))
              .filter((r) => {
                if (roomStatusFilter === 'READY') return isRoomReady(r);
                if (roomStatusFilter === 'OCCUPIED') return r.occupancyStatus === 'occupied';
                if (roomStatusFilter === 'DIRTY')
                  return r.housekeepingStatus !== 'clean' || r.inspectionStatus !== 'passed';
                if (roomStatusFilter === 'OOS') return r.maintenanceStatus === 'out_of_service';
                return true;
              })
              .map((rm) => {
                const ready = isRoomReady(rm);
                const isOos = rm.maintenanceStatus === 'out_of_service';
                const isTurnover =
                  rm.housekeepingStatus !== 'clean' || rm.inspectionStatus !== 'passed';

                let glowStyle =
                  'border-[#00e676]/35 shadow-[0_8px_30px_rgba(0,230,118,0.08)] hover:border-[#00e676]';
                let badgeStyle = 'bg-[#00e676]/15 text-[#00e676] border-[#00e676]/30';
                let statusLabel = 'Certified Ready';

                if (isOos) {
                  glowStyle =
                    'border-[#ff1e7a]/50 shadow-[0_8px_30px_rgba(255,30,122,0.14)] hover:border-[#ff1e7a]';
                  badgeStyle = 'bg-[#ff1e7a]/20 text-[#ff1e7a] border-[#ff1e7a]/40';
                  statusLabel = 'Out of Service';
                } else if (rm.occupancyStatus === 'occupied') {
                  if (rm.isVip) {
                    glowStyle =
                      'border-[#d4af37]/45 shadow-[0_8px_30px_rgba(212,175,55,0.12)] hover:border-[#d4af37]';
                    badgeStyle = 'bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/40';
                    statusLabel = 'VIP Occupied';
                  } else {
                    glowStyle =
                      'border-[#00f0ff]/35 shadow-[0_8px_30px_rgba(0,240,255,0.08)] hover:border-[#00f0ff]';
                    badgeStyle = 'bg-[#00f0ff]/15 text-[#00f0ff] border-[#00f0ff]/30';
                    statusLabel = 'Occupied';
                  }
                } else if (isTurnover) {
                  glowStyle =
                    'border-[#ff1e7a]/40 shadow-[0_8px_30px_rgba(255,30,122,0.1)] hover:border-[#ff1e7a]';
                  badgeStyle = 'bg-[#ff1e7a]/15 text-[#ff85b3] border-[#ff1e7a]/30';
                  statusLabel =
                    rm.inspectionStatus === 'awaiting_inspection'
                      ? 'Awaiting Inspect'
                      : 'Urgent Turnover';
                }

                return (
                  <div
                    key={rm.roomNumber}
                    onClick={() => setInspectedRoomNumber(rm.roomNumber)}
                    className={`group cursor-pointer rounded-3xl glass-panel p-5 border transition-all duration-300 hover:-translate-y-0.5 ${glowStyle}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-white/45">
                          Floor L{rm.floor} • {rm.roomType}
                        </div>
                        <div className="font-serif text-3xl text-white font-normal mt-0.5 tabular-nums">
                          Suite {rm.roomNumber}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full border text-[10px] font-medium ${badgeStyle}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                      <div className="truncate max-w-[160px] text-white/75">
                        {rm.currentGuestName ? (
                          <span className="font-medium text-white">{rm.currentGuestName}</span>
                        ) : (
                          <span className="text-white/40">Vacant Sanctuary</span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-white/55 tabular-nums">
                        {rm.hvacTempC.toFixed(1)}°C
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODULE 2: RECEPTION CHECK-IN / CHECK-OUT
      ===================================================================== */}
      {activeModule === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left 7 Cols: Check-In Form */}
          <div className="lg:col-span-7 glass-panel rounded-3xl p-7 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="text-xs text-[#00e676] uppercase tracking-wider">
                  Strict Ready-Room Gate
                </div>
                <h3 className="font-serif text-3xl text-white mt-0.5">
                  Guest Arrival & Check-In
                </h3>
              </div>
              <span className="px-4 py-1.5 rounded-full bg-[#00e676]/15 border border-[#00e676]/40 text-[#00e676] font-mono text-xs font-semibold tabular-nums">
                {t.readyRoomsLabel}: {readyRooms.length}
              </span>
            </div>

            {readyRooms.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#ff1e7a]/15 border border-[#ff1e7a]/40 text-[#ff85b3] text-sm">
                {t.noRoomsReady}
              </div>
            ) : (
              <form onSubmit={handleCheckInSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-white/60 mb-1.5">
                    Select Certified Ready Suite
                  </label>
                  <select
                    value={effectiveSelectedReadyRoom}
                    onChange={(e) => setSelectedReadyRoom(e.target.value)}
                    className="w-full rounded-2xl bg-white/[0.05] border border-[#00e676]/50 px-4 py-3 text-sm text-white outline-none"
                  >
                    {readyRooms.map((r) => (
                      <option key={r.roomNumber} value={r.roomNumber} className="bg-[#08080c]">
                        Suite {r.roomNumber} (Floor L{r.floor} — {r.roomType}) —{' '}
                        {r.baseRateIqd.toLocaleString()} IQD
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 mb-1">Main Guest Full Name *</label>
                    <input
                      type="text"
                      required
                      value={ciName}
                      onChange={(e) => setCiName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2.5 text-white outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Passport / National ID *</label>
                    <input
                      type="text"
                      required
                      value={ciIdNumber}
                      onChange={(e) => setCiIdNumber(e.target.value)}
                      placeholder="IRQ-ID-..."
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2.5 text-white outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Contact / WhatsApp</label>
                    <input
                      type="text"
                      value={ciContact}
                      onChange={(e) => setCiContact(e.target.value)}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2.5 text-white outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Vehicle Plate</label>
                    <input
                      type="text"
                      value={ciCarNumber}
                      onChange={(e) => setCiCarNumber(e.target.value)}
                      placeholder="EBL / SLM"
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2.5 text-white outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                {/* Extra Guests */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/70">
                      Total Guests in Suite:{' '}
                      <strong className="text-[#d4af37] font-mono">
                        {1 + ciExtraGuests.length}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCiExtraGuests((prev) => [
                          ...prev,
                          { id: `eg-${Date.now()}-${prev.length}`, fullName: '', idNumber: '' },
                        ])
                      }
                      className="px-3.5 py-1.5 rounded-full glass-pill text-[#d4af37] flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Companion
                    </button>
                  </div>
                  {ciExtraGuests.map((eg, i) => (
                    <div key={eg.id} className="grid grid-cols-12 gap-2">
                      <input
                        type="text"
                        required
                        placeholder={`Companion #${i + 2} Full Name *`}
                        value={eg.fullName}
                        onChange={(e) =>
                          setCiExtraGuests((prev) =>
                            prev.map((item) =>
                              item.id === eg.id ? { ...item, fullName: e.target.value } : item
                            )
                          )
                        }
                        className="col-span-5 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder={`ID Number *`}
                        value={eg.idNumber}
                        onChange={(e) =>
                          setCiExtraGuests((prev) =>
                            prev.map((item) =>
                              item.id === eg.id ? { ...item, idNumber: e.target.value } : item
                            )
                          )
                        }
                        className="col-span-5 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCiExtraGuests((prev) => prev.filter((item) => item.id !== eg.id))
                        }
                        className="col-span-2 rounded-xl bg-[#ff1e7a]/20 text-[#ff1e7a] flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Tariff Summary */}
                <div className="grid grid-cols-3 gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div>
                    <label className="block text-white/50 mb-1">Guest Pays %</label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={ciDiscountPct}
                      onChange={(e) => setCiDiscountPct(Number(e.target.value) || 100)}
                      className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 font-mono text-[#d4af37]"
                    />
                  </div>
                  <div>
                    <label className="block text-white/50 mb-1">Channel</label>
                    <select
                      value={ciChannel}
                      onChange={(e) => setCiChannel(e.target.value as BookingChannel)}
                      className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                    >
                      <option value="Walk_In_VIP" className="bg-[#08080c]">Walk_In_VIP</option>
                      <option value="Direct_Web" className="bg-[#08080c]">Direct_Web</option>
                      <option value="Booking_OTA" className="bg-[#08080c]">Booking_OTA</option>
                      <option value="Embassy_Corp" className="bg-[#08080c]">Embassy_Corp</option>
                      <option value="Airport_Transfer" className="bg-[#08080c]">Airport_Transfer</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-center text-right font-mono">
                    <div className="text-[11px] text-white/45">
                      Full: {fullCheckinPrice.toLocaleString()} IQD
                    </div>
                    <div className="text-sm font-semibold text-[#00e676] tabular-nums">
                      Pays: {finalCheckinPay.toLocaleString()} IQD
                    </div>
                  </div>
                </div>

                {ciMessage && (
                  <div
                    className={`p-4 rounded-2xl border ${
                      ciMessage.ok
                        ? 'bg-[#00e676]/15 border-[#00e676]/40 text-[#69f0ae]'
                        : 'bg-[#ff1e7a]/15 border-[#ff1e7a]/40 text-[#ff85b3]'
                    }`}
                  >
                    {ciMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00e676] to-[#00b85c] text-[#030305] font-semibold uppercase tracking-[0.16em] shadow-lg transition"
                >
                  Complete Check-In • Suite {effectiveSelectedReadyRoom}
                </button>
              </form>
            )}
          </div>

          {/* Right 5 Cols: Active In-House Check-Out List */}
          <div className="lg:col-span-5 glass-panel rounded-3xl p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="font-serif text-2xl text-white">{t.inHouseCheckout}</h3>
              <span className="font-mono text-xs text-[#00f0ff] tabular-nums">
                {occupiedRooms.length} Active
              </span>
            </div>

            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
              {occupiedRooms.map((rm) => (
                <div
                  key={rm.roomNumber}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-[#00f0ff]">
                        Suite {rm.roomNumber}
                      </span>
                      <span className="text-sm text-white font-medium">
                        {rm.currentGuestName}
                      </span>
                    </div>
                    {canSeePrivateGuestDetails && (
                      <div className="text-[11px] text-white/45 font-mono mt-1">
                        ID: {rm.currentGuestIdNumber} • Guests: {1 + rm.extraGuests.length} •{' '}
                        {rm.discountPayPercent}% Tariff
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => checkOutRoom(rm.roomNumber)}
                    className="px-4 py-2 rounded-xl bg-[#ff9e2c]/20 hover:bg-[#ff9e2c] text-[#ff9e2c] hover:text-[#030305] border border-[#ff9e2c]/40 text-xs font-semibold transition shrink-0"
                  >
                    Check Out
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODULE 3 & 4: HOUSEKEEPING & SUPERVISOR INSPECTIONS
      ===================================================================== */}
      {(activeModule === 'housekeeping' || activeModule === 'inspections') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Housekeeping Queue */}
          <div className="glass-panel rounded-3xl p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="font-serif text-2xl text-white">Housekeeping Turnover Queue</h3>
              <span className="px-3 py-1 rounded-full bg-[#ff9e2c]/15 text-[#ff9e2c] font-mono text-xs">
                {rooms.filter((r) => r.housekeepingStatus !== 'clean').length} Rooms
              </span>
            </div>
            <div className="space-y-3">
              {rooms
                .filter((r) => r.housekeepingStatus !== 'clean' || r.inspectionStatus === 'failed')
                .map((rm) => (
                  <div
                    key={rm.roomNumber}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-[#ff9e2c]/30 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-serif text-2xl text-white">Suite {rm.roomNumber}</div>
                      <div className="text-xs text-white/55">
                        Floor L{rm.floor} • {rm.roomType} • Status: {rm.housekeepingStatus}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {rm.housekeepingStatus === 'dirty' && (
                        <button
                          onClick={() => markCleaningStarted(rm.roomNumber)}
                          className="px-4 py-2 rounded-xl bg-[#00f0ff]/20 border border-[#00f0ff] text-[#00f0ff] text-xs font-semibold"
                        >
                          Start Clean
                        </button>
                      )}
                      <button
                        onClick={() => markCleaningFinishedAwaitingInspection(rm.roomNumber)}
                        className="px-4 py-2 rounded-xl bg-[#00e676] text-[#030305] text-xs font-semibold"
                      >
                        Mark Cleaned
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Supervisor Inspection Queue */}
          <div className="glass-panel rounded-3xl p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="font-serif text-2xl text-white">Supervisor Purity Certification</h3>
              <span className="px-3 py-1 rounded-full bg-[#d4af37]/15 text-[#d4af37] font-mono text-xs">
                {rooms.filter((r) => r.inspectionStatus === 'awaiting_inspection').length} Awaiting
              </span>
            </div>
            <div className="space-y-3">
              {rooms
                .filter((r) => r.inspectionStatus === 'awaiting_inspection')
                .map((rm) => (
                  <div
                    key={rm.roomNumber}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-[#d4af37]/30 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-serif text-2xl text-white">Suite {rm.roomNumber}</div>
                      <div className="text-xs text-white/55">
                        Housekeeping: {rm.housekeepingStatus} • Ready upon Pass
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => inspectRoomVerdict(rm.roomNumber, 'passed')}
                        className="px-4 py-2 rounded-xl bg-[#00e676] text-[#030305] text-xs font-semibold"
                      >
                        ✓ Pass Ready
                      </button>
                      <button
                        onClick={() => inspectRoomVerdict(rm.roomNumber, 'failed')}
                        className="px-4 py-2 rounded-xl bg-[#ff1e7a]/20 border border-[#ff1e7a] text-[#ff1e7a] text-xs font-semibold"
                      >
                        ✕ Fail
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODULE 5: MAINTENANCE & ENGINEERING
      ===================================================================== */}
      {activeModule === 'maintenance' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-7 space-y-5">
            <h3 className="font-serif text-2xl text-white">
              Quick-Tap Engineering & Maintenance Dispatch
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {rooms.map((r) => (
                <button
                  key={r.roomNumber}
                  onClick={() => setDmgRoom(r.roomNumber)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs transition ${
                    dmgRoom === r.roomNumber
                      ? 'bg-[#d4af37] text-[#030305] font-semibold'
                      : 'bg-white/[0.04] text-white/60 hover:text-white'
                  }`}
                >
                  {r.roomNumber}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
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
                  onClick={() => setDmgProblem(pt)}
                  className={`p-3 rounded-2xl border font-medium transition ${
                    dmgProblem === pt
                      ? 'bg-[#00f0ff]/20 border-[#00f0ff] text-white'
                      : 'bg-white/[0.03] border-white/10 text-white/65'
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-2 text-xs">
                {(
                  [
                    { id: 'low', label: 'Low' },
                    { id: 'medium', label: 'Medium' },
                    { id: 'high', label: 'High' },
                    { id: 'critical_oos', label: 'Critical (Out of Service)' },
                  ] as const
                ).map((pr) => (
                  <button
                    key={pr.id}
                    onClick={() => setDmgPriority(pr.id)}
                    className={`px-4 py-2 rounded-xl border ${
                      dmgPriority === pr.id
                        ? 'bg-[#ff1e7a] border-[#ff1e7a] text-white font-semibold'
                        : 'bg-white/[0.03] border-white/10 text-white/60'
                    }`}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  reportDamageTicket({
                    roomNumber: dmgRoom,
                    problemType: dmgProblem,
                    priority: dmgPriority,
                    note: dmgNote,
                    reportedBy: user?.fullName || 'Staff',
                  });
                  setMaintNotice(`Ticket logged for Suite ${dmgRoom}`);
                }}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#ff1e7a] to-rose-600 text-white text-xs font-semibold uppercase tracking-wider shadow-lg"
              >
                Dispatch Ticket • Suite {dmgRoom}
              </button>
            </div>
          </div>

          {maintNotice && (
            <div className="p-4 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37] text-xs">
              {maintNotice}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {maintenanceTickets.map((tkt) => (
              <div key={tkt.id} className="glass-panel rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-2xl text-white">
                    Suite {tkt.roomNumber} • {tkt.problemType}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#ff1e7a]/20 text-[#ff85b3] font-mono text-xs">
                    {tkt.status}
                  </span>
                </div>
                <p className="text-xs text-white/60">{tkt.note}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <button
                    onClick={() => {
                      const r = updateMaintenanceTicketStatus(tkt.id, 'working_on_it', role);
                      setMaintNotice(r.message);
                    }}
                    className="py-2 rounded-xl bg-blue-500/20 border border-blue-400 text-blue-200 font-medium"
                  >
                    Working on it
                  </button>
                  <button
                    onClick={() => {
                      const r = updateMaintenanceTicketStatus(tkt.id, 'fixed_awaiting_check', role);
                      setMaintNotice(r.message);
                    }}
                    className="py-2 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-200 font-medium"
                  >
                    Fixed
                  </button>
                  <button
                    onClick={() => {
                      const r = updateMaintenanceTicketStatus(tkt.id, 'out_of_service', role);
                      setMaintNotice(r.message);
                    }}
                    className="py-2 rounded-xl bg-rose-500/20 border border-rose-400 text-rose-200 font-medium"
                  >
                    Out of Service
                  </button>
                  <button
                    onClick={() => {
                      const r = updateMaintenanceTicketStatus(tkt.id, 'needs_parts', role);
                      setMaintNotice(r.message);
                    }}
                    className="py-2 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-200 font-medium"
                  >
                    Needs Parts
                  </button>
                </div>
                {(role === 'executive' || role === 'front_desk') && (
                  <button
                    onClick={() => {
                      const r = updateMaintenanceTicketStatus(tkt.id, 'checked_ok', role);
                      setMaintNotice(r.message);
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#00e676] text-[#030305] text-xs font-semibold"
                  >
                    Supervisor Checked — OK (Close & Release Room)
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODULE 6, 7, 8: STAYS, DAILY AUDIT & SETTINGS
      ===================================================================== */}
      {activeModule === 'stays' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {roomServiceOrders.map((ord) => (
            <div key={ord.id} className="glass-panel rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif text-2xl text-[#d4af37]">Suite {ord.roomNumber}</span>
                <span className="px-3 py-1 rounded-full bg-[#00f0ff]/15 text-[#00f0ff] font-mono text-xs uppercase">
                  {ord.status}
                </span>
              </div>
              <div className="text-sm text-white">{ord.guestName}</div>
              <div className="font-mono text-sm text-[#00e676] tabular-nums">
                {ord.totalIqd.toLocaleString()} IQD (${ord.totalUsd})
              </div>
              <button
                onClick={() => advanceRoomServiceStatus(ord.id)}
                className="w-full py-2.5 rounded-xl bg-white/[0.08] hover:bg-[#d4af37] text-white hover:text-[#030305] text-xs font-semibold transition"
              >
                Advance Culinary Stage →
              </button>
            </div>
          ))}
        </div>
      )}

      {activeModule === 'reports' && (
        <div className="glass-panel rounded-3xl p-7 space-y-5">
          <h3 className="font-serif text-3xl text-white">
            Official Daily Operational & Treasury Audit
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {occupiedRooms.map((r) => (
              <div
                key={r.roomNumber}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-semibold text-[#00f0ff]">
                    Suite {r.roomNumber}:
                  </span>{' '}
                  <span className="text-white">{r.currentGuestName}</span>
                  {canSeePrivateGuestDetails && r.extraGuests.length > 0 && (
                    <span className="text-[#d4af37] ml-2">
                      (+{r.extraGuests.length} Companions)
                    </span>
                  )}
                </div>
                {canSeePrivateGuestDetails && (
                  <span className="font-mono text-white/50">{r.currentGuestIdNumber}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeModule === 'settings' && (
        <div className="glass-panel rounded-3xl p-7 space-y-6">
          <h3 className="font-serif text-3xl text-white">
            Tariff Configuration & Encrypted Backup Vault
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1.5">
                Standard Owner Tariff (IQD)
              </label>
              <input
                type="number"
                value={ownerBasePriceIqd}
                onChange={(e) => setOwnerBasePriceIqd(Number(e.target.value) || 100000)}
                className="rounded-xl bg-white/[0.05] border border-[#d4af37]/50 px-4 py-2.5 font-mono text-sm text-[#d4af37]"
              />
            </div>
            <button
              onClick={handleDownloadBackup}
              className="px-5 py-2.5 rounded-xl bg-[#00e676] text-[#030305] text-xs font-semibold flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export JSON Backup
            </button>
            <label className="px-5 py-2.5 rounded-xl bg-[#00f0ff] text-[#030305] text-xs font-semibold flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> Restore Backup
              <input type="file" accept=".json" onChange={handleUploadBackup} className="hidden" />
            </label>
          </div>
          {settingsMsg && (
            <div className="p-4 rounded-2xl bg-[#00e676]/15 border border-[#00e676]/40 text-[#69f0ae] text-xs">
              {settingsMsg}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SLIDE-OVER ROOM INSPECTOR DRAWER
      ===================================================================== */}
      {inspectedRoom && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-md">
          <div className="w-full max-w-md h-full glass-panel border-l border-white/15 p-7 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#d4af37]">
                    {inspectedRoom.floorZone}
                  </div>
                  <h3 className="font-serif text-3xl text-white mt-0.5">
                    Suite {inspectedRoom.roomNumber} Inspector
                  </h3>
                </div>
                <button
                  onClick={() => setInspectedRoomNumber(null)}
                  className="w-9 h-9 rounded-full glass-pill flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Pills */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="text-white/45">Occupancy</div>
                  <div className="text-white font-semibold uppercase mt-1">
                    {inspectedRoom.occupancyStatus}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="text-white/45">Housekeeping</div>
                  <div className="text-[#ff9e2c] font-semibold uppercase mt-1">
                    {inspectedRoom.housekeepingStatus}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="text-white/45">Supervisor Check</div>
                  <div className="text-[#00e676] font-semibold uppercase mt-1">
                    {inspectedRoom.inspectionStatus}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div className="text-white/45">Engineering</div>
                  <div className="text-[#00f0ff] font-semibold uppercase mt-1">
                    {inspectedRoom.maintenanceStatus}
                  </div>
                </div>
              </div>

              {/* Guest Folio Details */}
              {inspectedRoom.occupancyStatus === 'occupied' && (
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2 text-xs">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#00f0ff]">
                    Active Resident Folio
                  </div>
                  <div className="text-base font-medium text-white">
                    {inspectedRoom.currentGuestName}
                  </div>
                  {canSeePrivateGuestDetails && (
                    <div className="text-white/60 space-y-1 font-mono text-[11px]">
                      <div>Passport / ID: {inspectedRoom.currentGuestIdNumber}</div>
                      <div>Phone: {inspectedRoom.currentGuestContact}</div>
                      <div>Vehicle: {inspectedRoom.currentGuestCarNumber || 'None'}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Climate Setpoint */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-white/70">
                    <Thermometer className="w-4 h-4 text-[#00f0ff]" />
                    HVAC Climate Control
                  </span>
                  <span className="font-mono text-sm font-semibold text-[#00f0ff] tabular-nums">
                    {inspectedRoom.hvacTempC.toFixed(1)} °C
                  </span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={26}
                  step={0.5}
                  value={inspectedRoom.hvacTempC}
                  onChange={(e) =>
                    setRoomHvacTemp(inspectedRoom.roomNumber, Number(e.target.value))
                  }
                  className="w-full accent-[#00f0ff]"
                />
              </div>

              {/* Room Tier Selector (Executive) */}
              {role === 'executive' && (
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">
                    Reconfigure Suite Tier
                  </label>
                  <select
                    value={inspectedRoom.roomType}
                    onChange={(e) =>
                      setRoomType(inspectedRoom.roomNumber, e.target.value as RoomType)
                    }
                    className="w-full rounded-xl bg-white/[0.05] border border-white/15 px-3.5 py-2.5 text-xs text-white"
                  >
                    <option value="Single" className="bg-[#08080c]">Single</option>
                    <option value="Twin" className="bg-[#08080c]">Twin</option>
                    <option value="Executive Suite" className="bg-[#08080c]">Executive Suite</option>
                    <option value="Diplomatic Suite" className="bg-[#08080c]">Diplomatic Suite</option>
                    <option value="Royal Penthouse" className="bg-[#08080c]">Royal Penthouse</option>
                  </select>
                </div>
              )}
            </div>

            {/* 1-Click Status Transitions */}
            <div className="space-y-2.5 pt-4 border-t border-white/10">
              {inspectedRoom.occupancyStatus === 'occupied' && (
                <button
                  onClick={() => checkOutRoom(inspectedRoom.roomNumber)}
                  className="w-full py-3 rounded-2xl bg-[#ff9e2c] text-[#030305] text-xs font-semibold uppercase tracking-wider"
                >
                  Check Out Resident → Flag Turnover
                </button>
              )}
              {inspectedRoom.housekeepingStatus !== 'clean' && (
                <button
                  onClick={() =>
                    markCleaningFinishedAwaitingInspection(inspectedRoom.roomNumber)
                  }
                  className="w-full py-3 rounded-2xl bg-[#00f0ff] text-[#030305] text-xs font-semibold uppercase tracking-wider"
                >
                  Complete Cleaning → Queue Inspection
                </button>
              )}
              {inspectedRoom.inspectionStatus !== 'passed' && (
                <button
                  onClick={() => inspectRoomVerdict(inspectedRoom.roomNumber, 'passed')}
                  className="w-full py-3 rounded-2xl bg-[#00e676] text-[#030305] text-xs font-semibold uppercase tracking-wider"
                >
                  Supervisor Pass → Certify Ready
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
