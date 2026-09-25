-- ========== TRANSIT REFERENCE DATA ==========
CREATE TABLE public.stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  area text,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stops TO anon, authenticated;
GRANT ALL ON public.stops TO service_role;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stops are public" ON public.stops FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_no text NOT NULL UNIQUE,
  name text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.routes TO anon, authenticated;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routes are public" ON public.routes FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  direction smallint NOT NULL DEFAULT 0,
  seq integer NOT NULL,
  UNIQUE (route_id, direction, seq)
);
GRANT SELECT ON public.route_stops TO anon, authenticated;
GRANT ALL ON public.route_stops TO service_role;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "route_stops are public" ON public.route_stops FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.route_shapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  direction smallint NOT NULL DEFAULT 0,
  coordinates jsonb NOT NULL,
  UNIQUE (route_id, direction)
);
GRANT SELECT ON public.route_shapes TO anon, authenticated;
GRANT ALL ON public.route_shapes TO service_role;
ALTER TABLE public.route_shapes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "route_shapes are public" ON public.route_shapes FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_no text NOT NULL UNIQUE,
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.buses TO anon, authenticated;
GRANT ALL ON public.buses TO service_role;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buses are public" ON public.buses FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  bus_id uuid REFERENCES public.buses(id) ON DELETE SET NULL,
  direction smallint NOT NULL DEFAULT 0,
  departure_time time NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trips TO anon, authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips are public" ON public.trips FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.stop_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  arrival_time time NOT NULL,
  UNIQUE (trip_id, seq)
);
GRANT SELECT ON public.stop_times TO anon, authenticated;
GRANT ALL ON public.stop_times TO service_role;
ALTER TABLE public.stop_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stop_times are public" ON public.stop_times FOR SELECT TO anon, authenticated USING (true);

-- ========== PASSENGER FEATURES ==========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.saved_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  alarm_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stop_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_stops TO authenticated;
GRANT ALL ON public.saved_stops TO service_role;
ALTER TABLE public.saved_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved stops" ON public.saved_stops FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.tracking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  destination_stop_id uuid REFERENCES public.stops(id) ON DELETE SET NULL,
  alarm_enabled boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_ping_at timestamptz,
  ended_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.tracking_sessions TO authenticated;
GRANT ALL ON public.tracking_sessions TO service_role;
ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions read" ON public.tracking_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own sessions insert" ON public.tracking_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own sessions update" ON public.tracking_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.bus_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  session_id uuid NOT NULL REFERENCES public.tracking_sessions(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  accuracy double precision,
  speed double precision,
  heading double precision,
  is_demo boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bus_locations_bus_recent_idx ON public.bus_locations (bus_id, recorded_at DESC);
GRANT SELECT ON public.bus_locations TO anon, authenticated;
GRANT INSERT ON public.bus_locations TO authenticated;
GRANT ALL ON public.bus_locations TO service_role;
ALTER TABLE public.bus_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bus locations are public" ON public.bus_locations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert own session pings" ON public.bus_locations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tracking_sessions s
    WHERE s.id = session_id AND s.user_id = auth.uid() AND s.ended_at IS NULL
  ));

