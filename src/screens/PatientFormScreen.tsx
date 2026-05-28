import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getPatient, createPatient, savePatient } from '../storage/patients';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PatientForm'>;
type Route = RouteProp<RootStackParamList, 'PatientForm'>;

export default function PatientFormScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const isEdit = !!params?.patientId;

  const [name, setName] = useState('');
  const [mrn, setMrn] = useState('');
  const [dob, setDob] = useState('');

  useEffect(() => {
    if (params?.patientId) {
      getPatient(params.patientId).then(p => {
        if (p) { setName(p.name); setMrn(p.mrn ?? ''); setDob(p.dob ?? ''); }
      });
    }
  }, [params?.patientId]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Required', 'Patient name is required.');
      return;
    }
    if (isEdit && params.patientId) {
      const existing = await getPatient(params.patientId);
      if (existing) {
        await savePatient({ ...existing, name: name.trim(), mrn: mrn.trim() || undefined, dob: dob.trim() || undefined });
      }
    } else {
      const p = createPatient(name.trim(), mrn.trim() || undefined, dob.trim() || undefined);
      await savePatient(p);
    }
    nav.goBack();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{isEdit ? 'Edit Patient' : 'New Patient'}</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Patient name"
          placeholderTextColor="#666"
          autoCapitalize="words"
        />

        <Text style={styles.label}>MRN (optional)</Text>
        <TextInput
          style={styles.input}
          value={mrn}
          onChangeText={setMrn}
          placeholder="Medical record number"
          placeholderTextColor="#666"
          keyboardType="default"
        />

        <Text style={styles.label}>Date of Birth (optional)</Text>
        <TextInput
          style={styles.input}
          value={dob}
          onChangeText={setDob}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#666"
          keyboardType="numbers-and-punctuation"
        />

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>{isEdit ? 'Save Changes' : 'Add Patient'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 20, paddingTop: 40 },
  heading: { color: '#ffffff', fontSize: 24, fontWeight: 'bold', marginBottom: 28 },
  label: { color: '#8888aa', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input: {
    backgroundColor: '#1a1a2e', color: '#ffffff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    borderWidth: 1, borderColor: '#2a2a4e', marginBottom: 20,
  },
  button: {
    backgroundColor: '#4466FF', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 12,
  },
  buttonText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
});
