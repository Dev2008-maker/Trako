const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// Parse environment variables from .env
function getEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const [k, ...v] = line.split('=');
      if (k && v.length) {
        env[k.trim()] = v.join('=').trim().replace(/\r/g, '').replace(/^['"]|['"]$/g, '');
      }
    }
  }
  return {
    url: process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY,
  };
}

const { url, key } = getEnv();
if (!url || !key) {
  console.error('Missing Supabase URL or key in environment/.env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const GTFS_DIR = path.join(__dirname, '..', 'data', 'gtfs');

// Helper to stream CSV and return headers & reader
function createCsvReader(filename) {
  const filePath = path.join(GTFS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  return rl;
}

// 1. Import Calendar
async function importCalendar() {
  console.log('--- Importing gtfs_calendar ---');
  const rl = createCsvReader('calendar.txt');
  const rows = [];
  let isHeader = true;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) { isHeader = false; continue; }
    const parts = line.split(',');
    rows.push({
      service_id: parts[0]?.trim(),
      monday: parseInt(parts[1] || '1', 10),
      tuesday: parseInt(parts[2] || '1', 10),
      wednesday: parseInt(parts[3] || '1', 10),
      thursday: parseInt(parts[4] || '1', 10),
      friday: parseInt(parts[5] || '1', 10),
      saturday: parseInt(parts[6] || '1', 10),
      sunday: parseInt(parts[7] || '1', 10),
      start_date: parts[8]?.trim(),
      end_date: parts[9]?.trim(),
    });
  }

  const { error } = await supabase.from('gtfs_calendar').upsert(rows, { onConflict: 'service_id' });
  if (error) {
    console.warn('Note on calendar import:', error.message);
  } else {
    console.log(`Successfully upserted ${rows.length} calendar rows.`);
  }
}

// 2. Import Routes
async function importRoutes() {
  console.log('--- Importing gtfs_routes ---');
  const rl = createCsvReader('routes.txt');
  const rows = [];
  let isHeader = true;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) { isHeader = false; continue; }
    const parts = line.split(',');
    rows.push({
      route_id: parts[0]?.trim(),
      agency_id: parts[1]?.trim() || 'PMPML',
      route_short_name: parts[2]?.trim(),
      route_long_name: parts[3]?.trim(),
      route_type: parseInt(parts[4] || '3', 10),
    });
  }

  // Batch insert in chunks of 100
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from('gtfs_routes').upsert(chunk, { onConflict: 'route_id' });
    if (error) console.warn(`Routes batch ${i} warning:`, error.message);
  }
  console.log(`Successfully upserted ${rows.length} routes.`);
}

// 3. Import Stops
async function importStops() {
  console.log('--- Importing gtfs_stops ---');
  const rl = createCsvReader('stops.txt');
  const rows = [];
  let isHeader = true;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) { isHeader = false; continue; }
    const parts = line.split(',');
    rows.push({
      stop_id: parts[0]?.trim(),
      stop_name: parts[1]?.trim(),
      stop_lat: parseFloat(parts[2]),
      stop_lon: parseFloat(parts[3]),
    });
  }

  // Batch insert in chunks of 250
  for (let i = 0; i < rows.length; i += 250) {
    const chunk = rows.slice(i, i + 250);
    const { error } = await supabase.from('gtfs_stops').upsert(chunk, { onConflict: 'stop_id' });
    if (error) {
      console.warn(`Stops batch ${i} warning:`, error.message);
      break;
    }
  }
  console.log(`Successfully upserted ${rows.length} stops.`);
}

// 4. Import Trips
async function importTrips(limit = Infinity) {
  console.log('--- Importing gtfs_trips ---');
  const rl = createCsvReader('trips.txt');
  const rows = [];
  let isHeader = true;
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) { isHeader = false; continue; }
    if (count >= limit) break;
    const parts = line.split(',');
    rows.push({
      route_id: parts[0]?.trim(),
      service_id: parts[1]?.trim(),
      trip_id: parts[2]?.trim(),
      trip_headsign: parts[3]?.trim(),
      direction_id: parseInt(parts[4] || '0', 10),
      shape_id: parts[5]?.trim() || null,
    });
    count++;
  }

  // Batch insert in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from('gtfs_trips').upsert(chunk, { onConflict: 'trip_id' });
    if (error) {
      console.warn(`Trips batch ${i} warning:`, error.message);
      break;
    }
  }
  console.log(`Successfully upserted ${rows.length} trips.`);
}

// Main runner
async function run() {
  console.log('====================================================');
  console.log('Starting Repeatable GTFS Import');
  console.log(`Target Supabase URL: ${url}`);
  console.log('====================================================\n');

  try {
    await importCalendar();
    await importRoutes();
    await importStops();
    await importTrips();
    console.log('\nImport process completed successfully.');
  } catch (err) {
    console.error('Import failed with error:', err);
  }
}

run();
