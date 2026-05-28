import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@toric_sia_cases';

export interface SiaCase {
  id: string;
  date: string;
  plannedSia: number;    // D
  plannedAxis: number;   // °
  achievedSia: number;   // D
  achievedAxis: number;  // °
  notes?: string;
}

export async function getSiaCases(): Promise<SiaCase[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveSiaCase(c: SiaCase): Promise<void> {
  const cases = await getSiaCases();
  const idx = cases.findIndex(x => x.id === c.id);
  if (idx >= 0) cases[idx] = c; else cases.push(c);
  await AsyncStorage.setItem(KEY, JSON.stringify(cases));
}

export async function deleteSiaCase(id: string): Promise<void> {
  const cases = await getSiaCases();
  await AsyncStorage.setItem(KEY, JSON.stringify(cases.filter(c => c.id !== id)));
}

export function meanSia(cases: SiaCase[]): { mag: number; axis: number } | null {
  if (cases.length === 0) return null;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  let sumX = 0, sumY = 0;
  for (const c of cases) {
    sumX += c.achievedSia * Math.cos(2 * toRad(c.achievedAxis));
    sumY += c.achievedSia * Math.sin(2 * toRad(c.achievedAxis));
  }
  sumX /= cases.length;
  sumY /= cases.length;
  const mag = Math.sqrt(sumX * sumX + sumY * sumY);
  let axis = toDeg(Math.atan2(sumY, sumX)) / 2;
  if (axis < 0) axis += 180;
  return { mag: Math.round(mag * 100) / 100, axis: Math.round(axis) % 180 };
}
