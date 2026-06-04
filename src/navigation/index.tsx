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
import AlpinsAnalysisScreen from '../screens/AlpinsAnalysisScreen';
import LandmarkAnnotationScreen from '../screens/LandmarkAnnotationScreen';
import SiaNomogramScreen from '../screens/SiaNomogramScreen';
import BagVsSulcusScreen from '../screens/BagVsSulcusScreen';
import BarrettTrueKScreen from '../screens/BarrettTrueKScreen';
import IolCalculatorsScreen from '../screens/IolCalculatorsScreen';
import IolWebViewScreen from '../screens/IolWebViewScreen';
import PostRefractiveScreen from '../screens/PostRefractiveScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#1A1200',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#FFFFFF' },
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
          name="AlpinsAnalysis"
          component={AlpinsAnalysisScreen}
          options={{ title: 'Alpins Analysis' }}
        />
        <Stack.Screen
          name="LandmarkAnnotation"
          component={LandmarkAnnotationScreen}
          options={{ title: 'Landmark Annotation' }}
        />
        <Stack.Screen
          name="PostRefractive"
          component={PostRefractiveScreen}
          options={{ title: 'Post-Refractive IOL' }}
        />
        <Stack.Screen
          name="SiaNomogram"
          component={SiaNomogramScreen}
          options={{ title: 'SIA Nomogram' }}
        />
        <Stack.Screen
          name="BagVsSulcus"
          component={BagVsSulcusScreen}
          options={{ title: 'Bag vs Sulcus IOL' }}
        />
        <Stack.Screen
          name="BarrettTrueK"
          component={BarrettTrueKScreen}
          options={{ title: 'Barrett True-K Toric' }}
        />
        <Stack.Screen
          name="IolCalculators"
          component={IolCalculatorsScreen}
          options={{
            title: 'IOL Calculators',
            headerStyle: { backgroundColor: '#0d0d1a' },
            headerTintColor: '#C8A84B',
            headerTitleStyle: { color: '#F0EAD6', fontWeight: '700' },
          }}
        />
        <Stack.Screen
          name="IolWebView"
          component={IolWebViewScreen}
          options={{ headerShown: false }}
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
