export type EyeSide = 'OD' | 'OS'; // OD = right, OS = left

export interface EyeRecord {
  id: string;
  side: EyeSide;
  imageUri?: string;
  referenceAxis: number;  // pre-op marked axis 0–180°
  targetAxis: number;     // IOL target axis 0–180°
  currentAxis?: number;   // IOL current position (intraop)
  notes?: string;
  date: string;
}

export interface Patient {
  id: string;
  name: string;
  mrn?: string;
  dob?: string;
  eyes: EyeRecord[];
  createdAt: string;
  updatedAt: string;
}

export type RootStackParamList = {
  PatientList: undefined;
  PatientForm: { patientId?: string };
  PatientDetail: { patientId: string };
  Camera: { patientId: string; eyeId: string };
  Alignment: { patientId: string; eyeId: string };
};
