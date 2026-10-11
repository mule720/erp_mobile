/**
 * REST helpers for the ERP Soft-POS feature.
 *
 * All calls go to the OWN backend (api.netonerppro.com) which proxies to AfriSwipe.
 * Auth: Bearer token from expo-secure-store (same key used by src/api/graphql.ts).
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'erp_token';
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL
    ? process.env.EXPO_PUBLIC_API_URL.replace(/\/graphql\/?$/, '')
    : 'https://api.netonerppro.com';

async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Register this device with AfriSwipe via the ERP backend. */
export async function registerSoftPosDevice(params: {
  staffRef: string;
  expoToken: string;
  deviceType: 'android' | 'ios';
  label?: string;
}): Promise<void> {
  const headers = await authHeader();
  try {
    await fetch(`${API_BASE}/api/soft-pos/register-device/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        staff_ref: params.staffRef,
        expo_token: params.expoToken,
        device_type: params.deviceType,
        label: params.label ?? '',
      }),
    });
  } catch {
    // Silent — device registration failure must not block login
  }
}

/** Notify the backend that the staff member accepted the payment. */
export async function completeSoftPosSession(
  sessionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/api/soft-pos/sessions/${sessionId}/complete/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: '{}',
  });
  return res.json();
}

/** Notify the backend that the session was cancelled. */
export async function failSoftPosSession(
  sessionId: string,
  reason = 'cancelled_by_staff',
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/api/soft-pos/sessions/${sessionId}/fail/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ reason }),
  });
  return res.json();
}
