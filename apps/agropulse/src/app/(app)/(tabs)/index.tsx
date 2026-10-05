import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { StateView } from '@/components/StateView';
import { Colors } from '@/constants/colors';
import { useOrg } from '@/context/OrgContext';
import { usePlots } from '@/context/PlotsContext';
import { getErrorMessage } from '@/lib/errors';
import { isPointInPolygon, polygonCenter, regionForPolygons, type LatLng } from '@/lib/geo';
import { STATUS_INFO, STATUS_ORDER } from '@/lib/plotStatus';

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { activeOrg } = useOrg();
  const { plots, isLoading, error, reload } = usePlots();
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  if (isLoading) return <StateView loading message="Cargando lotes…" />;
  if (error) return <StateView message={getErrorMessage(error)} actionLabel="Reintentar" onAction={reload} />;
  if (plots.length === 0) return <StateView message="Este establecimiento todavía no tiene lotes." />;

  const openPlot = (plotId: string) => router.push({ pathname: '/plot/[id]', params: { id: plotId } });

  // "Estoy en el lote" (RF-06). Sin permiso o sin GPS no se rompe: muestra un aviso.
  const locateMe = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setUserLocation(null);
        setLocationMessage('Ubicación no disponible');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const plotHere = plots.find((plot) => isPointInPolygon(point, plot.coords));
      setUserLocation(point);
      setLocationMessage(plotHere ? `Estás en ${plotHere.name}` : 'Estás fuera de los lotes');
      mapRef.current?.animateToRegion({ ...point, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    } catch {
      setUserLocation(null);
      setLocationMessage('Ubicación no disponible');
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        // Al cambiar de establecimiento, el mapa se vuelve a centrar en sus lotes.
        key={activeOrg?.id}
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={regionForPolygons(plots.map((plot) => plot.coords))}
        mapType="hybrid"
      >
        {plots.map((plot) => {
          const info = STATUS_INFO[plot.status];
          return (
            <Polygon
              key={plot.id}
              coordinates={plot.coords}
              fillColor={`${info.color}88`}
              strokeColor={info.color}
              strokeWidth={2}
              tappable
              onPress={() => openPlot(plot.id)}
            />
          );
        })}
        {plots.map((plot) => {
          const info = STATUS_INFO[plot.status];
          return (
            <Marker key={`label-${plot.id}`} coordinate={polygonCenter(plot.coords)} onPress={() => openPlot(plot.id)}>
              <View style={styles.label}>
                <Ionicons name={info.icon} size={14} color={info.color} />
                <Text style={styles.labelText}>
                  {plot.name} · {info.label}
                </Text>
              </View>
            </Marker>
          );
        })}
        {userLocation && <Marker coordinate={userLocation} pinColor={Colors.primary} title="Tu ubicación" />}
      </MapView>

      {locationMessage && (
        <View style={styles.locationBanner}>
          <Ionicons name="navigate" size={16} color={Colors.text} />
          <Text style={styles.locationText}>{locationMessage}</Text>
        </View>
      )}

      <View style={styles.legend}>
        {STATUS_ORDER.map((status) => (
          <View key={status} style={styles.legendRow}>
            <Ionicons name={STATUS_INFO[status].icon} size={14} color={STATUS_INFO[status].color} />
            <Text style={styles.legendText}>{STATUS_INFO[status].label}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={styles.fab}
        onPress={locateMe}
        disabled={isLocating}
        accessibilityLabel="Mi ubicación"
      >
        <Ionicons name={isLocating ? 'hourglass-outline' : 'locate'} size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  locationBanner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  legend: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 13,
    color: Colors.text,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
