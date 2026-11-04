-- =============================================================================
-- ERBIL HOTEL OPERATIONS // CITADEL TELEMETRY & LUXURY PORTAL
-- COMPLETE IDEMPOTENT SUPABASE SCHEMA MIGRATION: 001_erbil_hotel_schema.sql
-- Safe to run multiple times in Supabase SQL Editor with zero errors
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PROFILES TABLE (Bound to auth.users via Trigger)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Hotel Guest',
  phone TEXT DEFAULT '+964 750 816 9999',
  role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('guest', 'front_desk', 'housekeeping', 'executive')),
  simple_mode BOOLEAN NOT NULL DEFAULT false,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ar', 'ku')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'guest_' || NEW.id::text || '@erbilhotel.iq'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Valued Guest'),
    COALESCE(NEW.raw_user_meta_data->>'phone', '+964 774 115 0101'),
    CASE
      WHEN (NEW.raw_user_meta_data->>'role') IN ('guest', 'front_desk', 'housekeeping', 'executive')
      THEN NEW.raw_user_meta_data->>'role'
      ELSE 'guest'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. ROOMS TABLE (48 Suites & Rooms across Floors L1-L6)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT UNIQUE NOT NULL,
  floor INTEGER NOT NULL CHECK (floor BETWEEN 1 AND 10),
  floor_zone TEXT NOT NULL DEFAULT 'FLOOR_01_LOBBY',
  room_type TEXT NOT NULL DEFAULT 'Single' CHECK (room_type IN ('Single', 'Twin', 'Executive Suite', 'Diplomatic Suite', 'Royal Penthouse')),
  base_rate_iqd NUMERIC(12, 2) NOT NULL DEFAULT 100000.00,
  base_rate_usd NUMERIC(10, 2) NOT NULL DEFAULT 76.34,
  occupancy_status TEXT NOT NULL DEFAULT 'vacant' CHECK (occupancy_status IN ('vacant', 'occupied')),
  housekeeping_status TEXT NOT NULL DEFAULT 'clean' CHECK (housekeeping_status IN ('clean', 'dirty', 'cleaning_in_progress')),
  inspection_status TEXT NOT NULL DEFAULT 'passed' CHECK (inspection_status IN ('passed', 'failed', 'awaiting_inspection')),
  maintenance_status TEXT NOT NULL DEFAULT 'in_service' CHECK (maintenance_status IN ('in_service', 'out_of_service')),
  is_vip BOOLEAN NOT NULL DEFAULT false,
  hvac_temp_c NUMERIC(4, 1) NOT NULL DEFAULT 21.5,
  keycard_active BOOLEAN NOT NULL DEFAULT false,
  current_guest_name TEXT,
  current_guest_contact TEXT,
  current_guest_id_number TEXT,
  current_guest_car_number TEXT,
  extra_guests JSONB NOT NULL DEFAULT '[]'::jsonb,
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_room_ready(
  p_occupancy TEXT,
  p_housekeeping TEXT,
  p_inspection TEXT,
  p_maintenance TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    p_occupancy = 'vacant'
    AND p_housekeeping = 'clean'
    AND p_inspection = 'passed'
    AND p_maintenance = 'in_service'
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. RESERVATIONS & STAYS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref TEXT UNIQUE NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  room_number TEXT NOT NULL,
  guest_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_contact TEXT NOT NULL DEFAULT '',
  guest_id_number TEXT NOT NULL,
  guest_car_number TEXT DEFAULT '',
  extra_guests JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_guests INTEGER NOT NULL DEFAULT 1,
  channel TEXT NOT NULL DEFAULT 'Direct_Web' CHECK (channel IN ('Direct_Web', 'Booking_OTA', 'Embassy_Corp', 'Walk_In_VIP', 'Airport_Transfer')),
  check_in_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_date TIMESTAMPTZ,
  nights INTEGER NOT NULL DEFAULT 1,
  full_price_iqd NUMERIC(12, 2) NOT NULL DEFAULT 100000.00,
  discount_pay_percent NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
  final_paid_iqd NUMERIC(12, 2) NOT NULL DEFAULT 100000.00,
  final_paid_usd NUMERIC(10, 2) NOT NULL DEFAULT 76.34,
  status TEXT NOT NULL DEFAULT 'checked_in' CHECK (status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled')),
  digital_key_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. HOUSEKEEPING TASKS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER NOT NULL,
  assigned_to TEXT NOT NULL DEFAULT 'Housekeeping Squad Alpha',
  task_type TEXT NOT NULL DEFAULT 'Checkout Deep Turnover' CHECK (task_type IN ('Checkout Deep Turnover', 'Daily Refresh', 'VIP Turndown', 'Re-Clean After Failed Inspection')),
  status TEXT NOT NULL DEFAULT 'dirty' CHECK (status IN ('dirty', 'cleaning_in_progress', 'awaiting_inspection', 'passed', 'failed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent_vip')),
  sla_deadline TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '35 minutes'),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 5. MAINTENANCE LOGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor INTEGER NOT NULL,
  problem_type TEXT NOT NULL CHECK (problem_type IN ('HVAC / Climate', 'Plumbing / Water', 'Electrical / Lighting', 'Smart Keycard Lock', 'Furniture / Glazing')),
  priority TEXT NOT NULL DEFAULT 'high' CHECK (priority IN ('low', 'medium', 'high', 'critical_oos')),
  status TEXT NOT NULL DEFAULT 'working_on_it' CHECK (status IN ('working_on_it', 'fixed_awaiting_check', 'out_of_service', 'needs_parts', 'checked_ok')),
  reported_by TEXT NOT NULL DEFAULT 'Front Desk',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6. ROOM SERVICE ORDERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL,
  floor INTEGER NOT NULL,
  guest_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_iqd NUMERIC(12, 2) NOT NULL DEFAULT 32000.00,
  total_usd NUMERIC(10, 2) NOT NULL DEFAULT 24.43,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('queued', 'preparing', 'in_transit', 'delivered')),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 7. ROW-LEVEL SECURITY (RLS) POLICIES (Idempotent DROP IF EXISTS + CREATE)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_service_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Rooms viewable by all" ON public.rooms;
