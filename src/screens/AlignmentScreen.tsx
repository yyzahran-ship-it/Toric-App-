import React, { useCallback, useState } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, TextInput, Alert, ImageBackground,
} from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EyeRecord, Patient, RootStackParamList } from '../types';
import { getPatient, updateEyeRecord } from '../storage/patients';
import AlignmentOverlay from '../components/AlignmentOverlay';
import RotationCalculator from '../components/RotationCalculator';
import { calcResidualAtAxis, rotationEffect } from '../utils/toricMath';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Alignment'>;
type Route = RouteProp<RootStackParamList, 'Alignment'>;

const { width } = Dimensions.get('window');
const IMG_SIZE = width - 32;

export default function AlignmentScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [eye, setEye] = useState<EyeRecord | null>(null);
  const [currentAxisInput, setCurrentAxisInput] = useState('');
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPatient(params.patientId).then(p => {
        if (!p) return;
        setPatient(p);
        const e = p.eyes.find(e => e.id === params.eyeId);
        if (e) {
          setEye(e);
          setCurrentAxisInput(e.currentAxis !== undefined ? String(e.currentAxis) : '');
        }
      });
    }, [params.patientId, params.eyeId])
  );

  async function handleSaveCurrent() {
    if (!eye) return;
    const val = parseInt(currentAxisInput, 10);
    if (isNaN(val) || val < 0 || val > 180) {
      Alert.alert('Invalid', 'Enter a value between 0 and 180.');
      return;
    }
    const updated = { ...eye, currentAxis: val };
    await updateEyeRecord(params.patientId, updated);
    setEye(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const currentAxisNum = parseInt(currentAxisInput, 10);
  const hasCurrentAxis = !isNaN(currentAxisNum) && currentAxisNum >= 0 && currentAxisNum <= 180;

  if (!eye) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.sideBadge, eye.side === 'OD' ? styles.od : styles.os]}>
          <Text style={styles.sideText}>{eye.side}</Text>
        </View>
        <Text style={styles.patientName}>{patient?.name}</Text>
      </View>

      {/* Eye image + overlay */}
      <View style={styles.imageContainer}>
        {eye.imageUri ? (
          <>
            <Image source={{ uri: eye.imageUri }} style={{ width: IMG_SIZE, height: IMG_SIZE, borderRadius: 12 }} resizeMode="cover" />
            <AlignmentOverlay
              size={IMG_SIZE}
              referenceAxis={eye.referenceAxis}
              targetAxis={eye.targetAxis}
              currentAxis={hasCurrentAxis ? currentAxisNum : undefined}
              landmarks={eye.landmarks}
            />
          </>
        ) : (
          <ImageBackground
            source={require('../../assets/gauge-bg.png')}
            style={[styles.noImage, { width: IMG_SIZE, height: IMG_SIZE }]}
            imageStyle={{ borderRadius: 12, opacity: 0.55 }}
            resizeMode="cover"
          >
            <AlignmentOverlay
              size={IMG_SIZE}
              referenceAxis={eye.referenceAxis}
              targetAxis={eye.targetAxis}
              currentAxis={hasCurrentAxis ? currentAxisNum : undefined}
              landmarks={eye.landmarks}
            />
            <TouchableOpacity
              style={styles.cameraBtn}
              onPress={() => nav.navigate('Camera', { patientId: params.patientId, eyeId: params.eyeId })}
            >
              <Text style={styles.cameraBtnText}>Capture Eye Image</Text>
            </TouchableOpacity>
          </ImageBackground>
        )}
      </View>

      {/* Quick actions bar */}
      <View style={styles.quickActions}>
        {eye.imageUri && (
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => nav.navigate('Camera', { patientId: params.patientId, eyeId: params.eyeId })}
          >
            <Text style={styles.quickBtnText}>Recapture</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.quickBtn, styles.quickBtnGold]}
          onPress={() => nav.navigate('LandmarkAnnotation', { patientId: params.patientId, eyeId: params.eyeId })}
        >
          <Text style={[styles.quickBtnText, styles.quickBtnTextGold]}>
            Annotate {eye.landmarks && eye.landmarks.length > 0 ? `(${eye.landmarks.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Current IOL axis input */}
      <View style={styles.currentAxisCard}>
        <Text style={styles.cardLabel}>Current IOL Axis (intraop)</Text>
        <View style={styles.currentRow}>
          <TextInput
            style={styles.axisInput}
            value={currentAxisInput}
            onChangeText={val => setCurrentAxisInput(val.replace(/[^0-9]/g, ''))}
            placeholder="0–180"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text style={styles.degSymbol}>°</Text>
          <TouchableOpacity style={styles.updateBtn} onPress={handleSaveCurrent}>
            <Text style={styles.updateBtnText}>{saved ? 'Saved ✓' : 'Update'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rotation calculator */}
      {hasCurrentAxis && (
        <View style={styles.calcSection}>
          <Text style={styles.sectionTitle}>Rotation Calculator</Text>
          <RotationCalculator currentAxis={currentAxisNum} targetAxis={eye.targetAxis} />
        </View>
      )}

      {/* Residual astigmatism (only when we have K data + IOL cylinder + placed axis) */}
      {hasCurrentAxis && eye.iolCylinder && eye.k1Power !== undefined && eye.k2Power !== undefined && eye.k1Axis !== undefined && (
        <View style={styles.residualCard}>
          <Text style={styles.sectionTitle}>Predicted Residual Astigmatism</Text>
          {(() => {
            const cornealMag = Math.abs(eye.k2Power! - eye.k1Power!);
            const steepAxis = (eye.k1Axis! + 90) % 180;
            const siaMag = eye.sia ?? 0;
            const siaAxis = eye.siaAxis ?? 0;
            const toRad = (d: number) => d * Math.PI / 180;
            const Cx = cornealMag * Math.cos(2 * toRad(steepAxis)) + siaMag * Math.cos(2 * toRad(siaAxis));
            const Cy = cornealMag * Math.sin(2 * toRad(steepAxis)) + siaMag * Math.sin(2 * toRad(siaAxis));
            const effectiveMag = Math.sqrt(Cx * Cx + Cy * Cy);
            let effectiveAxis = (Math.atan2(Cy, Cx) * 180 / Math.PI) / 2;
            if (effectiveAxis < 0) effectiveAxis += 180;
            effectiveAxis = Math.round(effectiveAxis) % 180;
            const residual = calcResidualAtAxis(effectiveMag, effectiveAxis, eye.iolCylinder!, currentAxisNum);
            const color = residual < 0.5 ? '#44FF88' : residual < 1.0 ? '#FFD700' : '#FF6644';
            return (
              <View style={styles.residualRow}>
                <Text style={[styles.residualValue, { color }]}>{residual.toFixed(2)} D</Text>
                <Text style={styles.residualLabel}>
                  {residual < 0.5 ? 'Excellent' : residual < 1.0 ? 'Acceptable' : 'Reposition advised'}
                </Text>
              </View>
            );
          })()}
        </View>
      )}

      {/* Rotation effect chart (needs K data + IOL cylinder) */}
      {eye.iolCylinder && eye.k1Power !== undefined && eye.k2Power !== undefined && eye.k1Axis !== undefined && (() => {
        const cornealMag = Math.abs(eye.k2Power! - eye.k1Power!);
        const steepAxis = (eye.k1Axis! + 90) % 180;
        const siaMag = eye.sia ?? 0;
        const siaAxis2 = eye.siaAxis ?? 0;
        const toRad2 = (d: number) => d * Math.PI / 180;
        const Cx2 = cornealMag * Math.cos(2 * toRad2(steepAxis)) + siaMag * Math.cos(2 * toRad2(siaAxis2));
        const Cy2 = cornealMag * Math.sin(2 * toRad2(steepAxis)) + siaMag * Math.sin(2 * toRad2(siaAxis2));
        const eMag = Math.sqrt(Cx2 * Cx2 + Cy2 * Cy2);
        let eAxis = (Math.atan2(Cy2, Cx2) * 180 / Math.PI) / 2;
        if (eAxis < 0) eAxis += 180;
        eAxis = Math.round(eAxis) % 180;
        const chartData = rotationEffect(eMag, eAxis, eye.iolCylinder!, eAxis);
        const maxR = Math.max(...chartData.map(p => p.residual), 0.5);
        const CW = width - 64;
        const CH = 90;
        const pts = chartData.map(p => ({
          x: ((p.deg + 90) / 180) * CW,
          y: CH - (p.residual / maxR) * (CH - 12),
          deg: p.deg,
          residual: p.residual,
        }));
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const zeroX = (90 / 180) * CW;
        const threshY = CH - (0.5 / maxR) * (CH - 12);
        // Find where current axis lands on chart
        let curDot = null;
        if (hasCurrentAxis) {
          let delta = ((currentAxisNum - eAxis) % 180 + 180) % 180;
          if (delta > 90) delta -= 180;
          const cx = ((delta + 90) / 180) * CW;
          const cy = CH - (calcResidualAtAxis(eMag, eAxis, eye.iolCylinder!, currentAxisNum) / maxR) * (CH - 12);
          curDot = { cx, cy };
        }
        return (
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Rotation Effect on Residual Astigmatism</Text>
            <Svg width={CW} height={CH + 4}>
              {/* Threshold line at 0.5D */}
              <Line x1={0} y1={threshY} x2={CW} y2={threshY} stroke="#FF664444" strokeWidth={1} strokeDasharray="4,3" />
              {/* Zero rotation line */}
              <Line x1={zeroX} y1={0} x2={zeroX} y2={CH} stroke="#44444466" strokeWidth={1} />
              {/* Residual curve */}
              <Path d={pathD} stroke="#4466FF" strokeWidth={2} fill="none" />
              {/* Current axis dot */}
              {curDot && (
                <Circle cx={curDot.cx} cy={curDot.cy} r={5} fill="#FFD700" />
              )}
            </Svg>
            <View style={styles.chartLabels}>
              <Text style={styles.chartLabel}>−90°</Text>
              <Text style={styles.chartLabel}>Target (0°)</Text>
              <Text style={styles.chartLabel}>+90°</Text>
            </View>
            <Text style={styles.chartHint}>
              Yellow dot = current position · Dashed = 0.5 D threshold
            </Text>
          </View>
        );
      })()}

      {/* Export surgical plan */}
      <TouchableOpacity style={styles.exportBtn} onPress={async () => {
        if (!patient || !eye) return;
        const html = `
          <html><body style="font-family:Arial;padding:20px;color:#000">
          <h2 style="color:#003366">Toric IOL Surgical Plan</h2>
          <p><b>Patient:</b> ${patient.name}${patient.mrn ? ` &nbsp;|&nbsp; <b>MRN:</b> ${patient.mrn}` : ''}${patient.dob ? ` &nbsp;|&nbsp; <b>DOB:</b> ${patient.dob}` : ''}</p>
          <p><b>Eye:</b> ${eye.side === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'} &nbsp;|&nbsp; <b>Date:</b> ${new Date(eye.date).toLocaleDateString()}</p>
          <hr/>
          <h3>Corneal Measurements</h3>
          <table border="0" cellpadding="4">
            <tr><td><b>K1 Flat:</b></td><td>${eye.k1Power !== undefined ? `${eye.k1Power} D @ ${eye.k1Axis}°` : 'Not entered'}</td></tr>
            <tr><td><b>K2 Steep:</b></td><td>${eye.k2Power !== undefined ? `${eye.k2Power} D @ ${eye.k1Axis !== undefined ? (eye.k1Axis + 90) % 180 : '?'}°` : 'Not entered'}</td></tr>
            <tr><td><b>SIA:</b></td><td>${eye.sia !== undefined ? `${eye.sia} D @ ${eye.siaAxis ?? 0}°` : 'Not entered'}</td></tr>
          </table>
          <h3>IOL Plan</h3>
          <table border="0" cellpadding="4">
            <tr><td><b>Model:</b></td><td>${eye.iolModel ?? '—'}</td></tr>
            <tr><td><b>Sphere:</b></td><td>${eye.iolSphere !== undefined ? `${eye.iolSphere} D` : '—'}</td></tr>
            <tr><td><b>Cylinder:</b></td><td>${eye.iolCylinder !== undefined ? `${eye.iolCylinder} D` : '—'}</td></tr>
            <tr><td><b>Target Axis:</b></td><td><b style="font-size:18px">${eye.targetAxis}°</b></td></tr>
            <tr><td><b>Reference Axis:</b></td><td>${eye.referenceAxis}°</td></tr>
            ${eye.currentAxis !== undefined ? `<tr><td><b>Placed Axis:</b></td><td>${eye.currentAxis}°</td></tr>` : ''}
          </table>
          ${eye.notes ? `<h3>Notes</h3><p>${eye.notes}</p>` : ''}
          <p style="color:#999;font-size:11px;margin-top:30px">Generated by Toric IOL App</p>
          </body></html>`;
        try {
          const { uri } = await Print.printToFileAsync({ html });
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Surgical Plan' });
        } catch (e: any) {
          Alert.alert('Export failed', e.message);
        }
      }}>
        <Text style={styles.exportBtnText}>Export Surgical Plan (PDF)</Text>
      </TouchableOpacity>

      {/* Axis summary */}
      <View style={styles.axisSummary}>
        <Text style={styles.sectionTitle}>Axis Summary</Text>
        <View style={styles.axisRow}>
          <View style={styles.axisBlock}>
            <View style={[styles.axisDot, { backgroundColor: '#FF4444' }]} />
            <Text style={styles.axisBlockLabel}>Reference</Text>
            <Text style={styles.axisBlockValue}>{eye.referenceAxis}°</Text>
          </View>
          <View style={styles.axisBlock}>
            <View style={[styles.axisDot, { backgroundColor: '#44FF88' }]} />
            <Text style={styles.axisBlockLabel}>Target</Text>
            <Text style={styles.axisBlockValue}>{eye.targetAxis}°</Text>
          </View>
          {hasCurrentAxis && (
            <View style={styles.axisBlock}>
              <View style={[styles.axisDot, { backgroundColor: '#FFD700' }]} />
              <Text style={styles.axisBlockLabel}>Current</Text>
              <Text style={styles.axisBlockValue}>{currentAxisNum}°</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 16, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  sideBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  od: { backgroundColor: '#4466FF33', borderWidth: 1, borderColor: '#4466FF' },
  os: { backgroundColor: '#44AA6633', borderWidth: 1, borderColor: '#44AA66' },
  sideText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  patientName: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  imageContainer: {
    width: IMG_SIZE, height: IMG_SIZE, borderRadius: 12,
    overflow: 'hidden', backgroundColor: '#111122', marginBottom: 8,
    position: 'relative',
  },
  noImage: {
    backgroundColor: '#111122', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  cameraBtn: {
    position: 'absolute', bottom: 20,
    backgroundColor: '#4466FF', borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  cameraBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  quickBtn: {
    flex: 1, borderWidth: 1, borderColor: '#4466FF44',
    borderRadius: 10, paddingVertical: 8, alignItems: 'center',
  },
  quickBtnGold: { borderColor: '#C8A84B44' },
  quickBtnText: { color: '#4466FF', fontSize: 13 },
  quickBtnTextGold: { color: '#C8A84B' },
  currentAxisCard: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2a2a4e', marginBottom: 16,
  },
  cardLabel: { color: '#8888aa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  axisInput: {
    backgroundColor: '#0d0d1a', color: '#ffffff', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 22, fontWeight: 'bold',
    borderWidth: 1, borderColor: '#2a2a4e', width: 80, textAlign: 'center',
  },
  degSymbol: { color: '#8888aa', fontSize: 22 },
  updateBtn: {
    backgroundColor: '#4466FF', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 10, marginLeft: 8,
  },
  updateBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  calcSection: { marginBottom: 16 },
  sectionTitle: { color: '#8888aa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  residualCard: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2a2a4e', marginBottom: 16,
  },
  residualRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  residualValue: { fontSize: 32, fontWeight: 'bold' },
  residualLabel: { color: '#8888aa', fontSize: 14 },
  chartCard: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2a2a4e', marginBottom: 16,
  },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  chartLabel: { color: '#555577', fontSize: 10 },
  chartHint: { color: '#444466', fontSize: 10, marginTop: 4 },
  exportBtn: {
    borderWidth: 1, borderColor: '#4466FF', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginBottom: 16,
  },
  exportBtnText: { color: '#4466FF', fontSize: 14, fontWeight: '600' },
  axisSummary: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2a2a4e',
  },
  axisRow: { flexDirection: 'row', gap: 16 },
  axisBlock: { flex: 1, alignItems: 'center' },
  axisDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 4 },
  axisBlockLabel: { color: '#8888aa', fontSize: 11, textTransform: 'uppercase' },
  axisBlockValue: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
});
