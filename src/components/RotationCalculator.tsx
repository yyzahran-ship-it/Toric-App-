import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  currentAxis: number;
  targetAxis: number;
}

function calcRotation(current: number, target: number): { degrees: number; direction: 'CW' | 'CCW' } {
  // Toric lenses: axes are 0–180° (not 0–360°)
  let delta = ((target - current) % 180 + 180) % 180;
  if (delta > 90) {
    delta = 180 - delta;
    return { degrees: Math.round(delta), direction: 'CCW' };
  }
  return { degrees: Math.round(delta), direction: 'CW' };
}

export default function RotationCalculator({ currentAxis, targetAxis }: Props) {
  const { degrees, direction } = calcRotation(currentAxis, targetAxis);
  const isAligned = degrees === 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Rotation Needed</Text>
      {isAligned ? (
        <Text style={styles.aligned}>Aligned</Text>
      ) : (
        <View style={styles.row}>
          <Text style={styles.degrees}>{degrees}°</Text>
          <Text style={[styles.direction, direction === 'CW' ? styles.cw : styles.ccw]}>
            {direction === 'CW' ? 'Clockwise ↻' : 'Counter-clockwise ↺'}
          </Text>
        </View>
      )}
      <View style={styles.axisRow}>
        <View style={styles.axisItem}>
          <Text style={styles.axisLabel}>Current</Text>
          <Text style={styles.axisValue}>{currentAxis}°</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.axisItem}>
          <Text style={styles.axisLabel}>Target</Text>
          <Text style={styles.axisValue}>{targetAxis}°</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F6EF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD5BB',
  },
  label: {
    color: '#888060',
    fontSize: 13,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {
    alignItems: 'center',
    marginBottom: 12,
  },
  degrees: {
    color: '#1A1200',
    fontSize: 48,
    fontWeight: 'bold',
    lineHeight: 52,
  },
  direction: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  cw: { color: '#FFD700' },
  ccw: { color: '#44AAFF' },
  aligned: {
    color: '#44FF88',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  axisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  axisItem: {
    alignItems: 'center',
  },
  axisLabel: {
    color: '#888060',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  axisValue: {
    color: '#1A1200',
    fontSize: 20,
    fontWeight: '600',
  },
  arrow: {
    color: '#888060',
    fontSize: 18,
  },
});
