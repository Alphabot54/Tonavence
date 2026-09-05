import MetronomeScreen from './screens/MetronomeScreen';
import TunerScreen from './screens/TunerScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <TunerScreen />
      {/*<MetronomeScreen />*/}
    </SafeAreaProvider>
  );
}