-- anonymous count of passengers currently tracking a bus
CREATE OR REPLACE FUNCTION public.tracking_count(_bus_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.tracking_sessions
  WHERE bus_id = _bus_id
    AND ended_at IS NULL
    AND last_ping_at > now() - interval '2 minutes';
$$;
GRANT EXECUTE ON FUNCTION public.tracking_count(uuid) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_sessions;

-- ========== DEMO PUNE / PMPML SEED DATA ==========
INSERT INTO public.stops (code, name, area, lat, lon) VALUES
  ('PMC',  'PMC (Municipal Corporation)', 'Shivajinagar', 18.5314, 73.8547),
  ('SHVN', 'Shivajinagar Bus Stand', 'Shivajinagar', 18.5308, 73.8478),
  ('DECC', 'Deccan Gymkhana', 'Deccan', 18.5157, 73.8415),
  ('SWRG', 'Swargate', 'Swargate', 18.5010, 73.8586),
  ('MKTY', 'Market Yard', 'Gultekdi', 18.4874, 73.8695),
  ('KTRJ', 'Katraj Depot', 'Katraj', 18.4529, 73.8578),
  ('KOTH', 'Kothrud Depot', 'Kothrud', 18.5074, 73.8077),
  ('KRVN', 'Karve Nagar', 'Karve Nagar', 18.4926, 73.8177),
  ('WRJE', 'Warje Bridge', 'Warje', 18.4842, 73.7987),
  ('PUNE', 'Pune Station', 'Pune Camp', 18.5286, 73.8743),
  ('MGRD', 'MG Road Camp', 'Camp', 18.5147, 73.8786),
  ('HDPR', 'Hadapsar Gadital', 'Hadapsar', 18.5089, 73.9260),
  ('MGRP', 'Magarpatta City', 'Hadapsar', 18.5158, 73.9270),
  ('VMAN', 'Viman Nagar', 'Viman Nagar', 18.5679, 73.9143),
  ('YRWD', 'Yerawada', 'Yerawada', 18.5510, 73.8800),
  ('AUND', 'Aundh Gaon', 'Aundh', 18.5590, 73.8070),
  ('UNIV', 'Pune University', 'Ganeshkhind', 18.5529, 73.8253),
  ('HNJW', 'Hinjawadi Phase 1', 'Hinjawadi', 18.5983, 73.7125),
  ('BANR', 'Baner Road', 'Baner', 18.5590, 73.7868),
  ('NGDW', 'Nigdi Bhakti Shakti', 'Nigdi', 18.6550, 73.7610);

INSERT INTO public.routes (route_no, name, origin, destination) VALUES
  ('103', 'Katraj Depot – Kothrud Depot', 'Katraj Depot', 'Kothrud Depot'),
  ('215', 'Pune Station – Hinjawadi Phase 1', 'Pune Station', 'Hinjawadi Phase 1'),
  ('58',  'Swargate – Viman Nagar', 'Swargate', 'Viman Nagar'),
  ('292', 'Nigdi Bhakti Shakti – Hadapsar Gadital', 'Nigdi Bhakti Shakti', 'Hadapsar Gadital');

-- route 103
INSERT INTO public.route_stops (route_id, stop_id, direction, seq)
SELECT r.id, s.id, 0, x.seq FROM public.routes r
JOIN (VALUES ('KTRJ',1),('MKTY',2),('SWRG',3),('SHVN',4),('PMC',5),('DECC',6),('KRVN',7),('KOTH',8)) AS x(code, seq)
  ON true JOIN public.stops s ON s.code = x.code
WHERE r.route_no = '103';
-- route 215
INSERT INTO public.route_stops (route_id, stop_id, direction, seq)
SELECT r.id, s.id, 0, x.seq FROM public.routes r
JOIN (VALUES ('PUNE',1),('SHVN',2),('UNIV',3),('AUND',4),('BANR',5),('HNJW',6)) AS x(code, seq)
  ON true JOIN public.stops s ON s.code = x.code
WHERE r.route_no = '215';
-- route 58
INSERT INTO public.route_stops (route_id, stop_id, direction, seq)
SELECT r.id, s.id, 0, x.seq FROM public.routes r
JOIN (VALUES ('SWRG',1),('MGRD',2),('PUNE',3),('YRWD',4),('VMAN',5)) AS x(code, seq)
  ON true JOIN public.stops s ON s.code = x.code
WHERE r.route_no = '58';
-- route 292
INSERT INTO public.route_stops (route_id, stop_id, direction, seq)
SELECT r.id, s.id, 0, x.seq FROM public.routes r
JOIN (VALUES ('NGDW',1),('AUND',2),('SHVN',3),('PMC',4),('PUNE',5),('MGRD',6),('HDPR',7),('MGRP',8)) AS x(code, seq)
  ON true JOIN public.stops s ON s.code = x.code
WHERE r.route_no = '292';

-- reverse directions mirror the forward stop order
INSERT INTO public.route_stops (route_id, stop_id, direction, seq)
SELECT rs.route_id, rs.stop_id, 1,
       (SELECT count(*) FROM public.route_stops z WHERE z.route_id = rs.route_id AND z.direction = 0) + 1 - rs.seq
FROM public.route_stops rs WHERE rs.direction = 0;

-- map line for each route/direction, from its stop order
INSERT INTO public.route_shapes (route_id, direction, coordinates)
SELECT rs.route_id, rs.direction,
       jsonb_agg(jsonb_build_array(s.lon, s.lat) ORDER BY rs.seq)
FROM public.route_stops rs JOIN public.stops s ON s.id = rs.stop_id
GROUP BY rs.route_id, rs.direction;

INSERT INTO public.buses (bus_no, route_id)
SELECT x.bus_no, r.id FROM (VALUES
  ('MH12-TR-1031','103'),('MH12-TR-1032','103'),
  ('MH12-TR-2151','215'),('MH12-TR-2152','215'),
  ('MH12-TR-0581','58'),('MH12-TR-2921','292')
) AS x(bus_no, route_no) JOIN public.routes r ON r.route_no = x.route_no;

-- daily departures every 30 min, 06:00–22:00, both directions
INSERT INTO public.trips (route_id, bus_id, direction, departure_time)
SELECT b.route_id, b.id, d.direction, (time '06:00' + (g.n * interval '30 minutes'))
FROM public.buses b
CROSS JOIN generate_series(0, 32) AS g(n)
CROSS JOIN (VALUES (0::smallint),(1::smallint)) AS d(direction)
WHERE (g.n + CASE WHEN d.direction = 0 THEN 0 ELSE 1 END) % 2 = 0;

-- scheduled time at each stop: ~4 minutes between stops
INSERT INTO public.stop_times (trip_id, stop_id, seq, arrival_time)
SELECT t.id, rs.stop_id, rs.seq, t.departure_time + ((rs.seq - 1) * interval '4 minutes')
FROM public.trips t
JOIN public.route_stops rs ON rs.route_id = t.route_id AND rs.direction = t.direction;