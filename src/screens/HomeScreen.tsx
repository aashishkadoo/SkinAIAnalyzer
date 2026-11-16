
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';

import { supabase } from '../lib/supabase';
import { useSession } from '../hooks/useSession';
import { useProfile } from '../hooks/useProfile';
import { theme } from '../constants/theme';

import {
  getAllScans,
  type SavedSkinScan,
  type SkinAnalysisResult,
} from '../services/skinAnalysisStorage';

// ======================================================
// TYPES
// ======================================================

type HomeRoute = 'Camera' | 'Shop' | 'Settings';

interface HomeScreenProps {
  navigation?: {
    navigate: (route: HomeRoute) => void;
  };
}

type IconName =
  | 'scan'
  | 'sparkles'
  | 'bag'
  | 'chevron'
  | 'edit'
  | 'shield'
  | 'clock';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

type SkinMetric = {
  label: string;
  value: number;
  unit: string;
  color?: string;
};

type ScanRecord = {
  id: string;
  created_at: string;
  status: string;
  analysis: SkinAnalysisResult | null;
  photoUri: string;
};

type MetricInput = {
  name?: string;
  label?: string;
  key?: string;
  score?: number | string;
  value?: number | string;
  unit?: string;
  color?: string;
};

// ======================================================
// HELPERS
// ======================================================

const COMPLETED_STATUSES = new Set(['completed', 'done']);

function isCompleted(status?: string | null) {
  return COMPLETED_STATUSES.has(status?.toLowerCase() ?? '');
}

function formatScanDate(date?: string | null) {
  if (!date) return 'No analysis yet';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return 'Date unavailable';
  }

  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getMetricLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Converts the metrics saved by CameraScreen into dashboard metrics.
 *
 * Supported:
 * [
 *   { name: 'Hydration', score: 78 },
 *   { name: 'Texture', score: 65 }
 * ]
 *
 * Also supports object-based metrics from older saved records.
 */
function parseMetrics(source: unknown): SkinMetric[] {
  if (!source) return [];

  const entries: Array<[string, unknown]> = [];

  if (Array.isArray(source)) {
    source.forEach((item, index) => {
      if (!isObject(item)) return;

      const key =
        (typeof item.name === 'string' && item.name) ||
        (typeof item.label === 'string' && item.label) ||
        (typeof item.key === 'string' && item.key) ||
        `Metric ${index + 1}`;

      entries.push([key, item]);
    });
  } else if (isObject(source)) {
    if (Array.isArray(source.metrics)) {
      return parseMetrics(source.metrics);
    }

    entries.push(...Object.entries(source));
  }

  const result = new Map<string, SkinMetric>();

  entries.forEach(([key, raw]) => {
    const item = isObject(raw) ? raw : null;

    const value = toNumber(
      item ? item.score ?? item.value : raw,
    );

    if (value === null || value < 0) return;

    const label =
      (typeof item?.name === 'string' && item.name.trim()) ||
      (typeof item?.label === 'string' && item.label.trim()) ||
      getMetricLabel(key);

    const unit =
      typeof item?.unit === 'string' && item.unit.trim()
        ? item.unit
        : '%';

    const color =
      typeof item?.color === 'string'
        ? item.color
        : undefined;

    result.set(label.toLowerCase(), {
      label,
      value: Math.round(value * 10) / 10,
      unit,
      color,
    });
  });

  return Array.from(result.values()).slice(0, 6);
}

function getScanStatus(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'done':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'processing':
      return 'Processing';
    case 'syncing':
      return 'Syncing';
    default:
      return 'Pending';
  }
}

function toScanRecord(scan: SavedSkinScan): ScanRecord {
  return {
    id: scan.id,
    created_at: scan.createdAt,
    status: scan.status,
    analysis: scan.analysis,
    photoUri: scan.photoUri,
  };
}

// ======================================================
// ICONS
// ======================================================

