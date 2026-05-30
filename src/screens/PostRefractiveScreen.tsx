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
  runAllMethods, noHistoryConsensus, srktPower, srktPowerDoubleK, roundQtr,
  hofferQPower, holladay1Power, holladay1PowerDoubleK, haigisIOLPower,
  aConstToSF, aConstToPACD, aConstToHaigisA0,
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

  // ── Topography fields (no history required) ────────────────────────────
  const [showTopo,         setShowTopo]         = useState(false);
  // Myopic LASIK/PRK topo
  const [pentacamTNP,      setPentacamTNP]      = useState('');
  const [galileiTCP2,      setGalileiTCP2]      = useState('');
  const [tomeyACCP,        setTomeyACCP]        = useState('');
  const [atlasCentral,     setAtlasCentral]     = useState('');
  // RK-specific topo
  const [pentacamPWRSF,    setPentacamPWRSF]    = useState('');
  const [pentacamCTMin,    setPentacamCTMin]    = useState('');
  const [avgCentralPower,  setAvgCentralPower]  = useState('');
  // History-dependent topography
  const [atlasRing0mm,     setAtlasRing0mm]     = useState('');
  const [atlasRing1mm,     setAtlasRing1mm]     = useState('');
  const [atlasRing2mm,     setAtlasRing2mm]     = useState('');
  const [atlasRing3mm,     setAtlasRing3mm]     = useState('');
  const [atlasRing4mm,     setAtlasRing4mm]     = useState('');
  const [atlasRingMean,    setAtlasRingMean]    = useState('');
  const [effRP,            setEffRP]            = useState('');
  const [octNetCorneal,    setOctNetCorneal]    = useState('');
  const [octPosterior,     setOctPosterior]     = useState('');
  const [cct,              setCct]              = useState('');
  // ── Extended biometry ─────────────────────────────────────────────────
  const [acd,              setAcd]              = useState('');
  const [lensThick,        setLensThick]        = useState('');
  const [wtw,              setWtw]              = useState('');
  const [sfHolladay,       setSfHolladay]       = useState('');
  const [haigisA0,         setHaigisA0]         = useState('');
  const [haigisA1,         setHaigisA1]         = useState('');
  const [haigisA2,         setHaigisA2]         = useState('');
  const [keratIndex,       setKeratIndex]       = useState('1.3375');
  // Modern formula constants (ESCRS)
  const [barrettAConst,    setBarrettAConst]    = useState('');
  const [cookeAConst,      setCookeAConst]      = useState('');
  const [evoAConst,        setEvoAConst]        = useState('');
  const [hillRBFAConst,    setHillRBFAConst]    = useState('');
  const [hofferPACD,       setHofferPACD]       = useState('');
  const [kaneAConst,       setKaneAConst]       = useState('');
  const [pearlDGSAConst,   setPearlDGSAConst]   = useState('');
  // Eye flags
  const [isArgosAL,        setIsArgosAL]        = useState(false);
  const [isKeratoconus,    setIsKeratoconus]    = useState(false);

  // ── Biometry ───────────────────────────────────────────────────────────
  const [axialLength, setAxialLength] = useState('');
  const [aConst, setAConst]           = useState('118.0');
  const [targetRx, setTargetRx]       = useState('0.00');

  // ── Results ────────────────────────────────────────────────────────────
  const [results, setResults] = useState<PostRefResult[]>([]);
  const [consensus, setConsensus] = useState<{ meanKFlat: number; meanKSteep: number; meanK: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPatient(params.patientId).then(p => {
        const eye = p?.eyes.find(e => e.id === params.eyeId);
        if (!eye) return;
        if (eye.axialLength) setAxialLength(String(eye.axialLength));
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

    const noHxInput: PostRefNoHistoryInput = {
      kFlat: kF, kSteep: kS, procedure,
      pentacamTNP:        pentacamTNP      ? parseFloat(pentacamTNP)      : undefined,
      pentacamPWRSF4mm:   pentacamPWRSF    ? parseFloat(pentacamPWRSF)    : undefined,
      pentacamCTMin:      pentacamCTMin    ? parseFloat(pentacamCTMin)    : undefined,
      galileiTCP2:        galileiTCP2      ? parseFloat(galileiTCP2)      : undefined,
      tomeyACCP:          tomeyACCP        ? parseFloat(tomeyACCP)        : undefined,
      atlasCentralPower:  atlasCentral     ? parseFloat(atlasCentral)     : undefined,
      avgCentralPower:    avgCentralPower  ? parseFloat(avgCentralPower)  : undefined,
    };

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
        lasikRx:              lasikRx    ? parseFloat(lasikRx)    : undefined,
        atlasRingMean0_3:     atlasRingMean ? parseFloat(atlasRingMean)  : undefined,
        atlasRing0mm:         atlasRing0mm  ? parseFloat(atlasRing0mm)  : undefined,
        atlasRing1mm:         atlasRing1mm  ? parseFloat(atlasRing1mm)  : undefined,
        atlasRing2mm:         atlasRing2mm  ? parseFloat(atlasRing2mm)  : undefined,
        atlasRing3mm:         atlasRing3mm  ? parseFloat(atlasRing3mm)  : undefined,
        atlasRing4mm:         atlasRing4mm  ? parseFloat(atlasRing4mm)  : undefined,
        effRP:                effRP         ? parseFloat(effRP)         : undefined,
        octNetCornealPower:   octNetCorneal ? parseFloat(octNetCorneal) : undefined,
        octPosteriorCornealPower: octPosterior ? parseFloat(octPosterior) : undefined,
        centralCornealThickness:  cct          ? parseFloat(cct)          : undefined,
        haigisA0:    haigisA0   ? parseFloat(haigisA0)   : undefined,
        haigisA1:    haigisA1   ? parseFloat(haigisA1)   : undefined,
        haigisA2:    haigisA2   ? parseFloat(haigisA2)   : undefined,
        sfHolladay1: sfHolladay ? parseFloat(sfHolladay) : undefined,
        acd:         acd        ? parseFloat(acd)        : undefined,
        lensThickness: lensThick ? parseFloat(lensThick) : undefined,
        wtw:         wtw        ? parseFloat(wtw)        : undefined,
        keratometricIndex: keratIndex ? parseFloat(keratIndex) : undefined,
        barrettAConst:  barrettAConst  ? parseFloat(barrettAConst)  : undefined,
        cookeAConst:    cookeAConst    ? parseFloat(cookeAConst)    : undefined,
        evoAConst:      evoAConst      ? parseFloat(evoAConst)      : undefined,
        hillRBFAConst:  hillRBFAConst  ? parseFloat(hillRBFAConst)  : undefined,
        hofferPACD:     hofferPACD     ? parseFloat(hofferPACD)     : undefined,
        kaneAConst:     kaneAConst     ? parseFloat(kaneAConst)     : undefined,
        pearlDGSAConst: pearlDGSAConst ? parseFloat(pearlDGSAConst) : undefined,
        isArgosAL,
        isKeratoconus,
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
      const AL = parseFloat(axialLength);
      await updateEyeRecord(params.patientId, {
        ...eye,
        axialLength: !isNaN(AL) ? AL : eye.axialLength,
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

      {/* Eye flags */}
      <View style={s.flagRow}>
        <TouchableOpacity
          style={[s.flagChip, isArgosAL && s.flagChipActive]}
          onPress={() => setIsArgosAL(v => !v)}
        >
          <Text style={[s.flagChipText, isArgosAL && s.flagChipTextActive]}>
            Argos (SoS) AL
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.flagChip, isKeratoconus && s.flagChipActive]}
          onPress={() => setIsKeratoconus(v => !v)}
        >
          <Text style={[s.flagChipText, isKeratoconus && s.flagChipTextActive]}>
            Keratoconus
          </Text>
        </TouchableOpacity>
      </View>
      {isArgosAL && (
        <Text style={s.hint}>
          Argos (SoS) axial length uses Sum-of-Segments method — more accurate for post-refractive eyes.
          Enter the Argos AL value in the Axial Length field below.
        </Text>
      )}
      {isKeratoconus && (
        <View style={s.warningBox}>
          <Text style={s.warningText}>
            ⚠  Keratoconus eye — post-refractive K correction methods are not validated for KC.
            Barrett True-K and Kane have specific KC modes. Consult the ESCRS calculator.
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

      {/* Topography toggle — available with or without history */}
      <View style={s.historyToggleRow}>
        <Text style={s.historyToggleLabel}>Add Topography / OCT Values</Text>
        <Switch
          value={showTopo}
          onValueChange={setShowTopo}
          trackColor={{ false: '#DDD5BB', true: '#C8A84B' }}
          thumbColor="#fff"
        />
      </View>

      {showTopo && (
        <>
          {/* ── Pentacam section — procedure-specific ── */}
          {procedure !== 'RK' && (
            <View style={s.pentacamCard}>
              <Text style={s.pentacamTitle}>Pentacam (Oculus) — LASIK / PRK</Text>
              <Text style={s.label}>TNP_Apex 4.0mm Zone (D)  — Total Net Power</Text>
              <TextInput style={s.input} value={pentacamTNP} onChangeText={setPentacamTNP}
                keyboardType="decimal-pad" placeholder="e.g. 38.60" placeholderTextColor="#AAA" />
              <Text style={s.hint}>
                Preferred topo source for LASIK/PRK — total corneal power including posterior contribution.
              </Text>
            </View>
          )}

          {procedure === 'RK' && (
            <View style={s.pentacamCard}>
              <Text style={s.pentacamTitle}>Pentacam (Oculus) — RK</Text>
              <Text style={s.label}>PWR_SF_Pupil_4.0mm Zone (D)  — Sagittal Curvature Front Mean (Km)</Text>
              <TextInput style={s.input} value={pentacamPWRSF} onChangeText={setPentacamPWRSF}
                keyboardType="decimal-pad" placeholder="e.g. 40.20" placeholderTextColor="#AAA" />
              <Text style={[s.label, { marginTop: 10 }]}>CT_MIN (µm)  — Minimum Central Corneal Thickness</Text>
              <TextInput style={s.input} value={pentacamCTMin} onChangeText={setPentacamCTMin}
                keyboardType="decimal-pad" placeholder="e.g. 490" placeholderTextColor="#AAA" />
              <Text style={s.hint}>
                PWR_SF_Pupil_4.0mm Zone is found on the Power Distribution display. CT_MIN is the minimum
                central thickness shown by the Pentacam. Both are specific to RK calculations.
              </Text>
            </View>
          )}

          {/* ── Other topo devices — LASIK/PRK only ── */}
          {procedure !== 'RK' && (
            <View style={s.card}>
              <Text style={s.topoDeviceHeader}>Other Topography Devices — LASIK / PRK</Text>
              <Text style={s.label}>Galilei TCP2 (D)</Text>
              <TextInput style={s.input} value={galileiTCP2} onChangeText={setGalileiTCP2}
                keyboardType="decimal-pad" placeholder="e.g. 39.20" placeholderTextColor="#AAA" />
              <Text style={[s.label, { marginTop: 10 }]}>Tomey ACCP / Nidek ACP/APP (D)</Text>
              <TextInput style={s.input} value={tomeyACCP} onChangeText={setTomeyACCP}
                keyboardType="decimal-pad" placeholder="e.g. 39.50" placeholderTextColor="#AAA" />
              <Text style={[s.label, { marginTop: 10 }]}>Atlas 9000 Central K — 4mm Zone (D)</Text>
              <TextInput style={s.input} value={atlasCentral} onChangeText={setAtlasCentral}
                keyboardType="decimal-pad" placeholder="e.g. 40.91" placeholderTextColor="#AAA" />
              <Text style={s.hint}>
                Pentacam TNP is preferred. Galilei → Tomey → Atlas used as fallback in priority order.
              </Text>
            </View>
          )}

          {/* ── RK: Average Central Power ── */}
          {procedure === 'RK' && (
            <View style={s.card}>
              <Text style={s.topoDeviceHeader}>RK Topography</Text>
              <Text style={s.label}>Average Central Power* (D)  — from topo device, not SimK</Text>
              <TextInput style={s.input} value={avgCentralPower} onChangeText={setAvgCentralPower}
                keyboardType="decimal-pad" placeholder="e.g. 40.50" placeholderTextColor="#AAA" />
              <Text style={[s.label, { marginTop: 10 }]}>EyeSys EffRP (D)</Text>
              <TextInput style={s.input} value={effRP} onChangeText={setEffRP}
                keyboardType="decimal-pad" placeholder="e.g. 41.20" placeholderTextColor="#AAA" />
              <Text style={s.hint}>*Average central corneal power from device, not SimK values.</Text>
            </View>
          )}

          {/* ── OCT ── */}
          <View style={s.card}>
            <Text style={s.topoDeviceHeader}>OCT — RTVue / Avanti XR</Text>
            <View style={s.row}>
              <View style={s.half}>
                <Text style={s.label}>Net Corneal Power (D)</Text>
                <TextInput style={s.input} value={octNetCorneal} onChangeText={setOctNetCorneal}
                  keyboardType="decimal-pad" placeholder="e.g. 38.90" placeholderTextColor="#AAA" />
              </View>
              <View style={s.half}>
                <Text style={s.label}>Posterior Corneal Power (D)</Text>
                <TextInput style={s.input} value={octPosterior} onChangeText={setOctPosterior}
                  keyboardType="decimal-pad" placeholder="e.g. -6.10" placeholderTextColor="#AAA" />
              </View>
            </View>
            <Text style={[s.label, { marginTop: 10 }]}>Central Corneal Thickness (µm)</Text>
            <TextInput style={s.input} value={cct} onChangeText={setCct}
              keyboardType="decimal-pad" placeholder="e.g. 520" placeholderTextColor="#AAA" />
          </View>

          {/* ── Atlas Ring Values — history required ── */}
          {useHistory && (
            <View style={s.card}>
              {procedure === 'RK' ? (
                <>
                  <Text style={s.topoDeviceHeader}>Atlas Ring Values — RK (1–4mm)</Text>
                  <View style={s.row}>
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
                    <View style={s.quarter}>
                      <Text style={s.label}>4mm (D)</Text>
                      <TextInput style={s.input} value={atlasRing4mm} onChangeText={setAtlasRing4mm}
                        keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#AAA" />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.topoDeviceHeader}>Atlas Ring Values — LASIK / PRK (0–3mm)</Text>
                  <View style={s.row}>
                    <View style={s.quarter}>
                      <Text style={s.label}>0mm (D)</Text>
                      <TextInput style={s.input} value={atlasRing0mm} onChangeText={setAtlasRing0mm}
                        keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#AAA" />
                    </View>
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
                  </View>
                  <Text style={[s.label, { marginTop: 10 }]}>EyeSys EffRP (D)  — for Adjusted EffRP method</Text>
                  <TextInput style={s.input} value={effRP} onChangeText={setEffRP}
                    keyboardType="decimal-pad" placeholder="e.g. 41.20" placeholderTextColor="#AAA" />
                </>
              )}
              <Text style={[s.label, { marginTop: 10 }]}>Ring Mean (D)  — overrides individual values above</Text>
              <TextInput style={s.input} value={atlasRingMean} onChangeText={setAtlasRingMean}
                keyboardType="decimal-pad" placeholder="pre-computed mean (optional shortcut)" placeholderTextColor="#AAA" />
            </View>
          )}
        </>
      )}

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

      {/* Biometry */}
      <Text style={s.sectionHeader}>Biometry (for IOL Power)</Text>
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
            <Text style={s.label}>Formula</Text>
            <View style={[s.input, { justifyContent: 'center' }]}>
              <Text style={{ color: '#888060', fontSize: 14 }}>SRK/T</Text>
            </View>
          </View>
        </View>

        {/* Extended biometry */}
        <View style={s.biometryDivider} />
        <Text style={s.topoDeviceHeader}>Extended Biometry</Text>
        <View style={s.row}>
          <View style={s.half}>
            <Text style={s.label}>ACD (mm)</Text>
            <TextInput style={s.input} value={acd} onChangeText={setAcd}
              keyboardType="decimal-pad" placeholder="e.g. 3.15" placeholderTextColor="#AAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Lens Thick (mm)</Text>
            <TextInput style={s.input} value={lensThick} onChangeText={setLensThick}
              keyboardType="decimal-pad" placeholder="e.g. 4.50" placeholderTextColor="#AAA" />
          </View>
        </View>
        <View style={[s.row, { marginTop: 10 }]}>
          <View style={s.half}>
            <Text style={s.label}>WTW (mm)</Text>
            <TextInput style={s.input} value={wtw} onChangeText={setWtw}
              keyboardType="decimal-pad" placeholder="e.g. 11.8" placeholderTextColor="#AAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>SF — Holladay 1</Text>
            <TextInput style={s.input} value={sfHolladay} onChangeText={setSfHolladay}
              keyboardType="decimal-pad" placeholder="e.g. 1.68" placeholderTextColor="#AAA" />
          </View>
        </View>

        {/* Keratometric index */}
        <Text style={[s.label, { marginTop: 10 }]}>Device Keratometric Index (n)</Text>
        <View style={s.chipRow}>
          {(['1.3375', '1.332'] as const).map(idx => (
            <TouchableOpacity
              key={idx}
              style={[s.chip, keratIndex === idx && s.chipActive, { flex: 0, paddingHorizontal: 18 }]}
              onPress={() => setKeratIndex(idx)}
            >
              <Text style={[s.chipText, keratIndex === idx && s.chipTextActive]}>{idx}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={['1.3375', '1.332'].includes(keratIndex) ? '' : keratIndex}
            onChangeText={setKeratIndex}
            keyboardType="decimal-pad"
            placeholder="Other"
            placeholderTextColor="#AAA"
          />
        </View>

        {/* Haigis constants */}
        {procedure !== 'RK' && (
          <>
            <Text style={[s.label, { marginTop: 10 }]}>Haigis Constants  (leave blank to use converted A-const)</Text>
            <View style={s.row}>
              <View style={s.third}>
                <Text style={s.label}>a0</Text>
                <TextInput style={s.input} value={haigisA0} onChangeText={setHaigisA0}
                  keyboardType="numbers-and-punctuation" placeholder="conv." placeholderTextColor="#AAA" />
              </View>
              <View style={s.third}>
                <Text style={s.label}>a1  (default 0.4)</Text>
                <TextInput style={s.input} value={haigisA1} onChangeText={setHaigisA1}
                  keyboardType="decimal-pad" placeholder="0.4" placeholderTextColor="#AAA" />
              </View>
              <View style={s.third}>
                <Text style={s.label}>a2  (default 0.1)</Text>
                <TextInput style={s.input} value={haigisA2} onChangeText={setHaigisA2}
                  keyboardType="decimal-pad" placeholder="0.1" placeholderTextColor="#AAA" />
              </View>
            </View>
          </>
        )}

        {/* Modern formula constants (ESCRS) */}
        <View style={s.biometryDivider} />
        <Text style={s.topoDeviceHeader}>Modern Formula Constants  (ESCRS)</Text>
        <Text style={s.hint}>
          Barrett, EVO, Hill-RBF, Kane, Pearl DGS — enter from your IOL manufacturer data
          or optimised constants from ULIB / IOLCon. Leave blank if not available.
        </Text>
        <View style={[s.row, { marginTop: 8 }]}>
          <View style={s.half}>
            <Text style={s.label}>Barrett A-Constant</Text>
            <TextInput style={s.input} value={barrettAConst} onChangeText={setBarrettAConst}
              keyboardType="decimal-pad" placeholder="e.g. 119.36" placeholderTextColor="#AAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Cooke K6 A-Constant</Text>
            <TextInput style={s.input} value={cookeAConst} onChangeText={setCookeAConst}
              keyboardType="decimal-pad" placeholder="e.g. 119.20" placeholderTextColor="#AAA" />
          </View>
        </View>
        <View style={[s.row, { marginTop: 10 }]}>
          <View style={s.half}>
            <Text style={s.label}>EVO A-Constant</Text>
            <TextInput style={s.input} value={evoAConst} onChangeText={setEvoAConst}
              keyboardType="decimal-pad" placeholder="e.g. 119.40" placeholderTextColor="#AAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Hill-RBF A-Constant</Text>
            <TextInput style={s.input} value={hillRBFAConst} onChangeText={setHillRBFAConst}
              keyboardType="decimal-pad" placeholder="e.g. 119.30" placeholderTextColor="#AAA" />
          </View>
        </View>
        <View style={[s.row, { marginTop: 10 }]}>
          <View style={s.half}>
            <Text style={s.label}>Hoffer® QST  pACD</Text>
            <TextInput style={s.input} value={hofferPACD} onChangeText={setHofferPACD}
              keyboardType="decimal-pad" placeholder="e.g. 5.62" placeholderTextColor="#AAA" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Kane A-Constant</Text>
            <TextInput style={s.input} value={kaneAConst} onChangeText={setKaneAConst}
              keyboardType="decimal-pad" placeholder="e.g. 119.22" placeholderTextColor="#AAA" />
          </View>
        </View>
        <View style={[s.row, { marginTop: 10 }]}>
          <View style={s.half}>
            <Text style={s.label}>Pearl DGS A-Constant</Text>
            <TextInput style={s.input} value={pearlDGSAConst} onChangeText={setPearlDGSAConst}
              keyboardType="decimal-pad" placeholder="e.g. 119.10" placeholderTextColor="#AAA" />
          </View>
          <View style={s.half} />
        </View>

        <Text style={s.hint}>
          Common A-constants: AcrySof SA60AT 118.4 · Tecnis ZCB00 119.3 · CT LUCIA 611P 118.8
        </Text>
      </View>

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

          {/* IOL Power Results — multiple formulas */}
          {(() => {
            const AL  = parseFloat(axialLength);
            const AC  = parseFloat(aConst);
            const tRx = parseFloat(targetRx) || 0;
            if (isNaN(AL) || AL <= 15 || AL >= 36 || isNaN(AC)) return null;

            // Formula constants — use explicit entry if available, else derive from A-const
            const sfDerived    = !sfHolladay;
            const pACDDerived  = !hofferPACD;
            const a0Derived    = !haigisA0;
            const SF_val   = sfHolladay  ? parseFloat(sfHolladay)  : aConstToSF(AC);
            const pACD_val = hofferPACD  ? parseFloat(hofferPACD)  : aConstToPACD(AC);
            const a0_val   = haigisA0    ? parseFloat(haigisA0)    : aConstToHaigisA0(AC);
            const a1_val   = haigisA1    ? parseFloat(haigisA1)    : 0.4;
            const a2_val   = haigisA2    ? parseFloat(haigisA2)    : 0.1;
            const ACD_meas = acd ? parseFloat(acd) : null;
            const hasHaigis = ACD_meas !== null && !isNaN(ACD_meas);
            const anyDerived = sfDerived || pACDDerived || (hasHaigis && a0Derived);

            const computeAll = (meanK: number, elpK: number | undefined, iolAdj: number) => {
              const adj = iolAdj;
              const srkt = roundQtr(
                (elpK != null ? srktPowerDoubleK(meanK, elpK, AL, AC, tRx)
                              : srktPower(meanK, AL, AC, tRx)) + adj);
              const hofferQ = roundQtr(hofferQPower(meanK, AL, pACD_val, tRx) + adj);
              const holladay1 = roundQtr(
                (elpK != null ? holladay1PowerDoubleK(meanK, elpK, AL, SF_val, tRx)
                              : holladay1Power(meanK, AL, SF_val, tRx)) + adj);
              const haigis = hasHaigis
                ? roundQtr(haigisIOLPower(meanK, AL, ACD_meas!, a0_val, a1_val, a2_val, tRx) + adj)
                : null;
              return { srkt, hofferQ, holladay1, haigis };
            };

            const iolRows = results.map(r => ({
              method: r.methodName,
              requiresHistory: r.requiresHistory,
              isDoubleK: r.elpK != null,
              adj: r.iolPowerAdjustment,
              ...computeAll(r.adjustedMeanK, r.elpK, r.iolPowerAdjustment ?? 0),
            }));

            const noHxRows = iolRows.filter(x => !x.requiresHistory && !x.isDoubleK);
            const meanOf = (vals: (number | null)[]) => {
              const v = vals.filter((n): n is number => n !== null);
              return v.length ? roundQtr(v.reduce((a, b) => a + b, 0) / v.length) : null;
            };
            const cSRKT     = meanOf(noHxRows.map(x => x.srkt));
            const cHofferQ  = meanOf(noHxRows.map(x => x.hofferQ));
            const cHolladay = meanOf(noHxRows.map(x => x.holladay1));
            const cHaigis   = hasHaigis ? meanOf(noHxRows.map(x => x.haigis)) : null;

            return (
              <>
                <Text style={s.sectionHeader}>IOL Power Results — Multiple Formulas</Text>

                {/* Consensus card */}
                <View style={s.iolConsensusCard}>
                  <Text style={s.iolConsensusLabel}>No-History Consensus (Mean)</Text>
                  <View style={s.iolFormulaGrid}>
                    <IolFormulaCell label="SRK/T" value={cSRKT} />
                    <IolFormulaCell label="Hoffer Q" value={cHofferQ} derived={pACDDerived} />
                    <IolFormulaCell label="Holladay 1" value={cHolladay} derived={sfDerived} />
                    {hasHaigis && <IolFormulaCell label="Haigis" value={cHaigis} derived={a0Derived} />}
                  </View>
                  {anyDerived && (
                    <Text style={s.iolSafeLabel}>
                      * constant estimated from A-constant — enter specific constants in Biometry for accuracy
                    </Text>
                  )}
                  <Text style={[s.iolSafeLabel, { marginTop: 4 }]}>
                    Conservative choice: use the highest value to avoid hyperopic surprise
                  </Text>
                </View>

                {/* Per-method breakdown */}
                <View style={s.iolTable}>
                  <View style={s.iolTableHeader}>
                    <Text style={[s.iolMethodCol, s.iolHeaderText]}>K Method</Text>
                    <Text style={[s.iolFormulaCol, s.iolHeaderText]}>SRK/T</Text>
                    <Text style={[s.iolFormulaCol, s.iolHeaderText]}>Hoffer Q</Text>
                    <Text style={[s.iolFormulaCol, s.iolHeaderText]}>Holladay 1</Text>
                    {hasHaigis && <Text style={[s.iolFormulaCol, s.iolHeaderText]}>Haigis</Text>}
                  </View>
                  {iolRows.map((row, i) => (
                    <View key={i} style={[s.iolTableRow, i % 2 === 0 && s.iolTableRowAlt]}>
                      <View style={s.iolMethodCol}>
                        <Text style={s.iolMethodText} numberOfLines={2}>{row.method}</Text>
                        <Text style={[s.iolBadge, { color: row.isDoubleK ? '#AA44AA' : row.requiresHistory ? '#4488DD' : '#C8A84B' }]}>
                          {row.isDoubleK ? '2K-ELP' : row.requiresHistory ? 'HISTORY' : 'NO HX'}
                          {row.adj !== undefined ? `  adj ${row.adj >= 0 ? '+' : ''}${row.adj}` : ''}
                        </Text>
                      </View>
                      <Text style={[s.iolFormulaCol, s.iolValueText]}>{row.srkt}</Text>
                      <Text style={[s.iolFormulaCol, s.iolValueText]}>{row.hofferQ}</Text>
                      <Text style={[s.iolFormulaCol, s.iolValueText]}>{row.holladay1}</Text>
                      {hasHaigis && <Text style={[s.iolFormulaCol, s.iolValueText]}>{row.haigis ?? '—'}</Text>}
                    </View>
                  ))}
                </View>
                <Text style={s.hint}>
                  IOL powers rounded to 0.25 D. All formulas use adjusted K from each method.
                  {anyDerived ? ' (*) = constant derived from A-constant.' : ''}
                </Text>
              </>
            );
          })()}

          {/* Method breakdown */}
          <Text style={s.sectionHeader}>K Adjustment Breakdown</Text>
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

          <View style={s.barrettBox}>
            <Text style={s.barrettTitle}>Barrett True-K</Text>
            <Text style={s.barrettText}>
              The Barrett True-K formula is proprietary (APACRS/Asia Pacific) and cannot be reproduced
              here. Use it at: apacrs.org/barrett_true_K — it is among the highest-accuracy methods
              for post-myopic LASIK/PRK and should be included in your final IOL selection.
            </Text>
          </View>

          <View style={s.disclaimer}>
            <Text style={s.disclaimerText}>
              ⚕ Clinical decision support only. 2K-ELP methods (Aramberri Double-K) correct the
              ELP formula error that causes +1.7 D hyperopic shift with SRK/T after myopic LASIK.
              Cross-reference with ASCRS iolcalc.ascrs.org and ESCRS calculators before finalising.
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

function IolFormulaCell({
  label, value, derived,
}: { label: string; value: number | null; derived?: boolean }) {
  return (
    <View style={s.iolFormulaCell}>
      <Text style={s.iolFormulaCellLabel}>{label}{derived ? ' *' : ''}</Text>
      <Text style={s.iolFormulaCellValue}>{value !== null ? `${value} D` : '—'}</Text>
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

  flagRow: {
    flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap',
  },
  flagChip: {
    borderWidth: 1.5, borderColor: '#DDD5BB', borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#F8F6EF',
  },
  flagChipActive: { backgroundColor: '#1a3a6a', borderColor: '#4488DD' },
  flagChipText: { color: '#888060', fontSize: 13, fontWeight: '600' },
  flagChipTextActive: { color: '#AACCFF' },

  pentacamCard: {
    backgroundColor: '#F0EDF8', borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: '#AA88CC', marginTop: 8,
  },
  pentacamTitle: {
    color: '#5522AA', fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  topoDeviceHeader: {
    color: '#888060', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  quarter: { flex: 1 },
  third: { flex: 1 },
  biometryDivider: {
    height: 1, backgroundColor: '#DDD5BB', marginVertical: 12,
  },

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

  // IOL power table
  iolConsensusCard: {
    backgroundColor: '#0d1a2e', borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: '#4488DD', marginBottom: 12,
  },
  iolConsensusLabel: { color: '#88AADD', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  iolConsensusNum: { color: '#FFFFFF', fontSize: 32, fontWeight: '700', marginVertical: 4 },
  iolSafeLabel: { color: '#88AADD', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  iolFormulaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10,
  },
  iolFormulaCell: {
    flex: 1, minWidth: 72, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: 8,
  },
  iolFormulaCellLabel: {
    color: '#88AADD', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3,
  },
  iolFormulaCellValue: {
    color: '#FFFFFF', fontSize: 19, fontWeight: '700',
  },
  iolMethodCol: { flex: 2, paddingRight: 6 },
  iolFormulaCol: { flex: 1.2, textAlign: 'right' as const },
  iolTable: {
    backgroundColor: '#F8F6EF', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#DDD5BB', marginBottom: 6,
  },
  iolTableHeader: {
    flexDirection: 'row', backgroundColor: '#EDE9DE',
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  iolHeaderText: { color: '#888060', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  iolTableRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  iolTableRowAlt: { backgroundColor: '#F0EDE4' },
  iolCol1: { flex: 3, flexDirection: 'column' },
  iolCol2: { flex: 2, textAlign: 'right' },
  iolCol3: { flex: 1, textAlign: 'right' },
  iolMethodText: { color: '#1A1200', fontSize: 12, fontWeight: '600' },
  iolBadge: { fontSize: 9, fontWeight: '700', marginTop: 1 },
  iolValueText: { color: '#1A1200', fontSize: 16, fontWeight: '700', textAlign: 'right' },
  iolAdjText: { color: '#888060', fontSize: 11, textAlign: 'right' },

  barrettBox: {
    backgroundColor: '#F0EDF8', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#AA88CC', marginTop: 12,
  },
  barrettTitle: { color: '#5522AA', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  barrettText: { color: '#442288', fontSize: 11, lineHeight: 16 },

  disclaimer: {
    backgroundColor: '#FFF0EE', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#FFCCBB', marginTop: 12,
  },
  disclaimerText: { color: '#7a2010', fontSize: 11, lineHeight: 16 },
});
