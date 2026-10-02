import fs from "fs";

async function fetchStations() {
  const query = `[out:json][timeout:30];
(
  node["railway"="station"](18.42,73.74,18.66,73.98);
  node["station"="subway"](18.42,73.74,18.66,73.98);
  node["railway"="subway_entrance"](18.42,73.74,18.66,73.98);
);
out body;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  console.log("Fetching from Overpass...");
  const res = await fetch(url);
  const json = await res.json();
  const metroStations = json.elements
    .filter(
      (e) =>
        e.tags &&
        (e.tags.network?.includes("Metro") ||
          e.tags.name?.includes("Metro") ||
          e.tags.railway === "station" ||
          e.tags.station === "subway"),
    )
    .map((e) => ({
      name: e.tags.name,
      name_en: e.tags["name:en"],
      lat: e.lat,
      lon: e.lon,
      network: e.tags.network,
      tags: e.tags,
    }));
  console.log(`Found ${metroStations.length} matching nodes.`);
  fs.writeFileSync(
    "scratch/osm_metro.json",
    JSON.stringify(metroStations, null, 2),
  );
}

fetchStations().catch(console.error);
