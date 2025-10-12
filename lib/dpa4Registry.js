// lib/dpa4Registry.js
export default [
  {
    name: "Nanaimo_DPA4_UndergroundCoalMines",
    active: true,
    // Adjust if your service base/layer id differs:
    serviceBase: "https://nanmap.nanaimo.ca/arcgis/rest/services/NanMap/DevelopmentPermitAreas/MapServer",
    layerId: 4,                           // <-- placeholder; change after debug if needed
    outFields: ["*"],                     // start wide, then tighten after debug
    fieldMap: {
      // we'll fill these after we see debug attributes
      // e.g., "DPA": "dpaCode", "DPA_NAME": "dpaName", "NOTES": "notes"
    },
    srid: 4326,
    notes: "DPA4 Underground Coal Mine Areas (verify layerId/outFields from debug)."
  }
];
