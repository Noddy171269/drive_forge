import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: /api -> local Express server, so the client can use relative URLs
// in development without CORS friction.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
