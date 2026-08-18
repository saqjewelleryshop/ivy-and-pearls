import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('gsap')) return 'motion';
          if (id.includes('@stripe')) return 'payments';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('node_modules')) return 'vendor';
        }
      }
    }
  },
  ssr: {
    noExternal: ['react-helmet-async']
  }
});