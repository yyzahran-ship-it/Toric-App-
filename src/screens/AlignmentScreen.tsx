import React, { useCallback, useState } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, TextInput, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EyeRecord, Patient, RootStackParamList } from '../types';
import { getPatient, updateEyeRecord } from '../storage/patients';
import AlignmentOverlay from '../components/AlignmentOverlay';
import RotationCalculator from '../components/RotationCalculator';

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
            />
          </>
        ) : (
          <View style={[styles.noImage, { width: IMG_SIZE, height: IMG_SIZE }]}>
            <AlignmentOverlay
              size={IMG_SIZE}
              referenceAxis={eye.referenceAxis}
              targetAxis={eye.targetAxis}
              currentAxis={hasCurrentAxis ? currentAxisNum : undefined}
            />
            <TouchableOpacity
              style={styles.cameraBtn}
              onPress={() => nav.navigate('Camera', { patientId: params.patientId, eyeId: params.eyeId })}
            >
              <Text style={styles.cameraBtnText}>Capture Eye Image</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {eye.imageUri && (
        <TouchableOpacity
          style={styles.recaptureBtn}
          onPress={() => nav.navigate('Camera', { patientId: params.patientId, eyeId: params.eyeId })}
        >
          <Text style={styles.recaptureBtnText}>Recapture</Text>
        </TouchableOpacity>
      )}

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
  recaptureBtn: { alignSelf: 'flex-end', marginBottom: 16 },
  recaptureBtnText: { color: '#4466FF', fontSize: 14 },
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
