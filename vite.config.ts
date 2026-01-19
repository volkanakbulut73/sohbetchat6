import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid TypeScript errors regarding 'cwd' if types are missing.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // comprehensive check for the key
  const apiKey = process.env.API_KEY || env.API_KEY || process.env.VITE_API_KEY || env.VITE_API_KEY || '';
  
  const define: Record<string, any> = {};
  
  // ALWAYS define process.env.API_KEY. 
  // This ensures that in the client code, `process.env.API_KEY` is replaced by the string value (or empty string).
  // This removes reliance on the window.process polyfill for this specific variable.
  define['process.env.API_KEY'] = JSON.stringify(apiKey);

  return {
    plugins: [react()],
    define: define
  };
});