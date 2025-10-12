// lib/dpa4Registry.js
export default [
  {
    name: "Nanaimo_DPA4_CoalMineRisk",
    active: true,
    serviceBase: "https://nanmap.nanaimo.ca/arcgis/rest/services/NanMap/CityPlan2022/MapServer",
    layerId: 77,                               // Coal Mine Risk
    outFields: ["OBJECTID"],                   // only need existence
    fieldMap: {},                              // no descriptive attrs on this layer
    srid: 4326,
    notes: "DPA 4 (Abandoned Mine Workings Hazard) → Coal Mine Risk polygons."
  }
];
