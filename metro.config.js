const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Wasm assets (CanvasKit today, anything wasm-shaped later) must survive bundling.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// INERT under `expo start` in SDK 57 (verified — see docs/superpowers/evidence/P0.md):
// dev mode serves NO isolation headers; do not rely on crossOriginIsolated in dev.
// Kept only in case a future SDK honors it again. The real header contract lives in
// serve.json (local exported artifact) and vercel.json (eventual host).
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
