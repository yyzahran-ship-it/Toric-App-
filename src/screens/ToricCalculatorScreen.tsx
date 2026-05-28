import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getPatient, updateEyeRecord } from '../storage/patients';
import { calcToric, IOL_PLATFORMS, ToricResult } from '../utils/toricMath';
import { getSettings } from '../storage/settings';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ToricCalculator'>;
type Route = RouteProp<RootStackParamList, 'ToricCalculator'>;

const PLATFORM_KEYS = Object.keys(IOL_PLATFORMS);

export default function ToricCalculatorScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();

  const [k1Power, setK1Power] = useState('');
  const [k1Axis, setK1Axis] = useState('');
  const [k2Power, setK2Power] = useState('');
  const [sia, setSia] = useState('0.25');
  const [siaAxis, setSiaAxis] = useState('0');
  const [platform, setPlatform] = useState('acrysof');
  const [result, setResult] = useState<ToricResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [eyeSide, setEyeSide] = useState('');

  useFocusEffect(
    useCallback(() => {
      Promise.all([getPatient(params.patientId), getSettings()]).then(([p, settings]) => {
        const eye = p?.eyes.find(e => e.id === params.eyeId);
        if (!eye) return;
        setEyeSide(eye.side);
        if (eye.k1Power !== undefined) setK1Power(String(eye.k1Power));
        if (eye.k1Axis !== undefined) setK1Axis(String(eye.k1Axis));
        if (eye.k2Power !== undefined) setK2Power(String(eye.k2Power));
        // Use eye-specific SIA if set, otherwise fall back to user default
        setSia(String(eye.sia !== undefined ? eye.sia : settings.defaultSia));
        setSiaAxis(String(eye.siaAxis !== undefined ? eye.siaAxis : settings.defaultSiaAxis));
        setPlatform(settings.defaultPlatform);
      });
    }, [params.patientId, params.eyeId])
  );

  function handleCalculate() {
    const k1p = parseFloat(k1Power);
    const k1a = parseFloat(k1Axis);
    const k2p = parseFloat(k2Power);
    const s = parseFloat(sia);
    const sa = parseFloat(siaAxis);
    if (isNaN(k1p) || isNaN(k1a) || isNaN(k2p)) {
      Alert.alert('Missing data', 'Enter K1 power, K1 axis, and K2 power to calculate.');
      return;
    }
    if (k1a < 0 || k1a > 180 || sa < 0 || sa > 180) {
      Alert.alert('Invalid', 'Axis values must be between 0 and 180°.');
      return;
    }
    const r = calcToric({
      k1Power: k1p, k1Axis: k1a, k2Power: k2p,
      sia: isNaN(s) ? 0 : s,
      siaAxis: isNaN(sa) ? 0 : sa,
      platform,
    });
    setResult(r);
  }

  async function handleApply() {
    if (!result) return;
    setSaving(true);
    try {
      const p = await getPatient(params.patientId);
      const eye = p?.eyes.find(e => e.id === params.eyeId);
      if (!eye) return;
      await updateEyeRecord(params.patientId, {
        ...eye,
        k1Power: parseFloat(k1Power) || undefined,
        k1Axis: parseFloat(k1Axis) || undefined,
        k2Power: parseFloat(k2Power) || undefined,
        sia: parseFloat(sia) || undefined,
        siaAxis: parseFloat(siaAxis) || undefined,
        targetAxis: result.effectiveAxis,
        iolCylinder: result.bestCylinder,
      });
      Alert.alert('Applied', `Target axis set to ${result.effectiveAxis}°`, [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
    } finally {
      setSaving(false);
    }
  }

  const steepAxisLabel = k1Axis ? `(steep = ${((parseInt(k1Axis) + 90) % 180).toString()}°)` : '';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.sectionHeader}>Corneal Measurements</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.halfField}>
            <Text style={s.label}>K1 Flat (D)</Text>
            <TextInput style={s.input} value={k1Power} onChangeText={setK1Power}
              placeholder="43.50" placeholderTextColor="#555" keyboardType="decimal-pad" />
          </View>
          <View style={s.halfField}>
            <Text style={s.label}>K1 Flat Axis (°)</Text>
            <TextInput style={s.input} value={k1Axis} onChangeText={setK1Axis}
              placeholder="0–180" placeholderTextColor="#555" keyboardType="number-pad" maxLength={3} />
          </View>
        </View>
        <View style={s.row}>
          <View style={s.halfField}>
            <Text style={s.label}>K2 Steep (D){steepAxisLabel ? ' ' + steepAxisLabel : ''}</Text>
            <TextInput style={s.input} value={k2Power} onChangeText={setK2Power}
              placeholder="45.50" placeholderTextColor="#555" keyboardType="decimal-pad" />
          </View>
          <View style={s.halfField}>
            <Text style={s.label}>Astigmatism</Text>
            <View style={s.derivedBox}>
              <Text style={s.derivedValue}>
                {k1Power && k2Power
                  ? `${Math.abs(parseFloat(k2Power) - parseFloat(k1Power)).toFixed(2)} D`
                  : '—'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={s.sectionHeader}>Surgical Parameters</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.halfField}>
            <Text style={s.label}>SIA (D)</Text>
            <TextInput style={s.input} value={sia} onChangeText={setSia}
              placeholder="0.25" placeholderTextColor="#555" keyboardType="decimal-pad" />
          </View>
          <View style={s.halfField}>
            <Text style={s.label}>Incision Axis (°)</Text>
            <TextInput style={s.input} value={siaAxis} onChangeText={setSiaAxis}
              placeholder="0–180" placeholderTextColor="#555" keyboardType="number-pad" maxLength={3} />
          </View>
        </View>
      </View>

      <Text style={s.sectionHeader}>IOL Platform</Text>
      <View style={s.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PLATFORM_KEYS.map(key => (
              <TouchableOpacity
                key={key}
                style={[s.chipBtn, platform === key && s.chipBtnActive]}
                onPress={() => setPlatform(key)}
              >
                <Text style={[s.chipText, platform === key && s.chipTextActive]}>
                  {IOL_PLATFORMS[key].name.split(' ').slice(0, 2).join(' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <Text style={s.platformName}>{IOL_PLATFORMS[platform].name}</Text>
      </View>

      <TouchableOpacity style={s.calcBtn} onPress={handleCalculate}>
        <Text style={s.calcBtnText}>Calculate</Text>
      </TouchableOpacity>

      {result && (
        <>
          <Text style={s.sectionHeader}>Results</Text>
          <View style={s.card}>
            <View style={s.resultRow}>
              <View style={s.resultBlock}>
                <Text style={s.resultLabel}>Effective Corneal</Text>
                <Text style={s.resultBig}>{result.effectiveMag.toFixed(2)} D</Text>
              </View>
              <View style={s.resultBlock}>
                <Text style={s.resultLabel}>Placement Axis</Text>
                <Text style={[s.resultBig, { color: '#44FF88' }]}>{result.effectiveAxis}°</Text>
              </View>
            </View>
            <View style={[s.resultRow, { marginTop: 12 }]}>
              <View style={s.resultBlock}>
                <Text style={s.resultLabel}>Best IOL Cylinder</Text>
                <Text style={[s.resultBig, { color: '#FFD700' }]}>{result.bestCylinder} D</Text>
              </View>
              <View style={s.resultBlock}>
                <Text style={s.resultLabel}>Predicted Residual</Text>
                <Text style={[s.resultBig, { color: result.bestResidual < 0.5 ? '#44FF88' : result.bestResidual < 1.0 ? '#FFD700' : '#FF6644' }]}>
                  {result.bestResidual.toFixed(2)} D
                </Text>
              </View>
            </View>
          </View>

          <Text style={s.sectionHeader}>IOL Options — Residual Astigmatism</Text>
          <View style={s.card}>
            {result.iolOptions.map(opt => (
              <View key={opt.cylinder} style={[s.optRow, opt.isBest && s.optRowBest]}>
                <Text style={[s.optCyl, opt.isBest && s.optBestText]}>{opt.cylinder} D</Text>
                <View style={s.optBar}>
                  <View style={[
                    s.optBarFill,
                    { width: `${Math.min(100, (opt.residual / 3) * 100)}%` as any },
                    opt.isBest ? s.optBarBest : s.optBarNorm,
                  ]} />
                </View>
                <Text style={[s.optResidual, opt.isBest && s.optBestText]}>
                  {opt.residual.toFixed(2)} D
                </Text>
                {opt.isBest && <Text style={s.bestTag}>BEST</Text>}
              </View>
            ))}
          </View>

          <TouchableOpacity style={[s.applyBtn, saving && { opacity: 0.6 }]} onPress={handleApply} disabled={saving}>
            <Text style={s.applyBtnText}>
              {saving ? 'Saving…' : `Apply — Set Target Axis to ${result.effectiveAxis}°`}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 16 },
  sectionHeader: {
    color: '#8888aa', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginTop: 16,
  },
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2a2a4e',
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  halfField: { flex: 1, marginBottom: 12 },
  label: { color: '#8888aa', fontSize: 11, textTransform: 'uppercase', marginBottom: 5 },
  input: {
    backgroundColor: '#0d0d1a', color: '#fff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    borderWidth: 1, borderColor: '#2a2a4e',
  },
  derivedBox: {
    backgroundColor: '#0d0d1a', borderRadius: 8, borderWidth: 1,
    borderColor: '#2a2a4e', paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center',
  },
  derivedValue: { color: '#8888aa', fontSize: 16 },
  chipBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#2a2a4e',
  },
  chipBtnActive: { backgroundColor: '#4466FF22', borderColor: '#4466FF' },
  chipText: { color: '#8888aa', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  platformName: { color: '#8888aa', fontSize: 11, marginTop: 6 },
  calcBtn: {
    backgroundColor: '#4466FF', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
  },
  calcBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  resultRow: { flexDirection: 'row', gap: 12 },
  resultBlock: { flex: 1, alignItems: 'center' },
  resultLabel: { color: '#8888aa', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 },
  resultBig: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  optRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#0d0d1a',
  },
  optRowBest: { backgroundColor: '#FFD70011', borderRadius: 8, borderBottomWidth: 0, marginVertical: 2 },
  optCyl: { color: '#8888aa', fontSize: 13, width: 52, textAlign: 'right' },
  optBestText: { color: '#FFD700' },
  optBar: { flex: 1, height: 6, backgroundColor: '#0d0d1a', borderRadius: 3, overflow: 'hidden' },
  optBarFill: { height: '100%', borderRadius: 3 },
  optBarNorm: { backgroundColor: '#2a2a6e' },
  optBarBest: { backgroundColor: '#FFD700' },
  optResidual: { color: '#8888aa', fontSize: 13, width: 48, textAlign: 'right' },
  bestTag: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', width: 32 },
  applyBtn: {
    backgroundColor: '#44AA66', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 16,
  },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
