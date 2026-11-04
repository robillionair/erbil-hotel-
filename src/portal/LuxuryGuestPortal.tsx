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
  ArrowUpRight,
  Compass,
  Lock,
  Layers,
  X,
} from 'lucide-react';
import {
  useHotelOpsStore,
  isRoomReady,
  ExtraGuest,
  EXCHANGE_RATE_IQD,
} from '../store/useHotelOpsStore';
import { useAuthStore } from '../store/useAuthStore';

const ARCHITECTURAL_SUITES = [
  {
    id: 'tier-twin',
    title: 'Citadel View Twin Residence',
    subtitle: 'Floors L1 – L4 • Acoustic Glazing & Travertine Bath',
    rateIqd: 100000,
    image: '/assets/originals/twin-room.jpeg',
    secondaryImage: '/assets/originals/twin-room-window.jpeg',
    sqm: '42 m²',
    floorRange: [1, 2, 3, 4],
    badge: 'General Twin Example',
    description:
      'Tailored for diplomatic delegations and discerning travelers. Features twin ergonomic sleep sanctuaries, natural daylight framing Sulaymaniyah, and bespoke climate telemetry.',
  },
  {
    id: 'tier-exec',
    title: 'Executive Basalt Suite',
    subtitle: 'Floors L4 – L6 • Private Salon & Espresso Bar',
    rateIqd: 150000,
    image: '/assets/originals/twin-room-window.jpeg',
    secondaryImage: '/assets/originals/lobby-seating.jpeg',
    sqm: '64 m²',
    floorRange: [4, 5, 6],
    badge: 'Executive Wing',
    description:
      'Elevated smoked-basalt textures paired with warm Levantine walnut millwork, dedicated workspace, and priority housekeeping turndown.',
  },
  {
    id: 'tier-diplomatic',
    title: 'Diplomatic Wing Residence',
    subtitle: 'Floors L5 – L6 • Consular Security & Atrium Panorama',
    rateIqd: 220000,
    image: '/assets/originals/lobby-seating.jpeg',
    secondaryImage: '/assets/originals/atrium.jpeg',
    sqm: '92 m²',
    floorRange: [5, 6],
    badge: 'Consular Tier',
    description:
      'Engineered for visiting envoys and sovereign guests. Includes encrypted NFC keycard perimeter, formal majlis seating, and direct private elevator access.',
  },
  {
    id: 'tier-penthouse',
    title: 'Royal Kurd Penthouse',
    subtitle: 'Floor L6 Crown • Sovereign Majlis & Private Butler',
    rateIqd: 350000,
    image: '/assets/originals/atrium.jpeg',
    secondaryImage: '/assets/originals/lobby-wide.jpeg',
    sqm: '165 m²',
    floorRange: [6],
    badge: 'Sovereign Crown',
    description:
      'The pinnacle of Erbil Hotel. Commanding the 6th floor with soaring architectural vistas, private dining room, and dedicated 24-hour culinary concierge.',
  },
];

