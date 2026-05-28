import AsyncStorage from '@react-native-async-storage/async-storage';
import { Patient, EyeRecord } from '../types';
import uuid from 'react-native-uuid';

const STORAGE_KEY = 'toric_patients';

export async function getPatients(): Promise<Patient[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export async function getPatient(id: string): Promise<Patient | null> {
  const patients = await getPatients();
  return patients.find(p => p.id === id) ?? null;
}

export async function savePatient(patient: Patient): Promise<void> {
  const patients = await getPatients();
  const idx = patients.findIndex(p => p.id === patient.id);
  if (idx >= 0) {
    patients[idx] = { ...patient, updatedAt: new Date().toISOString() };
  } else {
    patients.push(patient);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

export async function deletePatient(id: string): Promise<void> {
  const patients = await getPatients();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(patients.filter(p => p.id !== id)));
}

export function createPatient(name: string, mrn?: string, dob?: string): Patient {
  return {
    id: uuid.v4() as string,
    name,
    mrn,
    dob,
    eyes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createEyeRecord(side: EyeRecord['side'], referenceAxis: number, targetAxis: number): EyeRecord {
  return {
    id: uuid.v4() as string,
    side,
    referenceAxis,
    targetAxis,
    date: new Date().toISOString(),
  };
}

export async function updateEyeRecord(patientId: string, eye: EyeRecord): Promise<void> {
  const patient = await getPatient(patientId);
  if (!patient) return;
  const idx = patient.eyes.findIndex(e => e.id === eye.id);
  if (idx >= 0) {
    patient.eyes[idx] = eye;
  } else {
    patient.eyes.push(eye);
  }
  await savePatient(patient);
}
