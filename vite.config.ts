import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third parameter '' ensures we load all env vars, not just VITE_ ones, 
  // though specific filtering is safer in production.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // JSON.stringify is crucial here to wrap the value in quotes
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});