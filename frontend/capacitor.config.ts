import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thechinesehouse.pos',
  appName: 'The Chinese House',
  webDir: 'dist',
  server: {
    url: 'https://the-chinese-house.vercel.app/dashboard',
    cleartext: true
  }
};

export default config;
