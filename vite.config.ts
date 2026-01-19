import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');
  
  // We do NOT strictly define process.env.API_KEY to a fixed string here if it is missing.
  // This allows the code to fallback to `window.process.env.API_KEY` or `window.API_KEY`
  // which might be injected at runtime in cloud environments.
  
  const define: Record<string, any> = {};
  
  // Only if we definitely have a key at build time, we expose it.
  // Otherwise, we leave it to the runtime check.
  const buildTimeKey = env.API_KEY || env.VITE_API_KEY;
  if (buildTimeKey) {
    define['process.env.API_KEY'] = JSON.stringify(buildTimeKey);
  }

  return {
    plugins: [react()],
    define: define
  };
});