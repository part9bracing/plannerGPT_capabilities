export const config = { runtime: "edge" };

import { geocodeAddress } from "../lib/geocode.js";
import { arcgisPointInPolygonQuery, mapAttributes } from "../lib/arcgis.js";

let dpa4Registry;
async function getRegistry() {
  if (!dpa4Registry) dpa4Registry = (await import("../lib/dpa4Registry.js")).default;
  return dpa4Registry;
}

function parse(url) {
  const sp = new URL(url).searchParams;
  const address = sp.get("address") || undefined;
  const lat = sp.get("lat"); const lon = sp.get("lon");
  const debug = sp.get("debug") === "1";
  let coords = null;
  if (lat && lon) coords = { lat: parseFloat(lat), lon: parseFloat(lon) };
  return { address, coords, debug };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

export default async function handler(req) {
  try {
    const { address, coords, debug } = parse(req.url);
    if (!address && !coords) {
      return json({ ok:false, capability:"dpa4",
        error:{ code:"BAD_REQUEST", message:"Provide ?address=... or ?lat=..&lon=.." } }, 400);
    }

    // 1) Resolve coords if only address given
    let point = coords, geocoder;
    if (!point && address) {
      const g = await geocodeAddress(address);
      if (!g) return json({ ok:false, capability:"dpa4",
        error:{ code:"GEOCODE_FAIL", message:"Could not geocode address" } }, 422);
      point = { lat: g.lat, lon: g.lon };
      geocoder = g.source;
    }

    // 2) Active adapter
    const active = (await getRegistry()).find(r => r.active);
    if (!active) return json({ ok:false, capability:"dpa4",
      error:{ code:"ADAPTER_MISSING", message:"No active DPA4 adapter" } }, 500);

    const { serviceBase, layerId, outFields, fieldMap, srid = 4326 } = active;

    // 3) ArcGIS query
    const { attributes, raw } = await arcgisPointInPolygonQuery({
      serviceBase, layerId, lat: point.lat, lon: point.lon, outFields, inSR: srid
    });

    // 4) Normalize (we’ll refine fieldMap after first debug)
    const mapped = mapAttributes(attributes, fieldMap) || {};
    const data = {
      parcelCentroid: point,
      // Common normalized keys for DPA results:
      dpaCode: mapped.dpaCode ?? null,
      dpaName: mapped.dpaName ?? null,
      notes: mapped.notes ?? null,
      source: `${serviceBase}/${layerId}`
    };

    return json({
      ok: true,
      capability: "dpa4",
      input: { address, ...point },
      data,
      attribution: [
        geocoder ? {
          name: geocoder === "bc_geocoder" ? "BC Address Geocoder" : "OSM Nominatim",
          url: geocoder === "bc_geocoder" ? "https://geocoder.api.gov.bc.ca/" : "https://nominatim.openstreetmap.org/"
        } : undefined,
        { name: "City of Nanaimo GIS", url: serviceBase }
      ].filter(Boolean),
      meta: { version: "0.1", debug: debug ? { attributes, raw } : undefined }
    });
  } catch (e) {
    console.error("DPA4_ERROR", e);
    return json({ ok:false, capability:"dpa4",
      error:{ code:"UNEXPECTED", message:String(e?.message||e) } }, 500);
  }
}
