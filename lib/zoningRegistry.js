// lib/zoningRegistry.js
export default [
  {
    name: "Nanaimo_Zoning_Bylaw_4500_Fill",
    active: true,
    serviceBase: "https://nanmap.nanaimo.ca/arcgis/rest/services/NanMap/Zoning/MapServer",
    layerId: 1,
    outFields: ["ZoneCode", "Zone_Description", "Category"],

    // Map ArcGIS → normalized keys
    fieldMap: {
      ZoneCode: "zoningDistrict",
      Zone_Description: "zoningName",
      Category: "category"
    },

    srid: 4326,
    notes: "Layer 1 returned ZoneCode/Zone_Description/Category for the test point."
  }
];
