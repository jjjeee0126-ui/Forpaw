import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'for-paw',
  brand: {
    displayName: 'For Paw',
    primaryColor: '#3182F6',
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
});
