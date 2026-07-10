import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.classicchinese.pos',
  appName: 'Classic Chinese',
  webDir: 'dist',
  server: {
    url: 'https://classic-chinese.vercel.app/dashboard',
    cleartext: true
  }
};

export default config;
