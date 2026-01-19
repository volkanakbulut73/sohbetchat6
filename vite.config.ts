import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Ensure it's a string, even if empty, to avoid 'undefined' variable issues in browser
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    }
  };
});