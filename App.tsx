import { StatusBar } from 'expo-status-bar';
import { GameScreen } from './src/application/GameScreen';

export default function App() {
  return (
    <>
      <GameScreen />
      <StatusBar style="auto" />
    </>
  );
}
