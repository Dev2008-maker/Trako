const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function main() {
  console.log('Building Route Explorer GTFS dataset...');

  // 1. Read stops.txt
  const stops = new Map();
  const stopLines = fs.readFileSync('data/gtfs/stops.txt', 'utf8').split('\n');
  for (let i = 1; i < stopLines.length; i++) {
    const line = stopLines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    stops.set(parts[0], {
      stopId: parts[0],
      name: parts[1] ? parts[1].trim() : '',
      lat: parseFloat(parts[2]),
      lon: parseFloat(parts[3]),
    });
  }
  console.log(`Loaded ${stops.size} stops.`);

  // 2. Read routes.txt
  const routes = new Map();
  const routeLines = fs.readFileSync('data/gtfs/routes.txt', 'utf8').split('\n');
  for (let i = 1; i < routeLines.length; i++) {
    const line = routeLines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    const id = parts[0];
    const shortName = parts[2];
    const longName = parts[3] ? parts[3].trim() : '';
    let origin = '';
    let destination = '';
    if (longName.includes('⇆')) {
      const sp = longName.split('⇆');
      origin = sp[0].trim();
      destination = sp[1].trim();
    } else if (longName.includes('to')) {
      const sp = longName.split('to');
      origin = sp[0].trim();
      destination = sp[1].trim();
    } else {
      origin = longName;
      destination = longName;
    }
    routes.set(id, { id, shortName, longName, origin, destination });
  }
  console.log(`Loaded ${routes.size} routes.`);

  // 3. Read trips.txt
  // For each route, find: representative trip_id (max stops or direction 0), all trip_ids, shape_id
  const routeTrips = new Map(); // route_id -> [{ trip_id, shape_id, direction_id }]
  const tripToRoute = new Map(); // trip_id -> route_id
  const tripLines = fs.readFileSync('data/gtfs/trips.txt', 'utf8').split('\n');
  for (let i = 1; i < tripLines.length; i++) {
    const line = tripLines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    const route_id = parts[0];
    const trip_id = parts[2];
    const shape_id = parts[7] || parts[6];
    const direction_id = parseInt(parts[5], 10) || 0;
    if (!routeTrips.has(route_id)) routeTrips.set(route_id, []);
    routeTrips.get(route_id).push({ trip_id, shape_id, direction_id });
    tripToRoute.set(trip_id, route_id);
  }
  console.log(`Loaded trips for ${routeTrips.size} routes.`);

  // 4. Read shapes.txt (sampled to keep shape lightweight and smooth)
  const shapePoints = new Map(); // shape_id -> [[lon, lat], ...]
  const shapeRl = readline.createInterface({
    input: fs.createReadStream('data/gtfs/shapes.txt'),
    crlfDelay: Infinity,
  });
  let shapeHeader = true;
  for await (const line of shapeRl) {
    if (shapeHeader) { shapeHeader = false; continue; }
    if (!line.trim()) continue;
    const [shape_id, pt_lat, pt_lon, seq] = line.split(',');
    if (!shapePoints.has(shape_id)) shapePoints.set(shape_id, []);
    shapePoints.get(shape_id).push({
      lat: parseFloat(pt_lat),
      lon: parseFloat(pt_lon),
      seq: parseInt(seq, 10),
    });
  }
  console.log(`Loaded ${shapePoints.size} unique shapes.`);

  // Sort and simplify shapes: keep ~60 points per shape max
  const processedShapes = new Map();
  for (const [id, pts] of shapePoints.entries()) {
    pts.sort((a, b) => a.seq - b.seq);
    const coords = pts.map(p => [Number(p.lon.toFixed(5)), Number(p.lat.toFixed(5))]);
    if (coords.length > 70) {
      const step = Math.ceil(coords.length / 60);
      const sampled = [];
      for (let i = 0; i < coords.length; i += step) {
        sampled.push(coords[i]);
      }
      if (sampled[sampled.length - 1] !== coords[coords.length - 1]) {
        sampled.push(coords[coords.length - 1]);
      }
      processedShapes.set(id, sampled);
    } else {
      processedShapes.set(id, coords);
    }
  }

  // 5. Read stop_times.txt
  // For each route, collect: first bus time, last bus time, and ordered stops for representative trip
  const routeStopTimes = new Map(); // route_id -> { times: [arrTimes...], trips: Map<trip_id, [stop_time]> }
  const stopTimesRl = readline.createInterface({
    input: fs.createReadStream('data/gtfs/stop_times.txt'),
    crlfDelay: Infinity,
  });
  let stHeader = true;
  for await (const line of stopTimesRl) {
    if (stHeader) { stHeader = false; continue; }
    if (!line.trim()) continue;
    const [trip_id, arrival_time, departure_time, stop_id, stop_sequence] = line.split(',');
    const route_id = tripToRoute.get(trip_id);
    if (!route_id) continue;

    if (!routeStopTimes.has(route_id)) {
      routeStopTimes.set(route_id, {
        firstDepartureList: [],
        repTripId: null,
        repTripStops: new Map(), // trip_id -> []
      });
    }
    const rData = routeStopTimes.get(route_id);
    const seq = parseInt(stop_sequence, 10);
    if (seq === 1 && departure_time) {
      rData.firstDepartureList.push(departure_time.trim());
    }

    // Only store stop details for the first 2 trips per route to keep memory low
    if (!rData.repTripStops.has(trip_id) && rData.repTripStops.size < 2) {
      rData.repTripStops.set(trip_id, []);
    }
    if (rData.repTripStops.has(trip_id)) {
      rData.repTripStops.get(trip_id).push({
        stopId: stop_id,
        seq,
        arr: arrival_time ? arrival_time.trim() : '08:00:00',
        dep: departure_time ? departure_time.trim() : '08:00:00',
      });
    }
  }
  console.log(`Processed stop_times for ${routeStopTimes.size} routes.`);

  // 6. Build final route explorer cards dataset & details dataset
  const explorerRoutes = [];
  const routeDetails = {};

  function formatTimeAmPm(timeStr) {
    if (!timeStr) return '06:00 AM';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (h >= 24) h = h - 24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH.toString().padStart(2, '0')}:${m} ${ampm}`;
  }

  for (const [routeId, r] of routes.entries()) {
    const trips = routeTrips.get(routeId) || [];
    const stData = routeStopTimes.get(routeId);

    // Pick best representative trip (the one with the most stops)
    let bestTrip = null;
    let bestStops = [];
    if (stData && stData.repTripStops) {
      for (const [tId, sList] of stData.repTripStops.entries()) {
        if (sList.length > bestStops.length) {
          bestStops = sList;
          bestTrip = trips.find(t => t.trip_id === tId) || { trip_id: tId, shape_id: null };
        }
      }
    }
    if (!bestTrip && trips.length > 0) {
      bestTrip = trips[0];
    }

    bestStops.sort((a, b) => a.seq - b.seq);

    // First and last bus times
    let firstBus = '05:45 AM';
    let lastBus = '10:45 PM';
    if (stData && stData.firstDepartureList.length > 0) {
      const sortedTimes = [...stData.firstDepartureList].sort();
      firstBus = formatTimeAmPm(sortedTimes[0]);
      lastBus = formatTimeAmPm(sortedTimes[sortedTimes.length - 1]);
    }

    // Frequency
    const totalTrips = trips.length || 20;
    let frequency = 'Every 15-20 mins';
    if (totalTrips >= 100) frequency = 'Every 5-8 mins';
    else if (totalTrips >= 50) frequency = 'Every 10-12 mins';
    else if (totalTrips >= 25) frequency = 'Every 15-20 mins';
    else if (totalTrips >= 10) frequency = 'Every 25-30 mins';
    else frequency = 'Every 40-50 mins';

    // Stop names for searching
    const resolvedStops = bestStops.map((bs, index) => {
      const s = stops.get(bs.stopId);
      return {
        stopId: bs.stopId,
        name: s ? s.name : `Stop ${index + 1}`,
        lat: s ? s.lat : 18.5204,
        lon: s ? s.lon : 73.8567,
        sequence: index + 1,
        scheduledArrival: formatTimeAmPm(bs.arr),
        scheduledDeparture: formatTimeAmPm(bs.dep),
      };
    });

    const stopNames = resolvedStops.map(s => s.name);
    const originStopName = resolvedStops[0]?.name || r.origin;
    const destStopName = resolvedStops[resolvedStops.length - 1]?.name || r.destination;

    // Get shape
    let shape = [];
    if (bestTrip && bestTrip.shape_id && processedShapes.has(bestTrip.shape_id)) {
      shape = processedShapes.get(bestTrip.shape_id);
    } else if (resolvedStops.length > 1) {
      shape = resolvedStops.map(s => [s.lon, s.lat]);
    }

    explorerRoutes.push({
      id: routeId,
      shortName: r.shortName,
      longName: r.longName,
      origin: originStopName,
      destination: destStopName,
      stopsCount: resolvedStops.length || 24,
      operatingStatus: 'Active · Regular Service',
      firstBus,
      lastBus,
      frequency,
      totalTrips,
      stopNames: stopNames.slice(0, 10), // first 10 for search index
    });

    routeDetails[routeId] = {
      routeId,
      shortName: r.shortName,
      longName: r.longName,
      origin: originStopName,
      destination: destStopName,
      firstBus,
      lastBus,
      frequency,
      stops: resolvedStops,
      shape,
    };
  }

  // Sort routes naturally by route shortName
  explorerRoutes.sort((a, b) => {
    const aNum = parseInt(a.shortName, 10);
    const bNum = parseInt(b.shortName, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
      return a.shortName.localeCompare(b.shortName);
    }
    return a.shortName.localeCompare(b.shortName);
  });

  // Write explorerRoutes.json and routeDetails.json
  fs.writeFileSync('src/data/gtfsExplorerRoutes.json', JSON.stringify(explorerRoutes, null, 2), 'utf8');
  fs.writeFileSync('src/data/gtfsRouteDetails.json', JSON.stringify(routeDetails), 'utf8');

  console.log(`Successfully generated:`);
  console.log(`- src/data/gtfsExplorerRoutes.json (${(fs.statSync('src/data/gtfsExplorerRoutes.json').size / 1024).toFixed(1)} KB)`);
  console.log(`- src/data/gtfsRouteDetails.json (${(fs.statSync('src/data/gtfsRouteDetails.json').size / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
