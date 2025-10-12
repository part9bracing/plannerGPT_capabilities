// lib/geocode.js — BC Geocoder first (no key required), fallback to OSM

async function bcGeocode(address) {
  const url = new URL("https://geocoder.api.gov.bc.ca/addresses.json");
  url.searchParams.set("addressString", address);
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("minScore", "80");
  url.searchParams.set("echo", "true");
  const key = process.env.BCGEO_API_KEY;          // optional
  if (key) url.searchParams.set("apikey", key);   // used only if set

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const json = await res.json();
  const feat = json?.features?.[0];
  const coords = feat?.geometry?.coordinates;     // [lon, lat]
  if (!coords || coords.length < 2) return null;

  return {
    lat: coords[1],
    lon: coords[0],
    fullAddress: feat?.properties?.fullAddress || feat?.properties?.addressString,
    score: feat?.properties?.score,
    source: "bc_geocoder"
  };
}

async function nominatimGeocode(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "planner-gpt-capabilities/0.1 (contact: you@example.com)" }
  });
  if (!res.ok) return null;

  const arr = await res.json();
  const first = Array.isArray(arr) ? arr[0] : null;
  if (!first) return null;

  return {
    lat: parseFloat(first.lat),
    lon: parseFloat(first.lon),
    fullAddress: first.display_name,
    score: undefined,
    source: "nominatim"
  };
}

export async function geocodeAddress(address) {
  const bc = await bcGeocode(address).catch(() => null);
  if (bc) return bc;
  return await nominatimGeocode(address).catch(() => null);
}
