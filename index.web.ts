import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Web must not register the app until CanvasKit is loaded — a Skia Canvas
// rendered before that is the silent-blank failure mode this gate exists to catch.
void LoadSkiaWeb({ locateFile: (file) => `/${file}` })
  .then(async () => {
    const App = (await import('./App')).default;
    registerRootComponent(App);
  })
  .catch((err: unknown) => {
    // The loader sits in front of the proof screen, so it must fail visibly too.
    console.error('CanvasKit failed to load:', err);
    const root = document.getElementById('root');
    if (root) root.textContent = 'Failed to start — see console for details, then reload.';
  });
