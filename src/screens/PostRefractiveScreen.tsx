import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Switch, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getPatient, updateEyeRecord } from '../storage/patients';
import {
  runAllMethods, noHistoryConsensus,
  PostRefNoHistoryInput, PostRefHistoryInput, PostRefResult, ProcedureType,
} from '../utils/postRefractiveCalc';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'PostRefractive'>;
type Route = RouteProp<RootStackParamList, 'PostRefractive'>;

const PROCEDURE_LABELS: ProcedureType[] = ['LASIK', 'PRK', 'RK'];

export default function PostRefractiveScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();

  // ── Current (post-op) K ────────────────────────────────────────────────
  const [kFlat,  setKFlat]  = useState('');
  const [kSteep, setKSteep] = useState('');
  const [procedure, setProcedure] = useState<ProcedureType>('LASIK');

  // ── History fields ─────────────────────────────────────────────────────
  const [useHistory, setUseHistory] = useState(false);
  const [preKFlat,  setPreKFlat]  = useState('');
  const [preKSteep, setPreKSteep] = useState('');
  const [preOpSEQ,  setPreOpSEQ]  = useState('');
  const [postOpSEQ, setPostOpSEQ] = useState('');
  const [lasikRx,   setLasikRx]   = useState('');

  // ── Results ────────────────────────────────────────────────────────────
  const [results, setResults] = useState<PostRefResult[]>([]);
  const [consensus, setConsensus] = useState<{ meanKFlat: number; meanKSteep: number; meanK: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPatient(params.patientId).then(p => {
        const eye = p?.eyes.find(e => e.id === params.eyeId);
        if (!eye) return;
        if (eye.k1Power) setKFlat(String(eye.k1Power));
        if (eye.k2Power) setKSteep(String(eye.k2Power));
        if (eye.postRefractiveType) setProcedure(eye.postRefractiveType as ProcedureType);
      });
    }, [params.patientId, params.eyeId])
  );

  function handleCalculate() {
    const kF = parseFloat(kFlat);
    const kS = parseFloat(kSteep);
    if (isNaN(kF) || isNaN(kS) || kF <= 0 || kS <= 0) {
      Alert.alert('Input Error', 'Enter valid current K1 (flat) and K2 (steep) values.');
      return;
    }
    if (kF > kS) {
      Alert.alert('Input Error', 'K1 (flat) should be ≤ K2 (steep). Check your keratometry values.');
      return;
    }

    const noHxInput: PostRefNoHistoryInput = { kFlat: kF, kSteep: kS, procedure };

    let hxInput: PostRefHistoryInput | undefined;
    if (useHistory) {
      const pkF   = parseFloat(preKFlat);
      const pkS   = parseFloat(preKSteep);
      const preSEQ = parseFloat(preOpSEQ);
      const pstSEQ = parseFloat(postOpSEQ);
      if (isNaN(pkF) || isNaN(pkS) || isNaN(preSEQ) || isNaN(pstSEQ)) {
        Alert.alert('Input Error', 'Fill all history fields or disable "Include History".');
        return;
      }
      hxInput = {
        ...noHxInput,
        preOpKFlat: pkF, preOpKSteep: pkS,
        preOpSEQ: preSEQ, postOpSEQ: pstSEQ,
        lasikRx: lasikRx ? parseFloat(lasikRx) : undefined,
      };
    }

    const res = runAllMethods(noHxInput, hxInput);
    setResults(res);
    setConsensus(noHistoryConsensus(res));
  }

  async function handleApplyToRecord() {
    if (!consensus) return;
    setSaving(true);
    try {
      const p   = await getPatient(params.patientId);
      const eye = p?.eyes.find(e => e.id === params.eyeId);
      if (!eye) return;
      await updateEyeRecord(params.patientId, {
        ...eye,
        k1Power: consensus.meanKFlat,
        k2Power: consensus.meanKSteep,
      });
      Alert.alert(
        'Applied',
        `Adjusted K values saved to eye record:\nK1 = ${consensus.meanKFlat} D  K2 = ${consensus.meanKSteep} D\n\nNow run the Toric Calculator to use them.`,
        [{ text: 'OK', onPress: () => nav.goBack() }]
      );
    } finally {
      setSaving(false);
    }
  }

  const methodColor = (m: PostRefResult) =>
    m.requiresHistory ? '#4488DD' : '#C8A84B';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* Header banner */}
      <View style={s.banner}>
        <Text style={s.bannerTitle}>Post-Refractive IOL Calculator</Text>
        <Text style={s.bannerDesc}>
          Adjusts corneal power for eyes with prior refractive surgery using the methods
          employed by the ASCRS &amp; ESCRS post-refractive calculators.
        </Text>
      </View>

      {/* Procedure selector */}
      <Text style={s.sectionHeader}>Prior Procedure</Text>
      <View style={s.chipRow}>
        {PROCEDURE_LABELS.map(p => (
          <TouchableOpacity
            key={p}
            style={[s.chip, procedure === p && s.chipActive]}
            onPress={() => setProcedure(p)}
          >
            <Text style={[s.chipText, procedure === p && s.chipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {procedure === 'RK' && (
        <View style={s.warningBox}>
          <Text style={s.warningText}>
            ⚠  Radial keratotomy causes variable, diurnally fluctuating corneal power.
            Calculations are estimates only. Use the highest available keratometry reading and
            consider a conservative (lower) IOL power to avoid hyperopic surprise.
          </Text>
        </View>
      )}

      {/* Current K (post-op) */}
      <Text style={s.sectionHeader}>Current (Post-Op) Keratometry</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.half}>
            <Text style={s.label}>K1 Flat (D)</Text>
            <TextInput style={s.input} value={kFlat} onChangeText={setKFlat}
              keyboardType="decimal-pad" placeholder="e.g. 40.50" placeholderTextColor="#AAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>K2 Steep (D)</Text>
            <TextInput style={s.input} value={kSteep} onChangeText={setKSteep}
              keyboardType="decimal-pad" placeholder="e.g. 41.75" placeholderTextColor="#AAA" />
          </View>
        </View>
        <Text style={s.hint}>K1 = flat (lower D) · K2 = steep (higher D)</Text>
      </View>

      {/* History toggle */}
      <View style={s.historyToggleRow}>
        <Text style={s.historyToggleLabel}>Include Pre-Op History</Text>
        <Switch
          value={useHistory}
          onValueChange={setUseHistory}
          trackColor={{ false: '#DDD5BB', true: '#C8A84B' }}
          thumbColor="#fff"
        />
      </View>
      <Text style={s.hint}>
        {useHistory
          ? 'History-based methods (Masket, Clinical History) are the most accurate.'
          : 'No-history methods (Shammas, Haigis-L) will be used — useful when pre-op records unavailable.'}
      </Text>

      {/* History fields */}
      {useHistory && (
        <>
          <Text style={s.sectionHeader}>Pre-Op Keratometry</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>Pre-Op K1 Flat (D)</Text>
                <TextInput style={s.input} value={preKFlat} onChangeText={setPreKFlat}
                  keyboardType="decimal-pad" placeholder="e.g. 44.00" placeholderTextColor="#AAA" />
              </View>
              <View style={s.half}>
                <Text style={s.label}>Pre-Op K2 Steep (D)</Text>
                <TextInput style={s.input} value={preKSteep} onChangeText={setPreKSteep}
                  keyboardType="decimal-pad" placeholder="e.g. 44.75" placeholderTextColor="#AAA" />
              </View>
            </View>
          </View>

          <Text style={s.sectionHeader}>Pre &amp; Post-Op Refraction (Spectacle Plane SEQ)</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>Pre-Op SEQ (D)</Text>
                <TextInput style={s.input} value={preOpSEQ} onChangeText={setPreOpSEQ}
                  keyboardType="numbers-and-punctuation" placeholder="e.g. -4.50" placeholderTextColor="#AAA" />
              </View>
              <View style={s.half}>
                <Text style={s.label}>Post-Op SEQ (D)</Text>
                <TextInput style={s.input} value={postOpSEQ} onChangeText={setPostOpSEQ}
                  keyboardType="numbers-and-punctuation" placeholder="e.g. -0.25" placeholderTextColor="#AAA" />
              </View>
            </View>
            <Text style={[s.label, { marginTop: 10 }]}>LASIK Rx Performed (optional)</Text>
            <TextInput style={s.input} value={lasikRx} onChangeText={setLasikRx}
              keyboardType="numbers-and-punctuation"
              placeholder="e.g. -4.50 (leave blank to use SEQ difference)"
              placeholderTextColor="#AAA" />
            <Text style={s.hint}>Negative for myopic correction. Used by Masket formula.</Text>
          </View>
        </>
      )}

      <TouchableOpacity style={s.calcBtn} onPress={handleCalculate}>
        <Text style={s.calcBtnText}>Calculate All Methods</Text>
      </TouchableOpacity>

      {/* ── Results ── */}
      {results.length > 0 && (
        <>
          {/* Consensus */}
          {consensus && (
            <>
              <Text style={s.sectionHeader}>Recommended Adjusted K (No-History Consensus)</Text>
              <View style={s.consensusCard}>
                <Text style={s.consensusLabel}>Mean of no-history methods</Text>
                <View style={s.consensusRow}>
                  <View style={s.consensusItem}>
                    <Text style={s.consensusNum}>{consensus.meanKFlat}</Text>
                    <Text style={s.consensusItemLabel}>K1 Flat (D)</Text>
                  </View>
                  <View style={s.consensusDivider} />
                  <View style={s.consensusItem}>
                    <Text style={s.consensusNum}>{consensus.meanKSteep}</Text>
                    <Text style={s.consensusItemLabel}>K2 Steep (D)</Text>
                  </View>
                  <View style={s.consensusDivider} />
                  <View style={s.consensusItem}>
                    <Text style={s.consensusNum}>{consensus.meanK}</Text>
                    <Text style={s.consensusItemLabel}>Mean K (D)</Text>
                  </View>
                </View>
                <Text style={s.consensusHint}>
                  ASCRS & ESCRS recommend using the mean/median of multiple methods.
                  If history is available, weight history-based results more heavily.
                </Text>
              </View>
            </>
          )}

          {/* Method breakdown */}
          <Text style={s.sectionHeader}>Method Breakdown</Text>
          {results.map((r, i) => (
            <View key={i} style={s.resultCard}>
              <View style={s.resultHeader}>
                <View style={[s.methodBadge, { backgroundColor: methodColor(r) + '22', borderColor: methodColor(r) }]}>
                  <Text style={[s.methodBadgeText, { color: methodColor(r) }]}>
                    {r.requiresHistory ? 'WITH HISTORY' : 'NO HISTORY'}
                  </Text>
                </View>
                <Text style={s.methodName}>{r.methodName}</Text>
              </View>

              <View style={s.resultGrid}>
                <ResultCell label="K1 Adj" value={`${r.adjustedKFlat} D`} />
                <ResultCell label="K2 Adj" value={`${r.adjustedKSteep} D`} />
                <ResultCell label="Mean K" value={`${r.adjustedMeanK} D`} highlight />
                {r.iolPowerAdjustment !== undefined && (
                  <ResultCell
                    label="IOL Adj"
                    value={`${r.iolPowerAdjustment >= 0 ? '+' : ''}${r.iolPowerAdjustment} D`}
                    highlight
                    highlightColor="#4488DD"
                  />
                )}
              </View>

              <Text style={s.resultFormula}>{r.formula}</Text>
              <Text style={s.resultRef}>📚 {r.reference}</Text>
              {r.warning && <Text style={s.resultWarning}>⚠ {r.warning}</Text>}
            </View>
          ))}

          {/* IOL Power Adjustment note */}
          {results.some(r => r.iolPowerAdjustment !== undefined) && (
            <View style={s.infoBox}>
              <Text style={s.infoTitle}>About IOL Power Adjustments</Text>
              <Text style={s.infoText}>
                The Masket formula provides an IOL power adjustment to add to the value from a standard
                formula (e.g. SRK/T, Holladay 1). Example: if SRK/T gives 21.00 D and Masket gives
                +1.41 D, use 22.41 D. Enter this corrected IOL power in the Toric Calculator.
              </Text>
            </View>
          )}

          {/* Apply button */}
          <TouchableOpacity
            style={[s.applyBtn, saving && { opacity: 0.6 }]}
            onPress={handleApplyToRecord}
            disabled={saving}
          >
            <Text style={s.applyBtnText}>
              {saving ? 'Saving…' : 'Apply Adjusted K to Eye Record'}
            </Text>
          </TouchableOpacity>

          <View style={s.disclaimer}>
            <Text style={s.disclaimerText}>
              ⚕ Clinical decision support only. Cross-reference with the ASCRS Post-Refractive
              IOL Calculator (iolcalc.ascrs.org) and ESCRS Calculator before finalising IOL selection.
              Barrett True-K requires the online calculators as it is a proprietary algorithm.
            </Text>
          </View>
        </>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function ResultCell({
  label, value, highlight = false, highlightColor = '#C8A84B',
}: {
  label: string; value: string; highlight?: boolean; highlightColor?: string;
}) {
  return (
    <View style={[s.resultCell, highlight && { borderColor: highlightColor, borderWidth: 1.5 }]}>
      <Text style={s.resultCellLabel}>{label}</Text>
      <Text style={[s.resultCellValue, highlight && { color: highlightColor }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },

  banner: {
    backgroundColor: '#0d0d1a', borderRadius: 12, padding: 16, marginBottom: 16,
  },
  bannerTitle: { color: '#C8A84B', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  bannerDesc: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 17 },

  sectionHeader: {
    color: '#888060', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginTop: 16,
  },
  hint: { color: '#888060', fontSize: 11, marginTop: 5, fontStyle: 'italic' },

  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: {
    flex: 1, borderWidth: 1.5, borderColor: '#DDD5BB', borderRadius: 8,
    paddingVertical: 9, alignItems: 'center', backgroundColor: '#F8F6EF',
  },
  chipActive: { backgroundColor: '#C8A84B', borderColor: '#C8A84B' },
  chipText: { color: '#888060', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  warningBox: {
    backgroundColor: '#FFF8E8', borderRadius: 10, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#C8A84B55',
  },
  warningText: { color: '#7a5010', fontSize: 12, lineHeight: 17 },

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

  historyToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#DDD5BB', marginTop: 16,
  },
  historyToggleLabel: { color: '#1A1200', fontSize: 14, fontWeight: '600' },

  calcBtn: {
    backgroundColor: '#C8A84B', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
  },
  calcBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Consensus
  consensusCard: {
    backgroundColor: '#0d0d1a', borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: '#C8A84B',
  },
  consensusLabel: { color: '#C8A84B', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  consensusRow: { flexDirection: 'row', alignItems: 'center' },
  consensusItem: { flex: 1, alignItems: 'center' },
  consensusNum: { color: '#C8A84B', fontSize: 22, fontWeight: '700' },
  consensusItemLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, marginTop: 2 },
  consensusDivider: { width: 1, height: 40, backgroundColor: 'rgba(200,168,75,0.3)' },
  consensusHint: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 12, fontStyle: 'italic' },

  // Result cards
  resultCard: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#DDD5BB', marginBottom: 10,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  methodBadge: {
    borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  methodBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  methodName: { color: '#1A1200', fontSize: 14, fontWeight: '600' },

  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  resultCell: {
    flex: 1, minWidth: 70, backgroundColor: '#FFFFFF',
    borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#DDD5BB',
    alignItems: 'center',
  },
  resultCellLabel: { color: '#888060', fontSize: 9, textTransform: 'uppercase', marginBottom: 3 },
  resultCellValue: { color: '#1A1200', fontSize: 16, fontWeight: '700' },

  resultFormula: { color: '#888060', fontSize: 11, fontStyle: 'italic', marginBottom: 4 },
  resultRef: { color: '#888060', fontSize: 10 },
  resultWarning: { color: '#AA6600', fontSize: 10, marginTop: 4, fontStyle: 'italic' },

  infoBox: {
    backgroundColor: '#EEF6FF', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#BBDDFF', marginTop: 10,
  },
  infoTitle: { color: '#1a3a6a', fontSize: 12, fontWeight: '600', marginBottom: 5 },
  infoText: { color: '#1a3a6a', fontSize: 11, lineHeight: 16 },

  applyBtn: {
    backgroundColor: '#2A8A44', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 16,
  },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  disclaimer: {
    backgroundColor: '#FFF0EE', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#FFCCBB', marginTop: 12,
  },
  disclaimerText: { color: '#7a2010', fontSize: 11, lineHeight: 16 },
});
