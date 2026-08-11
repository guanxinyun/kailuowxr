import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/kailuowxr/',
  publicDir: 'public',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
