import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Dimensions, Alert, ScrollView,
} from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Landmark } from '../types';
import { getPatient, updateEyeRecord } from '../storage/patients';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LandmarkAnnotation'>;
type Route = RouteProp<RootStackParamList, 'LandmarkAnnotation'>;

const { width } = Dimensions.get('window');
const CANVAS = width - 32;

const LANDMARK_COLORS = ['#FF4444', '#FFD700', '#44FF88', '#44AAFF', '#FF44FF', '#FF8844'];

export default function LandmarkAnnotationScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<View>(null);

  useFocusEffect(
    useCallback(() => {
      getPatient(params.patientId).then(p => {
        const eye = p?.eyes.find(e => e.id === params.eyeId);
        if (!eye) return;
        setImageUri(eye.imageUri ?? null);
        setLandmarks(eye.landmarks ?? []);
      });
    }, [params.patientId, params.eyeId])
  );

  function handleTap(e: any) {
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.max(0, Math.min(1, locationX / CANVAS));
    const y = Math.max(0, Math.min(1, locationY / CANVAS));
    const color = LANDMARK_COLORS[landmarks.length % LANDMARK_COLORS.length];
    setLandmarks(prev => [...prev, { x, y, color, label: `${prev.length + 1}` }]);
  }

  function handleDeleteLast() {
    setLandmarks(prev => prev.slice(0, -1));
  }

  function handleClear() {
    Alert.alert('Clear Landmarks', 'Remove all landmark markers?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setLandmarks([]) },
    ]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const p = await getPatient(params.patientId);
      const eye = p?.eyes.find(e => e.id === params.eyeId);
      if (!eye) return;
      await updateEyeRecord(params.patientId, { ...eye, landmarks });
      nav.goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.instructions}>
        Tap on the eye image to mark vessel reference points. These landmarks will appear in the alignment overlay.
      </Text>

      <View style={s.canvasWrapper}>
        <View
          style={{ width: CANVAS, height: CANVAS }}
          onTouchEnd={handleTap}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: CANVAS, height: CANVAS, borderRadius: 12 }}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.noImage, { width: CANVAS, height: CANVAS }]}>
              <Text style={s.noImageText}>No eye photo captured yet</Text>
              <Text style={s.noImageHint}>Tap below to go to Camera first</Text>
            </View>
          )}

          {/* SVG landmark overlay */}
          <Svg
            width={CANVAS}
            height={CANVAS}
            style={{ position: 'absolute', top: 0, left: 0 }}
            pointerEvents="none"
          >
            {landmarks.map((lm, i) => (
              <React.Fragment key={i}>
                {/* Outer ring */}
                <Circle
                  cx={lm.x * CANVAS}
                  cy={lm.y * CANVAS}
                  r={14}
                  stroke={lm.color}
                  strokeWidth={2}
                  fill="transparent"
                />
                {/* Inner dot */}
                <Circle
                  cx={lm.x * CANVAS}
                  cy={lm.y * CANVAS}
                  r={4}
                  fill={lm.color}
                />
                {/* Label */}
                <SvgText
                  x={lm.x * CANVAS + 16}
                  y={lm.y * CANVAS - 10}
                  fill={lm.color}
                  fontSize={12}
                  fontWeight="bold"
                >
                  {lm.label}
                </SvgText>
              </React.Fragment>
            ))}
          </Svg>
        </View>
      </View>

      {/* Landmark list */}
      {landmarks.length > 0 && (
        <View style={s.listCard}>
          <Text style={s.listTitle}>{landmarks.length} Landmark{landmarks.length > 1 ? 's' : ''}</Text>
          {landmarks.map((lm, i) => (
            <View key={i} style={s.listItem}>
              <View style={[s.dot, { backgroundColor: lm.color }]} />
              <Text style={s.listLabel}>{lm.label ?? `#${i + 1}`}</Text>
              <Text style={s.listPos}>
                x={Math.round(lm.x * 100)}%  y={Math.round(lm.y * 100)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons */}
      <View style={s.actionRow}>
        {landmarks.length > 0 && (
          <TouchableOpacity style={s.undoBtn} onPress={handleDeleteLast}>
            <Text style={s.undoBtnText}>Undo Last</Text>
          </TouchableOpacity>
        )}
        {landmarks.length > 0 && (
          <TouchableOpacity style={s.clearBtn} onPress={handleClear}>
            <Text style={s.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {!imageUri && (
        <TouchableOpacity
          style={s.cameraBtn}
          onPress={() => nav.navigate('Camera', { patientId: params.patientId, eyeId: params.eyeId })}
        >
          <Text style={s.cameraBtnText}>Go to Camera</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[s.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={s.saveBtnText}>{saving ? 'Saving…' : `Save ${landmarks.length} Landmark${landmarks.length !== 1 ? 's' : ''}`}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },
  instructions: {
    color: '#888060', fontSize: 13, marginBottom: 12,
    lineHeight: 18, fontStyle: 'italic',
  },
  canvasWrapper: {
    alignItems: 'center', marginBottom: 16,
    shadowColor: '#C8A84B', shadowOpacity: 0.2, shadowRadius: 12,
  },
  noImage: {
    backgroundColor: '#F8F6EF', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#DDD5BB',
  },
  noImageText: { color: '#888060', fontSize: 16 },
  noImageHint: { color: '#888060', fontSize: 13, marginTop: 4 },
  listCard: {
    backgroundColor: '#F8F6EF', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#DDD5BB', marginBottom: 12,
  },
  listTitle: { color: '#1A1200', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  listLabel: { color: '#1A1200', fontSize: 13, fontWeight: '600', width: 24 },
  listPos: { color: '#888060', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  undoBtn: {
    flex: 1, borderWidth: 1, borderColor: '#C8A84B', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  undoBtnText: { color: '#C8A84B', fontSize: 14, fontWeight: '600' },
  clearBtn: {
    flex: 1, borderWidth: 1, borderColor: '#882222', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  clearBtnText: { color: '#FF6644', fontSize: 14, fontWeight: '600' },
  cameraBtn: {
    borderWidth: 1, borderColor: '#C8A84B', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginBottom: 12,
  },
  cameraBtnText: { color: '#C8A84B', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#2A8A44', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
  },
  saveBtnText: { color: '#C8C8C8', fontSize: 16, fontWeight: '700' },
});
