import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'forpaw',
  brand: {
    displayName: 'ForPaw',
    primaryColor: '#FF6B35',
    icon: '',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
