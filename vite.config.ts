import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = process.env.API_KEY || env.API_KEY;
  
  // Only inject the key if we found one in the build environment. 
  // Otherwise, leave the code as is so it can read from window.process at runtime.
  const define: Record<string, any> = {};
  if (apiKey) {
    define['process.env.API_KEY'] = JSON.stringify(apiKey);
  }

  return {
    plugins: [react()],
    define: define
  };
});