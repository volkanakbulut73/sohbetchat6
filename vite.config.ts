import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Cast process to any to avoid TypeScript errors regarding 'cwd' if types are missing.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // comprehensive check for the key from all possible sources
  const apiKey = process.env.API_KEY || env.API_KEY || process.env.VITE_API_KEY || env.VITE_API_KEY || '';
  
  return {
    plugins: [react()],
    define: {
      // Define process.env.API_KEY globally so it works in the browser
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Also define process.env.VITE_API_KEY for compatibility
      'process.env.VITE_API_KEY': JSON.stringify(apiKey),
    }
  };
});