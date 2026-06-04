import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSettings, saveSettings } from '../storage/settings';
import { IOL_PLATFORMS } from '../utils/toricMath';
import { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

const PLATFORM_KEYS = Object.keys(IOL_PLATFORMS);

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const [sia, setSia] = useState('0.25');
  const [siaAxis, setSiaAxis] = useState('0');
  const [platform, setPlatform] = useState('acrysof');
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getSettings().then(s => {
        setSia(String(s.defaultSia));
        setSiaAxis(String(s.defaultSiaAxis));
        setPlatform(s.defaultPlatform);
      });
    }, [])
  );

  async function handleSave() {
    const siaVal = parseFloat(sia);
    const siaAxisVal = parseInt(siaAxis, 10);
    if (isNaN(siaVal) || siaVal < 0 || siaVal > 3) {
      Alert.alert('Invalid', 'SIA must be between 0 and 3 D.');
      return;
    }
    if (isNaN(siaAxisVal) || siaAxisVal < 0 || siaAxisVal > 180) {
      Alert.alert('Invalid', 'Incision axis must be between 0 and 180°.');
      return;
    }
    await saveSettings({ defaultSia: siaVal, defaultSiaAxis: siaAxisVal, defaultPlatform: platform });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.sectionHeader}>Default Surgical Parameters</Text>
      <View style={s.card}>
        <Text style={s.hint}>
          These values pre-fill the Toric Calculator for every new case. You can still override them per-eye.
        </Text>
        <View style={s.row}>
          <View style={s.half}>
            <Text style={s.label}>Default SIA (D)</Text>
            <TextInput style={s.input} value={sia} onChangeText={setSia}
              placeholder="0.25" placeholderTextColor="#AAAAAA" keyboardType="decimal-pad" />
          </View>
          <View style={s.half}>
            <Text style={s.label}>Incision Axis (°)</Text>
            <TextInput style={s.input} value={siaAxis} onChangeText={setSiaAxis}
              placeholder="0–180" placeholderTextColor="#AAAAAA" keyboardType="number-pad" maxLength={3} />
          </View>
        </View>
      </View>

      <Text style={s.sectionHeader}>Preferred IOL Platform</Text>
      <View style={s.card}>
        {PLATFORM_KEYS.map(key => (
          <TouchableOpacity
            key={key}
            style={[s.platformRow, platform === key && s.platformRowActive]}
            onPress={() => setPlatform(key)}
          >
            <View style={[s.radio, platform === key && s.radioActive]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.platformName, platform === key && { color: '#1A1200' }]}>
                {IOL_PLATFORMS[key].name}
              </Text>
              <Text style={s.cylinders}>
                {IOL_PLATFORMS[key].cylinders.join(' · ')} D
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[s.saveBtn, saved && { backgroundColor: '#2A8A44' }]} onPress={handleSave}>
        <Text style={s.saveBtnText}>{saved ? 'Saved ✓' : 'Save Settings'}</Text>
      </TouchableOpacity>

      {/* ── Help & Tutorial ────────────────────────────── */}
      <Text style={s.sectionHeader}>Help &amp; Tutorial</Text>
      <View style={s.card}>
        <Text style={s.hint}>
          Watch the step-by-step instructional video for surgical marking with the Zahran Toric Tool.
        </Text>
        <TouchableOpacity
          style={s.tutorialBtn}
          onPress={() => navigation.navigate('InstructionalVideo')}
        >
          <Text style={s.tutorialIcon}>▶</Text>
          <Text style={s.tutorialBtnText}>Watch Tutorial Video</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 60 },
  sectionHeader: {
    color: '#888060', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginTop: 16,
  },
  card: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  hint: { color: '#666688', fontSize: 13, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  label: { color: '#888060', fontSize: 11, textTransform: 'uppercase', marginBottom: 5 },
  input: {
    backgroundColor: '#FFFFFF', color: '#1A1200', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  platformRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderRadius: 8, paddingHorizontal: 6,
    borderWidth: 1, borderColor: 'transparent', marginBottom: 4,
  },
  platformRowActive: { backgroundColor: '#C8A84B22', borderColor: '#C8A84B66' },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#444466',
  },
  radioActive: { borderColor: '#C8A84B', backgroundColor: '#C8A84B' },
  platformName: { color: '#888060', fontSize: 14, fontWeight: '500' },
  cylinders: { color: '#888060', fontSize: 11, marginTop: 2 },
  saveBtn: {
    backgroundColor: '#C8A84B', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 24,
  },
  saveBtnText: { color: '#C8C8C8', fontSize: 16, fontWeight: '700' },
  tutorialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1200', borderRadius: 10, paddingVertical: 13,
    gap: 8, marginTop: 4,
  },
  tutorialIcon: { color: '#C8A84B', fontSize: 14 },
  tutorialBtnText: { color: '#F0EAD6', fontSize: 15, fontWeight: '700' },
});