function Icon({
  name,
  size = 20,
  color = theme.colors.primary,
}: IconProps) {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  switch (name) {
    case 'scan':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            {...common}
            d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"
          />
          <Circle {...common} cx="12" cy="12" r="3.2" />
        </Svg>
      );

    case 'sparkles':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            {...common}
            d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"
          />
          <Path
            {...common}
            d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"
          />
        </Svg>
      );

    case 'bag':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...common} d="M5 8h14l1 13H4L5 8Z" />
          <Path {...common} d="M9 9V6a3 3 0 0 1 6 0v3" />
        </Svg>
      );

    case 'chevron':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...common} d="m9 6 6 6-6 6" />
        </Svg>
      );

    case 'edit':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            {...common}
            d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"
          />
        </Svg>
      );

    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            {...common}
            d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z"
          />
          <Path {...common} d="m9 12 2 2 4-4" />
        </Svg>
      );

    case 'clock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...common} cx="12" cy="12" r="9" />
          <Path {...common} d="M12 7v5l3 2" />
        </Svg>
      );

    default:
      return null;
  }
}

// ======================================================
// REUSABLE COMPONENTS
// ======================================================

function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          hitSlop={8}
          onPress={onAction}
          style={styles.textAction}
        >
          <Text style={styles.textActionLabel}>{action}</Text>
          <Icon name="chevron" size={15} />
        </Pressable>
      ) : null}
    </View>
  );
}

function FeatureCard({
  icon,
  eyebrow,
  title,
  description,
  onPress,
}: {
  icon: IconName;
  eyebrow: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: 'rgba(232,74,138,0.08)' }}
      style={({ pressed }) => [
        styles.featureCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.featureIcon}>
        <Icon name={icon} size={21} />
      </View>

      <View style={styles.featureCopy}>
        <Text style={styles.featureEyebrow}>{eyebrow}</Text>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>
          {description}
        </Text>
      </View>

      <View style={styles.featureArrow}>
        <Icon name="chevron" size={17} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

function DashboardStat({
  label,
  value,
  subtitle,
  icon,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  icon: string;
}) {
  return (
    <View style={styles.dashboardStat}>
      <View style={styles.dashboardStatTop}>
        <View style={styles.dashboardStatIcon}>
          <Text style={styles.dashboardStatIconText}>{icon}</Text>
        </View>
      </View>

      <Text style={styles.dashboardStatValue}>{value}</Text>
      <Text style={styles.dashboardStatLabel}>{label}</Text>
      <Text style={styles.dashboardStatSubtitle}>{subtitle}</Text>
    </View>
  );
}

function MetricCard({ metric }: { metric: SkinMetric }) {
  const normalized = Math.max(0, Math.min(100, metric.value));

  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <Text style={styles.metricName} numberOfLines={1}>
          {metric.label}
        </Text>
        <View
          style={[
            styles.metricDot,
            metric.color ? { backgroundColor: metric.color } : null,
          ]}
        />
      </View>

      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{metric.value}</Text>
        <Text style={styles.metricUnit}>{metric.unit}</Text>
      </View>

      <View style={styles.metricTrack}>
        <View
          style={[
            styles.metricProgress,
            {
              width: `${normalized}%`,
              ...(metric.color ? { backgroundColor: metric.color } : {}),
            },
          ]}
        />
      </View>

      <Text style={styles.metricCaption}>Saved analysis result</Text>
    </View>
  );
}

function ScanActivityItem({ scan }: { scan: ScanRecord }) {
  const status = scan.status.toLowerCase();

  const statusColor = isCompleted(status)
    ? '#45A77A'
    : status === 'failed'
      ? '#D76B7C'
      : '#D69B50';

  return (
    <View style={styles.activityItem}>
      <View style={styles.activityIcon}>
        <Icon name="scan" size={18} />
      </View>

      <View style={styles.activityCopy}>
        <Text style={styles.activityTitle}>Skin analysis</Text>
        <Text style={styles.activityDate}>
          {formatScanDate(scan.created_at)}
        </Text>
      </View>

      <View
        style={[
          styles.activityStatus,
          { backgroundColor: `${statusColor}18` },
        ]}
      >
        <View
          style={[
            styles.activityStatusDot,
            { backgroundColor: statusColor },
          ]}
        />

        <Text
          style={[
            styles.activityStatusText,
            { color: statusColor },
          ]}
        >
          {getScanStatus(scan.status)}
        </Text>
      </View>
    </View>
  );
}

