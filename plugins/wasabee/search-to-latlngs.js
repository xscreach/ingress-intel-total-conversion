/* global L, plugin */
var latlngs = window.search.lastSearch.selectedResult.layer
  .getLayers()
  .flatMap((i) => i.getLatLngs())
  .flatMap((i) => i);
var points = latlngs.map((i) => new L.Point(i.lng, i.lat));
var fewerPoints = L.LineUtil.simplify(points, 0.0011);
var fewerLatlngs = fewerPoints.map((i) => new L.LatLng(i.y, i.x));
fewerLatlngs.forEach((item) => plugin.wasabee._selectedOp.addZonePoint(plugin.wasabee._selectedOp.zones[0].id, item));
