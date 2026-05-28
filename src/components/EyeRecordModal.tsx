import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Switch,
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
  // Corneal / IOL data
  const [k1Power, setK1Power] = useState('');
  const [k1Axis, setK1Axis] = useState('');
  const [k2Power, setK2Power] = useState('');
  const [sia, setSia] = useState('');
  const [siaAxis, setSiaAxis] = useState('');
  const [iolModel, setIolModel] = useState('');
  const [iolSphere, setIolSphere] = useState('');
  const [iolCylinder, setIolCylinder] = useState('');
  const [postRefractive, setPostRefractive] = useState(false);
  const [postRefractiveType, setPostRefractiveType] = useState<'LASIK' | 'PRK' | 'RK' | ''>('');

  useEffect(() => {
    if (existing) {
      setSide(existing.side);
      setRefAxis(String(existing.referenceAxis));
      setTargetAxis(String(existing.targetAxis));
      setNotes(existing.notes ?? '');
      setK1Power(existing.k1Power !== undefined ? String(existing.k1Power) : '');
      setK1Axis(existing.k1Axis !== undefined ? String(existing.k1Axis) : '');
      setK2Power(existing.k2Power !== undefined ? String(existing.k2Power) : '');
      setSia(existing.sia !== undefined ? String(existing.sia) : '');
      setSiaAxis(existing.siaAxis !== undefined ? String(existing.siaAxis) : '');
      setIolModel(existing.iolModel ?? '');
      setIolSphere(existing.iolSphere !== undefined ? String(existing.iolSphere) : '');
      setIolCylinder(existing.iolCylinder !== undefined ? String(existing.iolCylinder) : '');
      setPostRefractive(existing.postRefractive ?? false);
      setPostRefractiveType(existing.postRefractiveType ?? '');
    } else {
      setSide('OD'); setRefAxis(''); setTargetAxis(''); setNotes('');
      setK1Power(''); setK1Axis(''); setK2Power('');
      setSia(''); setSiaAxis('');
      setIolModel(''); setIolSphere(''); setIolCylinder('');
      setPostRefractive(false); setPostRefractiveType('');
    }
  }, [existing, visible]);

  function handleSave() {
    const ref = parseInt(refAxis, 10);
    const target = parseInt(targetAxis, 10);
    if (isNaN(ref) || ref < 0 || ref > 180) return;
    if (isNaN(target) || target < 0 || target > 180) return;

    const base = existing ?? createEyeRecord(side, ref, target);
    onSave({
      ...base,
      side,
      referenceAxis: ref,
      targetAxis: target,
      notes: notes.trim() || undefined,
      k1Power: k1Power ? parseFloat(k1Power) : undefined,
      k1Axis: k1Axis ? parseInt(k1Axis, 10) : undefined,
      k2Power: k2Power ? parseFloat(k2Power) : undefined,
      sia: sia ? parseFloat(sia) : undefined,
      siaAxis: siaAxis ? parseInt(siaAxis, 10) : undefined,
      iolModel: iolModel.trim() || undefined,
      iolSphere: iolSphere ? parseFloat(iolSphere) : undefined,
      iolCylinder: iolCylinder ? parseFloat(iolCylinder) : undefined,
      postRefractive: postRefractive || undefined,
      postRefractiveType: (postRefractive && postRefractiveType) ? postRefractiveType as 'LASIK' | 'PRK' | 'RK' : undefined,
    });
  }

  const steepAxisLabel = k1Axis ? ` (steep = ${((parseInt(k1Axis) + 90) % 180)}°)` : '';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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

            <Text style={styles.sectionTitle}>Alignment Axes</Text>
            <Text style={styles.label}>Reference Axis (0–180°)</Text>
            <TextInput style={styles.input} value={refAxis} onChangeText={setRefAxis}
              placeholder="e.g. 0" placeholderTextColor="#555" keyboardType="number-pad" />

            <Text style={styles.label}>Target Axis (0–180°)</Text>
            <TextInput style={styles.input} value={targetAxis} onChangeText={setTargetAxis}
              placeholder="e.g. 90" placeholderTextColor="#555" keyboardType="number-pad" />

            <Text style={styles.sectionTitle}>Corneal Biometry (optional)</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>K1 Flat (D)</Text>
                <TextInput style={styles.input} value={k1Power} onChangeText={setK1Power}
                  placeholder="43.50" placeholderTextColor="#555" keyboardType="decimal-pad" />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>K1 Flat Axis (°)</Text>
                <TextInput style={styles.input} value={k1Axis} onChangeText={setK1Axis}
                  placeholder="0–180" placeholderTextColor="#555" keyboardType="number-pad" maxLength={3} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>K2 Steep (D){steepAxisLabel}</Text>
                <TextInput style={styles.input} value={k2Power} onChangeText={setK2Power}
                  placeholder="45.50" placeholderTextColor="#555" keyboardType="decimal-pad" />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>SIA (D) @ Axis (°)</Text>
                <View style={styles.siaRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={sia} onChangeText={setSia}
                    placeholder="0.25" placeholderTextColor="#555" keyboardType="decimal-pad" />
                  <TextInput style={[styles.input, { width: 56 }]} value={siaAxis} onChangeText={setSiaAxis}
                    placeholder="0" placeholderTextColor="#555" keyboardType="number-pad" maxLength={3} />
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>IOL Data (optional)</Text>
            <Text style={styles.label}>IOL Model</Text>
            <TextInput style={styles.input} value={iolModel} onChangeText={setIolModel}
              placeholder="e.g. AcrySof IQ Toric T4" placeholderTextColor="#555" />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Sphere (D)</Text>
                <TextInput style={styles.input} value={iolSphere} onChangeText={setIolSphere}
                  placeholder="21.5" placeholderTextColor="#555" keyboardType="decimal-pad" />
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>Cylinder (D)</Text>
                <TextInput style={styles.input} value={iolCylinder} onChangeText={setIolCylinder}
                  placeholder="2.25" placeholderTextColor="#555" keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Post-Refractive Surgery</Text>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Prior refractive surgery</Text>
              <Switch
                value={postRefractive}
                onValueChange={setPostRefractive}
                trackColor={{ false: '#2a2a4e', true: '#FF880044' }}
                thumbColor={postRefractive ? '#FF8800' : '#666688'}
              />
            </View>
            {postRefractive && (
              <View style={styles.sideRow}>
                {(['LASIK', 'PRK', 'RK'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.sideBtn, postRefractiveType === t && styles.sideBtnWarn]}
                    onPress={() => setPostRefractiveType(t)}
                  >
                    <Text style={[styles.sideBtnText, postRefractiveType === t && styles.sideBtnWarnText]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes}
              placeholder="Surgical notes..." placeholderTextColor="#555" multiline numberOfLines={3} />

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '92%',
  },
  heading: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  sectionTitle: {
    color: '#4466FF', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginTop: 12,
  },
  label: { color: '#8888aa', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  sideRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
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
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a4e', marginBottom: 12,
  },
  textArea: { height: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  siaRow: { flexDirection: 'row', gap: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sideBtnWarn: { borderColor: '#FF8800', backgroundColor: '#FF880022' },
  sideBtnWarnText: { color: '#FF8800' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
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
