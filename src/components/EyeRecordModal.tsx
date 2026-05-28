import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { EyeRecord } from '../types';
import { createEyeRecord } from '../storage/patients';

interface Props {
  visible: boolean;
  existing: EyeRecord | null;
  onSave: (eye: EyeRecord) => void;
  onClose: () => void;
}

export default function EyeRecordModal({ visible, existing, onSave, onClose }: Props) {
  const [side, setSide] = useState<'OD' | 'OS'>('OD');
  const [refAxis, setRefAxis] = useState('');
  const [targetAxis, setTargetAxis] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (existing) {
      setSide(existing.side);
      setRefAxis(String(existing.referenceAxis));
      setTargetAxis(String(existing.targetAxis));
      setNotes(existing.notes ?? '');
    } else {
      setSide('OD'); setRefAxis(''); setTargetAxis(''); setNotes('');
    }
  }, [existing, visible]);

  function handleSave() {
    const ref = parseInt(refAxis, 10);
    const target = parseInt(targetAxis, 10);
    if (isNaN(ref) || ref < 0 || ref > 180) return;
    if (isNaN(target) || target < 0 || target > 180) return;

    if (existing) {
      onSave({ ...existing, side, referenceAxis: ref, targetAxis: target, notes: notes.trim() || undefined });
    } else {
      const eye = createEyeRecord(side, ref, target);
      onSave({ ...eye, notes: notes.trim() || undefined });
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.heading}>{existing ? 'Edit Eye Record' : 'New Eye Record'}</Text>

          <Text style={styles.label}>Eye Side</Text>
          <View style={styles.sideRow}>
            {(['OD', 'OS'] as const).map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.sideBtn, side === s && styles.sideBtnActive]}
                onPress={() => setSide(s)}
              >
                <Text style={[styles.sideBtnText, side === s && styles.sideBtnTextActive]}>{s}</Text>
                <Text style={styles.sideSub}>{s === 'OD' ? 'Right eye' : 'Left eye'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Reference Axis (0–180°)</Text>
          <TextInput
            style={styles.input}
            value={refAxis}
            onChangeText={setRefAxis}
            placeholder="e.g. 0"
            placeholderTextColor="#666"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Target Axis (0–180°)</Text>
          <TextInput
            style={styles.input}
            value={targetAxis}
            onChangeText={setTargetAxis}
            placeholder="e.g. 90"
            placeholderTextColor="#666"
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Surgical notes..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  heading: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { color: '#8888aa', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  sideRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  sideBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: '#2a2a4e',
    paddingVertical: 12, alignItems: 'center',
  },
  sideBtnActive: { borderColor: '#4466FF', backgroundColor: '#4466FF22' },
  sideBtnText: { color: '#8888aa', fontSize: 18, fontWeight: 'bold' },
  sideBtnTextActive: { color: '#ffffff' },
  sideSub: { color: '#8888aa', fontSize: 11, marginTop: 2 },
  input: {
    backgroundColor: '#0d0d1a', color: '#ffffff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 16,
    borderWidth: 1, borderColor: '#2a2a4e', marginBottom: 16,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a4e',
    paddingVertical: 13, alignItems: 'center',
  },
  cancelBtnText: { color: '#8888aa', fontSize: 16 },
  saveBtn: {
    flex: 2, backgroundColor: '#4466FF', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
