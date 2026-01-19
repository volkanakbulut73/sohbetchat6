import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');
  
  // CRITICAL: Check both the loaded .env object AND the actual process.env
  // Vercel injects environment variables into process.env directly during build.
  const apiKey = process.env.API_KEY || process.env.VITE_API_KEY || env.API_KEY || env.VITE_API_KEY;
  
  const define: Record<string, any> = {};
  
  // If we found a key, we "hardcode" it into the client bundle by replacing process.env.API_KEY
  if (apiKey) {
    define['process.env.API_KEY'] = JSON.stringify(apiKey);
  }

  return {
    plugins: [react()],
    define: define
  };
});