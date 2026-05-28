import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';

interface Props {
  size: number;
  referenceAxis: number; // pre-op marked axis (degrees)
  targetAxis: number;    // IOL target axis (degrees)
  currentAxis?: number;  // IOL current position (degrees)
}

function axisToCoords(angleDeg: number, radius: number, cx: number, cy: number) {
  // axis 0° = horizontal, increases counterclockwise (ophthalmic convention)
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x1: cx - radius * Math.cos(rad),
    y1: cy - radius * Math.sin(rad),
    x2: cx + radius * Math.cos(rad),
    y2: cy + radius * Math.sin(rad),
  };
}

export default function AlignmentOverlay({ size, referenceAxis, targetAxis, currentAxis }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.45;
  const innerR = size * 0.15;
  const tickR = size * 0.42;

  const refCoords = axisToCoords(referenceAxis, outerR * 0.9, cx, cy);
  const targetCoords = axisToCoords(targetAxis, outerR * 0.9, cx, cy);
  const currentCoords = currentAxis !== undefined ? axisToCoords(currentAxis, outerR * 0.85, cx, cy) : null;

  // degree tick marks every 30°
  const ticks = Array.from({ length: 6 }, (_, i) => i * 30);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Outer limbal ring */}
        <Circle cx={cx} cy={cy} r={outerR} stroke="#ffffff" strokeWidth={1.5} fill="none" opacity={0.6} />
        {/* Pupil ring */}
        <Circle cx={cx} cy={cy} r={innerR} stroke="#ffffff" strokeWidth={1} fill="none" opacity={0.5} />
        {/* Center crosshair */}
        <Line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="#ffffff" strokeWidth={1} opacity={0.5} />
        <Line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="#ffffff" strokeWidth={1} opacity={0.5} />

        {/* Degree tick marks */}
        {ticks.map(deg => {
          const rad = (deg * Math.PI) / 180;
          const x1 = cx + tickR * Math.cos(rad);
          const y1 = cy + tickR * Math.sin(rad);
          const x2 = cx + (tickR + 8) * Math.cos(rad);
          const y2 = cy + (tickR + 8) * Math.sin(rad);
          const x1b = cx - tickR * Math.cos(rad);
          const y1b = cy - tickR * Math.sin(rad);
          const x2b = cx - (tickR + 8) * Math.cos(rad);
          const y2b = cy - (tickR + 8) * Math.sin(rad);
          const tx = cx + (tickR + 18) * Math.cos(rad);
          const ty = cy + (tickR + 18) * Math.sin(rad);
          return (
            <G key={deg}>
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth={1} opacity={0.5} />
              <Line x1={x1b} y1={y1b} x2={x2b} y2={y2b} stroke="#ffffff" strokeWidth={1} opacity={0.5} />
              <SvgText x={tx} y={ty} fill="#ffffff" fontSize={10} textAnchor="middle" opacity={0.6}>
                {deg}°
              </SvgText>
            </G>
          );
        })}

        {/* Reference axis (red) — pre-op marking */}
        <Line
          x1={refCoords.x1} y1={refCoords.y1}
          x2={refCoords.x2} y2={refCoords.y2}
          stroke="#FF4444" strokeWidth={2.5} strokeDasharray="8,4"
        />

        {/* Target axis (green) — desired IOL alignment */}
        <Line
          x1={targetCoords.x1} y1={targetCoords.y1}
          x2={targetCoords.x2} y2={targetCoords.y2}
          stroke="#44FF88" strokeWidth={2.5}
        />

        {/* Current IOL position (yellow) — intraop */}
        {currentCoords && (
          <Line
            x1={currentCoords.x1} y1={currentCoords.y1}
            x2={currentCoords.x2} y2={currentCoords.y2}
            stroke="#FFD700" strokeWidth={2.5} strokeDasharray="4,4"
          />
        )}

        {/* Legend */}
        <Line x1={10} y1={size - 50} x2={30} y2={size - 50} stroke="#FF4444" strokeWidth={2.5} strokeDasharray="8,4" />
        <SvgText x={35} y={size - 46} fill="#FF4444" fontSize={11}>Reference</SvgText>
        <Line x1={10} y1={size - 32} x2={30} y2={size - 32} stroke="#44FF88" strokeWidth={2.5} />
        <SvgText x={35} y={size - 28} fill="#44FF88" fontSize={11}>Target</SvgText>
        {currentCoords && (
          <>
            <Line x1={10} y1={size - 14} x2={30} y2={size - 14} stroke="#FFD700" strokeWidth={2.5} strokeDasharray="4,4" />
            <SvgText x={35} y={size - 10} fill="#FFD700" fontSize={11}>Current</SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
