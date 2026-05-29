import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getPatient, updateEyeRecord } from '../storage/patients';
import { calcToric, applyPCA, IOL_PLATFORMS, ToricResult } from '../utils/toricMath';
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
  const [pcaEnabled, setPcaEnabled] = useState(false);
  const [postRefractive, setPostRefractive] = useState(false);
  const [postRefractiveType, setPostRefractiveType] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      Promise.all([getPatient(params.patientId), getSettings()]).then(([p, settings]) => {
        const eye = p?.eyes.find(e => e.id === params.eyeId);
        if (!eye) return;
        setEyeSide(eye.side);
        if (eye.k1Power !== undefined) setK1Power(String(eye.k1Power));
        if (eye.k1Axis !== undefined) setK1Axis(String(eye.k1Axis));
        if (eye.k2Power !== undefined) setK2Power(String(eye.k2Power));
        setSia(String(eye.sia !== undefined ? eye.sia : settings.defaultSia));
        setSiaAxis(String(eye.siaAxis !== undefined ? eye.siaAxis : settings.defaultSiaAxis));
        setPlatform(settings.defaultPlatform);
        setPostRefractive(eye.postRefractive ?? false);
        setPostRefractiveType(eye.postRefractiveType ?? '');
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

    let effectiveK1Power = k1p;
    let effectiveK1Axis = k1a;
    let effectiveK2Power = k2p;

    // PCA correction: adjust k values to total corneal astigmatism
    if (pcaEnabled) {
      const pca = applyPCA(k1p, k1a, k2p);
      // Reconstruct synthetic K values from adjusted parameters
      effectiveK1Axis = (pca.adjustedAxis + 90) % 180; // flat axis = steep − 90
      const halfMag = pca.adjustedMag / 2;
      effectiveK1Power = k1p - halfMag + (Math.abs(k2p - k1p) / 2 - halfMag);
      effectiveK2Power = k2p + pca.adjustedMag - Math.abs(k2p - k1p);
      // Simpler: pass adjusted magnitude directly by overriding k2 to set correct difference
      const midK = (k1p + k2p) / 2;
      effectiveK1Power = midK - pca.adjustedMag / 2;
      effectiveK2Power = midK + pca.adjustedMag / 2;
      effectiveK1Axis = pca.adjustedAxis >= 90
        ? (pca.adjustedAxis - 90 + 180) % 180
        : pca.adjustedAxis + 90 % 180;
      // Flat axis = steep − 90
      effectiveK1Axis = ((pca.adjustedAxis - 90) + 180) % 180;
    }

    const r = calcToric({
      k1Power: effectiveK1Power,
      k1Axis: effectiveK1Axis,
      k2Power: effectiveK2Power,
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

      {/* Post-refractive warning */}
      {postRefractive && (
        <View style={s.warningBanner}>
          <Text style={s.warningIcon}>⚠</Text>
          <View style={s.warningBody}>
            <Text style={s.warningTitle}>Post-Refractive Eye{postRefractiveType ? ` (${postRefractiveType})` : ''}</Text>
            <Text style={s.warningText}>
              Keratometry may underestimate corneal power. Use total corneal astigmatism from Scheimpflug/OCT. PCA correction is less predictable.
            </Text>
          </View>
        </View>
      )}

      <Text style={s.sectionHeader}>Corneal Measurements</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.halfField}>
            <Text style={s.label}>K1 Flat (D)</Text>
            <TextInput style={s.input} value={k1Power} onChangeText={setK1Power}
              placeholder="43.50" placeholderTextColor="#AAAAAA" keyboardType="decimal-pad" />
          </View>
          <View style={s.halfField}>
            <Text style={s.label}>K1 Flat Axis (°)</Text>
            <TextInput style={s.input} value={k1Axis} onChangeText={setK1Axis}
              placeholder="0–180" placeholderTextColor="#AAAAAA" keyboardType="number-pad" maxLength={3} />
          </View>
        </View>
        <View style={s.row}>
          <View style={s.halfField}>
            <Text style={s.label}>K2 Steep (D){steepAxisLabel ? ' ' + steepAxisLabel : ''}</Text>
            <TextInput style={s.input} value={k2Power} onChangeText={setK2Power}
              placeholder="45.50" placeholderTextColor="#AAAAAA" keyboardType="decimal-pad" />
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

        {/* PCA correction toggle */}
        <TouchableOpacity
          style={[s.toggleRow, pcaEnabled && s.toggleRowActive]}
          onPress={() => { setPcaEnabled(!pcaEnabled); setResult(null); }}
        >
          <View style={[s.checkbox, pcaEnabled && s.checkboxActive]}>
            {pcaEnabled && <Text style={s.checkmark}>✓</Text>}
          </View>
          <View style={s.toggleBody}>
            <Text style={[s.toggleLabel, pcaEnabled && s.toggleLabelActive]}>
              PCA Correction (Barrett)
            </Text>
            <Text style={s.toggleSub}>
              Adds ~0.3 D ATR posterior corneal contribution
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionHeader}>Surgical Parameters</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.halfField}>
            <Text style={s.label}>SIA (D)</Text>
            <TextInput style={s.input} value={sia} onChangeText={setSia}
              placeholder="0.25" placeholderTextColor="#AAAAAA" keyboardType="decimal-pad" />
          </View>
          <View style={s.halfField}>
            <Text style={s.label}>Incision Axis (°)</Text>
            <TextInput style={s.input} value={siaAxis} onChangeText={setSiaAxis}
              placeholder="0–180" placeholderTextColor="#AAAAAA" keyboardType="number-pad" maxLength={3} />
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
          <Text style={s.sectionHeader}>Results {pcaEnabled ? '(PCA corrected)' : ''}</Text>
          <View style={s.card}>
            <View style={s.resultRow}>
              <View style={s.resultBlock}>
                <Text style={s.resultLabel}>Effective Corneal</Text>
                <Text style={s.resultBig}>{result.effectiveMag.toFixed(2)} D</Text>
              </View>
              <View style={s.resultBlock}>
                <Text style={s.resultLabel}>Placement Axis</Text>
                <Text style={[s.resultBig, { color: '#C8A84B' }]}>{result.effectiveAxis}°</Text>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },
  sectionHeader: {
    color: '#888060', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginTop: 16,
  },
  warningBanner: {
    backgroundColor: '#FF880022', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FF880066', flexDirection: 'row',
    alignItems: 'flex-start', gap: 10, marginBottom: 8,
  },
  warningIcon: { fontSize: 20, color: '#FF8800' },
  warningBody: { flex: 1 },
  warningTitle: { color: '#FF8800', fontSize: 14, fontWeight: '700' },
  warningText: { color: '#CC7700', fontSize: 12, marginTop: 4, lineHeight: 17 },
  card: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  halfField: { flex: 1, marginBottom: 12 },
  label: { color: '#888060', fontSize: 11, textTransform: 'uppercase', marginBottom: 5 },
  input: {
    backgroundColor: '#FFFFFF', color: '#1A1200', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  derivedBox: {
    backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1,
    borderColor: '#DDD5BB', paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center',
  },
  derivedValue: { color: '#888060', fontSize: 16 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 4,
    borderTopWidth: 1, borderTopColor: '#2a2a4e', marginTop: 4,
  },
  toggleRowActive: { borderTopColor: '#C8A84B44' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: '#4a4a6e', alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { borderColor: '#C8A84B', backgroundColor: '#C8A84B22' },
  checkmark: { color: '#C8A84B', fontSize: 13, fontWeight: 'bold' },
  toggleBody: { flex: 1 },
  toggleLabel: { color: '#888060', fontSize: 13, fontWeight: '600' },
  toggleLabelActive: { color: '#C8A84B' },
  toggleSub: { color: '#888060', fontSize: 11, marginTop: 2 },
  chipBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  chipBtnActive: { backgroundColor: '#C8A84B22', borderColor: '#C8A84B' },
  chipText: { color: '#888060', fontSize: 12 },
  chipTextActive: { color: '#C8C8C8' },
  platformName: { color: '#888060', fontSize: 11, marginTop: 6 },
  calcBtn: {
    backgroundColor: '#C8A84B', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
  },
  calcBtnText: { color: '#C8C8C8', fontSize: 17, fontWeight: '700' },
  resultRow: { flexDirection: 'row', gap: 12 },
  resultBlock: { flex: 1, alignItems: 'center' },
  resultLabel: { color: '#888060', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 },
  resultBig: { color: '#1A1200', fontSize: 28, fontWeight: 'bold' },
  optRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#DDD5BB',
  },
  optRowBest: { backgroundColor: '#C8A84B11', borderRadius: 8, borderBottomWidth: 0, marginVertical: 2 },
  optCyl: { color: '#888060', fontSize: 13, width: 52, textAlign: 'right' },
  optBestText: { color: '#C8A84B' },
  optBar: { flex: 1, height: 6, backgroundColor: '#FFFFFF', borderRadius: 3, overflow: 'hidden' },
  optBarFill: { height: '100%', borderRadius: 3 },
  optBarNorm: { backgroundColor: '#E0D8C0' },
  optBarBest: { backgroundColor: '#C8A84B' },
  optResidual: { color: '#888060', fontSize: 13, width: 48, textAlign: 'right' },
  bestTag: { color: '#C8A84B', fontSize: 10, fontWeight: 'bold', width: 32 },
  applyBtn: {
    backgroundColor: '#2A8A44', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 16,
  },
  applyBtnText: { color: '#C8C8C8', fontSize: 15, fontWeight: '700' },
});
