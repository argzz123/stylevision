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
    allowedHosts: [
      'stylevision-argzz.amvera.io',
      'stylevision.fun',
      'www.stylevision.fun'
    ]
  }
});