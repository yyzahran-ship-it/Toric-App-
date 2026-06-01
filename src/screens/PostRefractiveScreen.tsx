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
  runAllMethods, noHistoryConsensus, srktPower, srktPowerDoubleK,
  hofferQPower, holladay1Power, holladay1PowerDoubleK, haigisIOLPower,
  aConstToSF, aConstToPACD, aConstToHaigisA0,
  roundQtr,
  PostRefNoHistoryInput, PostRefHistoryInput, PostRefResult, ProcedureType,
} from '../utils/postRefractiveCalc';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'PostRefractive'>;
type Route = RouteProp<RootStackParamList, 'PostRefractive'>;

const PROCEDURE_LABELS: ProcedureType[] = ['LASIK', 'PRK', 'RK'];

export default function PostRefractiveScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();

  // ── Procedure ──────────────────────────────────────────────────────────────
  const [procedure, setProcedure] = useState<ProcedureType>('LASIK');

  // ── Current (post-op) keratometry ──────────────────────────────────────────
  const [kFlat,  setKFlat]  = useState('');
  const [kSteep, setKSteep] = useState('');

  // ── Topography ─────────────────────────────────────────────────────────────
  const [showTopo,       setShowTopo]       = useState(false);
  const [pentacamTNP,    setPentacamTNP]    = useState('');
  const [pentacamPWRSF,  setPentacamPWRSF]  = useState('');
  const [pentacamCTMin,  setPentacamCTMin]  = useState('');
  const [galileiTCP2,    setGalileiTCP2]    = useState('');
  const [tomeyACCP,      setTomeyACCP]      = useState('');
  const [atlasCentral,   setAtlasCentral]   = useState('');
  const [avgCentral,     setAvgCentral]     = useState('');
  const [effRP,          setEffRP]          = useState('');
  // Contact lens over-refraction
  const [clBaseCurve,    setClBaseCurve]    = useState('');
  const [clPower,        setClPower]        = useState('');
  const [clRxWith,       setClRxWith]       = useState('');
  const [clRxWithout,    setClRxWithout]    = useState('');

  // ── Pre-op history ─────────────────────────────────────────────────────────
  const [useHistory, setUseHistory] = useState(false);
  const [preKFlat,   setPreKFlat]   = useState('');
  const [preKSteep,  setPreKSteep]  = useState('');
  const [preOpSEQ,   setPreOpSEQ]   = useState('');
  const [postOpSEQ,  setPostOpSEQ]  = useState('');
  const [lasikRx,    setLasikRx]    = useState('');
  // Atlas rings (for Adjusted Atlas method)
  const [showAtlas,      setShowAtlas]      = useState(false);
  const [atlasRing0mm,   setAtlasRing0mm]   = useState('');
  const [atlasRing1mm,   setAtlasRing1mm]   = useState('');
  const [atlasRing2mm,   setAtlasRing2mm]   = useState('');
  const [atlasRing3mm,   setAtlasRing3mm]   = useState('');
  const [atlasRing4mm,   setAtlasRing4mm]   = useState('');

  // ── Biometry (for IOL power) ───────────────────────────────────────────────
  const [axialLength, setAxialLength] = useState('');
  const [aConst,      setAConst]      = useState('118.0');
  const [targetRx,    setTargetRx]    = useState('0.00');
  // Optional: specific formula constants
  const [sfHolladay,  setSfHolladay]  = useState('');
  const [hofferPACD,  setHofferPACD]  = useState('');
  const [haigisA0,    setHaigisA0]    = useState('');
  const [haigisA1,    setHaigisA1]    = useState('');
  const [haigisA2,    setHaigisA2]    = useState('');
  const [measuredACD, setMeasuredACD] = useState('');

  // ── Results ────────────────────────────────────────────────────────────────
  const [results,   setResults]   = useState<PostRefResult[]>([]);
  const [consensus, setConsensus] = useState<{ meanKFlat: number; meanKSteep: number; meanK: number } | null>(null);
  const [saving,    setSaving]    = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!params?.patientId || !params?.eyeId) return;
      getPatient(params.patientId).then(p => {
        const eye = p?.eyes.find(e => e.id === params.eyeId);
        if (!eye) return;
        if (eye.axialLength) setAxialLength(String(eye.axialLength));
        if (eye.k1Power)     setKFlat(String(eye.k1Power));
        if (eye.k2Power)     setKSteep(String(eye.k2Power));
        if (eye.postRefractiveType) setProcedure(eye.postRefractiveType as ProcedureType);
      });
    }, [params?.patientId, params?.eyeId])
  );

  function handleCalculate() {
    const kF = parseFloat(kFlat);
    const kS = parseFloat(kSteep);
    if (isNaN(kF) || isNaN(kS) || kF <= 0 || kS <= 0) {
      Alert.alert('Input Error', 'Enter valid K1 (flat) and K2 (steep) values.');
      return;
    }
    if (kF > kS) {
      Alert.alert('Input Error', 'K1 should be ≤ K2 (flat ≤ steep). Check your values.');
      return;
    }

    const noHxInput: PostRefNoHistoryInput = {
      kFlat: kF, kSteep: kS, procedure,
      pentacamTNP:        pentacamTNP    ? parseFloat(pentacamTNP)    : undefined,
      pentacamPWRSF4mm:   pentacamPWRSF  ? parseFloat(pentacamPWRSF)  : undefined,
      pentacamCTMin:      pentacamCTMin  ? parseFloat(pentacamCTMin)  : undefined,
      galileiTCP2:        galileiTCP2    ? parseFloat(galileiTCP2)    : undefined,
      tomeyACCP:          tomeyACCP      ? parseFloat(tomeyACCP)      : undefined,
      atlasCentralPower:  atlasCentral   ? parseFloat(atlasCentral)   : undefined,
      avgCentralPower:    avgCentral     ? parseFloat(avgCentral)     : undefined,
      axialLength:        axialLength    ? parseFloat(axialLength)    : undefined,
      clBaseCurve:        clBaseCurve    ? parseFloat(clBaseCurve)    : undefined,
      clPower:            clPower        ? parseFloat(clPower)        : undefined,
      clRefractionWith:   clRxWith       ? parseFloat(clRxWith)       : undefined,
      clRefractionWithout: clRxWithout   ? parseFloat(clRxWithout)    : undefined,
    };

    let hxInput: PostRefHistoryInput | undefined;
    if (useHistory) {
      const pkF  = parseFloat(preKFlat);
      const pkS  = parseFloat(preKSteep);
      const preSEQ = parseFloat(preOpSEQ);
      const pstSEQ = parseFloat(postOpSEQ);
      if (isNaN(pkF) || isNaN(pkS) || isNaN(preSEQ) || isNaN(pstSEQ)) {
        Alert.alert('Input Error', 'Fill all pre-op history fields or disable the history toggle.');
        return;
      }
      hxInput = {
        ...noHxInput,
        preOpKFlat: pkF, preOpKSteep: pkS,
        preOpSEQ: preSEQ, postOpSEQ: pstSEQ,
        lasikRx:    lasikRx   ? parseFloat(lasikRx)   : undefined,
        effRP:      effRP     ? parseFloat(effRP)     : undefined,
        atlasRing0mm: atlasRing0mm ? parseFloat(atlasRing0mm) : undefined,
        atlasRing1mm: atlasRing1mm ? parseFloat(atlasRing1mm) : undefined,
        atlasRing2mm: atlasRing2mm ? parseFloat(atlasRing2mm) : undefined,
        atlasRing3mm: atlasRing3mm ? parseFloat(atlasRing3mm) : undefined,
        atlasRing4mm: atlasRing4mm ? parseFloat(atlasRing4mm) : undefined,
        sfHolladay1: sfHolladay ? parseFloat(sfHolladay) : undefined,
        hofferPACD:  hofferPACD ? parseFloat(hofferPACD) : undefined,
        haigisA0:    haigisA0  ? parseFloat(haigisA0)  : undefined,
        haigisA1:    haigisA1  ? parseFloat(haigisA1)  : undefined,
        haigisA2:    haigisA2  ? parseFloat(haigisA2)  : undefined,
        measuredACD: measuredACD ? parseFloat(measuredACD) : undefined,
      };
    }

    const res = runAllMethods(noHxInput, hxInput);
    setResults(res);
    setConsensus(noHistoryConsensus(res));
  }

  async function handleApplyToRecord() {
    if (!consensus) return;
    if (!params?.patientId || !params?.eyeId) {
      Alert.alert('No Patient', 'Open this calculator from a patient eye record to save results.');
      return;
    }
    setSaving(true);
    try {
      const p   = await getPatient(params.patientId);
      const eye = p?.eyes.find(e => e.id === params.eyeId);
      if (!eye) return;
      const AL = parseFloat(axialLength);
      await updateEyeRecord(params.patientId, {
        ...eye,
        axialLength: !isNaN(AL) ? AL : eye.axialLength,
        k1Power: consensus.meanKFlat,
        k2Power: consensus.meanKSteep,
      });
      Alert.alert(
        'Applied',
        `Adjusted K values saved:\nK1 = ${consensus.meanKFlat} D  K2 = ${consensus.meanKSteep} D\n\nNow run the Toric Calculator.`,
        [{ text: 'OK', onPress: () => nav.goBack() }]
      );
    } finally {
      setSaving(false);
    }
  }

  // IOL power calculation block
  const iolBlock = (() => {
    if (!results.length) return null;
    const AL  = parseFloat(axialLength);
    const AC  = parseFloat(aConst);
    const tRx = parseFloat(targetRx) || 0;
    if (isNaN(AL) || AL < 16 || AL > 36 || isNaN(AC)) return null;

    const SF_val   = sfHolladay  ? parseFloat(sfHolladay)  : aConstToSF(AC);
    const pACD_val = hofferPACD  ? parseFloat(hofferPACD)  : aConstToPACD(AC);
    const a0_val   = haigisA0    ? parseFloat(haigisA0)    : aConstToHaigisA0(AC);
    const a1_val   = haigisA1    ? parseFloat(haigisA1)    : 0.4;
    const a2_val   = haigisA2    ? parseFloat(haigisA2)    : 0.1;
    const ACD_meas = measuredACD ? parseFloat(measuredACD) : null;
    const hasHaigis = ACD_meas !== null && !isNaN(ACD_meas);

    interface IolRow {
      method: string;
      requiresHistory: boolean;
      isDoubleK: boolean;
      isIolAdj: boolean;
      srkt: number | null;
      hofferQ: number | null;
      holladay1: number | null;
      haigis: number | null;
    }

    const rows: IolRow[] = results
      .filter(r => r.iolPowerAdjustment == null || r.iolPowerAdjustment !== undefined)
      .map(r => {
        const isIolAdj = r.iolPowerAdjustment !== undefined;
        const adj      = r.iolPowerAdjustment ?? 0;
        const mk       = r.adjustedMeanK;
        const ek       = r.elpK;

        const srkt = isIolAdj
          ? roundQtr(srktPower(mk, AL, AC, tRx) + adj)
          : ek != null
            ? roundQtr(srktPowerDoubleK(mk, ek, AL, AC, tRx))
            : roundQtr(srktPower(mk, AL, AC, tRx));

        const hofferQ = isIolAdj
          ? roundQtr(hofferQPower(mk, AL, pACD_val, tRx) + adj)
          : roundQtr(hofferQPower(mk, AL, pACD_val, tRx));

        const holladay1 = isIolAdj
          ? roundQtr(holladay1Power(mk, AL, SF_val, tRx) + adj)
          : ek != null
            ? roundQtr(holladay1PowerDoubleK(mk, ek, AL, SF_val, tRx))
            : roundQtr(holladay1Power(mk, AL, SF_val, tRx));

        const haigis = hasHaigis
          ? roundQtr(haigisIOLPower(mk, AL, ACD_meas!, a0_val, a1_val, a2_val, tRx) + adj)
          : null;

        return {
          method: r.methodName,
          requiresHistory: r.requiresHistory,
          isDoubleK: ek != null,
          isIolAdj,
          srkt,
          hofferQ,
          holladay1,
          haigis,
        };
      });

    // Consensus: average K-adjustment no-history non-doubleK rows
    const noHxKRows = rows.filter(r => !r.requiresHistory && !r.isDoubleK && !r.isIolAdj);
    const meanOf = (vals: (number | null)[]) => {
      const v = vals.filter((n): n is number => n !== null);
      return v.length ? roundQtr(v.reduce((a, b) => a + b, 0) / v.length) : null;
    };
    const cSRKT     = meanOf(noHxKRows.map(r => r.srkt));
    const cHofferQ  = meanOf(noHxKRows.map(r => r.hofferQ));
    const cHolladay = meanOf(noHxKRows.map(r => r.holladay1));
    const cHaigis   = hasHaigis ? meanOf(noHxKRows.map(r => r.haigis)) : null;

    const sfDerived   = !sfHolladay;
    const pACDDerived = !hofferPACD;
    const a0Derived   = !haigisA0;

    return { rows, cSRKT, cHofferQ, cHolladay, cHaigis, hasHaigis, sfDerived, pACDDerived, a0Derived };
  })();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      {/* Banner */}
      <View style={s.banner}>
        <Text style={s.bannerTitle}>Post-Refractive IOL Calculator</Text>
        <Text style={s.bannerDesc}>
          Adjusts corneal power for eyes with prior refractive surgery.
          K corrections and IOL power from validated published methods.
        </Text>
      </View>

      {/* Procedure */}
      <Text style={s.sectionHeader}>Prior Procedure</Text>
      <View style={s.chipRow}>
        {PROCEDURE_LABELS.map(p => (
          <TouchableOpacity key={p}
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
            ⚠  Radial keratotomy: corneal power fluctuates diurnally. Measure K in the
            afternoon; use the flattest available reading. Consider a conservative (lower)
            IOL power to avoid hyperopic surprise.
          </Text>
        </View>
      )}

      {/* Current K */}
      <Text style={s.sectionHeader}>Current Post-Op Keratometry</Text>
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
        <Text style={s.hint}>K1 = flat meridian (lower value) · K2 = steep meridian (higher value)</Text>
      </View>

      {/* Topography toggle */}
      <View style={s.toggleRow}>
        <Text style={s.toggleLabel}>Add Topography Values</Text>
        <Switch value={showTopo} onValueChange={setShowTopo}
          trackColor={{ false: '#DDD5BB', true: '#C8A84B' }} thumbColor="#fff" />
      </View>

      {showTopo && (
        <View style={s.card}>
          {procedure !== 'RK' ? (
            <>
              <Text style={s.cardSection}>Pentacam — LASIK / PRK</Text>
              <Text style={s.label}>TNP_Apex 4.0 mm Zone — Total Net Power (D)</Text>
              <TextInput style={s.input} value={pentacamTNP} onChangeText={setPentacamTNP}
                keyboardType="decimal-pad" placeholder="e.g. 38.60 (preferred source)" placeholderTextColor="#AAA" />
              <Text style={[s.cardSection, { marginTop: 14 }]}>Other Devices — LASIK / PRK</Text>
              <Text style={s.label}>Galilei TCP2 (D)</Text>
              <TextInput style={s.input} value={galileiTCP2} onChangeText={setGalileiTCP2}
                keyboardType="decimal-pad" placeholder="e.g. 39.20" placeholderTextColor="#AAA" />
              <Text style={[s.label, { marginTop: 10 }]}>Tomey ACCP / Nidek ACP (D)</Text>
              <TextInput style={s.input} value={tomeyACCP} onChangeText={setTomeyACCP}
                keyboardType="decimal-pad" placeholder="e.g. 39.50" placeholderTextColor="#AAA" />
              <Text style={[s.label, { marginTop: 10 }]}>Atlas 9000 Central 4 mm Zone (D)</Text>
              <TextInput style={s.input} value={atlasCentral} onChangeText={setAtlasCentral}
                keyboardType="decimal-pad" placeholder="e.g. 40.91" placeholderTextColor="#AAA" />
              <Text style={s.hint}>Priority: Pentacam TNP → Galilei → Tomey → Atlas</Text>
            </>
          ) : (
            <>
              <Text style={s.cardSection}>Pentacam — RK</Text>
              <Text style={s.label}>PWR_SF_Pupil 4.0 mm Zone — Sagittal Front Mean (D)</Text>
              <TextInput style={s.input} value={pentacamPWRSF} onChangeText={setPentacamPWRSF}
                keyboardType="decimal-pad" placeholder="e.g. 40.20" placeholderTextColor="#AAA" />
              <Text style={[s.label, { marginTop: 10 }]}>CT_MIN — Minimum Central Thickness (µm)</Text>
              <TextInput style={s.input} value={pentacamCTMin} onChangeText={setPentacamCTMin}
                keyboardType="decimal-pad" placeholder="e.g. 490" placeholderTextColor="#AAA" />
              <Text style={[s.cardSection, { marginTop: 14 }]}>RK Topography — Other Devices</Text>
              <Text style={s.label}>Average Central Power (D) — not SimK</Text>
              <TextInput style={s.input} value={avgCentral} onChangeText={setAvgCentral}
                keyboardType="decimal-pad" placeholder="e.g. 40.50" placeholderTextColor="#AAA" />
              <Text style={[s.label, { marginTop: 10 }]}>EyeSys EffRP (D)</Text>
              <TextInput style={s.input} value={effRP} onChangeText={setEffRP}
                keyboardType="decimal-pad" placeholder="e.g. 41.20" placeholderTextColor="#AAA" />
            </>
          )}

          <View style={s.divider} />
          <Text style={s.cardSection}>Contact Lens Over-Refraction  (hard PMMA plano CL only)</Text>
          <Text style={s.hint}>K = BCL + PCL + R(with CL) − R(without CL)</Text>
          <View style={[s.row, { marginTop: 8 }]}>
            <View style={s.half}>
              <Text style={s.label}>Base Curve BCL (D)</Text>
              <TextInput style={s.input} value={clBaseCurve} onChangeText={setClBaseCurve}
                keyboardType="decimal-pad" placeholder="e.g. 43.00" placeholderTextColor="#AAA" />
            </View>
            <View style={s.half}>
              <Text style={s.label}>CL Power PCL (D)</Text>
              <TextInput style={s.input} value={clPower} onChangeText={setClPower}
                keyboardType="numbers-and-punctuation" placeholder="0.00 (plano)" placeholderTextColor="#AAA" />
            </View>
          </View>
          <View style={[s.row, { marginTop: 10 }]}>
            <View style={s.half}>
              <Text style={s.label}>Refraction WITH CL (D)</Text>
              <TextInput style={s.input} value={clRxWith} onChangeText={setClRxWith}
                keyboardType="numbers-and-punctuation" placeholder="e.g. −0.50" placeholderTextColor="#AAA" />
            </View>
            <View style={s.half}>
              <Text style={s.label}>Refraction WITHOUT CL (D)</Text>
              <TextInput style={s.input} value={clRxWithout} onChangeText={setClRxWithout}
                keyboardType="numbers-and-punctuation" placeholder="e.g. −5.00" placeholderTextColor="#AAA" />
            </View>
          </View>
        </View>
      )}

      {/* History toggle */}
      <View style={s.toggleRow}>
        <Text style={s.toggleLabel}>Include Pre-Op History</Text>
        <Switch value={useHistory} onValueChange={setUseHistory}
          trackColor={{ false: '#DDD5BB', true: '#C8A84B' }} thumbColor="#fff" />
      </View>
      <Text style={s.hint}>
        {useHistory
          ? 'History-based methods (Clinical History, Masket) will be calculated.'
          : 'Without history: Shammas, Haigis-L, topography-based methods only.'}
      </Text>

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

          <Text style={s.sectionHeader}>Pre &amp; Post-Op Refraction — Spectacle Plane SEQ</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>Pre-Op SEQ (D)</Text>
                <TextInput style={s.input} value={preOpSEQ} onChangeText={setPreOpSEQ}
                  keyboardType="numbers-and-punctuation" placeholder="e.g. −4.50" placeholderTextColor="#AAA" />
              </View>
              <View style={s.half}>
                <Text style={s.label}>Post-Op SEQ (D)</Text>
                <TextInput style={s.input} value={postOpSEQ} onChangeText={setPostOpSEQ}
                  keyboardType="numbers-and-punctuation" placeholder="e.g. −0.25" placeholderTextColor="#AAA" />
              </View>
            </View>
            <Text style={[s.label, { marginTop: 10 }]}>LASIK Rx Performed (optional)</Text>
            <TextInput style={s.input} value={lasikRx} onChangeText={setLasikRx}
              keyboardType="numbers-and-punctuation"
              placeholder="e.g. −4.50  (leave blank to use SEQ difference)"
              placeholderTextColor="#AAA" />
            <Text style={s.hint}>Negative for myopic correction. Used by Masket formula.</Text>
          </View>

          {/* Atlas rings (optional, history only) */}
          <View style={[s.toggleRow, { marginTop: 8 }]}>
            <Text style={[s.toggleLabel, { fontSize: 13 }]}>Atlas Ring Values (Adjusted Atlas method)</Text>
            <Switch value={showAtlas} onValueChange={setShowAtlas}
              trackColor={{ false: '#DDD5BB', true: '#C8A84B' }} thumbColor="#fff" />
          </View>
          {showAtlas && (
            <View style={s.card}>
              <Text style={s.cardSection}>
                {procedure === 'RK' ? 'Atlas Ring Values — 1–4mm' : 'Atlas Ring Values — 0–3mm'}
              </Text>
              <View style={s.row}>
                {procedure !== 'RK' && (
                  <View style={s.quarter}>
                    <Text style={s.label}>0mm (D)</Text>
                    <TextInput style={s.input} value={atlasRing0mm} onChangeText={setAtlasRing0mm}
                      keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#AAA" />
                  </View>
                )}
                <View style={s.quarter}>
                  <Text style={s.label}>1mm (D)</Text>
                  <TextInput style={s.input} value={atlasRing1mm} onChangeText={setAtlasRing1mm}
                    keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#AAA" />
                </View>
                <View style={s.quarter}>
                  <Text style={s.label}>2mm (D)</Text>
                  <TextInput style={s.input} value={atlasRing2mm} onChangeText={setAtlasRing2mm}
                    keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#AAA" />
                </View>
                <View style={s.quarter}>
                  <Text style={s.label}>3mm (D)</Text>
                  <TextInput style={s.input} value={atlasRing3mm} onChangeText={setAtlasRing3mm}
                    keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#AAA" />
                </View>
                {procedure === 'RK' && (
                  <View style={s.quarter}>
                    <Text style={s.label}>4mm (D)</Text>
                    <TextInput style={s.input} value={atlasRing4mm} onChangeText={setAtlasRing4mm}
                      keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#AAA" />
                  </View>
                )}
              </View>
              {procedure !== 'RK' && (
                <>
                  <Text style={[s.label, { marginTop: 10 }]}>EyeSys EffRP (D)</Text>
                  <TextInput style={s.input} value={effRP} onChangeText={setEffRP}
                    keyboardType="decimal-pad" placeholder="e.g. 41.20" placeholderTextColor="#AAA" />
                </>
              )}
            </View>
          )}
        </>
      )}

      {/* Biometry */}
      <Text style={s.sectionHeader}>Biometry — IOL Power</Text>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.half}>
            <Text style={s.label}>Axial Length (mm)</Text>
            <TextInput style={s.input} value={axialLength} onChangeText={setAxialLength}
              keyboardType="decimal-pad" placeholder="e.g. 23.50" placeholderTextColor="#AAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>A-Constant</Text>
            <TextInput style={s.input} value={aConst} onChangeText={setAConst}
              keyboardType="decimal-pad" placeholder="e.g. 118.0" placeholderTextColor="#AAA" />
          </View>
        </View>
        <View style={[s.row, { marginTop: 10 }]}>
          <View style={s.half}>
            <Text style={s.label}>Target Rx (D)</Text>
            <TextInput style={s.input} value={targetRx} onChangeText={setTargetRx}
              keyboardType="numbers-and-punctuation" placeholder="0.00" placeholderTextColor="#AAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Measured ACD (mm)</Text>
            <TextInput style={s.input} value={measuredACD} onChangeText={setMeasuredACD}
              keyboardType="decimal-pad" placeholder="e.g. 3.15 (for Haigis)" placeholderTextColor="#AAA" />
          </View>
        </View>
        <Text style={s.hint}>
          Common A-constants: AcrySof SA60AT 118.4 · Tecnis ZCB00 119.3 · CT LUCIA 611P 118.8
        </Text>

        {/* Optional formula constants */}
        <View style={s.divider} />
        <Text style={s.cardSection}>Formula Constants  (optional — derived from A-const if blank)</Text>
        <View style={s.row}>
          <View style={s.third}>
            <Text style={s.label}>SF  Holladay 1</Text>
            <TextInput style={s.input} value={sfHolladay} onChangeText={setSfHolladay}
              keyboardType="decimal-pad" placeholder="derived" placeholderTextColor="#AAA" />
          </View>
          <View style={s.third}>
            <Text style={s.label}>pACD  Hoffer Q</Text>
            <TextInput style={s.input} value={hofferPACD} onChangeText={setHofferPACD}
              keyboardType="decimal-pad" placeholder="derived" placeholderTextColor="#AAA" />
          </View>
          <View style={s.third}>
            <Text style={s.label}>a0  Haigis</Text>
            <TextInput style={s.input} value={haigisA0} onChangeText={setHaigisA0}
              keyboardType="numbers-and-punctuation" placeholder="derived" placeholderTextColor="#AAA" />
          </View>
        </View>
        <View style={[s.row, { marginTop: 10 }]}>
          <View style={s.half}>
            <Text style={s.label}>a1  Haigis  (default 0.4)</Text>
            <TextInput style={s.input} value={haigisA1} onChangeText={setHaigisA1}
              keyboardType="decimal-pad" placeholder="0.4" placeholderTextColor="#AAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>a2  Haigis  (default 0.1)</Text>
            <TextInput style={s.input} value={haigisA2} onChangeText={setHaigisA2}
              keyboardType="decimal-pad" placeholder="0.1" placeholderTextColor="#AAA" />
          </View>
        </View>
        <Text style={s.hint}>Haigis IOL power requires measured ACD above.</Text>
      </View>

      {/* Barrett True-K button */}
      <TouchableOpacity style={s.barrettBtn} onPress={() => nav.navigate('BarrettTrueK')}>
        <View>
          <Text style={s.barrettBtnTitle}>Barrett True-K Toric Calculator</Text>
          <Text style={s.barrettBtnSub}>Open APACRS in-app — most accurate for post-LASIK toric cases →</Text>
        </View>
      </TouchableOpacity>

      {/* Calculate */}
      <TouchableOpacity style={s.calcBtn} onPress={handleCalculate}>
        <Text style={s.calcBtnText}>Calculate All Methods</Text>
      </TouchableOpacity>

      {/* ── Results ── */}
      {results.length > 0 && (
        <>
          {/* Consensus adjusted K */}
          {consensus && (
            <>
              <Text style={s.sectionHeader}>No-History Consensus  (mean of Shammas / Haigis-L / topography methods)</Text>
              <View style={s.consensusCard}>
                <View style={s.consensusRow}>
                  <ConsensusCell label="K1 Flat" value={consensus.meanKFlat} />
                  <View style={s.consensusDivider} />
                  <ConsensusCell label="K2 Steep" value={consensus.meanKSteep} />
                  <View style={s.consensusDivider} />
                  <ConsensusCell label="Mean K" value={consensus.meanK} highlight />
                </View>
                <Text style={s.consensusHint}>
                  ASCRS & ESCRS recommend the mean of multiple methods.
                  When history is available, weight history-based results more heavily.
                </Text>
              </View>
            </>
          )}

          {/* IOL Power block */}
          {iolBlock && (
            <>
              <Text style={s.sectionHeader}>IOL Power — No-History Consensus K</Text>
              <View style={s.iolConsensusCard}>
                <Text style={s.iolConsensusLabel}>Formulas · A = {aConst} · AL = {axialLength} mm · Target {targetRx} D</Text>
                <View style={s.iolFormulaGrid}>
                  <IolCell label="SRK/T" value={iolBlock.cSRKT} />
                  <IolCell label={`Hoffer Q${iolBlock.pACDDerived ? '*' : ''}`} value={iolBlock.cHofferQ} />
                  <IolCell label={`Holladay 1${iolBlock.sfDerived ? '*' : ''}`} value={iolBlock.cHolladay} />
                  {iolBlock.hasHaigis && <IolCell label={`Haigis${iolBlock.a0Derived ? '*' : ''}`} value={iolBlock.cHaigis} />}
                </View>
                {(iolBlock.sfDerived || iolBlock.pACDDerived || (iolBlock.hasHaigis && iolBlock.a0Derived)) && (
                  <Text style={s.iolNote}>* constant estimated from A-constant — enter specific constants above for accuracy</Text>
                )}
                <Text style={s.iolNote}>Conservative choice: use the highest value to avoid hyperopic surprise</Text>
              </View>

              {/* K Adjustment — compact table */}
              <Text style={s.sectionHeader}>K Adjustment &amp; IOL Power — Per Method</Text>
              <View style={s.kTable}>
                <View style={[s.kTableRow, s.kTableHeaderRow]}>
                  <Text style={[s.kTColMethod, s.kTHeaderText]}>Method</Text>
                  <Text style={[s.kTColNum, s.kTHeaderText]}>K1 (D)</Text>
                  <Text style={[s.kTColNum, s.kTHeaderText]}>K2 (D)</Text>
                  <Text style={[s.kTColNum, s.kTHeaderText]}>Mean (D)</Text>
                </View>
                <View style={[s.kTableRow, s.kTableIolHeaderRow]}>
                  <View style={s.kTColMethod} />
                  <Text style={[s.kTColNum, s.kTIolHeaderText]}>SRK/T</Text>
                  <Text style={[s.kTColNum, s.kTIolHeaderText]}>Hoffer Q</Text>
                  <Text style={[s.kTColNum, s.kTIolHeaderText]}>Holladay</Text>
                </View>
                {results.filter(r => r.iolPowerAdjustment == null).map((r, i) => {
                  const iolRow = iolBlock.rows.find(x => x.method === r.methodName);
                  return (
                    <View key={i} style={[s.kTableMethodBlock, i % 2 === 1 && s.kTableRowAlt]}>
                      <View style={s.kTableMethodKRow}>
                        <View style={s.kTColMethod}>
                          <Text style={s.kTMethodText} numberOfLines={2}>{r.methodName}</Text>
                          <Text style={[
                            s.kTBadge,
                            r.elpK != null ? s.kTBadgeDK
                              : r.requiresHistory ? s.kTBadgeHx
                              : s.kTBadgeNH,
                          ]}>
                            {r.elpK != null ? 'DK' : r.requiresHistory ? 'HX' : 'NH'}
                          </Text>
                        </View>
                        <Text style={s.kTColNum}>{r.adjustedKFlat}</Text>
                        <Text style={s.kTColNum}>{r.adjustedKSteep}</Text>
                        <Text style={[s.kTColNum, s.kTMeanK]}>{r.adjustedMeanK}</Text>
                      </View>
                      <View style={s.kTIolDivider} />
                      <View style={s.kTableMethodIolRow}>
                        <View style={s.kTColMethod}>
                          <Text style={s.kTIolLabel}>IOL (D)</Text>
                        </View>
                        <Text style={[s.kTColNum, s.kTIolSub]}>{iolRow ? `${iolRow.srkt} D` : '—'}</Text>
                        <Text style={[s.kTColNum, s.kTIolSub]}>{iolRow ? `${iolRow.hofferQ} D` : '—'}</Text>
                        <Text style={[s.kTColNum, s.kTIolSub]}>{iolRow ? `${iolRow.holladay1} D` : '—'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Mean K Summary — Max / Min / Average across all K-adjustment methods */}
              {(() => {
                const kRows = results.filter(r => r.iolPowerAdjustment == null);
                const meanKs = kRows.map(r => r.adjustedMeanK);
                if (meanKs.length < 2) return null;
                const maxK  = Math.max(...meanKs);
                const minK  = Math.min(...meanKs);
                const avgK  = +(meanKs.reduce((a, b) => a + b, 0) / meanKs.length).toFixed(2);
                const spread = +(maxK - minK).toFixed(2);
                return (
                  <>
                    <Text style={s.sectionHeader}>Mean K — Summary Across Methods</Text>
                    <View style={s.kSummaryCard}>
                      <View style={s.kSummaryRow}>
                        <View style={s.kSummaryCell}>
                          <Text style={[s.kSummaryValue, s.kSummaryMax]}>{maxK}</Text>
                          <Text style={s.kSummaryLabel}>Maximum (D)</Text>
                        </View>
                        <View style={s.kSummarySep} />
                        <View style={s.kSummaryCell}>
                          <Text style={[s.kSummaryValue, s.kSummaryAvg]}>{avgK}</Text>
                          <Text style={s.kSummaryLabel}>Average (D)</Text>
                        </View>
                        <View style={s.kSummarySep} />
                        <View style={s.kSummaryCell}>
                          <Text style={[s.kSummaryValue, s.kSummaryMin]}>{minK}</Text>
                          <Text style={s.kSummaryLabel}>Minimum (D)</Text>
                        </View>
                      </View>
                      <Text style={s.kSummaryHint}>
                        Spread: {spread} D across {meanKs.length} methods · Use maximum to avoid hyperopic surprise
                      </Text>
                    </View>
                  </>
                );
              })()}

              {/* IOL Power Summary — Max / Average / Min across K-adjustment methods */}
              {iolBlock.rows.filter(r => !r.isIolAdj).length >= 2 && (() => {
                const iolRows  = iolBlock.rows.filter(r => !r.isIolAdj);
                const srktVals     = iolRows.map(r => r.srkt).filter((v): v is number => v !== null);
                const hofferVals   = iolRows.map(r => r.hofferQ).filter((v): v is number => v !== null);
                const holladay1Vals = iolRows.map(r => r.holladay1).filter((v): v is number => v !== null);
                const avg = (vals: number[]) =>
                  vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
                const fmt = (v: number | null) => v !== null ? `${v} D` : '—';
                return (
                  <>
                    <Text style={s.sectionHeader}>IOL Power — Summary Across Methods</Text>
                    <View style={s.iolSummaryCard}>
                      <View style={s.iolSumRow}>
                        <View style={s.iolSumLabelCol} />
                        <Text style={[s.iolSumCol, s.iolSumHeader]}>SRK/T</Text>
                        <Text style={[s.iolSumCol, s.iolSumHeader]}>Hoffer Q</Text>
                        <Text style={[s.iolSumCol, s.iolSumHeader]}>Holladay</Text>
                      </View>
                      <View style={s.iolSumRow}>
                        <Text style={[s.iolSumLabelCol, s.iolSumRowLabel, { color: '#FF9944' }]}>Max</Text>
                        <Text style={[s.iolSumCol, s.iolSumMax]}>{fmt(srktVals.length ? Math.max(...srktVals) : null)}</Text>
                        <Text style={[s.iolSumCol, s.iolSumMax]}>{fmt(hofferVals.length ? Math.max(...hofferVals) : null)}</Text>
                        <Text style={[s.iolSumCol, s.iolSumMax]}>{fmt(holladay1Vals.length ? Math.max(...holladay1Vals) : null)}</Text>
                      </View>
                      <View style={s.iolSumRow}>
                        <Text style={[s.iolSumLabelCol, s.iolSumRowLabel, { color: '#C8A84B' }]}>Avg</Text>
                        <Text style={[s.iolSumCol, s.iolSumAvg]}>{fmt(avg(srktVals))}</Text>
                        <Text style={[s.iolSumCol, s.iolSumAvg]}>{fmt(avg(hofferVals))}</Text>
                        <Text style={[s.iolSumCol, s.iolSumAvg]}>{fmt(avg(holladay1Vals))}</Text>
                      </View>
                      <View style={s.iolSumRow}>
                        <Text style={[s.iolSumLabelCol, s.iolSumRowLabel, { color: '#44AAFF' }]}>Min</Text>
                        <Text style={[s.iolSumCol, s.iolSumMin]}>{fmt(srktVals.length ? Math.min(...srktVals) : null)}</Text>
                        <Text style={[s.iolSumCol, s.iolSumMin]}>{fmt(hofferVals.length ? Math.min(...hofferVals) : null)}</Text>
                        <Text style={[s.iolSumCol, s.iolSumMin]}>{fmt(holladay1Vals.length ? Math.min(...holladay1Vals) : null)}</Text>
                      </View>
                      <Text style={s.iolSumHint}>
                        Conservative choice: use the highest value across formulas to avoid hyperopic surprise
                      </Text>
                    </View>
                  </>
                );
              })()}

              {/* IOL Power Adjustments — compact table */}
              {results.some(r => r.iolPowerAdjustment != null) && (
                <>
                  <Text style={s.sectionHeader}>IOL Power Adjustment (With History)</Text>
                  <View style={s.infoBox}>
                    <Text style={s.infoText}>
                      Add to a standard-formula IOL power calculated with the regular (non-adjusted) K.
                      Example: SRK/T = 21.0 D + Masket +1.4 D → use 22.5 D.
                    </Text>
                  </View>
                  <View style={s.kTable}>
                    <View style={[s.kTableRow, s.kTableHeaderRow]}>
                      <Text style={[s.kTColMethod, s.kTHeaderText]}>Method</Text>
                      <Text style={[s.kTColNum, s.kTHeaderText]}>IOL Adj (D)</Text>
                    </View>
                    {results.filter(r => r.iolPowerAdjustment != null).map((r, i) => (
                      <View key={i} style={[s.kTableRow, i % 2 === 1 && s.kTableRowAlt]}>
                        <Text style={[s.kTColMethod, s.kTMethodText]}>{r.methodName}</Text>
                        <Text style={[s.kTColNum, s.kTIolAdj]}>
                          {(r.iolPowerAdjustment ?? 0) >= 0 ? '+' : ''}{r.iolPowerAdjustment}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {/* K method table (when no AL entered) */}
          {!iolBlock && results.length > 0 && (
            <>
              <Text style={s.sectionHeader}>Adjusted K — All Methods</Text>
              <View style={s.kTable}>
                <View style={[s.kTableRow, s.kTableHeaderRow]}>
                  <Text style={[s.kTColMethod, s.kTHeaderText]}>Method</Text>
                  <Text style={[s.kTColNum, s.kTHeaderText]}>K1 (D)</Text>
                  <Text style={[s.kTColNum, s.kTHeaderText]}>K2 (D)</Text>
                  <Text style={[s.kTColNum, s.kTHeaderText]}>Mean (D)</Text>
                </View>
                {results.map((r, i) => (
                  <View key={i} style={[s.kTableRow, i % 2 === 1 && s.kTableRowAlt]}>
                    <View style={s.kTColMethod}>
                      <Text style={s.kTMethodText} numberOfLines={2}>{r.methodName}</Text>
                      {r.iolPowerAdjustment != null && (
                        <Text style={[s.kTBadge, s.kTBadgeHx]}>ADJ</Text>
                      )}
                    </View>
                    <Text style={s.kTColNum}>{r.adjustedKFlat}</Text>
                    <Text style={s.kTColNum}>{r.adjustedKSteep}</Text>
                    <Text style={[s.kTColNum, s.kTMeanK]}>{r.adjustedMeanK}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Apply button */}
          <TouchableOpacity
            style={[s.applyBtn, saving && { opacity: 0.6 }]}
            onPress={handleApplyToRecord}
            disabled={saving}
          >
            <Text style={s.applyBtnText}>
              {saving ? 'Saving…' : 'Apply Consensus K to Eye Record'}
            </Text>
          </TouchableOpacity>

          <View style={s.disclaimer}>
            <Text style={s.disclaimerText}>
              ⚕ Clinical decision support only. Cross-reference with ASCRS (iolcalc.ascrs.org)
              and Barrett True-K before finalising. IOL powers rounded to 0.25 D.
              Formula constants marked * are estimated from A-constant — enter exact values for accuracy.
            </Text>
          </View>
        </>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function ConsensusCell({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={s.consensusItem}>
      <Text style={[s.consensusNum, highlight && { color: '#C8A84B' }]}>{value}</Text>
      <Text style={s.consensusItemLabel}>{label} (D)</Text>
    </View>
  );
}

function IolCell({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={s.iolCell}>
      <Text style={s.iolCellLabel}>{label}</Text>
      <Text style={s.iolCellValue}>{value !== null ? `${value} D` : '—'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content:   { padding: 16 },

  banner: {
    backgroundColor: '#0d0d1a', borderRadius: 12, padding: 16, marginBottom: 16,
  },
  bannerTitle: { color: '#C8A84B', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  bannerDesc:  { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 17 },

  sectionHeader: {
    color: '#888060', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginTop: 18,
  },
  hint: { color: '#888060', fontSize: 11, marginTop: 5, fontStyle: 'italic' },

  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: {
    flex: 1, borderWidth: 1.5, borderColor: '#DDD5BB', borderRadius: 8,
    paddingVertical: 9, alignItems: 'center', backgroundColor: '#F8F6EF',
  },
  chipActive: { backgroundColor: '#C8A84B', borderColor: '#C8A84B' },
  chipText:   { color: '#888060', fontSize: 13, fontWeight: '600' },
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
  cardSection: {
    color: '#5522AA', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  divider: { height: 1, backgroundColor: '#DDD5BB', marginVertical: 12 },
  row:     { flexDirection: 'row', gap: 12 },
  half:    { flex: 1 },
  third:   { flex: 1 },
  quarter: { flex: 1 },
  label: {
    color: '#888060', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.3, marginBottom: 5,
  },
  input: {
    backgroundColor: '#FFFFFF', color: '#1A1200', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    borderWidth: 1, borderColor: '#DDD5BB',
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#DDD5BB', marginTop: 16,
  },
  toggleLabel: { color: '#1A1200', fontSize: 14, fontWeight: '600' },

  barrettBtn: {
    backgroundColor: '#1a0d2e', borderRadius: 12, paddingVertical: 14,
    paddingHorizontal: 16, marginTop: 16,
    borderWidth: 1.5, borderColor: '#7744BB',
  },
  barrettBtnTitle: { color: '#DDB8FF', fontSize: 14, fontWeight: '700' },
  barrettBtnSub:   { color: 'rgba(221,184,255,0.6)', fontSize: 11, marginTop: 2 },

  calcBtn: {
    backgroundColor: '#C8A84B', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 16,
  },
  calcBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Consensus K card
  consensusCard: {
    backgroundColor: '#0d0d1a', borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: '#C8A84B',
  },
  consensusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  consensusItem: { flex: 1, alignItems: 'center' },
  consensusNum:  { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  consensusItemLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 },
  consensusDivider:   { width: 1, height: 40, backgroundColor: 'rgba(200,168,75,0.3)' },
  consensusHint: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontStyle: 'italic' },

  // IOL power card
  iolConsensusCard: {
    backgroundColor: '#0d1a2e', borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: '#4488DD',
  },
  iolConsensusLabel: { color: '#88AADD', fontSize: 10, marginBottom: 10 },
  iolFormulaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  iolCell: {
    flex: 1, minWidth: 72, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: 8,
  },
  iolCellLabel: { color: '#88AADD', fontSize: 9, textTransform: 'uppercase', marginBottom: 3 },
  iolCellValue: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  iolNote: { color: '#88AADD', fontSize: 10, fontStyle: 'italic', marginTop: 4 },

  // Compact K table
  kTable: {
    borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: '#DDD5BB', marginBottom: 4,
  },
  kTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  kTableHeaderRow: { backgroundColor: '#E8E4D8' },
  kTableRowAlt: { backgroundColor: '#F8F6EF' },
  kTHeaderText: {
    color: '#888060', fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
  },
  kTColMethod: { flex: 2, paddingRight: 6 },
  kTColNum: {
    flex: 1, textAlign: 'center',
    color: '#1A1200', fontSize: 13, fontWeight: '600',
  },
  kTMethodText: { color: '#1A1200', fontSize: 12, fontWeight: '600' },
  kTBadge: {
    fontSize: 9, fontWeight: '700', borderRadius: 3, paddingHorizontal: 4,
    paddingVertical: 1, alignSelf: 'flex-start', marginTop: 2,
  },
  kTBadgeNH: { backgroundColor: '#C8A84B22', color: '#AA8830' },
  kTBadgeHx: { backgroundColor: '#4488DD22', color: '#4488DD' },
  kTBadgeDK: { backgroundColor: '#7744BB22', color: '#9966DD' },
  kTMeanK: { color: '#C8A84B', fontWeight: '700' },
  kTIolAdj: { color: '#44AAFF', fontWeight: '700', textAlign: 'center' },
  kTableMethodBlock: {},
  kTableMethodKRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 3 },
  kTableMethodIolRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 2, paddingBottom: 8 },
  kTIolDivider: { height: 1, backgroundColor: 'rgba(68,170,255,0.12)', marginHorizontal: 10 },
  kTableIolHeaderRow: { backgroundColor: '#0a1525', paddingVertical: 4 },
  kTIolHeaderText: { color: '#4488DD', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  kTIolLabel: { color: '#44AAFF', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  kTIolSub: { color: '#44AAFF', fontWeight: '700' },

  // Mean K summary card
  kSummaryCard: {
    backgroundColor: '#1a1400', borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: '#C8A84B66',
  },
  kSummaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  kSummaryCell: { flex: 1, alignItems: 'center' },
  kSummarySep: { width: 1, height: 44, backgroundColor: 'rgba(200,168,75,0.25)' },
  kSummaryValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  kSummaryMax:   { color: '#FF9944' },
  kSummaryAvg:   { color: '#C8A84B' },
  kSummaryMin:   { color: '#44AAFF' },
  kSummaryLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 3 },
  kSummaryHint:  { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontStyle: 'italic' },

  // IOL power summary table
  iolSummaryCard: {
    backgroundColor: '#0d1a2e', borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: '#4488DD55',
  },
  iolSumRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  iolSumLabelCol: { width: 36 },
  iolSumCol: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  iolSumHeader: { color: '#4488DD', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  iolSumRowLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  iolSumMax: { color: '#FF9944' },
  iolSumAvg: { color: '#C8A84B' },
  iolSumMin: { color: '#44AAFF' },
  iolSumHint: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontStyle: 'italic', marginTop: 6 },

  infoBox: {
    backgroundColor: '#EEF6FF', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#BBDDFF', marginBottom: 8,
  },
  infoText: { color: '#1a3a6a', fontSize: 12, lineHeight: 17 },

  // Badges (used in some badge styles above)
  badge: {
    borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
  },
  badgeNoHx:    { backgroundColor: '#C8A84B22', borderColor: '#C8A84B' },
  badgeHistory: { backgroundColor: '#4488DD22', borderColor: '#4488DD' },
  badgeDoubleK: { backgroundColor: '#7744BB22', borderColor: '#7744BB' },
  badgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

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
