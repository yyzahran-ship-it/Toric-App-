import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import uuid from 'react-native-uuid';
import { getSiaCases, saveSiaCase, deleteSiaCase, meanSia, SiaCase } from '../storage/siaCases';

export default function SiaNomogramScreen() {
  const [cases, setCases] = useState<SiaCase[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [plannedSia, setPlannedSia] = useState('0.25');
  const [plannedAxis, setPlannedAxis] = useState('0');
  const [achievedSia, setAchievedSia] = useState('');
  const [achievedAxis, setAchievedAxis] = useState('');
  const [notes, setNotes] = useState('');

  useFocusEffect(
    useCallback(() => { getSiaCases().then(setCases); }, [])
  );

  const mean = meanSia(cases);

  async function handleAdd() {
    const ps = parseFloat(plannedSia);
    const pa = parseFloat(plannedAxis);
    const as_ = parseFloat(achievedSia);
    const aa = parseFloat(achievedAxis);
    if (isNaN(ps) || isNaN(pa) || isNaN(as_) || isNaN(aa)) {
      Alert.alert('Missing data', 'Fill all four SIA fields.');
      return;
    }
    const c: SiaCase = {
      id: uuid.v4() as string,
      date: new Date().toISOString(),
      plannedSia: ps, plannedAxis: pa,
      achievedSia: as_, achievedAxis: aa,
      notes: notes.trim() || undefined,
    };
    await saveSiaCase(c);
    const updated = await getSiaCases();
    setCases(updated);
    setShowForm(false);
    setAchievedSia(''); setAchievedAxis(''); setNotes('');
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete Case', 'Remove this case from the nomogram?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteSiaCase(id);
          setCases(prev => prev.filter(c => c.id !== id));
        },
      },
    ]);
  }

  function vectorDiff(c: SiaCase): string {
    const toRad = (d: number) => d * Math.PI / 180;
    const px = c.plannedSia * Math.cos(2 * toRad(c.plannedAxis));
    const py = c.plannedSia * Math.sin(2 * toRad(c.plannedAxis));
    const ax = c.achievedSia * Math.cos(2 * toRad(c.achievedAxis));
    const ay = c.achievedSia * Math.sin(2 * toRad(c.achievedAxis));
    const diff = Math.sqrt((ax - px) ** 2 + (ay - py) ** 2);
    return diff.toFixed(2);
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Personal SIA summary */}
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>Personal Mean SIA</Text>
        {mean ? (
          <View style={s.summaryRow}>
            <View style={s.summaryBlock}>
              <Text style={s.summaryBig}>{mean.mag.toFixed(2)}</Text>
              <Text style={s.summaryUnit}>D</Text>
            </View>
            <Text style={s.summaryAt}>@</Text>
            <View style={s.summaryBlock}>
              <Text style={s.summaryBig}>{mean.axis}</Text>
              <Text style={s.summaryUnit}>°</Text>
            </View>
            <Text style={s.summaryN}>n = {cases.length}</Text>
          </View>
        ) : (
          <Text style={s.emptyHint}>Add cases below to track your personal SIA</Text>
        )}
        {mean && (
          <Text style={s.recommendation}>
            Recommendation: use {mean.mag.toFixed(2)} D @ {mean.axis}° as your default SIA in Settings
          </Text>
        )}
      </View>

      {/* Case list */}
      <Text style={s.sectionHeader}>Cases ({cases.length})</Text>
      {cases.map((c, i) => {
        const diff = parseFloat(vectorDiff(c));
        const accuracy = diff < 0.15 ? 'Excellent' : diff < 0.3 ? 'Good' : 'Adjust';
        const color = diff < 0.15 ? '#44FF88' : diff < 0.3 ? '#FFD700' : '#FF6644';
        return (
          <View key={c.id} style={s.caseCard}>
            <View style={s.caseHeader}>
              <Text style={s.caseNum}>Case {i + 1}</Text>
              <Text style={s.caseDate}>{new Date(c.date).toLocaleDateString()}</Text>
              <TouchableOpacity onPress={() => handleDelete(c.id)}>
                <Text style={s.deleteX}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.caseRow}>
              <View style={s.caseBlock}>
                <Text style={s.caseLabel}>Planned</Text>
                <Text style={s.caseVal}>{c.plannedSia.toFixed(2)} D @ {c.plannedAxis}°</Text>
              </View>
              <Text style={s.caseArrow}>→</Text>
              <View style={s.caseBlock}>
                <Text style={s.caseLabel}>Achieved</Text>
                <Text style={s.caseVal}>{c.achievedSia.toFixed(2)} D @ {c.achievedAxis}°</Text>
              </View>
            </View>
            <View style={s.caseFooter}>
              <Text style={[s.accuracy, { color }]}>{accuracy}</Text>
              <Text style={s.diffLabel}>Vector diff: {diff.toFixed(2)} D</Text>
            </View>
            {c.notes ? <Text style={s.caseNotes}>{c.notes}</Text> : null}
          </View>
        );
      })}

      {/* Add case form */}
      {showForm ? (
        <View style={s.formCard}>
          <Text style={s.formTitle}>Add Case</Text>
          <View style={s.formRow}>
            <View style={s.formHalf}>
              <Text style={s.formLabel}>Planned SIA (D)</Text>
              <TextInput style={s.input} value={plannedSia} onChangeText={setPlannedSia}
                keyboardType="decimal-pad" placeholderTextColor="#AAAAAA" placeholder="0.25" />
            </View>
            <View style={s.formHalf}>
              <Text style={s.formLabel}>Planned Axis (°)</Text>
              <TextInput style={s.input} value={plannedAxis} onChangeText={setPlannedAxis}
                keyboardType="number-pad" placeholderTextColor="#AAAAAA" placeholder="0" maxLength={3} />
            </View>
          </View>
          <View style={s.formRow}>
            <View style={s.formHalf}>
              <Text style={s.formLabel}>Achieved SIA (D)</Text>
              <TextInput style={s.input} value={achievedSia} onChangeText={setAchievedSia}
                keyboardType="decimal-pad" placeholderTextColor="#AAAAAA" placeholder="0.25" />
            </View>
            <View style={s.formHalf}>
              <Text style={s.formLabel}>Achieved Axis (°)</Text>
              <TextInput style={s.input} value={achievedAxis} onChangeText={setAchievedAxis}
                keyboardType="number-pad" placeholderTextColor="#AAAAAA" placeholder="0" maxLength={3} />
            </View>
          </View>
          <Text style={s.formLabel}>Notes (optional)</Text>
          <TextInput style={[s.input, { height: 60 }]} value={notes} onChangeText={setNotes}
            placeholder="e.g. temporal incision 2.4mm" placeholderTextColor="#AAAAAA" multiline />
          <View style={s.formBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleAdd}>
              <Text style={s.saveText}>Add Case</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)}>
          <Text style={s.addBtnText}>+ Add Case</Text>
        </TouchableOpacity>
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
  summaryCard: {
    backgroundColor: '#F8F6EF', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#C8A84B66',
    marginBottom: 4,
  },
  summaryTitle: { color: '#C8A84B', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryBlock: { alignItems: 'center' },
  summaryBig: { color: '#1A1200', fontSize: 36, fontWeight: 'bold' },
  summaryUnit: { color: '#888060', fontSize: 12 },
  summaryAt: { color: '#888060', fontSize: 24, marginHorizontal: 4 },
  summaryN: { color: '#888060', fontSize: 13, marginLeft: 16, alignSelf: 'flex-end', marginBottom: 8 },
  recommendation: { color: '#C8A84B88', fontSize: 12, marginTop: 10, fontStyle: 'italic' },
  emptyHint: { color: '#888060', fontSize: 14, fontStyle: 'italic' },
  caseCard: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#DDD5BB', marginBottom: 10,
  },
  caseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  caseNum: { color: '#1A1200', fontWeight: '600', fontSize: 14, flex: 1 },
  caseDate: { color: '#888060', fontSize: 12, marginRight: 12 },
  deleteX: { color: '#882222', fontSize: 16, fontWeight: 'bold' },
  caseRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  caseBlock: { flex: 1 },
  caseLabel: { color: '#888060', fontSize: 10, textTransform: 'uppercase' },
  caseVal: { color: '#1A1200', fontSize: 14, fontWeight: '500' },
  caseArrow: { color: '#888060', fontSize: 18 },
  caseFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accuracy: { fontSize: 12, fontWeight: '700' },
  diffLabel: { color: '#888060', fontSize: 12 },
  caseNotes: { color: '#666688', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  formCard: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#DDD5BB', marginTop: 12,
  },
  formTitle: { color: '#1A1200', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  formRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  formHalf: { flex: 1 },
  formLabel: { color: '#888060', fontSize: 11, textTransform: 'uppercase', marginBottom: 5, marginTop: 8 },
  input: {
    backgroundColor: '#FFFFFF', color: '#1A1200', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  formBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#DDD5BB', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelText: { color: '#888060', fontSize: 14 },
  saveBtn: {
    flex: 2, backgroundColor: '#C8A84B', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  saveText: { color: '#000', fontSize: 14, fontWeight: '700' },
  addBtn: {
    marginTop: 16, borderWidth: 1, borderColor: '#C8A84B',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  addBtnText: { color: '#C8A84B', fontSize: 15, fontWeight: '600' },
});
