import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.susedf.app',
  appName: 'SUSE-DF',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Geolocation: {
      permissionType: 'location'
    }
  }
};

export default config;