CREATE POLICY "Rooms viewable by all"
  ON public.rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Rooms insertable by all" ON public.rooms;
CREATE POLICY "Rooms insertable by all"
  ON public.rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Rooms updatable by authenticated users" ON public.rooms;
CREATE POLICY "Rooms updatable by authenticated users"
  ON public.rooms FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Reservations viewable by authenticated" ON public.reservations;
CREATE POLICY "Reservations viewable by authenticated"
  ON public.reservations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Reservations insertable by all" ON public.reservations;
CREATE POLICY "Reservations insertable by all"
  ON public.reservations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Reservations updatable by authenticated" ON public.reservations;
CREATE POLICY "Reservations updatable by authenticated"
  ON public.reservations FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Housekeeping viewable by all" ON public.housekeeping_tasks;
CREATE POLICY "Housekeeping viewable by all"
  ON public.housekeeping_tasks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Housekeeping insertable by all" ON public.housekeeping_tasks;
CREATE POLICY "Housekeeping insertable by all"
  ON public.housekeeping_tasks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Housekeeping updatable by all" ON public.housekeeping_tasks;
CREATE POLICY "Housekeeping updatable by all"
  ON public.housekeeping_tasks FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Maintenance viewable by all" ON public.maintenance_logs;
CREATE POLICY "Maintenance viewable by all"
  ON public.maintenance_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Maintenance insertable by all" ON public.maintenance_logs;
CREATE POLICY "Maintenance insertable by all"
  ON public.maintenance_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Maintenance updatable by all" ON public.maintenance_logs;
CREATE POLICY "Maintenance updatable by all"
  ON public.maintenance_logs FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Room service viewable by all" ON public.room_service_orders;
CREATE POLICY "Room service viewable by all"
  ON public.room_service_orders FOR SELECT USING (true);

