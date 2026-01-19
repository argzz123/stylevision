
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: [
      'stylevision-argzz.amvera.io',
      'stylevision.fun',
      'www.stylevision.fun'
    ],
    host: true,
    port: 4173,
  },
  server: {
    host: true,
    // Proxy API requests to the Node.js server (running on 3001) during local dev
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
    allowedHosts: [
      'stylevision-argzz.amvera.io',
      'stylevision.fun',
      'www.stylevision.fun'
    ]
  }
});
