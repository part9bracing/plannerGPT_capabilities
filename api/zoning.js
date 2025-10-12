// api/zoning.js
import { geocodeAddress } from "../lib/geocode.js";
import { arcgisPointInPolygonQuery, mapAttributes } from "../lib/arcgis.js";
import registry from "../lib/zoning.registry.js";

export const config = { runtime: "edge" };

// parse query params
function parse(url) {
  const sp = new URL(url).searchParams;
  const address = sp.get("address") || undefined;
  const lat = sp.get("lat");
  const lon = sp.get("lon");
  const debug = sp.get("debug") === "1";
  let coords = null;
  if (lat && lon) coords = { lat: parseFloat(lat), lon: parseFloat(lon) };
  return { address, coords, debug };
}

// uniform JSON response
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
      return json(
        {
          ok: false,
          capability: "zoning",
          error: { code: "BAD_REQUEST", message: "Provide ?address=... or ?lat=..&lon=.." }
        },
        400
      );
    }

    // 1) Resolve coordinates if only address supplied
    let point = coords;
    let geocoder;
    if (!point && address) {
      const g = await geocodeAddress(address);
      if (!g) {
        return json(
          {
            ok: false,
            capability: "zoning",
            error: { code: "GEOCODE_FAIL", message: "Could not geocode address" }
          },
          422
        );
      }
      point = { lat: g.lat, lon: g.lon };
      geocoder = g.source; // "bc_geocoder" or "nominatim"
    }

    // 2) Pick active adapter from registry
    const active = (registry || []).find((r) => r.active);
    if (!active) {
      return json(
        {
          ok: false,
          capability: "zoning",
          error: { code: "ADAPTER_MISSING", message: "No active zoning adapter" }
        },
        500
      );
    }

    const { serviceBase, layerId, outFields, fieldMap, srid = 4326 } = active;

    // 3) Query ArcGIS point-in-polygon
    const { attributes, raw } = await arcgisPointInPolygonQuery({
      serviceBase,
      layerId,
      lat: point.lat,
      lon: point.lon,
      outFields,
      inSR: srid
      // token: process.env.ARCGIS_TOKEN // uncomment if your service requires a token
    });

    // 4) Normalize attributes → stable output
    const mapped = mapAttributes(attributes, fieldMap);
    const data = {
      parcelCentroid: point,
      ...(mapped ?? { zoningDistrict: null, zoningName: null, bylawId: null }),
      source: `${serviceBase}/${layerId}`
    };

    // 5) Build response
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
        debug: debug ? { attributes } : undefined
        // include raw response when debugging if you want: debug ? { attributes, raw } : undefined
      }
    };

    return json(payload);
  } catch (e) {
    return json(
      {
        ok: false,
        capability: "zoning",
        error: { code: "UNEXPECTED", message: String(e?.message || e) }
      },
      500
    );
  }
}
