import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // relative assets in the build: the app is served at / on the LAN but Tailscale
  // mounts it at /juuku, and only relative URLs survive a prefix
  base: command === 'build' ? './' : '/',
  server: {
    port: 3100,
    strictPort: true,
    // LAN access for testing on a phone; the API stays on loopback and is proxied
    host: '0.0.0.0',
    proxy: { '/api': 'http://127.0.0.1:3101' },
  },
}));
