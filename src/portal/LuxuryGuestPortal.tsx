import React, { useState, useMemo } from 'react';
import {
  Key,
  Sparkles,
  UtensilsCrossed,
  ShieldCheck,
  MapPin,
  Phone,
  Thermometer,
  Wifi,
  CheckCircle2,
  Plus,
  Trash2,
  Building2,
  CreditCard,
  Clock,
  Lock,
} from 'lucide-react';
import {
  useHotelOpsStore,
  isRoomReady,
  ExtraGuest,
  EXCHANGE_RATE_IQD,
} from '../store/useHotelOpsStore';
import { useAuthStore } from '../store/useAuthStore';

const CULINARY_MENU = [
  {
    id: 'm1',
    name: 'Royal Mesopotamian Lamb Quzi & Saffron Rice',
    category: 'Signature Mains',
    priceIqd: 45000,
    desc: 'Slow-braised tender lamb shoulder, toasted almonds, raisins, aromatic Erbil saffron rice.',
  },
  {
    id: 'm2',
    name: 'Tigris Fire-Roasted Masgouf Fillet',
    category: 'Signature Mains',
    priceIqd: 52000,
    desc: 'Traditional oak-smoked carp fillet glazed with tamarind, turmeric, and charred tomato chutney.',
  },
  {
    id: 'm3',
    name: 'Levantine Mezze & Stone-Baked Samoon Platter',
    category: 'Artisanal Starters',
    priceIqd: 34000,
    desc: 'Smoked mutabbal, silky hummus bi-tahini, stuffed vine leaves, pomegranate molasses.',
  },
  {
    id: 'm4',
    name: 'Citadel Cardamom Qahwa & Pistachio Baklava',
    category: 'Dessert & Ritual',
    priceIqd: 28000,
    desc: 'Freshly brewed brass-pot Arabic coffee with layered Gaziantep pistachio pastry.',
  },
  {
    id: 'm5',
    name: 'Chilled Pomegranate & Rosewater Elixir',
    category: 'Beverages',
    priceIqd: 14000,
    desc: 'Pressed Halabja pomegranates infused with organic Damascus rose distillate.',
  },
];

