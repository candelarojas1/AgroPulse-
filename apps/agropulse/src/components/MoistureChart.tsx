import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/colors';
import { formatTime } from '@/lib/format';

export type ChartPoint = { measured_at: string; moisture_pct: number };

const HEIGHT = 180;
const PADDING = { top: 10, right: 12, bottom: 22, left: 34 };
const Y_TICKS = [0, 20, 40, 60];
const Y_MAX = 60;

// Gráfico de línea simple de humedad (RF-10), dibujado con SVG.
// Los puntos ya llegan ordenados por fecha.
export function MoistureChart({ points }: { points: ChartPoint[] }) {
  const [width, setWidth] = useState(0);

  if (points.length < 2) {
    return <Text style={styles.empty}>Sin lecturas suficientes en las últimas 6 h.</Text>;
  }

  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const firstTime = new Date(points[0].measured_at).getTime();
  const lastTime = new Date(points[points.length - 1].measured_at).getTime();
  const timeSpan = Math.max(lastTime - firstTime, 1);

  const x = (iso: string) => PADDING.left + ((new Date(iso).getTime() - firstTime) / timeSpan) * plotWidth;
  const y = (value: number) => PADDING.top + (1 - Math.min(value, Y_MAX) / Y_MAX) * plotHeight;

  const polyline = points.map((p) => `${x(p.measured_at)},${y(p.moisture_pct)}`).join(' ');
  const middle = points[Math.floor(points.length / 2)];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {Y_TICKS.map((tick) => (
            <Line
              key={tick}
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={Colors.border}
              strokeWidth={1}
            />
          ))}
          {Y_TICKS.map((tick) => (
            <SvgText key={`label-${tick}`} x={PADDING.left - 6} y={y(tick) + 4} fontSize={11} fill={Colors.textMuted} textAnchor="end">
              {`${tick}%`}
            </SvgText>
          ))}
          <Polyline points={polyline} fill="none" stroke={Colors.primary} strokeWidth={2} />
          {[points[0], middle, points[points.length - 1]].map((p, i) => (
            <SvgText
              key={`time-${i}`}
              x={x(p.measured_at)}
              y={HEIGHT - 6}
              fontSize={11}
              fill={Colors.textMuted}
              textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
            >
              {formatTime(p.measured_at)}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: Colors.textMuted,
    paddingVertical: 24,
    textAlign: 'center',
  },
});