DROP POLICY IF EXISTS "Room service insertable by all" ON public.room_service_orders;
CREATE POLICY "Room service insertable by all"
  ON public.room_service_orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Room service updatable by all" ON public.room_service_orders;
CREATE POLICY "Room service updatable by all"
  ON public.room_service_orders FOR UPDATE USING (true);

-- -----------------------------------------------------------------------------
-- 8. REALTIME PUBLICATION CONFIGURATION (Safe per-table checks)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['profiles', 'rooms', 'reservations', 'housekeeping_tasks', 'maintenance_logs', 'room_service_orders']
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 9. INITIAL SEED DATA: 48 ERBIL HOTEL ROOMS ACROSS 6 FLOORS (L1 - L6)
-- -----------------------------------------------------------------------------
INSERT INTO public.rooms (
  room_number, floor, floor_zone, room_type, base_rate_iqd, base_rate_usd,
  occupancy_status, housekeeping_status, inspection_status, maintenance_status,
  is_vip, hvac_temp_c, keycard_active, current_guest_name, current_guest_contact,
  current_guest_id_number, current_guest_car_number, discount_percent
) VALUES
  -- FLOOR 1: LOBBY & ATRIUM RESIDENCES (101-108)
  ('101', 1, 'FLOOR_01_LOBBY', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.0, false, NULL, NULL, NULL, NULL, 100),
  ('102', 1, 'FLOOR_01_LOBBY', 'Twin', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 22.0, true, 'Karwan Barzani', '+964 750 412 8890', 'IRQ-EBL-88219', 'EBL 44912', 100),
  ('103', 1, 'FLOOR_01_LOBBY', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.5, false, NULL, NULL, NULL, NULL, 100),
  ('104', 1, 'FLOOR_01_LOBBY', 'Twin', 100000, 76.34, 'vacant', 'dirty', 'awaiting_inspection', 'in_service', false, 23.0, false, NULL, NULL, NULL, NULL, 100),
  ('105', 1, 'FLOOR_01_LOBBY', 'Single', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 21.0, true, 'Dilan Talabani', '+964 770 119 3321', 'IRQ-SLM-19204', 'SLM 90211', 80),
  ('106', 1, 'FLOOR_01_LOBBY', 'Twin', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.2, false, NULL, NULL, NULL, NULL, 100),
  ('107', 1, 'FLOOR_01_LOBBY', 'Single', 100000, 76.34, 'vacant', 'cleaning_in_progress', 'awaiting_inspection', 'in_service', false, 22.4, false, NULL, NULL, NULL, NULL, 100),
  ('108', 1, 'FLOOR_01_LOBBY', 'Twin', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.0, false, NULL, NULL, NULL, NULL, 100),

  -- FLOOR 2: EXECUTIVE WING (201-208)
  ('201', 2, 'FLOOR_02_EXEC', 'Single', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 20.5, true, 'Dr. Rebwar Mustafa', '+964 750 882 1900', 'IRQ-EBL-33910', 'EBL 10045', 100),
  ('202', 2, 'FLOOR_02_EXEC', 'Twin', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.5, false, NULL, NULL, NULL, NULL, 100),
  ('203', 2, 'FLOOR_02_EXEC', 'Single', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 21.8, true, 'Shwan Dizayee', '+964 750 321 7741', 'IRQ-EBL-77412', 'EBL 77019', 90),
  ('204', 2, 'FLOOR_02_EXEC', 'Twin', 100000, 76.34, 'vacant', 'clean', 'awaiting_inspection', 'in_service', false, 21.5, false, NULL, NULL, NULL, NULL, 100),
  ('205', 2, 'FLOOR_02_EXEC', 'Twin', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.0, false, NULL, NULL, NULL, NULL, 100),
  ('206', 2, 'FLOOR_02_EXEC', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'out_of_service', false, 25.0, false, NULL, NULL, NULL, NULL, 100),
  ('207', 2, 'FLOOR_02_EXEC', 'Twin', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 21.2, true, 'Aso Hawrami', '+964 770 554 1188', 'IRQ-SLM-55411', 'SLM 31029', 100),
  ('208', 2, 'FLOOR_02_EXEC', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.0, false, NULL, NULL, NULL, NULL, 100),

  -- FLOOR 3: LEVANTINE GALLERY FLOOR (301-308)
  ('301', 3, 'FLOOR_03_GALLERY', 'Twin', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 21.0, true, 'Haval Zebari', '+964 750 911 2201', 'IRQ-DHK-91122', 'DHK 50211', 100),
  ('302', 3, 'FLOOR_03_GALLERY', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.4, false, NULL, NULL, NULL, NULL, 100),
  ('303', 3, 'FLOOR_03_GALLERY', 'Twin', 100000, 76.34, 'vacant', 'dirty', 'failed', 'in_service', false, 23.1, false, NULL, NULL, NULL, NULL, 100),
  ('304', 3, 'FLOOR_03_GALLERY', 'Single', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 21.5, true, 'Narin Qadir', '+964 770 401 9981', 'IRQ-SLM-40199', 'SLM 88321', 75),
  ('305', 3, 'FLOOR_03_GALLERY', 'Twin', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.0, false, NULL, NULL, NULL, NULL, 100),
  ('306', 3, 'FLOOR_03_GALLERY', 'Single', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 20.8, true, 'Soran Karim', '+964 750 612 4490', 'IRQ-EBL-61244', 'EBL 61244', 100),
  ('307', 3, 'FLOOR_03_GALLERY', 'Twin', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.5, false, NULL, NULL, NULL, NULL, 100),
  ('308', 3, 'FLOOR_03_GALLERY', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.2, false, NULL, NULL, NULL, NULL, 100),

  -- FLOOR 4: CITADEL MERIDIAN FLOOR (401-408)
  ('401', 4, 'FLOOR_04_MERIDIAN', 'Executive Suite', 150000, 114.50, 'occupied', 'clean', 'passed', 'in_service', true, 20.5, true, 'Tariq Al-Mansoor', '+964 780 112 9001', 'IRQ-BGD-11290', 'BGD 11002', 100),
  ('402', 4, 'FLOOR_04_MERIDIAN', 'Twin', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.5, false, NULL, NULL, NULL, NULL, 100),
  ('403', 4, 'FLOOR_04_MERIDIAN', 'Single', 100000, 76.34, 'vacant', 'dirty', 'awaiting_inspection', 'in_service', false, 22.8, false, NULL, NULL, NULL, NULL, 100),
  ('404', 4, 'FLOOR_04_MERIDIAN', 'Twin', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 21.0, true, 'Zana Jaff', '+964 770 889 1234', 'IRQ-SLM-88912', 'SLM 45019', 100),
  ('405', 4, 'FLOOR_04_MERIDIAN', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.2, false, NULL, NULL, NULL, NULL, 100),
  ('406', 4, 'FLOOR_04_MERIDIAN', 'Twin', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 21.6, true, 'Lana Othman', '+964 750 773 1920', 'IRQ-EBL-77319', 'EBL 92014', 85),
  ('407', 4, 'FLOOR_04_MERIDIAN', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.0, false, NULL, NULL, NULL, NULL, 100),
  ('408', 4, 'FLOOR_04_MERIDIAN', 'Twin', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.1, false, NULL, NULL, NULL, NULL, 100),

  -- FLOOR 5: DIPLOMATIC & CONSULAR WING (501-508)
  ('501', 5, 'FLOOR_05_DIPLOMATIC', 'Diplomatic Suite', 220000, 167.94, 'occupied', 'clean', 'passed', 'in_service', true, 20.0, true, 'Envoy Henri Laurent', '+964 750 001 9920', 'DIP-FRA-88201', 'CD 019 EBL', 100),
  ('502', 5, 'FLOOR_05_DIPLOMATIC', 'Executive Suite', 150000, 114.50, 'occupied', 'clean', 'passed', 'in_service', true, 20.5, true, 'Consul Elena Vance', '+964 750 009 4412', 'DIP-EU-44102', 'CD 042 EBL', 100),
  ('503', 5, 'FLOOR_05_DIPLOMATIC', 'Twin', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.0, false, NULL, NULL, NULL, NULL, 100),
  ('504', 5, 'FLOOR_05_DIPLOMATIC', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'out_of_service', false, 24.5, false, NULL, NULL, NULL, NULL, 100),
  ('505', 5, 'FLOOR_05_DIPLOMATIC', 'Twin', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', true, 21.0, true, 'Brig. Gen. Kawa Amin', '+964 770 900 1122', 'IRQ-GOV-90011', 'GOV 1102', 100),
  ('506', 5, 'FLOOR_05_DIPLOMATIC', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.0, false, NULL, NULL, NULL, NULL, 100),
  ('507', 5, 'FLOOR_05_DIPLOMATIC', 'Twin', 100000, 76.34, 'vacant', 'dirty', 'awaiting_inspection', 'in_service', false, 22.2, false, NULL, NULL, NULL, NULL, 100),
  ('508', 5, 'FLOOR_05_DIPLOMATIC', 'Executive Suite', 150000, 114.50, 'vacant', 'clean', 'passed', 'in_service', true, 20.8, false, NULL, NULL, NULL, NULL, 100),

  -- FLOOR 6: SOVEREIGN PENTHOUSE & CHAIRMAN GALLERY (601-608)
  ('601', 6, 'FLOOR_06_PENTHOUSE', 'Royal Penthouse', 350000, 267.18, 'occupied', 'clean', 'passed', 'in_service', true, 19.8, true, 'Sheikh Farhad Al-Sabah', '+964 750 999 0001', 'VIP-KWT-00019', 'VIP 0001', 100),
  ('602', 6, 'FLOOR_06_PENTHOUSE', 'Diplomatic Suite', 220000, 167.94, 'occupied', 'clean', 'passed', 'in_service', true, 20.2, true, 'Marcus Sterling // Sovereign Fund', '+964 750 888 4100', 'GBR-LON-99410', 'EBL 0009', 100),
  ('603', 6, 'FLOOR_06_PENTHOUSE', 'Executive Suite', 150000, 114.50, 'vacant', 'clean', 'passed', 'in_service', true, 20.5, false, NULL, NULL, NULL, NULL, 100),
  ('604', 6, 'FLOOR_06_PENTHOUSE', 'Twin', 100000, 76.34, 'occupied', 'clean', 'passed', 'in_service', false, 21.0, true, 'Rojan Nakshabandi', '+964 750 310 5599', 'IRQ-EBL-31055', 'EBL 31055', 60),
  ('605', 6, 'FLOOR_06_PENTHOUSE', 'Single', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.0, false, NULL, NULL, NULL, NULL, 100),
  ('606', 6, 'FLOOR_06_PENTHOUSE', 'Twin', 100000, 76.34, 'vacant', 'clean', 'passed', 'in_service', false, 21.0, false, NULL, NULL, NULL, NULL, 100),
  ('607', 6, 'FLOOR_06_PENTHOUSE', 'Executive Suite', 150000, 114.50, 'occupied', 'clean', 'passed', 'in_service', true, 20.4, true, 'Aria Rostami', '+964 770 219 8840', 'IRQ-SLM-21988', 'SLM 7711', 100),
  ('608', 6, 'FLOOR_06_PENTHOUSE', 'Royal Penthouse', 350000, 267.18, 'vacant', 'clean', 'passed', 'in_service', true, 20.0, false, NULL, NULL, NULL, NULL, 100)
ON CONFLICT (room_number) DO UPDATE SET
  floor = EXCLUDED.floor,
  floor_zone = EXCLUDED.floor_zone,
  room_type = EXCLUDED.room_type,
  base_rate_iqd = EXCLUDED.base_rate_iqd,
  base_rate_usd = EXCLUDED.base_rate_usd,
  is_vip = EXCLUDED.is_vip,
  updated_at = NOW();
