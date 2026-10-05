// Geometría simple de lotes. El polígono llega como GeoJSON: coordenadas [lng, lat].
export type LatLng = { latitude: number; longitude: number };
export type GeoJsonPolygon = { type: 'Polygon'; coordinates: number[][][] };

// Anillo exterior del polígono en el formato de react-native-maps.
export function polygonToCoords(geom: GeoJsonPolygon): LatLng[] {
  return geom.coordinates[0].map(([longitude, latitude]) => ({ latitude, longitude }));
}

// "¿Estoy en el lote?" (RF-06) con ray casting: se traza una línea horizontal desde el
// punto y se cuentan los cruces con los bordes. Impar = adentro. Se calcula en el
// celular: la ubicación del usuario no se envía al servidor.
export function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses =
      a.latitude > point.latitude !== b.latitude > point.latitude &&
      point.longitude <
        ((b.longitude - a.longitude) * (point.latitude - a.latitude)) / (b.latitude - a.latitude) + a.longitude;
    if (crosses) inside = !inside;
  }
  return inside;
}

// Centro aproximado (promedio de vértices) para ubicar la etiqueta del lote.
export function polygonCenter(polygon: LatLng[]): LatLng {
  const sum = polygon.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 },
  );
  return { latitude: sum.latitude / polygon.length, longitude: sum.longitude / polygon.length };
}

// Región del mapa que muestra todos los lotes, con margen.
export function regionForPolygons(polygons: LatLng[][]) {
  const points = polygons.flat();
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(maxLat - minLat, 0.005) * 1.8,
    longitudeDelta: Math.max(maxLng - minLng, 0.005) * 1.8,
  };
}
