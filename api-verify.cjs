const fs = require("fs");
const env = fs.readFileSync(".env", "utf-8");
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.+)/);
const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(url, key);

async function verifyAPI() {
  console.log("====================================================");
  console.log("            SUPABASE API VERIFICATION              ");
  console.log("====================================================\n");

  // 1. Home / Stops
  console.log("--- 1. Home / Stops Query ---");
  console.log(
    'Query: supabase.from("stops").select("stop_id, stop_name, stop_lat, stop_lon").order("stop_name")',
  );
  const q1 = await supabase
    .from("stops")
    .select("stop_id, stop_name, stop_lat, stop_lon")
    .order("stop_name");
  if (q1.error) {
    console.log("Error:", q1.error);
  } else {
    console.log("Rows Returned:", q1.data.length);
    console.log("First Row:", JSON.stringify(q1.data[0], null, 2));
  }

  // 2. Nearby Stops (Calculate top 10 nearest from Pune center 18.5204, 73.8567)
  console.log("\n--- 2. Nearby Stops Calculation ---");
  function dist(a, b) {
    const dLat = (b.lat - a.lat) * (Math.PI / 180);
    const dLon = (b.lon - a.lon) * (Math.PI / 180);
    const lat1 = a.lat * (Math.PI / 180);
    const lat2 = b.lat * (Math.PI / 180);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  const userLoc = { lat: 18.5204, lon: 73.8567 };
  const sortedStops = (q1.data || [])
    .map((s) => ({
      stop_id: s.stop_id,
      name: s.stop_name,
      distance_meters: Math.round(
        dist(userLoc, { lat: s.stop_lat, lon: s.stop_lon }),
      ),
    }))
    .sort((a, b) => a.distance_meters - b.distance_meters)
    .slice(0, 10);
  console.log("Top 10 Nearest Stops from GPS (18.5204, 73.8567):");
  console.table(sortedStops);

  // 3. Upcoming Buses (Stop 319)
  console.log("\n--- 3. Upcoming Buses Query (Stop 319) ---");
  const now = new Date();
  const nowH = String(now.getHours()).padStart(2, "0");
  const nowM = String(now.getMinutes()).padStart(2, "0");
  const nowS = String(now.getSeconds()).padStart(2, "0");
  const nowTime = `${nowH}:${nowM}:${nowS}`;
  console.log(
    `Query: supabase.from("stop_times").select("trip_id, arrival_time, departure_time, stop_id, stop_sequence").eq("stop_id", "319").gte("arrival_time", "${nowTime}").order("arrival_time").limit(30)`,
  );
  const q3 = await supabase
    .from("stop_times")
    .select("trip_id, arrival_time, departure_time, stop_id, stop_sequence")
    .eq("stop_id", "319")
    .gte("arrival_time", nowTime)
    .order("arrival_time", { ascending: true })
    .limit(30);

  if (q3.error) {
    console.log("Error:", q3.error);
  } else {
    console.log("Rows Returned:", q3.data.length);
    console.log("First Row:", JSON.stringify(q3.data[0], null, 2));

    // Join with trips & routes
    if (q3.data.length > 0) {
      const tripIds = [...new Set(q3.data.map((s) => s.trip_id))];
      const trips = await supabase
        .from("trips")
        .select("trip_id, route_id, trip_headsign")
        .in("trip_id", tripIds);
      const routeIds = [...new Set((trips.data || []).map((t) => t.route_id))];
      const routes = await supabase
        .from("routes")
        .select("route_id, route_short_name, route_long_name")
        .in("route_id", routeIds);

      const tripMap = new Map((trips.data || []).map((t) => [t.trip_id, t]));
      const routeMap = new Map(
        (routes.data || []).map((r) => [r.route_id, r.route_short_name]),
      );
      const firstTrip = tripMap.get(q3.data[0].trip_id);
      const firstRouteNo = firstTrip
        ? routeMap.get(firstTrip.route_id)
        : "Unknown";

      const parts = q3.data[0].arrival_time.split(":");
      const arrMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      const curMin = now.getHours() * 60 + now.getMinutes();
      console.log("Resolved First Upcoming Bus:");
      console.log({
        route_no: firstRouteNo,
        destination: firstTrip?.trip_headsign,
        arrival_time: q3.data[0].arrival_time,
        eta_minutes: Math.max(0, arrMin - curMin),
      });
    }
  }

  // 4. Nearby Buses (Batch query for 10 stops)
  console.log("\n--- 4. Nearby Buses Batch Query ---");
  const stopIds = sortedStops.map((s) => s.stop_id);
  console.log(
    `Query: supabase.from("stop_times").select("trip_id, arrival_time, stop_id").in("stop_id", [${stopIds.slice(0, 3).join(",")}...]).gte("arrival_time", "${nowTime}").order("arrival_time").limit(120)`,
  );
  const q4 = await supabase
    .from("stop_times")
    .select("trip_id, arrival_time, stop_id")
    .in("stop_id", stopIds)
    .gte("arrival_time", nowTime)
    .order("arrival_time", { ascending: true })
    .limit(120);

  if (q4.error) {
    console.log("Error:", q4.error);
  } else {
    console.log("Rows Returned:", q4.data.length);
    console.log("First Row:", JSON.stringify(q4.data[0], null, 2));
  }

  // 5. Routes
  console.log("\n--- 5. Routes Query ---");
  console.log(
    'Query: supabase.from("routes").select("route_id, route_short_name, route_long_name").order("route_short_name")',
  );
  const q5 = await supabase
    .from("routes")
    .select("route_id, route_short_name, route_long_name")
    .order("route_short_name");
  if (q5.error) {
    console.log("Error:", q5.error);
  } else {
    console.log("Rows Returned:", q5.data.length);
    console.log("First Row:", JSON.stringify(q5.data[0], null, 2));
  }

  // 6. Route Details (Route 108)
  console.log("\n--- 6. Route Details Query (Route 108) ---");
  console.log(
    'Query: supabase.from("trips").select("trip_id, shape_id, trip_headsign").eq("route_id", "108").limit(1)',
  );
  const q6Trip = await supabase
    .from("trips")
    .select("trip_id, shape_id, trip_headsign")
    .eq("route_id", "108")
    .limit(1);
  if (q6Trip.error) {
    console.log("Trip Query Error:", q6Trip.error);
  } else {
    console.log("Trip Row:", JSON.stringify(q6Trip.data[0], null, 2));
    const tripId = q6Trip.data[0].trip_id;
    console.log(
      `Query: supabase.from("stop_times").select("stop_id, stop_sequence, arrival_time, departure_time").eq("trip_id", "${tripId}").order("stop_sequence")`,
    );
    const q6Stops = await supabase
      .from("stop_times")
      .select("stop_id, stop_sequence, arrival_time, departure_time")
      .eq("trip_id", tripId)
      .order("stop_sequence");
    console.log("Stop Times Count for Route 108:", q6Stops.data?.length);
    console.log(
      "First Stop Time Row:",
      JSON.stringify(q6Stops.data?.[0], null, 2),
    );
  }
}

verifyAPI();
