import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
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
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    webViewRef.current?.reload();
  }, []);

  const onLoadEnd = useCallback(() => {
    setRefreshing(false);
    if (!hasLoaded) {
      setHasLoaded(true);
      SplashScreen.hideAsync();
    }
  }, [hasLoaded]);

  const retry = useCallback(() => {
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
      if (state.isConnected) {
        webViewRef.current?.reload();
      }
    });
  }, []);

  // No connection screen
  if (isConnected === false) {
    return (
      <View style={styles.offlineContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Text style={styles.offlineEmoji}>📡</Text>
        <Text style={styles.offlineTitle}>No Connection</Text>
        <Text style={styles.offlineMessage}>
          Please check your internet connection and try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={retry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
            colors={['#F97316']}
          />
        }
      >
        <WebView
          ref={webViewRef}
          source={{ uri: WEBSITE_URL }}
          style={styles.webview}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onLoadEnd={onLoadEnd}
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
          // Start with a black background while loading
          startInLoadingState={false}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
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