const CULINARY_MENU = [
  {
    id: 'm1',
    name: 'Royal Mesopotamian Lamb Quzi & Saffron Rice',
    category: 'Signature Culinary',
    priceIqd: 45000,
    prepTime: '22 min',
    desc: 'Slow-braised lamb shoulder, toasted almonds, golden raisins, aromatic Erbil saffron rice.',
  },
  {
    id: 'm2',
    name: 'Tigris Fire-Roasted Masgouf Fillet',
    category: 'Signature Culinary',
    priceIqd: 52000,
    prepTime: '25 min',
    desc: 'Oak-smoked carp fillet glazed with tangy tamarind, wild thyme, and charred tomato chutney.',
  },
  {
    id: 'm3',
    name: 'Levantine Mezze & Warm Samoon Anthology',
    category: 'Artisanal Starters',
    priceIqd: 34000,
    prepTime: '14 min',
    desc: 'Smoked mutabbal, silky hummus bi-tahini, dolma, and aged pomegranate reduction.',
  },
  {
    id: 'm4',
    name: 'Citadel Cardamom Qahwa & Pistachio Baklava',
    category: 'Ritual & Pastry',
    priceIqd: 28000,
    prepTime: '10 min',
    desc: 'Freshly brewed brass-pot Arabic coffee served with crisp layered pistachio pastry.',
  },
  {
    id: 'm5',
    name: 'Pressed Halabja Pomegranate & Rose Elixir',
    category: 'Botanical Elixir',
    priceIqd: 14000,
    prepTime: '6 min',
    desc: 'Cold-pressed organic pomegranates infused with Damascus rosewater distillate.',
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

  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [heroSlide, setHeroSlide] = useState<number>(0);
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);

  const heroImages = [
    {
      src: '/assets/originals/lobby-wide.jpeg',
      label: 'Grand Travertine Promenade',
      caption: 'Salem Street, Sulaymaniyah • Next to City Star',
    },
    {
      src: '/assets/originals/atrium.jpeg',
      label: 'Soaring Six-Floor Architectural Atrium',
      caption: 'Luminous Vertical Geometry & Panoramic Galleries',
    },
    {
      src: '/assets/originals/exterior.jpeg',
      label: 'Erbil Hotel Sovereign Facade',
      caption: 'Coordinates 35.5581° N, 45.4269° E',
    },
  ];

  // Strictly Ready rooms for booking
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

  // Digital Keycard state
  const [keyUnlockedPulse, setKeyUnlockedPulse] = useState(false);

  // Active guest stay
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

  const formatMoney = (iqd: number) => {
    if (currency === 'USD') {
      return `$${(iqd / EXCHANGE_RATE_IQD).toFixed(2)} USD`;
    }
    return `${iqd.toLocaleString()} IQD`;
  };

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
      `Culinary order dispatched to Suite ${activeStayRoom.roomNumber}. Live kitchen telemetry pulsed.`
    );
    setTimeout(() => setOrderNotice(null), 5000);
  };

  const fullBookingPriceIqd = (currentChosenRoom?.baseRateIqd || 100000) * Math.max(1, nights);
  const finalBookingPayIqd = Math.round((fullBookingPriceIqd * discountPayPercent) / 100);

  return (
    <div className="min-h-screen text-[#f4f0ea] font-sans relative selection:bg-[#d4af37]/30">
      {/* =====================================================================
          1. CINEMATIC PARALLAX HERO WITH KEN-BURNS & FLOATING GLASS BAR
      ===================================================================== */}
      <section className="relative h-[86vh] min-h-[640px] w-full overflow-hidden">
        {/* Background Ken Burns Image Layer */}
        <img
          key={heroImages[heroSlide].src}
          src={heroImages[heroSlide].src}
          alt={heroImages[heroSlide].label}
          className="absolute inset-0 w-full h-full object-cover object-center animate-ken-burns filter brightness-[0.46] contrast-[1.08]"
        />
        {/* Multi-layered radial & vertical atmospheric vignettes */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030305] via-[#030305]/40 to-[#030305]/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#030305_100%)] opacity-80" />

        <div className="relative z-10 max-w-7xl mx-auto h-full px-6 sm:px-10 flex flex-col justify-between py-12">
          {/* Top Crest & Currency / Scene Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-0.5 rounded-2xl bg-gradient-to-br from-[#d4af37] via-[#d4af37]/50 to-transparent shadow-2xl shadow-[#d4af37]/20">
                <img
                  src="/assets/logo/erbil-hotel-logo.jpeg"
                  alt="Erbil Hotel Crest"
                  className="w-14 h-14 rounded-[14px] object-cover"
                />
              </div>
              <div>
                <div className="text-[11px] font-medium tracking-[0.26em] text-[#d4af37] uppercase">
                  Sovereign Kurdish Hospitality
                </div>
                <h1 className="font-serif text-3xl sm:text-4xl tracking-wide text-[#f4f0ea] font-normal">
                  Erbil Hotel
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Dual Currency Pill Toggle */}
              <div className="glass-pill rounded-full p-1 flex items-center text-xs">
                <button
                  onClick={() => setCurrency('IQD')}
                  className={`px-3.5 py-1.5 rounded-full font-medium transition ${
                    currency === 'IQD'
                      ? 'bg-[#d4af37] text-[#030305] font-semibold shadow'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  IQD (د.ع)
                </button>
                <button
                  onClick={() => setCurrency('USD')}
                  className={`px-3.5 py-1.5 rounded-full font-medium transition ${
                    currency === 'USD'
                      ? 'bg-[#d4af37] text-[#030305] font-semibold shadow'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  USD ($)
                </button>
              </div>

              {onSwitchToOps && (
                <button
                  onClick={onSwitchToOps}
                  className="glass-pill px-4 py-2 rounded-full text-xs font-medium text-white/90 hover:text-[#d4af37] hover:border-[#d4af37]/50 flex items-center gap-1.5 transition"
                >
                  <span>Operations Command</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#d4af37]" />
                </button>
              )}
            </div>
          </div>

          {/* Center Editorial Typography */}
          <div className="max-w-3xl space-y-6 my-auto">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full glass-pill text-[#d4af37] text-xs tracking-[0.18em] uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Salem Street • Sulaymaniyah Sanctuary</span>
            </div>

            <h2 className="font-serif text-5xl sm:text-7xl font-light leading-[1.04] tracking-tight text-[#f4f0ea]">
              Where Smoked Basalt Meets{' '}
              <span className="italic font-normal text-[#d4af37]">Levantine Serenity.</span>
            </h2>

            <p className="text-base sm:text-lg text-white/70 max-w-2xl leading-relaxed font-light">
              An architectural landmark next to City Star. Forty-eight bespoke residences and
              diplomatic suites orchestrated by live environmental telemetry, dual-supervisor
              purity certification, and timeless Kurdish warmth.
            </p>

            {/* Scene Switcher Pills */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {heroImages.map((img, idx) => (
                <button
                  key={img.src}
                  onClick={() => setHeroSlide(idx)}
                  className={`px-4 py-2 rounded-full text-xs transition-all ${
                    heroSlide === idx
                      ? 'bg-white/15 border border-[#d4af37] text-[#f4f0ea] shadow-lg'
                      : 'bg-white/[0.04] border border-white/10 text-white/55 hover:text-white'
                  }`}
                >
                  0{idx + 1}. {img.label}
                </button>
              ))}
            </div>
          </div>

          {/* Floating VisionOS Glassmorphic Booking Bar */}
          <div className="glass-panel rounded-3xl p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-white/10 pb-3 md:pb-0 md:pr-4">
              <div className="text-[11px] text-white/45 uppercase tracking-wider">
                Certified Ready Inventory
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-serif text-3xl text-[#00e676] font-normal tabular-nums">
                  {readyRooms.length}
                </span>
                <span className="text-xs text-white/60">of {rooms.length} Suites Ready Now</span>
              </div>
            </div>

            <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-white/10 pb-3 md:pb-0 md:pr-4">
              <div className="text-[11px] text-white/45 uppercase tracking-wider">
                Standard Owner Tariff
              </div>
              <div className="font-serif text-2xl text-[#d4af37] mt-1 tabular-nums">
                {formatMoney(100000)}{' '}
                <span className="text-xs font-sans text-white/50">/ Night</span>
              </div>
            </div>

            <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-white/10 pb-3 md:pb-0 md:pr-4">
              <div className="text-[11px] text-white/45 uppercase tracking-wider">
                Direct Concierge & WhatsApp
              </div>
              <div className="text-sm text-white/90 font-mono mt-1.5 flex items-center gap-2 tabular-nums">
                <Phone className="w-3.5 h-3.5 text-[#00e676]" />
                +964 774 115 0101
              </div>
            </div>

            <div className="md:col-span-3 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsBookingDrawerOpen(true)}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#b89225] hover:brightness-110 text-[#030305] text-xs font-semibold uppercase tracking-[0.16em] shadow-xl shadow-[#d4af37]/20 transition"
              >
                Reserve Ready Suite
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. INTERACTIVE ARCHITECTURAL SUITE SHOWCASE (4 TIERS + HOVER LENS)
      ===================================================================== */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-24 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.24em] text-[#d4af37]">
              Architectural Accommodations
            </div>
            <h3 className="font-serif text-4xl sm:text-5xl font-light text-[#f4f0ea] mt-2">
              Curated Sanctuary Tiers
            </h3>
          </div>
          <p className="text-sm text-white/60 max-w-md leading-relaxed">
            Every tier is bound to live floor availability from our central operations store.
            Select any residence to open the 1-click check-in and keycard drawer.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {ARCHITECTURAL_SUITES.map((tier) => {
            const availableOnFloors = readyRooms.filter((r) =>
              tier.floorRange.includes(r.floor)
            );
            return (
              <div
                key={tier.id}
                className="group rounded-3xl glass-panel overflow-hidden flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 hover:border-[#d4af37]/40"
              >
                <div>
                  {/* Image Container with Hover Lens Swap */}
                  <div className="relative h-72 overflow-hidden">
                    <img
                      src={tier.image}
                      alt={tier.title}
                      className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#030305] via-transparent to-black/30" />

                    {/* Top Floating Badges */}
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                      <span className="px-3.5 py-1 rounded-full glass-pill text-[11px] font-medium text-[#d4af37]">
                        {tier.badge}
                      </span>
                      <span className="px-3 py-1 rounded-full glass-pill font-mono text-[11px] text-[#00e676] tabular-nums">
                        ● {availableOnFloors.length} Ready on Floors L{tier.floorRange[0]}–L
                        {tier.floorRange[tier.floorRange.length - 1]}
                      </span>
                    </div>

                    {/* Bottom Dimensions & Rate Overlay */}
                    <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
                      <div>
                        <div className="text-xs text-white/70">{tier.subtitle}</div>
                        <h4 className="font-serif text-2xl sm:text-3xl text-white font-normal">
                          {tier.title}
                        </h4>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-white/50 uppercase">Tariff</div>
                        <div className="font-serif text-2xl text-[#d4af37] tabular-nums">
                          {formatMoney(tier.rateIqd)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="text-sm text-white/65 leading-relaxed font-light">
                      {tier.description}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-3 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-white/50 font-mono">
                    <span>AREA: {tier.sqm}</span>
                    <span>•</span>
                    <span>HVAC: 21.0°C</span>
                  </div>

                  <button
                    onClick={() => {
                      if (availableOnFloors[0]) {
                        setSelectedRoomNum(availableOnFloors[0].roomNumber);
                      }
                      setIsBookingDrawerOpen(true);
                    }}
                    className="px-5 py-2.5 rounded-full bg-white/[0.07] hover:bg-[#d4af37] text-white hover:text-[#030305] text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <span>Book This Tier</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          3. APPLE-WALLET-GRADE 3D DIGITAL KEYCARD & IN-SUITE DINING
      ===================================================================== */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 pb-28 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* LEFT 5 COLS: 3D METALLIC / GLASSMORPHIC DIGITAL ROOM KEYCARD */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.24em] text-[#00f0ff]">
              VisionOS Cryptographic Pass
            </div>
            <h3 className="font-serif text-3xl sm:text-4xl font-light text-[#f4f0ea] mt-1">
              Apple-Wallet-Grade Digital Key
            </h3>
          </div>

          {/* 3D Perspective Metallic Pass Card */}
          <div
            style={{ perspective: '1200px' }}
            className="relative group"
          >
            <div
              style={{
                transform: 'rotateX(6deg) rotateY(-6deg)',
                transformStyle: 'preserve-3d',
              }}
              className="rounded-[28px] p-7 glass-panel border border-[#d4af37]/40 bg-gradient-to-br from-[#161522]/90 via-[#090910]/95 to-[#040407] shadow-[0_30px_70px_rgba(0,0,0,0.85)] transition-transform duration-500 group-hover:rotate-x-0 group-hover:rotate-y-0 relative overflow-hidden"
            >
              {/* Metallic Sheen */}
              <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#d4af37]/15 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-[#00f0ff]/10 blur-3xl pointer-events-none" />

              {/* Top Pass Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="/assets/logo/erbil-hotel-logo.jpeg"
                    alt="Erbil Crest"
                    className="w-10 h-10 rounded-xl object-cover border border-[#d4af37]/60"
                  />
                  <div>
                    <div className="text-[10px] font-mono tracking-[0.2em] text-[#d4af37] uppercase">
                      ERBIL HOTEL • CITADEL PASS
                    </div>
                    <div className="font-serif text-lg text-white">
                      {activeStayRoom.floorZone}
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#00e676]/15 border border-[#00e676]/40 text-[#00e676] font-mono text-[10px] uppercase tracking-wider">
                  ● BLE / NFC Ready
                </span>
              </div>

              {/* Center Suite Number & Resident */}
              <div className="my-8 flex items-end justify-between">
                <div>
                  <div className="text-[11px] text-white/45 uppercase tracking-wider">
                    Assigned Residence
                  </div>
                  <div className="font-serif text-6xl font-light text-white tracking-tight mt-1 tabular-nums">
                    {activeStayRoom.roomNumber}
                  </div>
                  <div className="text-xs text-[#d4af37] mt-1">{activeStayRoom.roomType}</div>
                </div>

                {/* Animated NFC Unlock Pulse Button */}
                <button
                  type="button"
                  onClick={() => {
                    setKeyUnlockedPulse(true);
                    setTimeout(() => setKeyUnlockedPulse(false), 2600);
                  }}
                  className="relative w-20 h-20 rounded-full glass-pill border border-[#d4af37]/60 flex flex-col items-center justify-center text-[#d4af37] hover:scale-105 transition"
                >
                  {keyUnlockedPulse && (
                    <span className="absolute inset-0 rounded-full border-2 border-[#00e676] animate-nfc-ripple" />
                  )}
                  <Wifi className="w-6 h-6 rotate-90" />
                  <span className="text-[9px] font-mono uppercase tracking-wider mt-1">
                    {keyUnlockedPulse ? 'Unlocked' : 'Tap Lock'}
                  </span>
                </button>
              </div>

              {/* Resident & Security Metadata */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-xs">
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Primary Resident</div>
                  <div className="text-white/90 font-medium truncate mt-0.5">
                    {activeStayRoom.currentGuestName || user?.fullName || 'Envoy Henri Laurent'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/40 uppercase">Cryptographic Token</div>
                  <div className="font-mono text-[11px] text-[#00f0ff] mt-0.5 tabular-nums">
                    {activeStay?.digitalKeyToken || `EBL-${activeStayRoom.roomNumber}-NFC9`}
                  </div>
                </div>
              </div>

              {/* Live Suite Climate Slider (18°C - 26°C) */}
              <div className="mt-6 p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-white/75">
                    <Thermometer className="w-4 h-4 text-[#00f0ff]" />
                    In-Suite Climate Telemetry
                  </span>
                  <span className="font-mono text-sm font-semibold text-[#00f0ff] tabular-nums">
                    {activeStayRoom.hvacTempC.toFixed(1)} °C
                  </span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={26}
                  step={0.5}
                  value={activeStayRoom.hvacTempC}
                  onChange={(e) =>
                    setRoomHvacTemp(activeStayRoom.roomNumber, Number(e.target.value))
                  }
                  className="w-full accent-[#00f0ff] cursor-pointer"
                />
                <div className="flex justify-between font-mono text-[10px] text-white/40">
                  <span>18.0°C Chilled</span>
                  <span>22.0°C Optimal</span>
                  <span>26.0°C Warm</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT 7 COLS: SLEEK VISUAL IN-SUITE DINING CONCIERGE */}
        <div className="lg:col-span-7 rounded-3xl glass-panel p-7 sm:p-9 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.22em] text-[#d4af37]">
                Mesopotamian Gastronomy
              </div>
              <h3 className="font-serif text-3xl text-white font-light mt-1">
                In-Suite Culinary Concierge • Suite {activeStayRoom.roomNumber}
              </h3>
            </div>
            <span className="px-3.5 py-1.5 rounded-full glass-pill font-mono text-xs text-[#00e676] tabular-nums">
              Active Kitchen Queue: {roomServiceOrders.length}
            </span>
          </div>

          <div className="space-y-3">
            {CULINARY_MENU.map((item) => {
              const qty = cart[item.id] || 0;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    qty > 0
                      ? 'bg-white/[0.06] border-[#d4af37]/50'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-serif text-lg text-white">{item.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/[0.06] font-mono text-[10px] text-white/60">
                        {item.prepTime}
                      </span>
                    </div>
                    <p className="text-xs text-white/55 font-light">{item.desc}</p>
                    <div className="font-mono text-xs text-[#d4af37] pt-0.5 tabular-nums">
                      {formatMoney(item.priceIqd)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setCart((prev) => ({
                          ...prev,
                          [item.id]: Math.max(0, (prev[item.id] || 0) - 1),
                        }))
                      }
                      className="w-8 h-8 rounded-full glass-pill flex items-center justify-center text-white/70 hover:text-white"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-mono text-sm text-white tabular-nums">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))
                      }
                      className="w-8 h-8 rounded-full bg-[#d4af37]/20 border border-[#d4af37] text-[#d4af37] flex items-center justify-center hover:bg-[#d4af37] hover:text-[#030305] transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {orderNotice && (
            <div className="p-4 rounded-2xl bg-[#00e676]/15 border border-[#00e676]/40 text-[#69f0ae] text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{orderNotice}</span>
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-white/55">
              Dispatches directly to Citadel Mode View 03 & View 06 live telemetry.
            </div>
            <button
              type="button"
              onClick={handleOrderDining}
              className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#b89225] hover:brightness-110 text-[#030305] text-xs font-semibold uppercase tracking-[0.16em] shadow-lg shadow-[#d4af37]/20 transition"
            >
              Dispatch Culinary Order to Suite {activeStayRoom.roomNumber}
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. SLIDE-OVER 1-CLICK SUITE BOOKING & CHECK-IN DRAWER
      ===================================================================== */}
      {isBookingDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-xl h-full glass-panel border-l border-white/15 p-6 sm:p-8 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#00e676]">
                    Certified Ready-Room Reservation
                  </div>
                  <h3 className="font-serif text-3xl text-white mt-0.5">
                    Instant Suite Check-In
                  </h3>
                </div>
                <button
                  onClick={() => setIsBookingDrawerOpen(false)}
                  className="w-9 h-9 rounded-full glass-pill flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Floor Filter Pills */}
              <div>
                <label className="block text-xs text-white/60 mb-2">
                  Filter Certified Ready Rooms by Floor (L1–L6)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedFloorFilter('ALL')}
                    className={`px-3 py-1.5 rounded-full text-xs transition ${
                      selectedFloorFilter === 'ALL'
                        ? 'bg-[#d4af37] text-[#030305] font-semibold'
                        : 'glass-pill text-white/70'
                    }`}
                  >
                    All Floors ({readyRooms.length})
                  </button>
                  {[1, 2, 3, 4, 5, 6].map((fl) => {
                    const c = readyRooms.filter((r) => r.floor === fl).length;
                    return (
                      <button
                        key={fl}
                        type="button"
                        onClick={() => setSelectedFloorFilter(fl)}
                        className={`px-3 py-1.5 rounded-full text-xs transition ${
                          selectedFloorFilter === fl
                            ? 'bg-[#d4af37] text-[#030305] font-semibold'
                            : 'glass-pill text-white/70'
                        }`}
                      >
                        Floor {fl} ({c})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ready Room Selector Pills */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
                {filteredReadyRooms.map((rm) => {
                  const isSel = currentChosenRoom?.roomNumber === rm.roomNumber;
                  return (
                    <button
                      key={rm.roomNumber}
                      type="button"
                      onClick={() => setSelectedRoomNum(rm.roomNumber)}
                      className={`p-3 rounded-2xl border text-left transition ${
                        isSel
                          ? 'bg-[#d4af37]/20 border-[#d4af37] text-white shadow-lg'
                          : 'bg-white/[0.03] border-white/10 text-white/70 hover:border-white/30'
                      }`}
                    >
                      <div className="font-mono text-sm font-semibold text-white">
                        RM {rm.roomNumber}
                      </div>
                      <div className="text-[10px] text-[#d4af37] truncate mt-0.5">
                        {rm.roomType}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Booking Form */}
              <form onSubmit={handleInstantBooking} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-2 text-xs text-white outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Passport / ID *</label>
                    <input
                      type="text"
                      required
                      value={guestIdNumber}
                      onChange={(e) => setGuestIdNumber(e.target.value)}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-2 text-xs text-white outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Phone / WhatsApp</label>
                    <input
                      type="text"
                      value={guestContact}
                      onChange={(e) => setGuestContact(e.target.value)}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-2 text-xs text-white outline-none focus:border-[#d4af37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Vehicle Plate</label>
                    <input
                      type="text"
                      value={guestCarNumber}
                      onChange={(e) => setGuestCarNumber(e.target.value)}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-2 text-xs text-white outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                {/* Companion Guests */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/70">
                      Total Guests:{' '}
                      <strong className="text-[#d4af37] font-mono">
                        {1 + extraGuests.length}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={addExtraGuestRow}
                      className="px-3 py-1 rounded-full glass-pill text-[#d4af37] text-xs flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Companion
                    </button>
                  </div>
                  {extraGuests.map((eg, idx) => (
                    <div key={eg.id} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        required
                        placeholder={`Companion #${idx + 2} Name *`}
                        value={eg.fullName}
                        onChange={(e) => updateExtraGuest(eg.id, 'fullName', e.target.value)}
                        className="col-span-5 rounded-xl bg-black/40 border border-white/10 px-3 py-1.5 text-xs text-white"
                      />
                      <input
                        type="text"
                        required
                        placeholder={`ID Number *`}
                        value={eg.idNumber}
                        onChange={(e) => updateExtraGuest(eg.id, 'idNumber', e.target.value)}
                        className="col-span-5 rounded-xl bg-black/40 border border-white/10 px-3 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeExtraGuest(eg.id)}
                        className="col-span-2 p-1.5 rounded-xl bg-[#ff1e7a]/20 text-[#ff1e7a] flex justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Nights & Discount Calculation */}
                <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                  <div>
                    <label className="block text-[11px] text-white/50">Nights</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={nights}
                      onChange={(e) => setNights(Math.max(1, Number(e.target.value) || 1))}
                      className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/50">Guest Pays %</label>
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={discountPayPercent}
                      onChange={(e) =>
                        setDiscountPayPercent(
                          Math.max(10, Math.min(100, Number(e.target.value) || 100))
                        )
                      }
                      className="mt-1 w-full rounded-xl bg-black/40 border border-white/10 px-3 py-1.5 text-xs font-mono text-[#d4af37]"
                    />
                  </div>
                  <div className="flex flex-col justify-center text-right font-mono">
                    <div className="text-[10px] text-white/40 line-through">
                      {fullBookingPriceIqd.toLocaleString()} IQD
                    </div>
                    <div className="text-sm font-semibold text-[#00e676] tabular-nums">
                      {formatMoney(finalBookingPayIqd)}
                    </div>
                  </div>
                </div>

                {bookingFeedback && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs ${
                      bookingFeedback.type === 'success'
                        ? 'bg-[#00e676]/15 border-[#00e676]/40 text-[#69f0ae]'
                        : 'bg-[#ff1e7a]/15 border-[#ff1e7a]/40 text-[#ff85b3]'
                    }`}
                  >
                    {bookingFeedback.msg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#d4af37] to-[#b89225] text-[#030305] text-xs font-semibold uppercase tracking-[0.16em] shadow-xl transition"
                >
                  Confirm Check-In & Provision Keycard
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
