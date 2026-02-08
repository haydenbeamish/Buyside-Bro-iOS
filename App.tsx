import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
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

SplashScreen.preventAutoHideAsync();

const WEBSITE_URL = 'https://www.buysidebro.com';
const WEBSITE_ORIGIN = 'buysidebro.com';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const onNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  }, []);

  // Intercept external links — open in system browser
  const onShouldStartLoadWithRequest = useCallback((request: { url: string }) => {
    const { url } = request;

    // Allow navigations within the main website
    if (url.includes(WEBSITE_ORIGIN)) {
      return true;
    }

    // Allow about:blank and data URIs
    if (url.startsWith('about:') || url.startsWith('data:')) {
      return true;
    }

    // Open external URLs in system browser (Stripe, OAuth, etc.)
    Linking.openURL(url);
    return false;
  }, []);

  const onLoadStart = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
  }, []);

  const onLoadEnd = useCallback(() => {
    setIsLoading(false);
    if (!hasLoaded) {
      setHasLoaded(true);
      SplashScreen.hideAsync();
    }
  }, [hasLoaded]);

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
  const pullToRefreshScript = `
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
            injectedJavaScript={pullToRefreshScript}
            // Allow cookies and session storage for auth
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            domStorageEnabled={true}
            javaScriptEnabled={true}
            // Allow media playback
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            // Allow back/forward swipe gestures on iOS
            allowsBackForwardNavigationGestures={true}
            // Pull-to-refresh on Android (native support)
            pullToRefreshEnabled={Platform.OS === 'android'}
          />
        </SafeAreaView>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        )}
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
});
