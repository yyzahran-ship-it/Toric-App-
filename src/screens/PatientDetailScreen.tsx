import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Patient, EyeRecord, RootStackParamList } from '../types';
import { getPatient, updateEyeRecord, createEyeRecord, savePatient } from '../storage/patients';
import EyeRecordModal from '../components/EyeRecordModal';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PatientDetail'>;
type Route = RouteProp<RootStackParamList, 'PatientDetail'>;

export default function PatientDetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEye, setEditingEye] = useState<EyeRecord | null>(null);

  useFocusEffect(
    useCallback(() => {
      getPatient(params.patientId).then(setPatient);
    }, [params.patientId])
  );

  async function handleSaveEye(eye: EyeRecord) {
    await updateEyeRecord(params.patientId, eye);
    const updated = await getPatient(params.patientId);
    setPatient(updated);
    setModalVisible(false);
    setEditingEye(null);
  }

  async function handleDeleteEye(eyeId: string) {
    Alert.alert('Delete Record', 'Remove this eye record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!patient) return;
          const updated = { ...patient, eyes: patient.eyes.filter(e => e.id !== eyeId) };
          await savePatient(updated);
          setPatient(updated);
        },
      },
    ]);
  }

  if (!patient) return null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.patientCard}>
          <Text style={styles.patientName}>{patient.name}</Text>
          {patient.mrn ? <Text style={styles.patientInfo}>MRN: {patient.mrn}</Text> : null}
          {patient.dob ? <Text style={styles.patientInfo}>DOB: {patient.dob}</Text> : null}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => nav.navigate('PatientForm', { patientId: patient.id })}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Eye Records</Text>

        {patient.eyes.length === 0 && (
          <View style={styles.noEyes}>
            <Text style={styles.noEyesText}>No eye records yet.</Text>
            <Text style={styles.noEyesHint}>Add an OD or OS record below.</Text>
          </View>
        )}

        {patient.eyes.map(eye => (
          <View key={eye.id} style={styles.eyeCard}>
            <View style={styles.eyeHeader}>
              <View style={[styles.eyeBadge, eye.side === 'OD' ? styles.odBadge : styles.osBadge]}>
                <Text style={styles.eyeBadgeText}>{eye.side}</Text>
              </View>
              <Text style={styles.eyeDate}>{new Date(eye.date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.eyeAxes}>
              <View style={styles.axisItem}>
                <Text style={styles.axisLabel}>Reference</Text>
                <Text style={styles.axisValue}>{eye.referenceAxis}°</Text>
              </View>
              <View style={styles.axisItem}>
                <Text style={styles.axisLabel}>Target</Text>
                <Text style={styles.axisValue}>{eye.targetAxis}°</Text>
              </View>
              {eye.currentAxis !== undefined && (
                <View style={styles.axisItem}>
                  <Text style={styles.axisLabel}>Current</Text>
                  <Text style={[styles.axisValue, { color: '#FFD700' }]}>{eye.currentAxis}°</Text>
                </View>
              )}
            </View>
            {eye.notes ? <Text style={styles.eyeNotes}>{eye.notes}</Text> : null}
            <View style={styles.eyeActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => nav.navigate('Alignment', { patientId: patient.id, eyeId: eye.id })}
              >
                <Text style={styles.actionBtnText}>Align</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => nav.navigate('Camera', { patientId: patient.id, eyeId: eye.id })}
              >
                <Text style={styles.actionBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.editActionBtn]}
                onPress={() => { setEditingEye(eye); setModalVisible(true); }}
              >
                <Text style={styles.actionBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => handleDeleteEye(eye.id)}
              >
                <Text style={styles.actionBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => { setEditingEye(null); setModalVisible(true); }}>
        <Text style={styles.fabText}>+ Eye</Text>
      </TouchableOpacity>

      <EyeRecordModal
        visible={modalVisible}
        existing={editingEye}
        onSave={handleSaveEye}
        onClose={() => { setModalVisible(false); setEditingEye(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 16, paddingBottom: 100 },
  patientCard: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#2a2a4e',
  },
  patientName: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },
  patientInfo: { color: '#8888aa', fontSize: 14, marginTop: 4 },
  editBtn: { alignSelf: 'flex-start', marginTop: 10 },
  editBtnText: { color: '#4466FF', fontSize: 14 },
  sectionTitle: { color: '#8888aa', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  noEyes: { alignItems: 'center', paddingVertical: 32 },
  noEyesText: { color: '#ffffff', fontSize: 16 },
  noEyesHint: { color: '#8888aa', fontSize: 14, marginTop: 4 },
  eyeCard: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#2a2a4e',
  },
  eyeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eyeBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10 },
  odBadge: { backgroundColor: '#4466FF33', borderWidth: 1, borderColor: '#4466FF' },
  osBadge: { backgroundColor: '#44AA6633', borderWidth: 1, borderColor: '#44AA66' },
  eyeBadgeText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  eyeDate: { color: '#8888aa', fontSize: 13 },
  eyeAxes: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  axisItem: { alignItems: 'center' },
  axisLabel: { color: '#8888aa', fontSize: 11, textTransform: 'uppercase' },
  axisValue: { color: '#ffffff', fontSize: 20, fontWeight: '600' },
  eyeNotes: { color: '#8888aa', fontSize: 13, marginBottom: 10, fontStyle: 'italic' },
  eyeActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1, backgroundColor: '#4466FF', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  editActionBtn: { backgroundColor: '#2a2a4e' },
  deleteBtn: { backgroundColor: '#882222' },
  actionBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    backgroundColor: '#4466FF', borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: '#4466FF', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
