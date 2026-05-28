import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DeviceMotion } from 'expo-sensors';
import { RootStackParamList } from '../types';
import { getPatient, updateEyeRecord } from '../storage/patients';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Camera'>;
type Route = RouteProp<RootStackParamList, 'Camera'>;

export default function CameraScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [capturing, setCapturing] = useState(false);
  const [saveToGallery, setSaveToGallery] = useState(false);
  // Roll angle in degrees (tilt left/right) from gyroscope — for leveling guide
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
        if (mediaPermission?.granted) {
          await MediaLibrary.saveToLibraryAsync(photo.uri);
        }
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
        {/* Alignment guide */}
        <View style={styles.guide}>
          <View style={styles.circle} />
          <View style={styles.hLine} />
          <View style={styles.vLine} />
        </View>

        {/* Level indicator */}
        <View style={styles.levelBar}>
          <View style={[styles.levelDot, { left: `${50 + Math.max(-45, Math.min(45, roll))}%` as any }]} />
          <View style={styles.levelCenter} />
        </View>
        <Text style={[styles.levelText, isLevel ? styles.levelOk : styles.levelOff]}>
          {isLevel ? 'Level ✓' : `${roll > 0 ? 'Tilt left' : 'Tilt right'} ${Math.abs(roll)}°`}
        </Text>

        <View style={styles.hint}>
          <Text style={styles.hintText}>Center the eye within the circle</Text>
        </View>

        {/* Save to gallery toggle */}
        <TouchableOpacity style={styles.galleryToggle} onPress={() => setSaveToGallery(v => !v)}>
          <View style={[styles.toggleDot, saveToGallery && styles.toggleDotOn]} />
          <Text style={styles.galleryText}>Save to gallery</Text>
        </TouchableOpacity>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.shutterBtn} onPress={capture} disabled={capturing}>
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
  circle: {
    width: 260, height: 260, borderRadius: 130,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', position: 'absolute',
  },
  hLine: { position: 'absolute', width: 260, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  vLine: { position: 'absolute', width: 1, height: 260, backgroundColor: 'rgba(255,255,255,0.3)' },
  levelBar: {
    position: 'absolute', top: 140, left: 40, right: 40, height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2,
  },
  levelDot: {
    position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#FFD700', marginLeft: -7,
  },
  levelCenter: {
    position: 'absolute', top: -4, left: '50%', marginLeft: -6,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  levelText: {
    position: 'absolute', top: 160, alignSelf: 'center',
    fontSize: 12, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  levelOk: { color: '#44FF88' },
  levelOff: { color: '#FFD700' },
  hint: { position: 'absolute', top: 80, left: 0, right: 0, alignItems: 'center' },
  hintText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6,
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
    borderWidth: 4, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#ffffff' },
  shutterLevel: { backgroundColor: '#44FF88' },
  permContainer: { flex: 1, backgroundColor: '#0d0d1a', alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText: { color: '#ffffff', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  permBtn: { backgroundColor: '#4466FF', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
