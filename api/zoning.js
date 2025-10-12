export const config = { runtime: "edge" };

function parseInput(url) {
  const sp = new URL(url).searchParams;
  const address = sp.get("address") || undefined;
  const lat = sp.get("lat");
  const lon = sp.get("lon");
  let coords = null;

  if (lat && lon) {
    coords = { lat: parseFloat(lat), lon: parseFloat(lon) };
  }

  return { address, coords };
}

export default function handler(req) {
  const { address, coords } = parseInput(req.url);

  if (!address && !coords) {
    return new Response(
      JSON.stringify({
        ok: false,
        capability: "zoning",
        error: { code: "BAD_REQUEST", message: "Provide ?address=... or ?lat=..&lon=.." }
      }),
      {
        status: 400,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*"
        }
      }
    );
  }

  // STUB payload (we will replace with ArcGIS point-in-polygon soon)
  const data = {
    parcelCentroid: coords || null,
    zoningDistrict: "STUBs-R1",
    zoningName: "Single Detached Residential (stub)",
    source: "arcgis: to-be-configured"
  };

  const body = {
    ok: true,
    capability: "zoning",
    input: { address, ...(coords || {}) },
    data,
    meta: { version: "0.1" }
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}
