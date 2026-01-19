import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid TypeScript errors regarding 'cwd' if types are missing.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Try to find the key from build-time environment
  const apiKey = process.env.API_KEY || env.API_KEY || process.env.VITE_API_KEY || env.VITE_API_KEY;
  
  const define: Record<string, any> = {};
  
  // Only explicitly define process.env.API_KEY if we have a value.
  // If we don't, we leave it undefined so that code checking `window.process.env.API_KEY` 
  // or other runtime injections can work without being overwritten by an empty string.
  if (apiKey) {
    define['process.env.API_KEY'] = JSON.stringify(apiKey);
  }

  return {
    plugins: [react()],
    define: define
  };
});