import fs from "fs";

async function searchCoords() {
  const list = [
    { key: "DAP", query: "Dapodi metro station" },
    { key: "BOP", query: "Bopodi metro station" },
    { key: "KHD", query: "Khadki metro station" },
    { key: "RGH", query: "Range Hill metro station" },
    { key: "SHN", query: "Shivajinagar metro station" },
    { key: "DST", query: "District Court metro station Pune" },
    { key: "BWP", query: "Budhwar Peth metro station" },
    { key: "MND", query: "Mandai metro station Pune" },
    { key: "SWG", query: "Swargate metro station" },
    { key: "IDL", query: "Ideal Colony metro station" },
    { key: "NAL", query: "Nal Stop metro station" },
    { key: "PMC", query: "PMC metro station Pune" },
    { key: "YRW", query: "Yerawada metro station" },
    { key: "KLN", query: "Kalyani Nagar metro station" },
  ];

  const results = {};
  for (const item of list) {
    await new Promise((r) => setTimeout(r, 600));
    const sUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(item.query)}&format=json`;
    const sRes = await fetch(sUrl, {
      headers: { "User-Agent": "TrakoPuneTransit/1.0 (contact@trako.app)" },
    });
    const sData = await sRes.json();
    if (sData.query?.search?.[0]) {
      const bestTitle = sData.query.search[0].title;
      const cUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=${encodeURIComponent(bestTitle)}&format=json`;
      const cRes = await fetch(cUrl, {
        headers: { "User-Agent": "TrakoPuneTransit/1.0 (contact@trako.app)" },
      });
      const cData = await cRes.json();
      const p = Object.values(cData.query.pages)[0];
      if (p.coordinates?.[0]) {
        results[item.key] = {
          title: bestTitle,
          lat: p.coordinates[0].lat,
          lon: p.coordinates[0].lon,
        };
        console.log(
          `✓ ${item.key} (${bestTitle}): ${p.coordinates[0].lat}, ${p.coordinates[0].lon}`,
        );
      } else {
        console.log(`? ${item.key} (${bestTitle}): no coord`);
      }
    }
  }
  fs.writeFileSync(
    "scratch/wiki_remaining.json",
    JSON.stringify(results, null, 2),
  );
}

searchCoords().catch(console.error);
