import fs from "fs";

// Read .env
const envFile = fs.readFileSync(".env", "utf8");
const keyMatch = envFile.match(/VITE_MAPTILER_API_KEY=([^\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1].trim() : "";

const stations = [
  // Line 1 (Purple Line)
  {
    lineId: "purple",
    code: "PCMC",
    name: "PCMC",
    query: "PCMC Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "STN",
    name: "Sant Tukaram Nagar",
    query: "Sant Tukaram Nagar Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "BHO",
    name: "Bhosari (Nashik Phata)",
    query: "Bhosari Metro Station Nashik Phata, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "KAS",
    name: "Kasarwadi",
    query: "Kasarwadi Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "PHU",
    name: "Phugewadi",
    query: "Phugewadi Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "DAP",
    name: "Dapodi",
    query: "Dapodi Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "BOP",
    name: "Bopodi",
    query: "Bopodi Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "KHD",
    name: "Khadki",
    query: "Khadki Metro Station, Pune",
    operational: false,
  }, // Non-operational
  {
    lineId: "purple",
    code: "RGH",
    name: "Range Hill",
    query: "Range Hill Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "SHN",
    name: "Shivaji Nagar",
    query: "Shivajinagar Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "DST",
    name: "District Court",
    query: "District Court Metro Station, Pune",
    interchange: true,
    operational: true,
  },
  {
    lineId: "purple",
    code: "BWP",
    name: "Budhwar Peth",
    query: "Budhwar Peth Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "MND",
    name: "Mandai",
    query: "Mandai Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "purple",
    code: "SWG",
    name: "Swargate",
    query: "Swargate Metro Station, Pune",
    operational: true,
  },

  // Line 2 (Aqua Line)
  {
    lineId: "aqua",
    code: "VNZ",
    name: "Vanaz",
    query: "Vanaz Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "AND",
    name: "Anand Nagar",
    query: "Anand Nagar Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "IDL",
    name: "Ideal Colony",
    query: "Ideal Colony Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "NAL",
    name: "Nal Stop",
    query: "Nal Stop Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "GWC",
    name: "Garware College",
    query: "Garware College Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "DEC",
    name: "Deccan Gymkhana",
    query: "Deccan Gymkhana Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "CSU",
    name: "Chhatrapati Sambhaji Udyan",
    query: "Chhatrapati Sambhaji Udyan Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "PMC",
    name: "PMC Bhavan",
    query: "PMC Metro Station Pune Municipal Corporation, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "DST_A",
    name: "District Court",
    query: "District Court Metro Station, Pune",
    interchange: true,
    operational: true,
  },
  {
    lineId: "aqua",
    code: "MGP",
    name: "Mangalwar Peth (RTO)",
    query: "Mangalwar Peth Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "PRS",
    name: "Pune Railway Station",
    query: "Pune Railway Station Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "RHC",
    name: "Ruby Hall Clinic",
    query: "Ruby Hall Clinic Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "BDG",
    name: "Bund Garden",
    query: "Bund Garden Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "YRW",
    name: "Yerawada",
    query: "Yerawada Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "KLN",
    name: "Kalyani Nagar",
    query: "Kalyani Nagar Metro Station, Pune",
    operational: true,
  },
  {
    lineId: "aqua",
    code: "RMW",
    name: "Ramwadi",
    query: "Ramwadi Metro Station, Pune",
    operational: true,
  },
];

async function geocodeAll() {
  console.log("Geocoding 30 Pune Metro stations with MapTiler API...");
  const results = [];
  for (const s of stations) {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(s.query)}.json?key=${apiKey}&proximity=73.8567,18.5204&limit=1`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const [lon, lat] = data.features[0].geometry.coordinates;
        results.push({
          ...s,
          lat,
          lon,
          geocodedName: data.features[0].text,
        });
        console.log(`✓ ${s.name}: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      } else {
        console.warn(`✗ ${s.name}: not found`);
      }
    } catch (err) {
      console.error(`Error on ${s.name}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  fs.writeFileSync(
    "scratch/geocoded_metro.json",
    JSON.stringify(results, null, 2),
  );
  console.log(`Saved ${results.length} stations.`);
}

geocodeAll();
