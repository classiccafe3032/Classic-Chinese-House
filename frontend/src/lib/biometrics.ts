import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Preferences } from '@capacitor/preferences';
import { API_URL } from './apiClient';

const BIOMETRIC_TOKEN_KEY = 'admin_biometric_token';

export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch (err) {
    console.error('Biometrics check failed:', err);
    return false;
  }
}

export async function hasSavedBiometricToken(): Promise<boolean> {
  const { value } = await Preferences.get({ key: BIOMETRIC_TOKEN_KEY });
  return !!value;
}

export async function registerBiometricDevice(): Promise<boolean> {
  try {
    const token = localStorage.getItem('admin_token');
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_URL}/admin/biometric/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error('Failed to register biometric token');
    const data = await res.json();

    await Preferences.set({
      key: BIOMETRIC_TOKEN_KEY,
      value: data.biometricToken
    });

    return true;
  } catch (err) {
    console.error('Failed to register device for biometrics:', err);
    return false;
  }
}

export async function authenticateWithBiometrics(): Promise<any> {
  try {
    const { value: biometricToken } = await Preferences.get({ key: BIOMETRIC_TOKEN_KEY });
    if (!biometricToken) throw new Error('No biometric token saved on device');

    await NativeBiometric.verifyIdentity({
      reason: "Unlock the Chinese House POS",
      title: "Biometric Login",
      subtitle: "Use your fingerprint or face to login",
      description: "Fast and secure access to your dashboard",
    });

    // Verification succeeded, send token to backend
    const res = await fetch(`${API_URL}/admin/biometric/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ biometricToken })
    });

    if (!res.ok) throw new Error('Biometric token expired or invalid');
    
    return await res.json();
  } catch (err) {
    console.error('Biometric auth failed:', err);
    throw err;
  }
}

export async function removeBiometricToken(): Promise<void> {
  await Preferences.remove({ key: BIOMETRIC_TOKEN_KEY });
}
