import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import NetInfo from '@react-native-community/netinfo';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import CookieManager, { type Cookie, type Cookies } from '@preeternal/react-native-cookie-manager';
import { registerForPushNotifications, unregisterPushNotifications, getDeepLinkUrl } from './notifications';
import NotificationSettings from './NotificationSettings';

SplashScreen.preventAutoHideAsync();

// Show notifications as banners even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const WEBSITE_URL = 'https://www.buysidebro.com';
const WEBSITE_ORIGIN = 'buysidebro.com';
const STORE_COOKIES_KEY = 'session_cookies';
const STORE_BIOMETRIC_KEY = 'biometric_enabled';

// Restore cookies from SecureStore into the native cookie jar
async function restoreCookies(cookiesJson: string): Promise<boolean> {
  try {
    const cookies: Cookies = JSON.parse(cookiesJson);
    await CookieManager.clearAll(true);

    for (const cookie of Object.values(cookies)) {
      await CookieManager.set(WEBSITE_URL, {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || '.buysidebro.com',
        path: cookie.path || '/',
        secure: cookie.secure ?? true,
        httpOnly: cookie.httpOnly ?? false,
        ...(cookie.expires ? { expires: cookie.expires } : {}),
      }, true);
    }

    if (Platform.OS === 'android') {
      await CookieManager.flush();
    }
    return true;
  } catch {
    return false;
  }
}

