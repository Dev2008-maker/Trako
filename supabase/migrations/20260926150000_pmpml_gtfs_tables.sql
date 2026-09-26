-- ========== PMPML GTFS DATA LAYER TABLES ==========

-- 1. gtfs_calendar
CREATE TABLE IF NOT EXISTS public.gtfs_calendar (
  service_id text PRIMARY KEY,
  monday integer NOT NULL DEFAULT 1,
  tuesday integer NOT NULL DEFAULT 1,
  wednesday integer NOT NULL DEFAULT 1,
  thursday integer NOT NULL DEFAULT 1,
  friday integer NOT NULL DEFAULT 1,
  saturday integer NOT NULL DEFAULT 1,
  sunday integer NOT NULL DEFAULT 1,
  start_date text NOT NULL,
  end_date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. gtfs_routes
CREATE TABLE IF NOT EXISTS public.gtfs_routes (
  route_id text PRIMARY KEY,
  agency_id text NOT NULL DEFAULT 'PMPML',
  route_short_name text NOT NULL,
  route_long_name text NOT NULL,
  route_type integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. gtfs_stops
CREATE TABLE IF NOT EXISTS public.gtfs_stops (
  stop_id text PRIMARY KEY,
  stop_name text NOT NULL,
  stop_lat double precision NOT NULL,
  stop_lon double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. gtfs_shapes
CREATE TABLE IF NOT EXISTS public.gtfs_shapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shape_id text NOT NULL,
  shape_pt_lat double precision NOT NULL,
  shape_pt_lon double precision NOT NULL,
  shape_pt_sequence integer NOT NULL,
  CONSTRAINT gtfs_shapes_unique UNIQUE (shape_id, shape_pt_sequence)
);

-- 5. gtfs_trips
CREATE TABLE IF NOT EXISTS public.gtfs_trips (
  trip_id text PRIMARY KEY,
  route_id text NOT NULL REFERENCES public.gtfs_routes(route_id) ON DELETE CASCADE,
  service_id text NOT NULL REFERENCES public.gtfs_calendar(service_id) ON DELETE CASCADE,
  trip_headsign text,
  direction_id integer NOT NULL DEFAULT 0,
  shape_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. gtfs_stop_times
CREATE TABLE IF NOT EXISTS public.gtfs_stop_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id text NOT NULL REFERENCES public.gtfs_trips(trip_id) ON DELETE CASCADE,
  arrival_time text NOT NULL,
  departure_time text NOT NULL,
  stop_id text NOT NULL REFERENCES public.gtfs_stops(stop_id) ON DELETE CASCADE,
  stop_sequence integer NOT NULL,
  timepoint integer DEFAULT 0,
  CONSTRAINT gtfs_stop_times_unique UNIQUE (trip_id, stop_sequence)
);

-- ========== INDEXES ==========
CREATE INDEX IF NOT EXISTS idx_gtfs_routes_short_name ON public.gtfs_routes (route_short_name);
CREATE INDEX IF NOT EXISTS idx_gtfs_routes_id ON public.gtfs_routes (route_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stops_name ON public.gtfs_stops (stop_name);
CREATE INDEX IF NOT EXISTS idx_gtfs_stops_id ON public.gtfs_stops (stop_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_id ON public.gtfs_trips (trip_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_route ON public.gtfs_trips (route_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_shape ON public.gtfs_trips (shape_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_service ON public.gtfs_trips (service_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_trip ON public.gtfs_stop_times (trip_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_stop_times_stop ON public.gtfs_stop_times (stop_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_shapes_shape_id ON public.gtfs_shapes (shape_id);

-- ========== PERMISSIONS & ROW LEVEL SECURITY ==========
GRANT SELECT ON public.gtfs_calendar TO anon, authenticated;
GRANT SELECT ON public.gtfs_routes TO anon, authenticated;
GRANT SELECT ON public.gtfs_stops TO anon, authenticated;
GRANT SELECT ON public.gtfs_shapes TO anon, authenticated;
GRANT SELECT ON public.gtfs_trips TO anon, authenticated;
GRANT SELECT ON public.gtfs_stop_times TO anon, authenticated;

GRANT ALL ON public.gtfs_calendar TO service_role;
GRANT ALL ON public.gtfs_routes TO service_role;
GRANT ALL ON public.gtfs_stops TO service_role;
GRANT ALL ON public.gtfs_shapes TO service_role;
GRANT ALL ON public.gtfs_trips TO service_role;
GRANT ALL ON public.gtfs_stop_times TO service_role;

ALTER TABLE public.gtfs_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_stop_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public gtfs_calendar read" ON public.gtfs_calendar FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public gtfs_routes read" ON public.gtfs_routes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public gtfs_stops read" ON public.gtfs_stops FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public gtfs_shapes read" ON public.gtfs_shapes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public gtfs_trips read" ON public.gtfs_trips FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public gtfs_stop_times read" ON public.gtfs_stop_times FOR SELECT TO anon, authenticated USING (true);

-- Allow import scripts using anon/authenticated or service_role
CREATE POLICY "allow gtfs_calendar insert" ON public.gtfs_calendar FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow gtfs_routes insert" ON public.gtfs_routes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow gtfs_stops insert" ON public.gtfs_stops FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow gtfs_shapes insert" ON public.gtfs_shapes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow gtfs_trips insert" ON public.gtfs_trips FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow gtfs_stop_times insert" ON public.gtfs_stop_times FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