// ======================================================
// HOME SCREEN
// ======================================================

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useSession();
  const { profile, loading } = useProfile(user?.id ?? null);

  const goTo = useCallback(
    (route: HomeRoute) => navigation?.navigate(route),
    [navigation],
  );

  const skinType = profile?.skin_type?.trim() ?? '';
  const concerns: string[] = [];

  const profileComplete = Boolean(
    profile?.display_name?.trim() && skinType,
  );

  // ----------------------------------------------------
  // STATE
  // ----------------------------------------------------

  const aura = useRef(new Animated.Value(0.42)).current;

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // ----------------------------------------------------
  // ANIMATION
  // ----------------------------------------------------

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(aura, {
          toValue: 0.82,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(aura, {
          toValue: 0.42,
          duration: 2400,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [aura]);

  // ----------------------------------------------------
  // LOAD DASHBOARD
  //
  // Scans and metrics come from local SQLite.
  // This means the dashboard works even when:
  // - The device is offline.
  // - A scan has not synced to Supabase.
  // - The user has just completed a local scan.
  //
  // Supabase is used only for the profile avatar.
  // ----------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadDashboard = async () => {
        setDashboardLoading(true);
        setDashboardError(null);

        try {
          if (!user?.id) {
            setAvatarUrl(null);
            setScans([]);
            return;
          }

          // Load the local scan history first.
          // The dashboard does not wait for cloud sync.
          const localScans = await getAllScans();

          if (!active) return;

          setScans(localScans.map(toScanRecord));

          // Avatar is optional. A failure here should not
          // prevent locally saved scans from being displayed.
          const { data: profileData, error: avatarError } =
            await supabase
              .from('profiles')
              .select('avatar_url')
              .eq('id', user.id)
              .maybeSingle();

          if (avatarError) {
            console.warn('Unable to load profile avatar:', avatarError.message);
          }

          if (active) {
            setAvatarUrl(profileData?.avatar_url ?? null);
          }
        } catch (error) {
          console.error('Home dashboard loading error:', error);

          if (active) {
            setDashboardError(
              error instanceof Error
                ? error.message
                : 'Unable to load your saved skin scans.',
            );
          }
        } finally {
          if (active) {
            setDashboardLoading(false);
          }
        }
      };

      loadDashboard();

      return () => {
        active = false;
      };
    }, [user?.id]),
  );

  // ----------------------------------------------------
  // USER DISPLAY
  // ----------------------------------------------------

  const metadataName = [
    user?.user_metadata?.display_name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
  ].find(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  );

  const rawDisplayName =
    profile?.display_name?.trim() ||
    metadataName?.trim() ||
    user?.email?.split('@')[0]?.trim() ||
    '';

  const displayName = rawDisplayName
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const firstName = displayName
    ? displayName.split(' ')[0]
    : 'there';

  const initials = useMemo(
    () =>
      displayName
        ? displayName
            .split(/\s+/)
            .filter(Boolean)
            .map(part => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
        : 'U',
    [displayName],
  );

  // ----------------------------------------------------
  // DERIVED SCAN DATA
  // ----------------------------------------------------

  const completedScans = useMemo(
    () => scans.filter(scan => isCompleted(scan.status)),
    [scans],
  );

  const completedScansCount = completedScans.length;

  const latestScan = scans[0] ?? null;

  // Use the newest completed scan that actually has saved
  // analysis data. This avoids showing empty metrics when
  // a newer pending scan exists.
  const latestAnalysisScan = useMemo(
    () =>
      completedScans.find(
        scan => scan.analysis !== null,
      ) ?? null,
    [completedScans],
  );

  const latestAnalysis = latestAnalysisScan?.analysis ?? null;

  const metrics = useMemo(
    () => parseMetrics(latestAnalysis?.metrics),
    [latestAnalysis],
  );

  const overallScore = latestAnalysis?.overallScore;

  const overallScoreText =
    typeof overallScore === 'number' &&
    Number.isFinite(overallScore)
      ? `${Math.round(Math.max(0, Math.min(100, overallScore)))}%`
      : '--';

  // ----------------------------------------------------
  // LOADING
  // ----------------------------------------------------

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingOrb}>
          <Icon name="sparkles" size={27} />
        </View>

        <Text style={styles.loadingTitle}>
          Preparing your skin studio
        </Text>

        <Text style={styles.loadingSubtitle}>
          Loading your profile…
        </Text>
      </View>
    );
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile settings"
              onPress={() => goTo('Settings')}
              style={styles.avatar}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}

              <View style={styles.avatarStatus} />
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.greeting}>
                YOUR PERSONAL SKIN STUDIO
              </Text>

              <Text style={styles.name} numberOfLines={1}>
                Hello, {firstName}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => goTo('Settings')}
            style={({ pressed }) => [
              styles.headerAction,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="edit" size={17} />
          </Pressable>
        </View>

        {/* HERO */}

        <View style={styles.heroWrap}>
          <Animated.View
            style={[styles.heroAura, { opacity: aura }]}
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => goTo('Camera')}
            android_ripple={{ color: 'rgba(255,255,255,0.14)' }}
            style={({ pressed }) => [
              styles.hero,
              pressed && styles.heroPressed,
            ]}
          >
            <View style={styles.heroTopline}>
              <View style={styles.aiBadge}>
                <Icon name="sparkles" size={13} color="#FFFFFF" />
                <Text style={styles.aiBadgeText}>
                  AI SKIN ANALYSIS
                </Text>
              </View>

              <View style={styles.heroStatusDot} />
            </View>

            <Text style={styles.heroTitle}>
              Your skin,{"\n"}understood.
            </Text>

            <Text style={styles.heroDescription}>
              Get a clearer picture of your skin and discover care
              that fits your needs.
            </Text>

            <View style={styles.heroBottom}>
              <View style={styles.heroButton}>
                <Text style={styles.heroButtonText}>
                  Start skin analysis
                </Text>

                <Icon
                  name="chevron"
                  size={17}
                  color={theme.colors.primaryDeep}
                />
              </View>

              <View style={styles.heroGraphic}>
                <View style={styles.heroGraphicRing}>
                  <View style={styles.heroGraphicInner}>
                    <Icon name="scan" size={31} color="#FFFFFF" />
                  </View>
                </View>

                <View style={styles.heroGraphicSparkle}>
                  <Icon name="sparkles" size={15} color="#FFFFFF" />
                </View>
              </View>
            </View>

            <Text style={styles.heroFootnote}>
              Photo-based insights • Personalised recommendations
            </Text>
          </Pressable>
        </View>

        {/* DASHBOARD */}

        <View style={styles.dashboardHeading}>
          <View>
            <Text style={styles.dashboardEyebrow}>
              YOUR PERSONAL OVERVIEW
            </Text>

            <Text style={styles.dashboardTitle}>
              Skin dashboard
            </Text>
          </View>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.dashboardGrid}>
          <DashboardStat
            icon="◉"
            label="Total scans"
            value={scans.length}
            subtitle="Saved on this device"
          />

          <DashboardStat
            icon="✓"
            label="Completed"
            value={completedScansCount}
            subtitle="Saved analyses"
          />
        </View>

        <View style={styles.lastAnalysisCard}>
          <View style={styles.lastAnalysisIcon}>
            <Icon name="clock" size={20} />
          </View>

          <View style={styles.lastAnalysisCopy}>
            <Text style={styles.lastAnalysisLabel}>
              LAST SAVED ANALYSIS
            </Text>

            <Text style={styles.lastAnalysisDate}>
              {latestAnalysisScan
                ? formatScanDate(latestAnalysisScan.created_at)
                : latestScan
                  ? formatScanDate(latestScan.created_at)
                  : 'No analysis yet'}
            </Text>
          </View>

          <View style={styles.lastAnalysisArrow}>
            <Icon name="chevron" size={17} />
          </View>
        </View>

        {/* LATEST SKIN INSIGHTS */}

        <SectionHeading title="Latest skin insights" />

        {dashboardLoading ? (
          <View style={styles.dashboardLoading}>
            <ActivityIndicator color={theme.colors.primary} />

            <Text style={styles.dashboardLoadingText}>
              Loading your saved skin insights...
            </Text>
          </View>
        ) : dashboardError ? (
          <View style={styles.noMetricsCard}>
            <View style={styles.noMetricsIcon}>
              <Icon name="shield" size={23} />
            </View>

            <Text style={styles.noMetricsTitle}>
              Unable to load saved results
            </Text>

            <Text style={styles.noMetricsDescription}>
              {dashboardError}
            </Text>
          </View>
        ) : metrics.length > 0 ? (
          <>
            <View style={styles.insightsIntro}>
              <View style={styles.insightsIntroIcon}>
                <Icon name="sparkles" size={18} />
              </View>

              <View style={styles.insightsIntroCopy}>
                <Text style={styles.insightsIntroTitle}>
                  Your latest saved results
                </Text>

                <Text style={styles.insightsIntroSubtitle}>
                  Retrieved from your locally saved scan
                </Text>
              </View>

              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceValue}>
                  {overallScoreText}
                </Text>

                <Text style={styles.confidenceLabel}>
                  OVERALL SCORE
                </Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              {metrics.map(metric => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </View>

            {latestAnalysis?.skinType ? (
              <View style={styles.conditionCard}>
                <Text style={styles.conditionLabel}>
                  SKIN TYPE
                </Text>

                <Text style={styles.conditionValue}>
                  {latestAnalysis.skinType}
                </Text>
              </View>
            ) : null}

            {latestAnalysis?.summary ? (
              <View style={styles.conditionCard}>
                <Text style={styles.conditionLabel}>
                  ANALYSIS SUMMARY
                </Text>

                <Text style={styles.conditionValue}>
                  {latestAnalysis.summary}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.noMetricsCard}>
            <View style={styles.noMetricsIcon}>
              <Icon name="sparkles" size={23} />
            </View>

            <Text style={styles.noMetricsTitle}>
              Your insights are waiting
            </Text>

            <Text style={styles.noMetricsDescription}>
              {completedScansCount > 0
                ? 'Your saved scan does not contain readable metrics yet.'
                : 'Complete a skin analysis to populate your dashboard with saved results and skin metrics.'}
            </Text>

            <Pressable
              onPress={() => goTo('Camera')}
              style={styles.noMetricsButton}
            >
              <Text style={styles.noMetricsButtonText}>
                Analyse my skin
              </Text>

              <Icon
                name="chevron"
                size={16}
                color={theme.colors.primaryDeep}
              />
            </Pressable>
          </View>
        )}

        {/* AI TOOLS */}

        <SectionHeading title="Your AI skin tools" />

        <View style={styles.featureStack}>
          <FeatureCard
            icon="scan"
            eyebrow="PERSONALISED ANALYSIS"
            title="Understand your skin"
            description="Check visible skin concerns with a guided photo scan."
            onPress={() => goTo('Camera')}
          />

          <FeatureCard
            icon="bag"
            eyebrow="SMART PRODUCT DISCOVERY"
            title="Find your product matches"
            description="Explore skincare recommendations for your profile."
            onPress={() => goTo('Shop')}
          />
        </View>

        {/* SKIN PROFILE */}

        <SectionHeading
          title="Your skin profile"
          action="Edit profile"
          onAction={() => goTo('Settings')}
        />

        <View style={styles.profileCard}>
          <View style={styles.profileCardTop}>
            <View style={styles.profileIcon}>
              <Icon name="sparkles" size={19} />
            </View>

            <View style={styles.profileIntro}>
              <Text style={styles.profileCardTitle}>
                {profileComplete
                  ? 'Your profile is taking shape'
                  : 'Let’s personalise your care'}
              </Text>

              <Text style={styles.profileCardSubtitle}>
                {profileComplete
                  ? 'Your preferences help guide product discovery.'
                  : 'Add a few details to make recommendations more relevant.'}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit skin profile"
              hitSlop={10}
              onPress={() => goTo('Settings')}
              style={styles.editIconButton}
            >
              <Icon name="edit" size={17} />
            </Pressable>
          </View>

          <View style={styles.profileDivider} />

          <View style={styles.profileDetails}>
            <View style={styles.profileDetail}>
              <Text style={styles.detailLabel}>SKIN TYPE</Text>

              <Text style={styles.detailValue}>
                {skinType || 'Not set'}
              </Text>
            </View>

            <View style={styles.detailVerticalDivider} />

            <View style={[styles.profileDetail, styles.concernsDetail]}>
              <Text style={styles.detailLabel}>SKIN CONCERNS</Text>

              {concerns.length > 0 ? (
                <View style={styles.concernChips}>
                  {concerns.slice(0, 3).map(concern => (
                    <View key={concern} style={styles.concernChip}>
                      <Text style={styles.concernChipText}>
                        {concern}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.detailValue}>Not set</Text>
              )}
            </View>
          </View>

          {!profileComplete ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => goTo('Settings')}
              style={styles.completeProfileButton}
            >
              <Text style={styles.completeProfileText}>
                Complete your skin profile
              </Text>

              <Icon name="chevron" size={16} />
            </Pressable>
          ) : null}
        </View>

        {/* SKIN JOURNEY */}

        <SectionHeading
          title="Your skin journey"
          action="New scan"
          onAction={() => goTo('Camera')}
        />

        <View style={styles.activityCard}>
          {scans.length > 0 ? (
            scans.slice(0, 4).map((scan, index) => (
              <View key={scan.id}>
                <ScanActivityItem scan={scan} />

                {index < Math.min(scans.length, 4) - 1 ? (
                  <View style={styles.activityDivider} />
                ) : null}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIllustration}>
                <View style={styles.emptyIllustrationHalo} />

                <View style={styles.emptyIllustrationIcon}>
                  <Icon name="clock" size={27} />
                </View>

                <View style={styles.emptySparkleOne}>
                  <Icon name="sparkles" size={13} />
                </View>
              </View>

              <Text style={styles.emptyTitle}>
                Your first scan starts here
              </Text>

              <Text style={styles.emptyDescription}>
                Your completed analyses will appear here, making
                it easier to follow changes in your skin over time.
              </Text>

              <Pressable
                accessibilityRole="button"
                onPress={() => goTo('Camera')}
                style={({ pressed }) => [
                  styles.outlineButton,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="scan" size={17} />

                <Text style={styles.outlineButtonText}>
                  Create your first scan
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* PRIVACY */}

        <View style={styles.privacyNote}>
          <View style={styles.privacyIcon}>
            <Icon
              name="shield"
              size={17}
              color={theme.colors.success}
            />
          </View>

          <View style={styles.privacyCopy}>
            <Text style={styles.privacyTitle}>
              Your skin data matters
            </Text>

            <Text style={styles.privacyDescription}>
              Skin photos and analysis data should be handled
              securely. AI insights are informational and are
              not a medical diagnosis.
            </Text>
          </View>
        </View>

        {/* ACCOUNT */}

        <View style={styles.accountFooter}>
          <Text style={styles.accountLabel}>SIGNED IN AS</Text>

          <Text style={styles.accountEmail} numberOfLines={1}>
            {user?.email ?? 'Account'}
          </Text>
        </View>

        {/* WATERMARK */}

        <View style={styles.watermark}>
          <View style={styles.watermarkLine} />

          <Text style={styles.watermarkText}>
            Developed &amp; Engineered by Vaishnavi Hurnaum
          </Text>

          <Text style={styles.watermarkSubtext}>
            SKIN AI ANALYZER • PERSONAL SKIN STUDIO
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 170,
  },

  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },

  loadingOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    marginBottom: 16,
  },

  loadingTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },

  loadingSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },

  // HEADER

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  headerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginRight: 12,
    elevation: 4,
    shadowColor: '#D68BAF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarText: {
    color: theme.colors.primaryDeep,
    fontSize: 16,
    fontWeight: '800',
  },

  avatarStatus: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    right: 1,
    bottom: 1,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  headerText: {
    flex: 1,
    minWidth: 0,
  },

  greeting: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.15,
    marginBottom: 4,
  },

  name: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  headerAction: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // HERO

  heroWrap: {
    position: 'relative',
    marginBottom: 29,
  },

  heroAura: {
    position: 'absolute',
    top: 12,
    left: 18,
    right: 18,
    bottom: -7,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    transform: [{ scale: 1.015 }],
  },

  hero: {
    overflow: 'hidden',
    minHeight: 258,
    padding: 20,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryDeep,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 7,
  },

  heroPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },

  heroTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  aiBadge: {
    minHeight: 27,
    borderRadius: 20,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  heroStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FBD5E4',
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '800',
    letterSpacing: -0.9,
    marginTop: 18,
  },

  heroDescription: {
    maxWidth: 245,
    color: 'rgba(255,255,255,0.83)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  heroBottom: {
    minHeight: 75,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  heroButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },

  heroButtonText: {
    color: theme.colors.primaryDeep,
    fontSize: 12,
    fontWeight: '800',
  },

  heroGraphic: {
    width: 84,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroGraphicRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  heroGraphicInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  heroGraphicSparkle: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  heroFootnote: {
    color: 'rgba(255,255,255,0.67)',
    fontSize: 9,
    letterSpacing: 0.1,
    marginTop: 2,
  },

  // DASHBOARD

  dashboardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },

  dashboardEyebrow: {
    color: theme.colors.primary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },

  dashboardTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#EAF7F0',
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#45A77A',
  },

  liveText: {
    color: '#45A77A',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  dashboardGrid: {
    flexDirection: 'row',
    gap: 11,
    marginBottom: 11,
  },

  dashboardStat: {
    flex: 1,
    minHeight: 125,
    padding: 15,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#D68BAF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 9,
    elevation: 2,
  },

  dashboardStatTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  dashboardStatIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  dashboardStatIconText: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: '800',
  },

  dashboardStatValue: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.text,
  },

  dashboardStatLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 2,
  },

  dashboardStatSubtitle: {
    fontSize: 9,
    color: theme.colors.textMuted,
    marginTop: 4,
  },

  lastAnalysisCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 27,
  },

  lastAnalysisIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  lastAnalysisCopy: {
    flex: 1,
    marginLeft: 11,
  },

  lastAnalysisLabel: {
    color: theme.colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },

  lastAnalysisDate: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },

  lastAnalysisArrow: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // SECTION HEADINGS

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 1,
  },

  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.35,
  },

  textAction: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingLeft: 8,
  },

  textActionLabel: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },

  // METRICS

  dashboardLoading: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    marginBottom: 27,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  dashboardLoadingText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 10,
  },

  insightsIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 11,
  },

  insightsIntroIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  insightsIntroCopy: {
    flex: 1,
    marginLeft: 10,
  },

  insightsIntroTitle: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },

  insightsIntroSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 3,
  },

  confidenceBadge: {
    alignItems: 'center',
    backgroundColor: '#F8E8F0',
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  confidenceValue: {
    color: theme.colors.primaryDeep,
    fontSize: 15,
    fontWeight: '900',
  },

  confidenceLabel: {
    color: theme.colors.primary,
    fontSize: 6,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginTop: 2,
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },

  metricCard: {
    width: '48%',
    flexGrow: 1,
    minHeight: 119,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 17,
    padding: 13,
    elevation: 2,
    shadowColor: '#D68BAF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },

  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  metricName: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    marginRight: 5,
  },

  metricDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },

  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 9,
  },

  metricValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },

  metricUnit: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginLeft: 3,
    fontWeight: '700',
  },

  metricTrack: {
    height: 6,
    borderRadius: 5,
    backgroundColor: '#F3E6ED',
    overflow: 'hidden',
    marginTop: 9,
  },

  metricProgress: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },

  metricCaption: {
    color: theme.colors.textMuted,
    fontSize: 8,
    marginTop: 7,
  },

  conditionCard: {
    padding: 15,
    borderRadius: 16,
    backgroundColor: '#FFF4F8',
    borderWidth: 1,
    borderColor: '#F1D7E4',
    marginBottom: 27,
  },

  conditionLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    color: theme.colors.primary,
  },

  conditionValue: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 6,
  },

  noMetricsCard: {
    alignItems: 'center',
    padding: 21,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 27,
  },

  noMetricsIcon: {
    width: 51,
    height: 51,
    borderRadius: 17,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  noMetricsTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },

  noMetricsDescription: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 15,
  },

  noMetricsButton: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 13,
    backgroundColor: theme.colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  noMetricsButtonText: {
    color: theme.colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
  },

  // AI TOOLS

  featureStack: {
    gap: 10,
    marginBottom: 27,
  },

  featureCard: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 2,
  },

  featureCardCompact: {
    minHeight: 86,
  },

  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primarySoft,
    marginRight: 12,
  },

  featureCopy: {
    flex: 1,
    minWidth: 0,
  },

  featureEyebrow: {
    color: theme.colors.primary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 4,
  },

  featureTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },

  featureDescription: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },

  featureArrow: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  pressed: {
    opacity: 0.78,
  },

  // PROFILE

  profileCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 27,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 2,
  },

  profileCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  profileIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  profileIntro: {
    flex: 1,
  },

  profileCardTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },

  profileCardSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },

  editIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  profileDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 15,
  },

  profileDetails: {
    flexDirection: 'row',
  },

  profileDetail: {
    flex: 0.8,
    minWidth: 0,
  },

  concernsDetail: {
    flex: 1.2,
    paddingLeft: 14,
  },

  detailVerticalDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 13,
  },

  detailLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 7,
  },

  detailValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },

  concernChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },

  concernChip: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: theme.colors.primarySoft,
  },

  concernChipText: {
    color: theme.colors.primaryDeep,
    fontSize: 9,
    fontWeight: '700',
  },

  moreConcerns: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },

  completeProfileButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    marginTop: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  completeProfileText: {
    color: theme.colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
  },

  // ACTIVITY

  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 19,
  },

  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 69,
  },

  activityIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityCopy: {
    flex: 1,
    marginLeft: 11,
  },

  activityTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
  },

  activityDate: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 4,
  },

  activityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  activityStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  activityStatusText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'capitalize',
  },

  activityDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 50,
  },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 18,
    paddingBottom: 18,
  },

  emptyIllustration: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyIllustrationHalo: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.colors.primarySoft,
  },

  emptyIllustrationIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  emptySparkleOne: {
    position: 'absolute',
    right: 0,
    top: 3,
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  emptyTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  emptyDescription: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 16,
  },

  outlineButton: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EFB5CD',
    backgroundColor: '#FFF9FB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },

  outlineButtonText: {
    color: theme.colors.primaryDeep,
    fontSize: 12,
    fontWeight: '800',
  },

  // PRIVACY

  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 13,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 19,
  },

  privacyIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  privacyCopy: {
    flex: 1,
  },

  privacyTitle: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 3,
  },

  privacyDescription: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
  },

  // ACCOUNT

  accountFooter: {
    paddingTop: 4,
  },

  accountLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },

  accountEmail: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },

  // WATERMARK

  watermark: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 12,
    marginTop: 8,
  },

  watermarkLine: {
    width: 35,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#EABBD0',
    marginBottom: 12,
  },

  watermarkText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.35,
    textAlign: 'center',
  },

  watermarkSubtext: {
    color: theme.colors.primary,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 5,
  },
});