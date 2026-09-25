import { createServerFn } from "@tanstack/react-start";

export type MapConfig = {
  style: string | Record<string, unknown>;
};

/** Production light map style. Match Rapido / Ola clean map style. */
export const getMapConfig = createServerFn({ method: "GET" }).handler(async (): Promise<MapConfig> => {
  const key = process.env["MAPTILER_API_KEY"];
  if (key) {
    return {
      style: `https://api.maptiler.com/maps/base-light/style.json?key=${key}`,
    };
  }
  return {
    style: "/trako-map-style.json",
  };
});

export type PlaceResult = {
  id: string;
  name: string;
  context: string;
  lat: number;
  lon: number;
};

/** Place / area / landmark search around Pune. */
export const searchPlaces = createServerFn({ method: "GET" })
  .inputValidator((input: { query: string }) => ({ query: String(input.query ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<PlaceResult[]> => {
    const key = process.env["MAPTILER_API_KEY"];
    const q = data.query.trim();
    if (!key || q.length < 2) return [];

    const url = new URL(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json`,
    );
    url.searchParams.set("key", key);
    url.searchParams.set("country", "in");
    url.searchParams.set("proximity", "73.8567,18.5204");
    url.searchParams.set("bbox", "73.55,18.30,74.15,18.75");
    url.searchParams.set("limit", "6");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Place search failed (${response.status})`);
    }
    const body = (await response.json()) as {
      features?: Array<{
        id: string;
        text?: string;
        place_name?: string;
        center?: [number, number];
      }>;
    };

    return (body.features ?? [])
      .filter((f) => Array.isArray(f.center))
      .map((f) => ({
        id: f.id,
        name: f.text ?? f.place_name ?? q,
        context: (f.place_name ?? "").split(",").slice(1).join(",").trim(),
        lat: f.center![1],
        lon: f.center![0],
      }));
  });
