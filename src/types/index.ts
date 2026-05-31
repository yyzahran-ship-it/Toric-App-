export type EyeSide = 'OD' | 'OS'; // OD = right, OS = left

export interface Landmark {
  x: number;      // 0–1 relative to image width
  y: number;      // 0–1 relative to image height
  color: string;
  label?: string;
}

export interface EyeRecord {
  id: string;
  side: EyeSide;
  imageUri?: string;
  referenceAxis: number;  // pre-op marked axis 0–180°
  targetAxis: number;     // IOL target axis 0–180°
  currentAxis?: number;   // IOL current position (intraop)
  notes?: string;
  date: string;
  // Corneal biometry
  axialLength?: number;   // axial length (mm)
  k1Power?: number;       // flat K (D)
  k1Axis?: number;        // flat meridian axis 0–180°
  k2Power?: number;       // steep K (D), axis = k1Axis + 90
  // Surgical parameters
  sia?: number;           // surgically induced astigmatism (D)
  siaAxis?: number;       // incision meridian axis 0–180°
  // IOL data
  iolModel?: string;
  iolSphere?: number;     // sphere power (D)
  iolCylinder?: number;   // cylinder power (D)
  // Post-refractive surgery
  postRefractive?: boolean;
  postRefractiveType?: 'LASIK' | 'PRK' | 'RK';
  // Landmark annotations (vessel reference marks)
  landmarks?: Landmark[];
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
  ToricCalculator: { patientId: string; eyeId: string };
  AlpinsAnalysis: { patientId: string; eyeId: string };
  LandmarkAnnotation: { patientId: string; eyeId: string };
  PostRefractive: { patientId?: string; eyeId?: string };
  SiaNomogram: undefined;
  BagVsSulcus: undefined;
  BarrettTrueK: undefined;
  Settings: undefined;
};
