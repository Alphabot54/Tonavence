import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from "expo-status-bar";
import { NavigationBar } from "expo-navigation-bar";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style='light'/>
      <NavigationBar style='dark' />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
    </SafeAreaProvider>
  );
}