import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Skia 2.6.2 creates its web API when the module is imported, so App must remain a
// dynamic import after CanvasKit resolves. Importing App above this gate permanently
// constructs Skia with an undefined CanvasKit API.
void LoadSkiaWeb({ locateFile: (file) => `/${file}` })
  .then(async () => {
    const App = (await import('./App')).default;
    registerRootComponent(App);
  })
  .catch((err: unknown) => {
    console.error('CanvasKit failed to load:', err);
    const root = document.getElementById('root');
    if (root) root.textContent = 'Failed to start — see console for details, then reload.';
  });
