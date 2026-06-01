import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const BARRETT_URL = 'https://calc.apacrs.org/TRueKToric105/truektoric.aspx';
const BARRETT_UII_URL = 'https://calc.apacrs.org/barrett_universal2105/';

function openCalc(url: string) {
  WebBrowser.openBrowserAsync(url, {
    toolbarColor: '#1a0d2e',
    controlsColor: '#DDB8FF',
    showTitle: true,
    enableBarCollapsing: true,
  });
}

export default function BarrettTrueKScreen() {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      <View style={s.banner}>
        <Text style={s.bannerTitle}>Barrett True-K Toric</Text>
        <Text style={s.bannerSubtitle}>APACRS — calc.apacrs.org</Text>
        <Text style={s.bannerDesc}>
          The reference standard for post-refractive toric IOL power calculation.
          Combines Barrett True-K corneal correction with toric IOL selection in a
          single validated workflow.
        </Text>
      </View>

      <TouchableOpacity style={s.primaryBtn} onPress={() => openCalc(BARRETT_URL)} activeOpacity={0.8}>
        <Text style={s.primaryBtnTitle}>Open Barrett True-K Toric →</Text>
        <Text style={s.primaryBtnSub}>calc.apacrs.org/TRueKToric105</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.secondaryBtn} onPress={() => openCalc(BARRETT_UII_URL)} activeOpacity={0.8}>
        <Text style={s.secondaryBtnTitle}>Open Barrett Universal II →</Text>
        <Text style={s.secondaryBtnSub}>calc.apacrs.org/barrett_universal2105</Text>
      </TouchableOpacity>

      <Text style={s.sectionHeader}>What You Need</Text>
      <View style={s.card}>
        {[
          ['K1 / K2', 'Flat and steep meridian keratometry (D)'],
          ['Axis', 'Steep K axis (degrees)'],
          ['AL', 'Axial length (mm)'],
          ['ACD', 'Anterior chamber depth (mm)'],
          ['LT', 'Lens thickness (mm)'],
          ['WTW', 'White-to-white corneal diameter (mm)'],
          ['A-constant', 'IOL-specific optimised constant'],
          ['Pre-op Rx', 'Pre-LASIK/PRK SEQ — if available'],
          ['Pre-op K', 'Pre-operative keratometry — if available'],
        ].map(([label, desc]) => (
          <View key={label} style={s.inputRow}>
            <Text style={s.inputLabel}>{label}</Text>
            <Text style={s.inputDesc}>{desc}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sectionHeader}>Tips</Text>
      <View style={s.card}>
        <Text style={s.tipText}>
          • Enter your adjusted K values from the Post-Rx calculator above if you have
          them. Barrett True-K also computes its own K correction internally —
          use whichever gives the higher IOL power.
        </Text>
        <Text style={s.tipText}>
          • For post-LASIK eyes without history, enable the "No History" tab.
          For eyes with pre-op records, enter pre-op K and refraction for greater accuracy.
        </Text>
        <Text style={s.tipText}>
          • When in doubt, round UP to the next 0.25 D to avoid hyperopic surprise.
        </Text>
      </View>

      <View style={s.notice}>
        <Text style={s.noticeText}>
          Opens in your device browser — required to pass security checks that block in-app
          WebViews. Tap the browser's back arrow or close button to return to the app.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content:   { padding: 16 },

  banner: {
    backgroundColor: '#1a0d2e', borderRadius: 14, padding: 18, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#7744BB',
  },
  bannerTitle:    { color: '#DDB8FF', fontSize: 18, fontWeight: '800', marginBottom: 3 },
  bannerSubtitle: { color: 'rgba(221,184,255,0.5)', fontSize: 11, marginBottom: 10 },
  bannerDesc:     { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 17 },

  primaryBtn: {
    backgroundColor: '#7744BB', borderRadius: 12, padding: 16, marginBottom: 10,
  },
  primaryBtnTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  primaryBtnSub:   { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 3 },

  secondaryBtn: {
    backgroundColor: '#1a0d2e', borderRadius: 12, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: '#7744BB44',
  },
  secondaryBtnTitle: { color: '#DDB8FF', fontSize: 14, fontWeight: '600' },
  secondaryBtnSub:   { color: 'rgba(221,184,255,0.45)', fontSize: 11, marginTop: 3 },

  sectionHeader: {
    color: '#888060', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4,
  },

  card: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#DDD5BB', marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#EEE9D8',
  },
  inputLabel: { color: '#1A1200', fontSize: 13, fontWeight: '700', width: 80 },
  inputDesc:  { flex: 1, color: '#666055', fontSize: 13, lineHeight: 17 },

  tipText: {
    color: '#555044', fontSize: 12, lineHeight: 18, marginBottom: 8,
  },

  notice: {
    backgroundColor: '#F0EEE8', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  noticeText: { color: '#888060', fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
});
