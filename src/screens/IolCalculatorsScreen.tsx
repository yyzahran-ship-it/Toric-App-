import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { RootStackParamList } from '../types';

interface CalcEntry {
  title: string;
  subtitle: string;
  url: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  description: string;
}

const WEB_CALCULATORS: CalcEntry[] = [
  {
    title: 'ASCRS IOL Calculator',
    subtitle: 'iolcalc.ascrs.org',
    url: 'https://iolcalc.ascrs.org',
    tag: 'Post-Rx · Toric · Complex',
    tagColor: '#44AAFF',
    tagBg: '#001a33',
    description: 'Covers post-refractive eyes, short/long axial length, and toric cases. Widely used and regularly updated.',
  },
  {
    title: 'Barrett True-K Toric',
    subtitle: 'calc.apacrs.org',
    url: 'https://calc.apacrs.org/TRueKToric105/truektoric.aspx',
    tag: 'Post-Rx · Toric',
    tagColor: '#DDB8FF',
    tagBg: '#1a0d2e',
    description: 'Barrett True-K formula for post-refractive toric IOL calculation. Highest accuracy for post-LASIK/PRK eyes.',
  },
  {
    title: 'Barrett Universal II',
    subtitle: 'asia-pacific.myalcon.com',
    url: 'https://calc.apacrs.org/barrett_universal2105/',
    tag: 'Universal · Toric',
    tagColor: '#DDB8FF',
    tagBg: '#1a0d2e',
    description: 'Barrett Universal II for routine and complex cases. Part of the Barrett Suite — arguably the most accurate modern formula set.',
  },
  {
    title: 'Hoffer QST',
    subtitle: 'hofferqst.com',
    url: 'https://hofferqst.com',
    tag: 'ML-enhanced · ACD',
    tagColor: '#88DDAA',
    tagBg: '#0a2010',
    description: 'Incorporates ML-derived ACD prediction. Inputs: K, AL, ACD (corneal epithelium to crystalline lens), and patient gender.',
  },
  {
    title: 'ZEISS AI IOL Calculator',
    subtitle: 'zcalc.meditec.zeiss.com',
    url: 'https://zcalc.meditec.zeiss.com',
    tag: 'AI · Short Eyes',
    tagColor: '#FFCC66',
    tagBg: '#1a1200',
    description: 'Best outcomes for short eyes where accurate ELP estimation is critical. AI-powered online portal.',
  },
];

export default function IolCalculatorsScreen() {
  function open(entry: CalcEntry) {
    WebBrowser.openBrowserAsync(entry.url, {
      toolbarColor: '#0d0d1a',
      controlsColor: '#C8A84B',
      showTitle: true,
      enableBarCollapsing: true,
    });
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.sectionLabel}>WEB-BASED CALCULATORS</Text>
        <Text style={s.sectionNote}>All calculators open in-app — no browser required</Text>

        {WEB_CALCULATORS.map(entry => (
          <TouchableOpacity
            key={entry.url}
            style={s.card}
            onPress={() => open(entry)}
            activeOpacity={0.75}
          >
            <View style={s.cardTop}>
              <View style={s.cardTitles}>
                <Text style={s.cardTitle}>{entry.title}</Text>
                <Text style={s.cardSubtitle}>{entry.subtitle}</Text>
              </View>
              <View style={[s.tag, { backgroundColor: entry.tagBg, borderColor: entry.tagColor + '44' }]}>
                <Text style={[s.tagText, { color: entry.tagColor }]}>{entry.tag}</Text>
              </View>
            </View>
            <Text style={s.cardDesc}>{entry.description}</Text>
            <View style={s.cardFooter}>
              <Text style={s.openText}>Open in browser →</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={s.notice}>
          <Text style={s.noticeIcon}>ℹ</Text>
          <Text style={s.noticeText}>
            Opens in your device browser — passes security checks that block in-app WebViews.
            An active internet connection is required. Tap the back arrow to return to the app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  content: { padding: 16, paddingBottom: 48 },

  sectionLabel: {
    color: '#C8A84B', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, marginBottom: 4, marginTop: 8,
  },
  sectionNote: {
    color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16,
  },

  card: {
    backgroundColor: '#16162a', borderRadius: 14,
    borderWidth: 1, borderColor: '#2a2a44',
    padding: 16, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  cardTitles: { flex: 1 },
  cardTitle: { color: '#F0EAD6', fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  tag: {
    borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  tagText: { fontSize: 10, fontWeight: '700' },
  cardDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  cardFooter: { alignItems: 'flex-end' },
  openText: { color: '#C8A84B', fontSize: 12, fontWeight: '700' },

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#16162a', borderRadius: 10,
    borderWidth: 1, borderColor: '#2a2a44',
    padding: 14, marginTop: 8,
  },
  noticeIcon: { color: '#888060', fontSize: 16, marginTop: 1 },
  noticeText: { flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 17 },
});
