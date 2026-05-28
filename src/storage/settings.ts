import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@toric_settings';

export interface AppSettings {
  defaultSia: number;
  defaultSiaAxis: number;
  defaultPlatform: string;
}

const DEFAULTS: AppSettings = {
  defaultSia: 0.25,
  defaultSiaAxis: 0,
  defaultPlatform: 'acrysof',
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
