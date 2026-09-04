import MetronomeScreen from './screens/MetronomeScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <MetronomeScreen />
    </SafeAreaProvider>
  );
}
