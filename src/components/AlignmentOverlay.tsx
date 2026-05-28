import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Landmark } from '../types';

interface Props {
  size: number;
  referenceAxis: number;
  targetAxis: number;
  currentAxis?: number;
  landmarks?: Landmark[];
}

function axisToCoords(angleDeg: number, radius: number, cx: number, cy: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x1: cx - radius * Math.cos(rad),
    y1: cy - radius * Math.sin(rad),
    x2: cx + radius * Math.cos(rad),
    y2: cy + radius * Math.sin(rad),
  };
}

export default function AlignmentOverlay({ size, referenceAxis, targetAxis, currentAxis, landmarks }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.45;
  const innerR = size * 0.15;
  const tickR = size * 0.42;
  const goldR = outerR + 6;

  const refCoords = axisToCoords(referenceAxis, outerR * 0.9, cx, cy);
  const targetCoords = axisToCoords(targetAxis, outerR * 0.9, cx, cy);
  const currentCoords = currentAxis !== undefined ? axisToCoords(currentAxis, outerR * 0.85, cx, cy) : null;

  const ticks = Array.from({ length: 6 }, (_, i) => i * 30);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="60%" stopColor="#0d0d1a" stopOpacity="0" />
            <Stop offset="100%" stopColor="#4466FF" stopOpacity="0.07" />
          </RadialGradient>
        </Defs>

        {/* Subtle inner glow */}
        <Circle cx={cx} cy={cy} r={outerR} fill="url(#innerGlow)" />

        {/* Gold outer accent ring */}
        <Circle cx={cx} cy={cy} r={goldR} stroke="#C8A84B" strokeWidth={1.5} fill="none" opacity={0.35} />
        <Circle cx={cx} cy={cy} r={goldR + 4} stroke="#C8A84B" strokeWidth={0.5} fill="none" opacity={0.15} />

        {/* Main limbal ring */}
        <Circle cx={cx} cy={cy} r={outerR} stroke="#88CCFF" strokeWidth={1.5} fill="none" opacity={0.55} />

        {/* Pupil ring */}
        <Circle cx={cx} cy={cy} r={innerR} stroke="#88CCFF" strokeWidth={1} fill="none" opacity={0.4} />

        {/* Center crosshair */}
        <Line x1={cx - 10} y1={cy} x2={cx + 10} y2={cy} stroke="#88CCFF" strokeWidth={1} opacity={0.5} />
        <Line x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} stroke="#88CCFF" strokeWidth={1} opacity={0.5} />

        {/* Degree tick marks */}
        {ticks.map(deg => {
          const rad = (deg * Math.PI) / 180;
          const x1 = cx + tickR * Math.cos(rad);
          const y1 = cy + tickR * Math.sin(rad);
          const x2 = cx + (tickR + 10) * Math.cos(rad);
          const y2 = cy + (tickR + 10) * Math.sin(rad);
          const x1b = cx - tickR * Math.cos(rad);
          const y1b = cy - tickR * Math.sin(rad);
          const x2b = cx - (tickR + 10) * Math.cos(rad);
          const y2b = cy - (tickR + 10) * Math.sin(rad);
          const tx = cx + (tickR + 22) * Math.cos(rad);
          const ty = cy + (tickR + 22) * Math.sin(rad);
          return (
            <G key={deg}>
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C8A84B" strokeWidth={1.5} opacity={0.6} />
              <Line x1={x1b} y1={y1b} x2={x2b} y2={y2b} stroke="#C8A84B" strokeWidth={1.5} opacity={0.6} />
              <SvgText x={tx} y={ty} fill="#C8A84B" fontSize={10} textAnchor="middle" opacity={0.8}>
                {deg}°
              </SvgText>
            </G>
          );
        })}

        {/* Reference axis (red dashed) */}
        <Line
          x1={refCoords.x1} y1={refCoords.y1}
          x2={refCoords.x2} y2={refCoords.y2}
          stroke="#FF4444" strokeWidth={2.5} strokeDasharray="8,4" opacity={0.9}
        />

        {/* Target axis (bright green) */}
        <Line
          x1={targetCoords.x1} y1={targetCoords.y1}
          x2={targetCoords.x2} y2={targetCoords.y2}
          stroke="#44FF88" strokeWidth={3} opacity={1}
        />
        {/* Target axis endpoint dots */}
        <Circle cx={targetCoords.x1} cy={targetCoords.y1} r={4} fill="#44FF88" opacity={0.8} />
        <Circle cx={targetCoords.x2} cy={targetCoords.y2} r={4} fill="#44FF88" opacity={0.8} />

        {/* Current IOL position (gold dashed) */}
        {currentCoords && (
          <>
            <Line
              x1={currentCoords.x1} y1={currentCoords.y1}
              x2={currentCoords.x2} y2={currentCoords.y2}
              stroke="#FFD700" strokeWidth={2.5} strokeDasharray="4,4"
            />
            <Circle cx={currentCoords.x1} cy={currentCoords.y1} r={3} fill="#FFD700" />
            <Circle cx={currentCoords.x2} cy={currentCoords.y2} r={3} fill="#FFD700" />
          </>
        )}

        {/* Landmark reference dots */}
        {landmarks && landmarks.map((lm, i) => (
          <G key={`lm-${i}`}>
            <Circle
              cx={lm.x * size}
              cy={lm.y * size}
              r={9}
              stroke={lm.color}
              strokeWidth={2}
              fill="transparent"
              opacity={0.85}
            />
            <Circle
              cx={lm.x * size}
              cy={lm.y * size}
              r={3}
              fill={lm.color}
              opacity={0.85}
            />
            {lm.label && (
              <SvgText
                x={lm.x * size + 12}
                y={lm.y * size - 8}
                fill={lm.color}
                fontSize={10}
                fontWeight="bold"
                opacity={0.9}
              >
                {lm.label}
              </SvgText>
            )}
          </G>
        ))}

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
