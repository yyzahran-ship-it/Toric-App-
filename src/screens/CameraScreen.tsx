import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DeviceMotion } from 'expo-sensors';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { RootStackParamList } from '../types';
import { getPatient, updateEyeRecord } from '../storage/patients';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Camera'>;
type Route = RouteProp<RootStackParamList, 'Camera'>;

// ── Static dial geometry (computed once at module load) ───────────────────────
const DIAL = 310;
const dcx = DIAL / 2;
const dcy = DIAL / 2;
const R_MAIN = 120;
const R_OUTER1 = 127;
const R_OUTER2 = 134;
const R_OUTER3 = 142;
const R_LABEL = 151;
const R_INNER = 54;

// TABO axis → SVG: x = cx + r·cos(a), y = cy − r·sin(a)  (y-flipped for SVG)
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = i * 5;
  const isMajor = a % 30 === 0;
  const isMedium = a % 10 === 0;
  const rOut = isMajor ? R_OUTER2 : isMedium ? R_OUTER1 : R_MAIN + 5;
  const rad = (a * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x1: dcx + R_MAIN * c, y1: dcy - R_MAIN * s,
    x2: dcx + rOut * c,   y2: dcy - rOut * s,
    sw: isMajor ? 2.5 : isMedium ? 1.5 : 0.8,
    color: isMajor ? '#C8A84B' : isMedium ? 'rgba(200,168,75,0.65)' : 'rgba(200,168,75,0.3)',
  };
});

const LABELS = [0, 30, 60, 90, 120, 150, 180].map(a => {
  const rad = (a * Math.PI) / 180;
  return { a, x: dcx + R_LABEL * Math.cos(rad), y: dcy - R_LABEL * Math.sin(rad) };
});

// ── Premium dial component ────────────────────────────────────────────────────
function PremiumDial({ roll }: { roll: number }) {
  const isLevel = Math.abs(roll) <= 3;
  return (
    <Svg width={DIAL} height={DIAL}>
      {/* Triple accent rings */}
      <Circle cx={dcx} cy={dcy} r={R_OUTER3} stroke="rgba(200,168,75,0.2)" strokeWidth={1} fill="none" />
      <Circle cx={dcx} cy={dcy} r={R_OUTER2} stroke="rgba(200,168,75,0.45)" strokeWidth={1.5} fill="none" />
      <Circle cx={dcx} cy={dcy} r={R_OUTER1} stroke="rgba(200,168,75,0.75)" strokeWidth={2} fill="none" />

      {/* Main guide ring */}
      <Circle cx={dcx} cy={dcy} r={R_MAIN} stroke="#C8A84B" strokeWidth={2.5} fill="rgba(0,0,0,0.12)" />

      {/* Tick marks at every 5° */}
      {TICKS.map((t, i) => (
        <Line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.color} strokeWidth={t.sw} />
      ))}

      {/* Degree labels at TABO 0°–180° */}
      {LABELS.map(({ a, x, y }) => (
        <SvgText key={a} x={x} y={y + 4} textAnchor="middle" fill="#C8A84B" fontSize={10} fontWeight="600">
          {a}°
        </SvgText>
      ))}

      {/* Inner pupil guide (dashed cyan) */}
      <Circle cx={dcx} cy={dcy} r={R_INNER} stroke="rgba(136,204,255,0.55)" strokeWidth={1.5} fill="none" strokeDasharray="6,4" />

      {/* Crosshairs */}
      <Line x1={dcx - R_MAIN} y1={dcy} x2={dcx + R_MAIN} y2={dcy} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
      <Line x1={dcx} y1={dcy - R_MAIN} x2={dcx} y2={dcy + R_MAIN} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />

      {/* Center readout circle */}
      <Circle cx={dcx} cy={dcy} r={32} fill="rgba(0,0,0,0.65)" stroke={isLevel ? '#44FF88' : '#C8A84B'} strokeWidth={1.5} />
      <SvgText x={dcx} y={dcy - 3} textAnchor="middle" fill={isLevel ? '#44FF88' : '#FFD700'} fontSize={15} fontWeight="700">
        {roll > 0 ? '+' : ''}{roll}°
      </SvgText>
      <SvgText x={dcx} y={dcy + 13} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize={8}>
        {isLevel ? 'LEVEL' : 'TILT'}
      </SvgText>
    </Svg>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function CameraScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [capturing, setCapturing] = useState(false);
  const [saveToGallery, setSaveToGallery] = useState(false);
  const [roll, setRoll] = useState(0);

  useEffect(() => {
    if (permission && !permission.granted) requestPermission();
  }, [permission]);

  useEffect(() => {
    DeviceMotion.setUpdateInterval(100);
    const sub = DeviceMotion.addListener(data => {
      if (data.rotation) {
        const deg = (data.rotation.gamma * 180) / Math.PI;
        setRoll(Math.round(deg));
      }
    });
    return () => sub.remove();
  }, []);

  async function capture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo) throw new Error('No photo captured');
      if (saveToGallery) {
        if (!mediaPermission?.granted) await requestMediaPermission();
        if (mediaPermission?.granted) await MediaLibrary.saveToLibraryAsync(photo.uri);
      }
      const patient = await getPatient(params.patientId);
      const eye = patient?.eyes.find(e => e.id === params.eyeId);
      if (!eye) throw new Error('Eye record not found');
      await updateEyeRecord(params.patientId, { ...eye, imageUri: photo.uri });
      nav.navigate('Alignment', { patientId: params.patientId, eyeId: params.eyeId });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to capture photo');
    } finally {
      setCapturing(false);
    }
  }

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permText}>Camera access is required to capture eye images.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLevel = Math.abs(roll) <= 3;

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">

        {/* Premium instrument gauge overlay */}
        <View style={styles.guide}>
          <PremiumDial roll={roll} />
        </View>

        {/* Hint */}
        <View style={styles.hint}>
          <Text style={styles.hintText}>Center the eye within the ring</Text>
        </View>

        {/* Save to gallery toggle */}
        <TouchableOpacity style={styles.galleryToggle} onPress={() => setSaveToGallery(v => !v)}>
          <View style={[styles.toggleDot, saveToGallery && styles.toggleDotOn]} />
          <Text style={styles.galleryText}>Save to gallery</Text>
        </TouchableOpacity>

        {/* Shutter */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.shutterBtn, isLevel && styles.shutterBtnLevel]}
            onPress={capture}
            disabled={capturing}
          >
            {capturing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={[styles.shutterInner, isLevel && styles.shutterLevel]} />
            )}
          </TouchableOpacity>
        </View>

      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  guide: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: { position: 'absolute', top: 80, left: 0, right: 0, alignItems: 'center' },
  hintText: {
    color: 'rgba(255,255,255,0.85)', fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
  },
  galleryToggle: {
    position: 'absolute', bottom: 140, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  toggleDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.3)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
  toggleDotOn: { backgroundColor: '#44FF88', borderColor: '#44FF88' },
  galleryText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  controls: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
  shutterBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterBtnLevel: { borderColor: '#44FF88' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(200,168,75,0.85)' },
  shutterLevel: { backgroundColor: '#44FF88' },
  permContainer: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText: { color: '#1A1200', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  permBtn: { backgroundColor: '#C8A84B', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#1A1200', fontSize: 16, fontWeight: '600' },
});
