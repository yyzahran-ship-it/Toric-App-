import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getPatient, updateEyeRecord } from '../storage/patients';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Camera'>;
type Route = RouteProp<RootStackParamList, 'Camera'>;

export default function CameraScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  async function capture() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo) throw new Error('No photo captured');

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

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Alignment guide overlay */}
        <View style={styles.guide}>
          <View style={styles.circle} />
          <View style={styles.hLine} />
          <View style={styles.vLine} />
        </View>

        <View style={styles.hint}>
          <Text style={styles.hintText}>Center the eye within the circle</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.shutterBtn} onPress={capture} disabled={capturing}>
            {capturing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.shutterInner} />
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
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    position: 'absolute',
  },
  hLine: {
    position: 'absolute', width: 260, height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  vLine: {
    position: 'absolute', width: 1, height: 260,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  hint: {
    position: 'absolute', top: 80, left: 0, right: 0, alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.8)', fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6,
  },
  controls: {
    position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center',
  },
  shutterBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#ffffff',
  },
  permContainer: { flex: 1, backgroundColor: '#0d0d1a', alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText: { color: '#ffffff', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  permBtn: { backgroundColor: '#4466FF', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
