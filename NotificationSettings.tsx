import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from './notifications';

const THRESHOLD_OPTIONS = [3, 5, 7, 10];

const DEFAULT_PREFS: NotificationPreferences = {
  watchlistPriceAlerts: true,
  priceAlertThreshold: 5,
  usaMarketSummary: true,
  asxMarketSummary: true,
  europeMarketSummary: true,
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NotificationSettings({ visible, onClose }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getNotificationPreferences().then((fetched) => {
      if (fetched) setPrefs(fetched);
      setLoading(false);
    });
  }, [visible]);

  const updatePref = useCallback(
    (key: keyof NotificationPreferences, value: boolean | number) => {
      const updated = { ...prefs, [key]: value };
      setPrefs(updated);
      updateNotificationPreferences({ [key]: value });
    },
    [prefs],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Notification Settings</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeButton}>Done</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : (
          <ScrollView style={styles.content}>
            {/* Price Alerts Section */}
            <Text style={styles.sectionHeader}>Price Alerts</Text>
            <View style={styles.row}>
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowLabel}>Watchlist Price Alerts</Text>
                <Text style={styles.rowDescription}>
                  Get notified when stocks in your watchlist move significantly
                </Text>
              </View>
              <Switch
                value={prefs.watchlistPriceAlerts}
                onValueChange={(v) => updatePref('watchlistPriceAlerts', v)}
                trackColor={{ false: '#333333', true: '#F97316' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {prefs.watchlistPriceAlerts && (
              <>
                <Text style={styles.thresholdLabel}>Alert Threshold</Text>
                <View style={styles.thresholdRow}>
                  {THRESHOLD_OPTIONS.map((t) => (
                    <Pressable
                      key={t}
                      style={[
                        styles.thresholdOption,
                        prefs.priceAlertThreshold === t && styles.thresholdOptionActive,
                      ]}
                      onPress={() => updatePref('priceAlertThreshold', t)}
                    >
                      <Text
                        style={[
                          styles.thresholdText,
                          prefs.priceAlertThreshold === t && styles.thresholdTextActive,
                        ]}
                      >
                        {t}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Market Summaries Section */}
            <Text style={styles.sectionHeader}>Daily Market Summaries</Text>
            <View style={styles.row}>
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowLabel}>USA Market Summary</Text>
                <Text style={styles.rowDescription}>
                  Daily overview of US market activity
                </Text>
              </View>
              <Switch
                value={prefs.usaMarketSummary}
                onValueChange={(v) => updatePref('usaMarketSummary', v)}
                trackColor={{ false: '#333333', true: '#F97316' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowLabel}>ASX Market Summary</Text>
                <Text style={styles.rowDescription}>
                  Daily overview of Australian market activity
                </Text>
              </View>
              <Switch
                value={prefs.asxMarketSummary}
                onValueChange={(v) => updatePref('asxMarketSummary', v)}
                trackColor={{ false: '#333333', true: '#F97316' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowLabel}>Europe Market Summary</Text>
                <Text style={styles.rowDescription}>
                  Daily overview of European market activity
                </Text>
              </View>
              <Switch
                value={prefs.europeMarketSummary}
                onValueChange={(v) => updatePref('europeMarketSummary', v)}
                trackColor={{ false: '#333333', true: '#F97316' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333333',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    color: '#F97316',
    fontSize: 17,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    color: '#F97316',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 28,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222222',
  },
  rowTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  rowDescription: {
    color: '#888888',
    fontSize: 13,
    marginTop: 3,
  },
  thresholdLabel: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 10,
  },
  thresholdRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  thresholdOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#333333',
    alignItems: 'center',
  },
  thresholdOptionActive: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  thresholdText: {
    color: '#888888',
    fontSize: 15,
    fontWeight: '600',
  },
  thresholdTextActive: {
    color: '#F97316',
  },
});