// Check if cookies contain a session (look for common session cookie patterns)
function hasSessionCookie(cookies: Cookies): boolean {
  return Object.keys(cookies).some(
    (name) =>
      name.includes('session') ||
      name.includes('sid') ||
      name.includes('connect') ||
      name.includes('auth') ||
      name.includes('token'),
  );
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const notificationRegistered = useRef(false);

  // Biometric initialization — runs once on mount before WebView renders
  useEffect(() => {
    (async () => {
      try {
        const storedCookies = await SecureStore.getItemAsync(STORE_COOKIES_KEY);
        const biometricEnabled = await SecureStore.getItemAsync(STORE_BIOMETRIC_KEY);

        // No stored session — fresh user, show WebView for normal login
        if (!storedCookies || biometricEnabled !== 'true') {
          setShowWebView(true);
          return;
        }

        // Check biometric hardware
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
          setShowWebView(true);
          return;
        }

        // Prompt Face ID / biometric
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Log in to Buy Side Bro',
          cancelLabel: 'Use Password',
          disableDeviceFallback: false,
          fallbackLabel: 'Use Passcode',
        });

        if (result.success) {
          await restoreCookies(storedCookies);
        }
        // If biometric fails/cancelled, WebView loads without cookies (manual login)
      } catch (e) {
        console.warn('Biometric init error:', e);
      } finally {
        setShowWebView(true);
      }
    })();
  }, []);

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => handler.remove();
  }, [canGoBack]);

  // Register for push notifications once the user is logged in
  useEffect(() => {
    if (!isLoggedIn || notificationRegistered.current) return;
    notificationRegistered.current = true;
    registerForPushNotifications();
  }, [isLoggedIn]);

  // Handle notification taps — deep-link into WebView
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const url = getDeepLinkUrl(data);
      if (url && webViewRef.current) {
        const escaped = url.replace(/'/g, "\\'");
        webViewRef.current.injectJavaScript(`window.location.href='${escaped}'; true;`);
      }
    });
    return () => subscription.remove();
  }, []);

  // Save session cookies to SecureStore if user is logged in
  const saveCookiesIfLoggedIn = useCallback(async () => {
    try {
      const cookies = await CookieManager.get(WEBSITE_URL, true);

      if (hasSessionCookie(cookies)) {
        setIsLoggedIn(true);
        const json = JSON.stringify(cookies);
        // SecureStore has a ~2KB limit on some iOS versions
        if (json.length < 2000) {
          await SecureStore.setItemAsync(STORE_COOKIES_KEY, json);
          await SecureStore.setItemAsync(STORE_BIOMETRIC_KEY, 'true');
        }
      } else {
        setIsLoggedIn(false);
        // No session cookie — user may have logged out, clear stored session
        const previouslyStored = await SecureStore.getItemAsync(STORE_COOKIES_KEY);
        if (previouslyStored) {
          await SecureStore.deleteItemAsync(STORE_COOKIES_KEY);
          await SecureStore.deleteItemAsync(STORE_BIOMETRIC_KEY);
        }
      }
    } catch (e) {
      console.warn('Cookie save error:', e);
    }
  }, []);

  const onNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);

    // Detect logout by URL pattern
    const url = navState.url.toLowerCase();
    if (url.includes('/logout') || url.includes('/signout') || url.includes('/logged-out')) {
      SecureStore.deleteItemAsync(STORE_COOKIES_KEY);
      SecureStore.deleteItemAsync(STORE_BIOMETRIC_KEY);
      unregisterPushNotifications();
      notificationRegistered.current = false;
      setIsLoggedIn(false);
    }
  }, []);

  // Intercept external links — open in system browser
  const onShouldStartLoadWithRequest = useCallback((request: { url: string }) => {
    const { url } = request;

    if (url.includes(WEBSITE_ORIGIN)) {
      return true;
    }

    if (url.startsWith('about:') || url.startsWith('data:')) {
      return true;
    }

    Linking.openURL(url);
    return false;
  }, []);

  const onLoadStart = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
  }, []);

  const onLoadEnd = useCallback(async () => {
    setIsLoading(false);
    if (!hasLoaded) {
      setHasLoaded(true);
      SplashScreen.hideAsync();
    }

    // Capture session cookies after each page load
    await saveCookiesIfLoggedIn();
  }, [hasLoaded, saveCookiesIfLoggedIn]);

  const onError = useCallback((event: WebViewErrorEvent) => {
    setIsLoading(false);
    setLoadError(event.nativeEvent.description || 'Failed to load page');
    if (!hasLoaded) {
      SplashScreen.hideAsync();
    }
  }, [hasLoaded]);

  const onHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    const { statusCode } = event.nativeEvent;
    if (statusCode >= 500) {
      setLoadError(`Server error (${statusCode}). Please try again later.`);
    }
  }, []);

  const retry = useCallback(() => {
    setLoadError(null);
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
      if (state.isConnected) {
        webViewRef.current?.reload();
      }
    });
  }, []);

  // Pull-to-refresh via injected JavaScript (avoids ScrollView/WebView conflict)
  const injectedScript = `
    (function() {
      if (window.__pullToRefreshInitialized) return;
      window.__pullToRefreshInitialized = true;

      let startY = 0;
      let pulling = false;

      document.addEventListener('touchstart', function(e) {
        if (window.scrollY === 0) {
          startY = e.touches[0].pageY;
          pulling = true;
        }
      }, { passive: true });

      document.addEventListener('touchmove', function(e) {
        if (!pulling) return;
        const diff = e.touches[0].pageY - startY;
        if (diff > 120 && window.scrollY === 0) {
          pulling = false;
          window.ReactNativeWebView.postMessage('__PULL_TO_REFRESH__');
        }
      }, { passive: true });

      document.addEventListener('touchend', function() {
        pulling = false;
      }, { passive: true });
    })();
    true;
  `;

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    if (event.nativeEvent.data === '__PULL_TO_REFRESH__') {
      webViewRef.current?.reload();
    }
  }, []);

  // No connection screen
  if (isConnected === false) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.offlineContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <Text style={styles.offlineEmoji}>📡</Text>
          <Text style={styles.offlineTitle}>No Connection</Text>
          <Text style={styles.offlineMessage}>
            Please check your internet connection and try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // WebView error screen
  if (loadError) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.offlineContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <Text style={styles.offlineEmoji}>⚠️</Text>
          <Text style={styles.offlineTitle}>Something Went Wrong</Text>
          <Text style={styles.offlineMessage}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <SafeAreaView style={styles.container} edges={['top']}>
          {showWebView && (
            <WebView
              ref={webViewRef}
              source={{ uri: WEBSITE_URL }}
              style={styles.webview}
              onNavigationStateChange={onNavigationStateChange}
              onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
              onLoadStart={onLoadStart}
              onLoadEnd={onLoadEnd}
              onError={onError}
              onHttpError={onHttpError}
              onMessage={onMessage}
              injectedJavaScript={injectedScript}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              domStorageEnabled={true}
              javaScriptEnabled={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              allowsBackForwardNavigationGestures={true}
              pullToRefreshEnabled={Platform.OS === 'android'}
            />
          )}
        </SafeAreaView>
        {isLoggedIn && !isLoading && (
          <Pressable
            style={styles.settingsButton}
            onPress={() => setShowSettings(true)}
            hitSlop={8}
          >
            <Text style={styles.settingsIcon}>&#x2699;</Text>
          </Pressable>
        )}
        {(isLoading || !showWebView) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        )}
        <NotificationSettings
          visible={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  offlineEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  offlineTitle: {
    color: '#F97316',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  offlineMessage: {
    color: '#999999',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#F97316',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  retryText: {
    color: '#F97316',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  settingsIcon: {
    color: '#F97316',
    fontSize: 22,
  },
});
