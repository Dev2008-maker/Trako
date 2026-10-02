import fs from "fs";

const purpleTitles = [
  "PCMC_metro_station",
  "Sant_Tukaram_Nagar_metro_station",
  "Bhosari_metro_station",
  "Kasarwadi_metro_station",
  "Phugewadi_metro_station",
  "Dapodi_metro_station",
  "Bopodi_metro_station",
  "Khadki_metro_station",
  "Range_Hill_metro_station",
  "Shivajinagar_metro_station",
  "Civil_Court_metro_station",
  "Kasba_Peth_metro_station",
  "Mandai_metro_station",
  "Swargate_metro_station",
];

const aquaTitles = [
  "Vanaz_metro_station",
  "Anand_Nagar_metro_station_(Pune)",
  "Ideal_Colony_metro_station",
  "Nal_Stop_metro_station",
  "Garware_College_metro_station",
  "Deccan_Gymkhana_metro_station",
  "Chhatrapati_Sambhaji_Udyan_metro_station",
  "PMC_metro_station",
  "Mangalwar_Peth_metro_station",
  "Pune_Railway_Station_metro_station",
  "Ruby_Hall_Clinic_metro_station",
  "Bund_Garden_metro_station",
  "Yerwada_metro_station",
  "Kalyani_Nagar_metro_station",
  "Ramwadi_metro_station",
];

async function fetchWikiCoords() {
  const allTitles = [...purpleTitles, ...aquaTitles];
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=coordinates|pageprops&titles=${allTitles.join("|")}&format=json`;
  console.log("Fetching Wikipedia coordinates for all stations...");
  const res = await fetch(url);
  const data = await res.json();
  const pages = data.query.pages;

  const results = {};
  for (const pid in pages) {
    const page = pages[pid];
    if (page.coordinates && page.coordinates.length > 0) {
      results[page.title] = {
        lat: page.coordinates[0].lat,
        lon: page.coordinates[0].lon,
      };
      console.log(
        `✓ ${page.title}: ${page.coordinates[0].lat}, ${page.coordinates[0].lon}`,
      );
    } else {
      console.log(`? ${page.title}: no coords in api`);
    }
  }
  fs.writeFileSync(
    "scratch/wiki_coords.json",
    JSON.stringify(results, null, 2),
  );
}

fetchWikiCoords().catch(console.error);
