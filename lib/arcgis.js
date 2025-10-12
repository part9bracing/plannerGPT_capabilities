export async function arcgisPointInPolygonQuery({
  serviceBase, layerId, lat, lon,
  outFields = ["*"], inSR = 4326, token
}) {
  const url = new URL(`${serviceBase}/${layerId}/query`);
  const geometry = JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: inSR } });

  url.searchParams.set("f", "json");
  url.searchParams.set("geometry", geometry);
  url.searchParams.set("geometryType", "esriGeometryPoint");
  url.searchParams.set("inSR", String(inSR));
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", outFields.join(","));
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("outSR", "4326");
  if (token) url.searchParams.set("token", token);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`ArcGIS query failed: ${res.status}`);
  const body = await res.json();
  if (body?.error) throw new Error(`ArcGIS error ${body.error.code}: ${body.error.message}`);

  const attrs = body?.features?.[0]?.attributes ?? null;
  return { attributes: attrs, raw: body };
}

export function mapAttributes(attrs, fieldMap) {
  if (!attrs) return null;
  const out = {};
  for (const [arcField, outKey] of Object.entries(fieldMap)) {
    out[outKey] = attrs[arcField] ?? null;
  }
  return out;
}
