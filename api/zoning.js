// api/zoning.js
// Runtime: Edge (fast, no cold starts)
export const config = { runtime: "edge" };

import { geocodeAddress } from "../lib/geocode.js";
import { arcgisPointInPolygonQuery, mapAttributes } from "../lib/arcgis.js";

// Dynamic import avoids bundler issues & dotted filenames
let zoningRegistry;
async function getRegistry() {
  if (!zoningRegistry) {
    zoningRegistry = (await import("../lib/zoningRegistry.js")).default;
  }
  return zoningRegistry;
}

// --- helpers ---
function parse(url) {
  const sp = new URL(url).searchParams;
  const address = sp.get("address") || undefined;
  const lat = sp.get("lat");
  const lon = sp.get("lon");
  const debug = sp.get("debug") === "1";
  const includeRaw = sp.get("includeRaw") === "1";
  const select =
    (sp.get("select") || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

  let coords = null;
  if (lat && lon) coords = { lat: parseFloat(lat), lon: parseFloat(lon) };

  return { address, coords, debug, includeRaw, select };
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

function pick(obj, keys) {
  if (!keys || !keys.length) return obj;
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

// --- handler ---
export default async function handler(req) {
  try {
    const { address, coords, debug, includeRaw, select } = parse(req.url);

    if (!address && !coords) {
      return json(
        {
          ok: false,
          capability: "zoning",
          error: { code: "BAD_REQUEST", message: "Provide ?address=... or ?lat=..&lon=.." }
        },
        400
      );
    }

    // 1) Resolve coordinates if only address supplied (BC Geocoder first, OSM fallback)
    let point = coords;
    let geocoder;
    if (!point && address) {
      const g = await geocodeAddress(address);
      if (!g) {
        return json(
          { ok: false, capability: "zoning", error: { code: "GEOCODE_FAIL", message: "Could not geocode address" } },
          422
        );
      }
      point = { lat: g.lat, lon: g.lon };
      geocoder = g.source; // "bc_geocoder" or "nominatim"
    }

    // 2) Load active adapter
    const registry = await getRegistry();
    const active = (registry || []).find(r => r.active);
    if (!active) {
      return json(
        { ok: false, capability: "zoning", error: { code: "ADAPTER_MISSING", message: "No active zoning adapter" } },
        500
      );
    }

    const { serviceBase, layerId, outFields, fieldMap, srid = 4326 } = active;

    // 3) ArcGIS point-in-polygon
    const { attributes, raw } = await arcgisPointInPolygonQuery({
      serviceBase,
      layerId,
      lat: point.lat,
      lon: point.lon,
      outFields,
      inSR: srid
      // token: process.env.ARCGIS_TOKEN // uncomment if your service requires a token
    });

    // 4) Normalize attributes to stable output keys
    const mapped = mapAttributes(attributes, fieldMap);
    let data = {
      parcelCentroid: point,
      ...(mapped ?? { zoningDistrict: null, zoningName: null, bylawId: null }),
      source: `${serviceBase}/${layerId}`
    };

    // Allow trimming of returned fields: ?select=zoningDistrict,zoningName
    if (select.length) {
      // Always keep parcelCentroid + source for context
      data = {
        parcelCentroid: data.parcelCentroid,
        ...pick(data, select),
        source: data.source
      };
    }

    const payload = {
      ok: true,
      capability: "zoning",
      input: { address, ...point },
      data,
      attribution: [
        geocoder
          ? {
              name: geocoder === "bc_geocoder" ? "BC Address Geocoder" : "OSM Nominatim",
              url: geocoder === "bc_geocoder" ? "https://geocoder.api.gov.bc.ca/" : "https://nominatim.openstreetmap.org/"
            }
          : undefined,
        { name: "City of Nanaimo GIS", url: serviceBase }
      ].filter(Boolean),
      meta: {
        version: "0.2",
        note: mapped ? undefined : "No polygon match or fields may need mapping.",
        debug: debug ? { attributes, ...(includeRaw ? { raw } : {}) } : undefined
      }
    };

    return json(payload);
  } catch (e) {
    // helpful error surfaced in function logs
    console.error("ZONING_ERROR", e);
    return json(
      { ok: false, capability: "zoning", error: { code: "UNEXPECTED", message: String(e?.message || e) } },
      500
    );
  }
}
