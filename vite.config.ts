import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
	        host: '0.0.0.0',
	        proxy: {
	          '/api': {
	            target: process.env.BACKEND_URL || 'http://localhost:8080',
	            changeOrigin: true,
	          },
	        },
      },
      plugins: [react()],
	      define: {
	        'process.env.GOOGLE_MAPS_API_KEY': JSON.stringify(env.GOOGLE_MAPS_API_KEY || ''),
	      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
