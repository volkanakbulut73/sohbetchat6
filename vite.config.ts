import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid TypeScript errors regarding 'cwd' if types are missing.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Check for keys in various environment locations
  const apiKey = process.env.API_KEY || env.API_KEY || process.env.VITE_API_KEY || env.VITE_API_KEY;
  
  const define: Record<string, any> = {};
  
  // Only define process.env.API_KEY if we actually have a value.
  // This prevents overwriting the variable with an empty string during build,
  // allowing the code to potentially find it in window.process at runtime.
  if (apiKey) {
    define['process.env.API_KEY'] = JSON.stringify(apiKey);
  }

  return {
    plugins: [react()],
    define: define
  };
});