import MetronomeScreen from './screens/MetronomeScreen';
import MetroScreen from './screens/MetroScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PolygonMetronome from './components/PolygonMetronome';

export default function App() {
  return (
    <SafeAreaProvider>
      <MetroScreen />
    </SafeAreaProvider>
  );
}
