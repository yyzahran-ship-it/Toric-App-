import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText, G } from 'react-native-svg';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { getPatient } from '../storage/patients';
import { calcAlpins, applyPCA, AlpinsVectors } from '../utils/toricMath';

type Route = RouteProp<RootStackParamList, 'AlpinsAnalysis'>;

const { width } = Dimensions.get('window');
const PLOT_SIZE = Math.min(width - 48, 280);
const toRad = (d: number) => (d * Math.PI) / 180;

function polarToSvg(mag: number, axis: number, scale: number, cx: number, cy: number) {
  const x = cx + scale * mag * Math.cos(2 * toRad(axis));
  const y = cy - scale * mag * Math.sin(2 * toRad(axis));
  return { x, y };
}

export default function AlpinsAnalysisScreen() {
  const { params } = useRoute<Route>();
  const [tiaMag, setTiaMag] = useState('');
  const [tiaAxis, setTiaAxis] = useState('');
  const [siaMag, setSiaMag] = useState('');
  const [siaAxis, setSiaAxis] = useState('');
  const [result, setResult] = useState<AlpinsVectors | null>(null);
  const [preloaded, setPreloaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPatient(params.patientId).then(p => {
        if (!p) return;
        const eye = p.eyes.find(e => e.id === params.eyeId);
        if (!eye) return;
        // Pre-populate TIA from corneal data if available
        if (eye.k1Power !== undefined && eye.k1Axis !== undefined && eye.k2Power !== undefined) {
          const pca = applyPCA(eye.k1Power, eye.k1Axis, eye.k2Power);
          setTiaMag(pca.adjustedMag.toFixed(2));
          setTiaAxis(String(pca.adjustedAxis));
          setPreloaded(true);
        } else if (eye.iolCylinder !== undefined) {
          setTiaMag(String(eye.iolCylinder));
          setTiaAxis(String(eye.targetAxis));
          setPreloaded(true);
        }
        // Pre-populate SIA from IOL cylinder (perfect placement = CI 1.0)
        if (eye.iolCylinder !== undefined) {
          setSiaMag(String(eye.iolCylinder));
          setSiaAxis(String(eye.targetAxis));
        }
      });
    }, [params.patientId, params.eyeId])
  );

  function handleCalculate() {
    const tm = parseFloat(tiaMag);
    const ta = parseFloat(tiaAxis);
    const sm = parseFloat(siaMag);
    const sa = parseFloat(siaAxis);
    if (isNaN(tm) || isNaN(ta) || isNaN(sm) || isNaN(sa)) return;
    setResult(calcAlpins({ mag: tm, axis: ta }, { mag: sm, axis: sa }));
  }

  const cx = PLOT_SIZE / 2;
  const cy = PLOT_SIZE / 2;
  const maxScale = PLOT_SIZE / 2 - 24;
  const scale = result
    ? Math.min(maxScale / Math.max(result.tia.mag, result.sia.mag, 0.5) * 0.9, maxScale)
    : maxScale;

  const ciColor = result
    ? result.ci >= 0.9 && result.ci <= 1.1 ? '#44FF88'
    : result.ci >= 0.75 && result.ci <= 1.25 ? '#FFD700' : '#FF6644'
    : '#fff';
  const isColor = result
    ? result.is < 0.2 ? '#44FF88' : result.is < 0.5 ? '#FFD700' : '#FF6644'
    : '#fff';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {preloaded && (
        <View style={s.infoBanner}>
          <Text style={s.infoText}>TIA pre-filled from corneal data. Enter post-op refraction as SIA for real analysis.</Text>
        </View>
      )}

      <Text style={s.sectionHeader}>Target-Induced Astigmatism (TIA)</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.half}>
            <Text style={s.label}>Magnitude (D)</Text>
            <TextInput style={s.input} value={tiaMag} onChangeText={setTiaMag}
              keyboardType="decimal-pad" placeholder="e.g. 1.75" placeholderTextColor="#AAAAAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Axis (°)</Text>
            <TextInput style={s.input} value={tiaAxis} onChangeText={setTiaAxis}
              keyboardType="number-pad" placeholder="0–180" placeholderTextColor="#AAAAAA" maxLength={3} />
          </View>
        </View>
      </View>

      <Text style={s.sectionHeader}>Surgically-Induced Astigmatism (SIA)</Text>
      <Text style={s.hint}>Enter post-op refraction cylinder for actual results, or use IOL cylinder for theoretical.</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.half}>
            <Text style={s.label}>Magnitude (D)</Text>
            <TextInput style={s.input} value={siaMag} onChangeText={setSiaMag}
              keyboardType="decimal-pad" placeholder="e.g. 1.75" placeholderTextColor="#AAAAAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Axis (°)</Text>
            <TextInput style={s.input} value={siaAxis} onChangeText={setSiaAxis}
              keyboardType="number-pad" placeholder="0–180" placeholderTextColor="#AAAAAA" maxLength={3} />
          </View>
        </View>
      </View>

      <TouchableOpacity style={s.calcBtn} onPress={handleCalculate}>
        <Text style={s.calcBtnText}>Analyze</Text>
      </TouchableOpacity>

      {result && (
        <>
          <Text style={s.sectionHeader}>Alpins Vectors</Text>
          <View style={s.card}>
            <View style={s.metricsGrid}>
              <MetricBox label="TIA" value={`${result.tia.mag.toFixed(2)} D @ ${result.tia.axis}°`} color="#4466FF" />
              <MetricBox label="SIA" value={`${result.sia.mag.toFixed(2)} D @ ${result.sia.axis}°`} color="#44AA66" />
              <MetricBox label="DV (residual)" value={`${result.dv.mag.toFixed(2)} D @ ${result.dv.axis}°`} color="#FF6644" />
              <MetricBox
                label="CI (ideal 1.0)"
                value={result.ci.toFixed(2)}
                color={ciColor}
                sub={result.ci > 1.0 ? 'Overcorrected' : result.ci < 1.0 ? 'Undercorrected' : 'Perfect'}
              />
              <MetricBox
                label="ME (ideal 0)"
                value={`${result.me > 0 ? '+' : ''}${result.me.toFixed(2)} D`}
                color={Math.abs(result.me) < 0.25 ? '#44FF88' : '#FFD700'}
              />
              <MetricBox
                label="AE (ideal 0°)"
                value={`${result.ae > 0 ? '+' : ''}${result.ae.toFixed(1)}°`}
                color={Math.abs(result.ae) < 5 ? '#44FF88' : '#FFD700'}
                sub={result.ae > 0 ? 'CCW rotation' : result.ae < 0 ? 'CW rotation' : 'On axis'}
              />
              <MetricBox
                label="IS (ideal 0)"
                value={result.is.toFixed(2)}
                color={isColor}
                sub={result.is < 0.2 ? 'Excellent' : result.is < 0.5 ? 'Acceptable' : 'Poor'}
              />
            </View>
          </View>

          <Text style={s.sectionHeader}>Double-Angle Plot</Text>
          <View style={[s.card, { alignItems: 'center' }]}>
            <AlpinsPlot result={result} size={PLOT_SIZE} scale={scale} />
            <View style={s.legend}>
              <LegendItem color="#4466FF" label="TIA" />
              <LegendItem color="#44AA66" label="SIA" />
              <LegendItem color="#FF6644" label="DV" />
            </View>
          </View>
        </>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function MetricBox({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <View style={s.metricBox}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, { color }]}>{value}</Text>
      {sub ? <Text style={s.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendLabel}>{label}</Text>
    </View>
  );
}

function AlpinsPlot({ result, size, scale }: { result: AlpinsVectors; size: number; scale: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 8;

  const tiaEnd = polarToSvg(result.tia.mag, result.tia.axis, scale, cx, cy);
  const siaEnd = polarToSvg(result.sia.mag, result.sia.axis, scale, cx, cy);
  const tiaEnd2 = polarToSvg(result.tia.mag, result.tia.axis + 90, scale, cx, cy);
  const siaEnd2 = polarToSvg(result.sia.mag, result.sia.axis + 90, scale, cx, cy);

  const maxMag = Math.max(result.tia.mag, result.sia.mag, 0.5);
  const gridSteps = [maxMag * 0.33, maxMag * 0.67, maxMag];

  return (
    <Svg width={size} height={size}>
      {/* Grid circles */}
      {gridSteps.map((r, i) => (
        <Circle key={i} cx={cx} cy={cy} r={(r / maxMag) * maxR} stroke="#2a2a4e" strokeWidth={1} fill="none" />
      ))}
      {/* Axes */}
      <Line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#333355" strokeWidth={1} />
      <Line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#333355" strokeWidth={1} />
      <SvgText x={cx + maxR + 4} y={cy + 4} fill="#555577" fontSize={9}>0°/180°</SvgText>
      <SvgText x={cx - 4} y={cy - maxR - 4} fill="#555577" fontSize={9} textAnchor="middle">90°</SvgText>

      {/* TIA vector (and its opposite = line) */}
      <Line x1={tiaEnd2.x} y1={tiaEnd2.y} x2={tiaEnd.x} y2={tiaEnd.y} stroke="#4466FF" strokeWidth={2} strokeDasharray="4,2" />
      <Circle cx={tiaEnd.x} cy={tiaEnd.y} r={5} fill="#4466FF" />

      {/* SIA vector */}
      <Line x1={siaEnd2.x} y1={siaEnd2.y} x2={siaEnd.x} y2={siaEnd.y} stroke="#44AA66" strokeWidth={2} strokeDasharray="4,2" />
      <Circle cx={siaEnd.x} cy={siaEnd.y} r={5} fill="#44AA66" />

      {/* DV vector: from tip of TIA to tip of SIA */}
      <Line x1={tiaEnd.x} y1={tiaEnd.y} x2={siaEnd.x} y2={siaEnd.y}
        stroke="#FF6644" strokeWidth={2} />

      {/* Center */}
      <Circle cx={cx} cy={cy} r={3} fill="#fff" />
    </Svg>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },
  infoBanner: {
    backgroundColor: '#C8A84B22', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#C8A84B66', marginBottom: 8,
  },
  infoText: { color: '#C8A84B', fontSize: 13 },
  sectionHeader: {
    color: '#888060', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginTop: 16,
  },
  hint: { color: '#888060', fontSize: 12, marginBottom: 8, fontStyle: 'italic' },
  card: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  label: { color: '#888060', fontSize: 11, textTransform: 'uppercase', marginBottom: 5 },
  input: {
    backgroundColor: '#FFFFFF', color: '#1A1200', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  calcBtn: {
    backgroundColor: '#C8A84B', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
  },
  calcBtnText: { color: '#C8C8C8', fontSize: 17, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricBox: {
    flex: 1, minWidth: '42%', backgroundColor: '#FFFFFF',
    borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#DDD5BB',
  },
  metricLabel: { color: '#888060', fontSize: 10, textTransform: 'uppercase', marginBottom: 4 },
  metricValue: { fontSize: 18, fontWeight: '700' },
  metricSub: { color: '#888060', fontSize: 11, marginTop: 2 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { color: '#888060', fontSize: 12 },
});
