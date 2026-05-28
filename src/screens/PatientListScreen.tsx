import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, StatusBar,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Patient, RootStackParamList } from '../types';
import { getPatients, deletePatient } from '../storage/patients';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PatientList'>;

export default function PatientListScreen() {
  const nav = useNavigation<Nav>();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      getPatients().then(setPatients);
    }, [])
  );

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.mrn && p.mrn.includes(query))
  );

  function confirmDelete(patient: Patient) {
    Alert.alert('Delete Patient', `Remove ${patient.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deletePatient(patient.id);
          setPatients(prev => prev.filter(p => p.id !== patient.id));
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Toric IOL</Text>
        <Text style={styles.subtitle}>Alignment Tool</Text>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search patients or MRN..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>👁</Text>
            <Text style={styles.emptyText}>No patients yet</Text>
            <Text style={styles.emptyHint}>Tap + to add a patient</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => nav.navigate('PatientDetail', { patientId: item.id })}
            onLongPress={() => confirmDelete(item)}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.cardName}>{item.name}</Text>
              {item.mrn ? <Text style={styles.cardMrn}>MRN: {item.mrn}</Text> : null}
              <Text style={styles.cardEyes}>
                {item.eyes.length === 0 ? 'No eye records' : `${item.eyes.length} eye record${item.eyes.length > 1 ? 's' : ''}`}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => nav.navigate('PatientForm', {})}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#0d0d1a' },
  title: { color: '#ffffff', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#6666aa', fontSize: 14, marginTop: 2 },
  searchRow: { paddingHorizontal: 16, paddingBottom: 12 },
  search: {
    backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a4e',
  },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a4e',
  },
  cardLeft: { flex: 1 },
  cardName: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
  cardMrn: { color: '#8888aa', fontSize: 13, marginTop: 2 },
  cardEyes: { color: '#44AAFF', fontSize: 13, marginTop: 4 },
  chevron: { color: '#8888aa', fontSize: 22 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  emptyHint: { color: '#8888aa', fontSize: 14, marginTop: 4 },
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#4466FF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4466FF', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
});
