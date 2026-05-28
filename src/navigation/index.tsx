import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import PatientListScreen from '../screens/PatientListScreen';
import PatientFormScreen from '../screens/PatientFormScreen';
import PatientDetailScreen from '../screens/PatientDetailScreen';
import CameraScreen from '../screens/CameraScreen';
import AlignmentScreen from '../screens/AlignmentScreen';
import ToricCalculatorScreen from '../screens/ToricCalculatorScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0d0d1a' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#0d0d1a' },
        }}
      >
        <Stack.Screen
          name="PatientList"
          component={PatientListScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PatientForm"
          component={PatientFormScreen}
          options={({ route }) => ({
            title: route.params?.patientId ? 'Edit Patient' : 'New Patient',
          })}
        />
        <Stack.Screen
          name="PatientDetail"
          component={PatientDetailScreen}
          options={{ title: 'Patient' }}
        />
        <Stack.Screen
          name="Camera"
          component={CameraScreen}
          options={{ title: 'Capture Eye', headerTransparent: true, headerTintColor: '#fff' }}
        />
        <Stack.Screen
          name="Alignment"
          component={AlignmentScreen}
          options={{ title: 'IOL Alignment' }}
        />
        <Stack.Screen
          name="ToricCalculator"
          component={ToricCalculatorScreen}
          options={{ title: 'Toric Calculator' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
