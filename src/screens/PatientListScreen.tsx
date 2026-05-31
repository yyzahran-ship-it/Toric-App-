import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, StatusBar, Image,
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
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={styles.title}>Toric IOL</Text>
            <Text style={styles.subtitle}>Alignment Tool</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => nav.navigate('SiaNomogram')}>
            <Text style={styles.headerBtnText}>SIA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => nav.navigate('BagVsSulcus')}>
            <Text style={styles.headerBtnText}>Sulcus</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => nav.navigate('PostRefractive', {})}>
            <Text style={styles.headerBtnText}>Post-Rx</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => nav.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search patients or MRN..."
          placeholderTextColor="#AAAAAA"
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    backgroundColor: '#FFFFFF', flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48 },
  title: { color: '#1A1200', fontSize: 26, fontWeight: 'bold' },
  subtitle: { color: '#C8A84B', fontSize: 13, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: {
    borderWidth: 1, borderColor: '#C8A84B66', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  headerBtnText: { color: '#C8A84B', fontSize: 12, fontWeight: '700' },
  settingsBtn: { paddingBottom: 4, paddingLeft: 8 },
  settingsIcon: { color: '#888060', fontSize: 24 },
  searchRow: { paddingHorizontal: 16, paddingBottom: 12 },
  search: {
    backgroundColor: '#F8F6EF', color: '#1A1200', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 16,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  cardLeft: { flex: 1 },
  cardName: { color: '#1A1200', fontSize: 17, fontWeight: '600' },
  cardMrn: { color: '#888060', fontSize: 13, marginTop: 2 },
  cardEyes: { color: '#44AAFF', fontSize: 13, marginTop: 4 },
  chevron: { color: '#888060', fontSize: 22 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#1A1200', fontSize: 18, fontWeight: '600' },
  emptyHint: { color: '#888060', fontSize: 14, marginTop: 4 },
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#C8A84B', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#C8A84B', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: '#C8C8C8', fontSize: 28, lineHeight: 30 },
});
