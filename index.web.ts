import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Web must not register the app until CanvasKit is loaded — a Skia Canvas
// rendered before that is the silent-blank failure mode this gate exists to catch.
void LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(async () => {
  const App = (await import('./App')).default;
  registerRootComponent(App);
});
