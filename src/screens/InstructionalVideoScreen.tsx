import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import WebView from 'react-native-webview';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_3BWhVNnRWmaT2Cbf27189pVqRiS/hf_20260604_131319_f5bffc50-f067-4ac4-bc69-1b253e59e32c.mp4';

const YOUTUBE_LINKS = [
  {
    title: 'Zahran Toric Tool — Surgical Marking (Part 1)',
    url: 'https://youtube.com/watch?v=aGAYTDLztlc',
  },
  {
    title: 'Zahran Toric Tool — Implementation in Surgery (Part 2)',
    url: 'https://youtu.be/vHKrFGimkHw',
  },
];

const CHAPTERS = [
  {
    step: '01',
    title: 'Pre-op: Limbal Reference Marking',
    body:
      'With the patient upright at the slit lamp, apply topical anaesthetic. ' +
      'Place a Mendez degree gauge on the limbus and use a toric marker pen to ' +
      'ink the 0° (3 o'clock) and 180° (9 o'clock) meridians as your reference ' +
      'landmarks before any recumbent positioning.',
    color: '#1A6BBF',
  },
  {
    step: '02',
    title: 'Axis Calculation in the App',
    body:
      'Enter K1, K2, and your surgeon-induced astigmatism (SIA) into the ' +
      'Toric Calculator. The app computes the net astigmatism vector and ' +
      'displays the target IOL axis on the compass dial — ready to transfer ' +
      'to the operating room.',
    color: '#C8A84B',
  },
  {
    step: '03',
    title: 'Intraoperative IOL Alignment',
    body:
      'Under the microscope, identify your limbal reference marks. After IOL ' +
      'implantation, rotate the toric lens until its axis markers align with ' +
      'the target meridian. Remove OVD carefully and recheck alignment — ' +
      'residual rotation > 5° warrants immediate correction before closing.',
    color: '#2A8A44',
  },
];

const videoHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1A1200; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; }
    video { width: 100%; height: auto; display: block;
            border-radius: 8px; background: #000; }
  </style>
</head>
<body>
  <video controls autoplay playsinline preload="auto"
         poster="" style="max-height: 100vh;">
    <source src="${VIDEO_URL}" type="video/mp4" />
  </video>
</body>
</html>
`;

export default function InstructionalVideoScreen() {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Video player */}
      <View style={s.playerWrapper}>
        <WebView
          source={{ html: videoHtml }}
          style={s.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          scrollEnabled={false}
          originWhitelist={['*']}
        />
      </View>

      {/* Title block */}
      <View style={s.titleBlock}>
        <Text style={s.titleLabel}>INSTRUCTIONAL VIDEO</Text>
        <Text style={s.title}>Zahran Toric Tool</Text>
        <Text style={s.subtitle}>Surgical Marking Protocol · 3-Step Guide</Text>
      </View>

      {/* Chapter cards */}
      <Text style={s.sectionHeader}>Video Chapters</Text>
      {CHAPTERS.map((ch) => (
        <View key={ch.step} style={s.card}>
          <View style={[s.stepBadge, { backgroundColor: ch.color + '22', borderColor: ch.color + '55' }]}>
            <Text style={[s.stepNum, { color: ch.color }]}>{ch.step}</Text>
          </View>
          <View style={s.cardBody}>
            <Text style={[s.cardTitle, { color: ch.color }]}>{ch.title}</Text>
            <Text style={s.cardText}>{ch.body}</Text>
          </View>
        </View>
      ))}

      {/* YouTube resources */}
      <Text style={s.sectionHeader}>Additional Resources</Text>
      <View style={s.resourcesCard}>
        <Text style={s.resourcesHint}>
          Full surgical demonstrations by Dr. Yazan A. Zahran — opens in browser.
        </Text>
        {YOUTUBE_LINKS.map((link) => (
          <TouchableOpacity
            key={link.url}
            style={s.linkRow}
            onPress={() => Linking.openURL(link.url)}
          >
            <View style={s.ytIcon}>
              <Text style={s.ytIconText}>▶</Text>
            </View>
            <Text style={s.linkText}>{link.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.footer}>
        Zahran Toric Tool · Dr. Yazan A. Zahran{' \n'}
        Ophthalmology Dept., Security Forces Hospital, Makkah Al-Mukarramah
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingBottom: 48 },

  playerWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1A1200',
    overflow: 'hidden',
  },
  webview: { flex: 1, backgroundColor: '#1A1200' },

  titleBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD5BB',
  },
  titleLabel: {
    color: '#888060', fontSize: 10, textTransform: 'uppercase',
    letterSpacing: 1.5, marginBottom: 4,
  },
  title: { color: '#1A1200', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#888060', fontSize: 13, marginTop: 2 },

  sectionHeader: {
    color: '#888060', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, marginTop: 20, marginHorizontal: 16,
  },

  card: {
    flexDirection: 'row',
    backgroundColor: '#F8F6EF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DDD5BB',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepNum: { fontSize: 13, fontWeight: '800' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  cardText: { color: '#444466', fontSize: 13, lineHeight: 19 },

  resourcesCard: {
    backgroundColor: '#F8F6EF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#DDD5BB',
    gap: 10,
  },
  resourcesHint: { color: '#888060', fontSize: 12, marginBottom: 4 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  ytIcon: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: '#FF0000', alignItems: 'center', justifyContent: 'center',
  },
  ytIconText: { color: '#FFFFFF', fontSize: 10 },
  linkText: { flex: 1, color: '#1A1200', fontSize: 13, fontWeight: '500' },

  footer: {
    color: '#AAAAAA', fontSize: 10, textAlign: 'center',
    marginTop: 28, paddingHorizontal: 16, lineHeight: 16,
  },
});