export const LuxuryGuestPortal: React.FC<{ onSwitchToOps?: () => void }> = ({ onSwitchToOps }) => {
  const { user, openAuthModal } = useAuthStore();
  const {
    rooms,
    reservations,
    roomServiceOrders,
    checkInGuest,
    placeRoomServiceOrder,
    setRoomHvacTemp,
  } = useHotelOpsStore();

  // Only show READY rooms in booking selector
  const readyRooms = useMemo(() => rooms.filter(isRoomReady), [rooms]);

  const [selectedFloorFilter, setSelectedFloorFilter] = useState<number | 'ALL'>('ALL');
  const [selectedRoomNum, setSelectedRoomNum] = useState<string>(
    readyRooms[0]?.roomNumber || '101'
  );
  const [guestName, setGuestName] = useState(user?.fullName || 'Envoy Henri Laurent');
  const [guestContact, setGuestContact] = useState(user?.phone || '+964 750 816 9999');
  const [guestIdNumber, setGuestIdNumber] = useState('IRQ-PASS-889120');
  const [guestCarNumber, setGuestCarNumber] = useState('EBL 7701');
  const [nights, setNights] = useState(2);
  const [discountPayPercent, setDiscountPayPercent] = useState(100);
  const [extraGuests, setExtraGuests] = useState<ExtraGuest[]>([]);
  const [bookingFeedback, setBookingFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  // Active guest stay for Digital Keycard & In-Room Dining
  const activeStay = useMemo(() => {
    const matchByUser = reservations.find(
      (r) =>
        r.status === 'checked_in' &&
        user &&
        r.guestName.toLowerCase().includes(user.fullName.split(' ')[0].toLowerCase())
    );
    return matchByUser || reservations.find((r) => r.status === 'checked_in') || null;
  }, [reservations, user]);

  const activeStayRoom = useMemo(
    () => rooms.find((r) => r.roomNumber === (activeStay?.roomNumber || '501')) || rooms[0],
    [rooms, activeStay]
  );

  // Culinary Cart
  const [cart, setCart] = useState<Record<string, number>>({ m1: 1, m4: 1 });
  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  const filteredReadyRooms = useMemo(
    () =>
      readyRooms.filter((r) =>
        selectedFloorFilter === 'ALL' ? true : r.floor === selectedFloorFilter
      ),
    [readyRooms, selectedFloorFilter]
  );

  const currentChosenRoom = useMemo(
    () =>
      readyRooms.find((r) => r.roomNumber === selectedRoomNum) ||
      filteredReadyRooms[0] ||
      null,
    [readyRooms, filteredReadyRooms, selectedRoomNum]
  );

  const addExtraGuestRow = () => {
    setExtraGuests((prev) => [
      ...prev,
      { id: `eg-${Date.now()}-${prev.length}`, fullName: '', idNumber: '' },
    ]);
  };

  const updateExtraGuest = (id: string, field: 'fullName' | 'idNumber', val: string) => {
    setExtraGuests((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const removeExtraGuest = (id: string) => {
    setExtraGuests((prev) => prev.filter((item) => item.id !== id));
  };

  const handleInstantBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingFeedback(null);
    if (!currentChosenRoom) {
      setBookingFeedback({
        type: 'error',
        msg: 'No rooms are currently Ready for immediate check-in.',
      });
      return;
    }

    const res = checkInGuest({
      roomNumber: currentChosenRoom.roomNumber,
      guestName,
      guestContact,
      guestIdNumber,
      guestCarNumber,
      extraGuests,
      discountPayPercent,
      nights,
      channel: 'Direct_Web',
    });

    if (!res.ok) {
      setBookingFeedback({ type: 'error', msg: res.error || 'Booking failed.' });
    } else {
      setBookingFeedback({
        type: 'success',
        msg: `Suite ${currentChosenRoom.roomNumber} Reserved & Checked In! Ref: ${res.bookingRef}. Digital Keycard Provisioned.`,
      });
      setExtraGuests([]);
    }
  };

  const handleOrderDining = () => {
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const found = CULINARY_MENU.find((m) => m.id === id)!;
        return { name: found.name, priceIqd: found.priceIqd, qty };
      });

    if (items.length === 0) return;

    placeRoomServiceOrder({
      roomNumber: activeStayRoom.roomNumber,
      guestName: activeStayRoom.currentGuestName || user?.fullName || 'VIP Suite Guest',
      items,
    });

    setOrderNotice(
      `Culinary order dispatched to Suite ${activeStayRoom.roomNumber}. Live telemetry updated.`
    );
    setTimeout(() => setOrderNotice(null), 5000);
  };

  const fullBookingPriceIqd = (currentChosenRoom?.baseRateIqd || 100000) * Math.max(1, nights);
  const finalBookingPayIqd = Math.round((fullBookingPriceIqd * discountPayPercent) / 100);
  const finalBookingPayUsd = (finalBookingPayIqd / EXCHANGE_RATE_IQD).toFixed(2);

  return (
    <div className="min-h-screen bg-[#030305] text-[#f4f0ea] font-sans">
      {/* HERO ARCHITECTURAL SHOWCASE */}
      <section className="relative h-[78vh] min-h-[560px] w-full overflow-hidden border-b border-[#1c1c24]">
        <img
          src="/assets/originals/lobby-wide.jpeg"
          alt="Erbil Hotel Grand Lobby"
          className="absolute inset-0 w-full h-full object-cover object-center scale-105 transition-transform duration-1000 filter brightness-[0.42] contrast-[1.08]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#030305] via-[#030305]/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#030305]/90 via-transparent to-[#030305]/75" />

        <div className="relative z-10 max-w-7xl mx-auto h-full px-6 flex flex-col justify-between py-12">
          {/* Top Brand Tag */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src="/assets/logo/erbil-hotel-logo.jpeg"
                alt="Erbil Hotel Official Emblem"
                className="w-14 h-14 object-cover border border-[#d4af37]"
              />
              <div>
                <div className="font-mono text-[10px] tracking-[0.28em] text-[#d4af37] uppercase">
                  SALEM STREET // SULAYMANIYAH & ERBIL CITADEL HERITAGE
                </div>
                <h1 className="font-serif text-3xl md:text-4xl tracking-wide text-[#f4f0ea] font-semibold">
                  ERBIL HOTEL
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="px-3 py-1.5 bg-[#0a0a0e]/90 border border-[#24242e] text-[#d4af37]">
                READY SUITES NOW: <span className="font-bold">{readyRooms.length}</span> / {rooms.length}
              </div>
              {onSwitchToOps && (
                <button
                  onClick={onSwitchToOps}
                  className="px-4 py-1.5 bg-[#12121a] hover:bg-[#1b1b26] border border-[#d4af37]/50 text-[#f4f0ea] uppercase tracking-wider transition"
                >
                  Staff Operations Grid →
                </button>
              )}
            </div>
          </div>

          {/* Center Hero Statement */}
          <div className="max-w-3xl space-y-5 my-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37] font-mono text-[11px] uppercase tracking-[0.2em]">
              <Sparkles className="w-3.5 h-3.5" />
              MESOPOTAMIAN ARCHITECTURAL SANCTUARY
            </div>
            <h2 className="font-serif text-4xl sm:text-6xl font-normal leading-[1.08] tracking-tight text-[#f4f0ea]">
              Smoked Basalt Elegance.{' '}
              <span className="italic text-[#d4af37]">Sovereign Hospitality.</span>
            </h2>
            <p className="text-sm sm:text-base text-[#c2beb6] max-w-2xl leading-relaxed font-light">
              Experience timeless Kurdish and Levantine refinement on Salem Street, next to City Star.
              Every suite is governed by real-time environmental telemetry, cryptographic keycard access,
              and certified multi-stage inspection protocols.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="#reserve-suite"
                className="px-7 py-3.5 bg-[#d4af37] hover:bg-[#e5c247] text-[#030305] font-mono text-xs font-bold uppercase tracking-[0.2em] transition"
              >
                Reserve Ready Suite
              </a>
              <a
                href="#digital-keycard"
                className="px-6 py-3.5 bg-[#0a0a0e]/85 hover:bg-[#14141c] border border-[#2c2c38] text-[#f4f0ea] font-mono text-xs uppercase tracking-[0.18em] transition"
              >
                Digital Keycard & Dining
              </a>
              {!user && (
                <button
                  onClick={() => openAuthModal('signup')}
                  className="px-5 py-3.5 border border-[#d4af37]/50 text-[#d4af37] font-mono text-xs uppercase tracking-[0.16em] hover:bg-[#d4af37]/10 transition"
                >
                  Create VIP Account
                </button>
              )}
            </div>
          </div>

          {/* Bottom Architectural Specs Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-[#ffffff]/10 font-mono text-xs">
            <div>
              <div className="text-[10px] text-[#888895] uppercase">COORDINATES</div>
              <div className="text-[#f4f0ea] mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                35.5581° N, 45.4269° E
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#888895] uppercase">STANDARD OWNER TARIFF</div>
              <div className="text-[#d4af37] mt-0.5 font-semibold">
                100,000 IQD / $76.34 USD
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#888895] uppercase">DIRECT RECEPTION / WHATSAPP</div>
              <div className="text-[#f4f0ea] mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#00e676]" />
                +964 774 115 0101
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#888895] uppercase">CLEANLINESS CERTIFICATION</div>
              <div className="text-[#00e676] mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                DUAL SUPERVISOR VERIFIED
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REAL OWNER PHOTOGRAPHY GALLERY */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-b border-[#16161a]">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#d4af37]">
              AUTHENTIC ARCHITECTURAL PORTFOLIO
            </div>
            <h3 className="font-serif text-3xl sm:text-4xl text-[#f4f0ea] mt-1">
              Inside Erbil Hotel & General Twin Room Gallery
            </h3>
          </div>
          <p className="font-mono text-xs text-[#888895] max-w-md">
            Original owner-supplied photography of our exterior facade, soaring multi-story atrium,
            warm travertine reception lounge, and Twin Room example configurations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              src: '/assets/originals/exterior.jpeg',
              tag: 'ARCHITECTURAL FACADE',
              title: 'Erbil Hotel Exterior // Salem Street',
              sub: 'Located next to City Star, Sulaymaniyah',
            },
            {
              src: '/assets/originals/atrium.jpeg',
              tag: 'VERTICAL GEOMETRY',
              title: 'Central Multi-Floor Atrium',
              sub: 'Panoramic interior balconies across Floors L1–L6',
            },
            {
              src: '/assets/originals/lobby-seating.jpeg',
              tag: 'DIPLOMATIC LOUNGE',
              title: 'Grand Reception & Welcome Salon',
              sub: '24/7 Concierge & Cardamom Qahwa Hospitality',
            },
            {
              src: '/assets/originals/lobby-wide.jpeg',
              tag: 'TRAVERTINE HALL',
              title: 'Main Lobby Promenade',
              sub: 'Bespoke lighting and warm Mesopotamian stone',
            },
            {
              src: '/assets/originals/twin-room.jpeg',
              tag: 'TWIN ROOM — EXAMPLE PHOTO',
              title: 'Twin Room Configuration (Example I)',
              sub: 'General Twin Room example — 100,000 IQD Standard Rate',
            },
            {
              src: '/assets/originals/twin-room-window.jpeg',
              tag: 'TWIN ROOM — EXAMPLE PHOTO',
              title: 'Twin Room Daylight View (Example II)',
              sub: 'General Twin Room example — Acoustic glazing & climate control',
            },
          ].map((photo, i) => (
            <div
              key={i}
              className="group relative bg-[#0a0a0e] border border-[#1c1c24] overflow-hidden"
            >
              <div className="aspect-[16/10] overflow-hidden bg-[#050508]">
                <img
                  src={photo.src}
                  alt={photo.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="p-4 border-t border-[#16161a]">
                <div className="font-mono text-[9px] tracking-[0.2em] text-[#d4af37] uppercase">
                  {photo.tag}
                </div>
                <div className="font-serif text-lg text-[#f4f0ea] mt-0.5">{photo.title}</div>
                <div className="text-xs text-[#888895] mt-1">{photo.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* INTERACTIVE SUITE BOOKING + DIGITAL KEYCARD & IN-ROOM DINING */}
      <section
        id="reserve-suite"
        className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-12 gap-10"
      >
        {/* LEFT 7 COLS: LIVE READY-ROOM RESERVATION & INSTANT CHECK-IN */}
        <div className="lg:col-span-7 bg-[#0a0a0e] border border-[#1e1e26] p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#181820] pb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#00e676]">
                STRICT READY-ROOM FILTER ENFORCED
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl text-[#f4f0ea] mt-1">
                Instant Suite Reservation & Check-In
              </h3>
            </div>
            <div className="px-3 py-1.5 bg-[#00e676]/10 border border-[#00e676]/40 text-[#00e676] font-mono text-xs">
              Ready Rooms: {readyRooms.length}
            </div>
          </div>

          {/* Floor Selector */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#888895] mb-2">
              1. Filter Ready Inventory by Floor (L1–L6)
            </label>
            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setSelectedFloorFilter('ALL')}
                className={`px-3 py-1.5 border transition ${
                  selectedFloorFilter === 'ALL'
                    ? 'bg-[#d4af37] text-[#030305] border-[#d4af37] font-bold'
                    : 'bg-[#050508] text-[#888895] border-[#22222c] hover:text-[#f4f0ea]'
                }`}
              >
                ALL FLOORS ({readyRooms.length})
              </button>
              {[1, 2, 3, 4, 5, 6].map((fl) => {
                const count = readyRooms.filter((r) => r.floor === fl).length;
                return (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => setSelectedFloorFilter(fl)}
                    className={`px-3 py-1.5 border transition ${
                      selectedFloorFilter === fl
                        ? 'bg-[#d4af37] text-[#030305] border-[#d4af37] font-bold'
                        : 'bg-[#050508] text-[#888895] border-[#22222c] hover:text-[#f4f0ea]'
                    }`}
                  >
                    FL {fl} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ready Room Chooser Grid */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[#888895] mb-2">
              2. Choose Certified Ready Room (Vacant + Clean + Inspection Passed + In Service)
            </label>
            {filteredReadyRooms.length === 0 ? (
              <div className="p-6 bg-[#050508] border border-[#ff1e7a]/40 text-center font-mono text-xs text-[#ff1e7a]">
                No rooms ready for check-in on this floor filter.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                {filteredReadyRooms.map((rm) => {
                  const isSel = currentChosenRoom?.roomNumber === rm.roomNumber;
                  return (
                    <button
                      key={rm.roomNumber}
                      type="button"
                      onClick={() => setSelectedRoomNum(rm.roomNumber)}
                      className={`p-2.5 border text-left font-mono transition ${
                        isSel
                          ? 'bg-[#14141d] border-[#d4af37] text-[#f4f0ea]'
                          : 'bg-[#050508] border-[#1c1c24] text-[#9898a6] hover:border-[#343444]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#f4f0ea]">RM {rm.roomNumber}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-[#00e676]/15 text-[#00e676]">
                          READY
                        </span>
                      </div>
                      <div className="text-[10px] text-[#d4af37] truncate mt-1">{rm.roomType}</div>
                      <div className="text-[10px] text-[#787885] mt-0.5">
                        {rm.baseRateIqd.toLocaleString()} IQD
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guest Details Form */}
          <form onSubmit={handleInstantBooking} className="space-y-4 pt-2 border-t border-[#181820]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#888895] mb-1">
                  Main Guest Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full bg-[#050508] border border-[#24242e] focus:border-[#d4af37] px-3 py-2 text-xs font-mono text-[#f4f0ea] outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#888895] mb-1">
                  Passport / National ID Number *
                </label>
                <input
                  type="text"
                  required
                  value={guestIdNumber}
                  onChange={(e) => setGuestIdNumber(e.target.value)}
                  className="w-full bg-[#050508] border border-[#24242e] focus:border-[#d4af37] px-3 py-2 text-xs font-mono text-[#f4f0ea] outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#888895] mb-1">
                  Contact / WhatsApp Number
                </label>
                <input
                  type="text"
                  value={guestContact}
                  onChange={(e) => setGuestContact(e.target.value)}
                  className="w-full bg-[#050508] border border-[#24242e] focus:border-[#d4af37] px-3 py-2 text-xs font-mono text-[#f4f0ea] outline-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#888895] mb-1">
                  Vehicle Plate Number
                </label>
                <input
                  type="text"
                  value={guestCarNumber}
                  onChange={(e) => setGuestCarNumber(e.target.value)}
                  className="w-full bg-[#050508] border border-[#24242e] focus:border-[#d4af37] px-3 py-2 text-xs font-mono text-[#f4f0ea] outline-none"
                />
              </div>
            </div>

            {/* Extra Guests Section */}
            <div className="p-3.5 bg-[#06060a] border border-[#1c1c24] space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[11px] text-[#f4f0ea]">
                  TOTAL GUESTS IN SUITE:{' '}
                  <span className="text-[#d4af37] font-bold">{1 + extraGuests.length}</span> (Auto-Calculated)
                </div>
                <button
                  type="button"
                  onClick={addExtraGuestRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#14141e] hover:bg-[#1e1e2d] border border-[#d4af37]/50 text-[#d4af37] font-mono text-[10px] uppercase tracking-wider transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Another Guest
                </button>
              </div>

              {extraGuests.map((eg, index) => (
                <div key={eg.id} className="grid grid-cols-12 gap-2 items-center pt-1">
                  <div className="col-span-5">
                    <input
                      type="text"
                      required
                      placeholder={`Guest #${index + 2} Full Name *`}
                      value={eg.fullName}
                      onChange={(e) => updateExtraGuest(eg.id, 'fullName', e.target.value)}
                      className="w-full bg-[#030305] border border-[#262630] px-2.5 py-1.5 text-xs font-mono text-[#f4f0ea] outline-none"
                    />
                  </div>
                  <div className="col-span-5">
                    <input
                      type="text"
                      required
                      placeholder={`Guest #${index + 2} ID Number *`}
                      value={eg.idNumber}
                      onChange={(e) => updateExtraGuest(eg.id, 'idNumber', e.target.value)}
                      className="w-full bg-[#030305] border border-[#262630] px-2.5 py-1.5 text-xs font-mono text-[#f4f0ea] outline-none"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeExtraGuest(eg.id)}
                      className="p-1.5 text-[#ff1e7a] hover:bg-[#ff1e7a]/10 border border-[#ff1e7a]/30"
                      title="Remove Guest"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing & Owner Discount Rule */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[#050508] border border-[#1c1c24] font-mono">
              <div>
                <label className="block text-[10px] text-[#888895] uppercase">Nights</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={nights}
                  onChange={(e) => setNights(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full bg-[#0a0a0e] border border-[#262632] px-2.5 py-1.5 text-xs text-[#f4f0ea]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#888895] uppercase">
                  Guest Pays % (Tariff Rule)
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={discountPayPercent}
                  onChange={(e) =>
                    setDiscountPayPercent(Math.max(10, Math.min(100, Number(e.target.value) || 100)))
                  }
                  className="mt-1 w-full bg-[#0a0a0e] border border-[#262632] px-2.5 py-1.5 text-xs text-[#d4af37]"
                />
              </div>
              <div className="flex flex-col justify-center">
                <div className="text-[10px] text-[#888895]">
                  FULL: {fullBookingPriceIqd.toLocaleString()} IQD ({discountPayPercent}%)
                </div>
                <div className="text-sm font-bold text-[#00e676] mt-0.5">
                  FINAL: {finalBookingPayIqd.toLocaleString()} IQD
                </div>
                <div className="text-[10px] text-[#d4af37]">≈ ${finalBookingPayUsd} USD</div>
              </div>
            </div>

            {bookingFeedback && (
              <div
                className={`p-3 border font-mono text-xs ${
                  bookingFeedback.type === 'success'
                    ? 'bg-[#00e676]/10 border-[#00e676] text-[#00e676]'
                    : 'bg-[#ff1e7a]/10 border-[#ff1e7a] text-[#ff1e7a]'
                }`}
              >
                {bookingFeedback.msg}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-[#d4af37] hover:bg-[#e3be42] text-[#030305] font-mono text-xs font-bold uppercase tracking-[0.2em] transition"
            >
              COMPLETE CHECK-IN & ISSUE DIGITAL KEYCARD
            </button>
          </form>
        </div>

        {/* RIGHT 5 COLS: CRYPTOGRAPHIC DIGITAL KEYCARD + LIVE IN-ROOM DINING */}
        <div id="digital-keycard" className="lg:col-span-5 space-y-6">
          {/* DIGITAL KEYCARD WALLET */}
          <div className="bg-gradient-to-br from-[#0d0d14] via-[#08080c] to-[#040406] border border-[#d4af37]/50 p-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#22222c] pb-4">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-[#d4af37]" />
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#d4af37]">
                    NFC / BLE CRYPTOGRAPHIC KEYCARD
                  </div>
                  <div className="font-serif text-xl text-[#f4f0ea]">
                    Suite {activeStayRoom.roomNumber} // {activeStayRoom.roomType}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-[#00e676]/15 border border-[#00e676]/50 text-[#00e676] font-mono text-[10px]">
                ACTIVE KEY
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 my-5 font-mono text-xs">
              <div className="p-3 bg-[#050508] border border-[#181820]">
                <div className="text-[9px] text-[#787885] uppercase">REGISTERED RESIDENT</div>
                <div className="text-[#f4f0ea] font-semibold mt-1 truncate">
                  {activeStayRoom.currentGuestName || user?.fullName || 'Envoy Henri Laurent'}
                </div>
              </div>
              <div className="p-3 bg-[#050508] border border-[#181820]">
                <div className="text-[9px] text-[#787885] uppercase">FLOOR ZONE</div>
                <div className="text-[#d4af37] font-semibold mt-1">{activeStayRoom.floorZone}</div>
              </div>
            </div>

            {/* Interactive Suite Climate Control */}
            <div className="p-4 bg-[#050508] border border-[#1c1c24] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Thermometer className="w-4 h-4 text-[#00f0ff]" />
                <div>
                  <div className="font-mono text-[10px] uppercase text-[#888895]">
                    LIVE SUITE HVAC TELEMETRY
                  </div>
                  <div className="font-mono text-sm font-bold text-[#f4f0ea]">
                    {activeStayRoom.hvacTempC.toFixed(1)} °C
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setRoomHvacTemp(activeStayRoom.roomNumber, activeStayRoom.hvacTempC - 0.5)
                  }
                  className="px-2.5 py-1 bg-[#101018] hover:bg-[#1a1a28] border border-[#2a2a36]"
                >
                  -0.5°C
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRoomHvacTemp(activeStayRoom.roomNumber, activeStayRoom.hvacTempC + 0.5)
                  }
                  className="px-2.5 py-1 bg-[#101018] hover:bg-[#1a1a28] border border-[#2a2a36]"
                >
                  +0.5°C
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between font-mono text-[10px] text-[#787885]">
              <span className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-[#00e676]" />
                TOKEN: {activeStay?.digitalKeyToken || `CITADEL-KEY-${activeStayRoom.roomNumber}-9F2A`}
              </span>
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#d4af37]" /> AES-256
              </span>
            </div>
          </div>

          {/* LIVE IN-ROOM DINING & CULINARY DISPATCH */}
          <div className="bg-[#0a0a0e] border border-[#1e1e26] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#181820] pb-3">
              <div className="flex items-center gap-2.5">
                <UtensilsCrossed className="w-4 h-4 text-[#d4af37]" />
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#d4af37]">
                    MESOPOTAMIAN GASTRONOMY
                  </div>
                  <h4 className="font-serif text-xl text-[#f4f0ea]">
                    In-Suite Culinary Dispatch (Suite {activeStayRoom.roomNumber})
                  </h4>
                </div>
              </div>
              <span className="font-mono text-[10px] text-[#888895]">
                ACTIVE TICKETS: {roomServiceOrders.length}
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {CULINARY_MENU.map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-[#050508] border border-[#181820] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-serif text-sm text-[#f4f0ea] font-medium">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-[#787885] line-clamp-1">{item.desc}</div>
                      <div className="font-mono text-[11px] text-[#d4af37] mt-1">
                        {item.priceIqd.toLocaleString()} IQD ($
                        {(item.priceIqd / EXCHANGE_RATE_IQD).toFixed(2)})
                      </div>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setCart((prev) => ({
                            ...prev,
                            [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
                          }))
                        }
                        className="w-6 h-6 bg-[#101018] border border-[#262632] flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-5 text-center text-[#f4f0ea]">{qty}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))
                        }
                        className="w-6 h-6 bg-[#101018] border border-[#d4af37]/50 text-[#d4af37] flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {orderNotice && (
              <div className="p-2.5 bg-[#00e676]/10 border border-[#00e676] text-[#00e676] font-mono text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{orderNotice}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleOrderDining}
              className="w-full py-3 bg-[#14141d] hover:bg-[#d4af37] hover:text-[#030305] border border-[#d4af37] text-[#d4af37] font-mono text-xs font-bold uppercase tracking-[0.18em] transition"
            >
              DISPATCH CULINARY ORDER TO SUITE {activeStayRoom.roomNumber}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
