import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid TypeScript errors regarding 'cwd' if types are missing.
  const env = loadEnv(mode, (process as any).cwd(), '');
  // Check both API_KEY and VITE_API_KEY
  const apiKey = process.env.API_KEY || env.API_KEY || process.env.VITE_API_KEY || env.VITE_API_KEY;
  
  const define: Record<string, any> = {};
  
  // Only inject the key if we found one in the build environment. 
  // Otherwise, leave the code as is so it can read from window.process at runtime.
  if (apiKey) {
    define['process.env.API_KEY'] = JSON.stringify(apiKey);
  }

  return {
    plugins: [react()],
    define: define
  };
});