import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE = 'https://www.buysidebro.com';
const STORE_DEVICE_TOKEN_KEY = 'push_device_token';

export interface NotificationPreferences {
  watchlistPriceAlerts: boolean;
  priceAlertThreshold: number;
  usaMarketSummary: boolean;
  asxMarketSummary: boolean;
  europeMarketSummary: boolean;
}

/**
 * Register for push notifications:
 * 1. Check physical device
 * 2. Request permissions
 * 3. Get native APNs device token
 * 4. Send to backend
 * 5. Store token locally for later unregistration
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get native APNs token (backend sends directly via APNs, not Expo push service)
  const tokenData = await Notifications.getDevicePushTokenAsync();
  const deviceToken = tokenData.data as string;

  try {
    const response = await fetch(`${API_BASE}/api/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        deviceToken,
        platform: Platform.OS,
      }),
    });

    if (!response.ok) {
      console.warn('Failed to register push token:', response.status);
      return null;
    }

    await SecureStore.setItemAsync(STORE_DEVICE_TOKEN_KEY, deviceToken);
    return deviceToken;
  } catch (error) {
    console.warn('Error registering push token:', error);
    return null;
  }
}

/**
 * Unregister the device token from the backend and clear local storage.
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const deviceToken = await SecureStore.getItemAsync(STORE_DEVICE_TOKEN_KEY);
    if (!deviceToken) return;

    await fetch(`${API_BASE}/api/push/unregister`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ deviceToken }),
    });

    await SecureStore.deleteItemAsync(STORE_DEVICE_TOKEN_KEY);
  } catch (error) {
    console.warn('Error unregistering push token:', error);
  }
}

/**
 * Fetch the user's notification preferences from the backend.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  try {
    const response = await fetch(`${API_BASE}/api/push/preferences`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn('Error fetching notification preferences:', error);
    return null;
  }
}

/**
 * Update the user's notification preferences on the backend.
 */
export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/push/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(prefs),
    });

    return response.ok;
  } catch (error) {
    console.warn('Error updating notification preferences:', error);
    return false;
  }
}

/**
 * Build the WebView URL to navigate to based on notification data.
 */
export function getDeepLinkUrl(data: Record<string, unknown>): string | null {
  if (data.type === 'price_alert' && typeof data.symbol === 'string') {
    return `${API_BASE}/stock/${data.symbol}`;
  }

  if (data.type === 'summary' && typeof data.market === 'string') {
    return `${API_BASE}/news`;
  }

  return null;
}
