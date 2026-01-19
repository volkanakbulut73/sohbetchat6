import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Removed 'define' block to allow process.env.API_KEY to be read from the runtime environment (window.process)
});