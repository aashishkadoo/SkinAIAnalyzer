
// src/screens/CameraScreen.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Image,
  ActivityIndicator,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import * as Crypto from 'expo-crypto';

import {
  savePhotoPermanently,
  saveScan,
  type SkinAnalysisResult,
} from '../services/skinAnalysisStorage';

import {
  startScanSyncListener,
  syncPendingScans,
} from '../services/scanSyncService';

// ======================================================
// TYPES
// ======================================================

type ScreenMode = 'camera' | 'preview' | 'results';
type AnalysisMode = 'overall' | 'texture';
type TextureArea = 'Cheeks' | 'Forehead' | 'Nose' | 'Chin';

type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

type Metric = {
  name: string;
  score: number;
  description: string;
  color: string;
  detail: string;
};

type Observation = {
  title: string;
  level: string;
  description: string;
  color: string;
};

type Recommendation = {
  step: string;
  title: string;
  description: string;
  category: string;
  time: string;
};

type DemoReport = Omit<
  SkinAnalysisResult,
  'metrics' | 'concerns' | 'recommendations'
> & {
  overallScore: number;
  skinType: string;
  hydration: number;
  skinHealth: string;
  analysisMode: AnalysisMode;
  textureArea: TextureArea;
  reportTitle: string;
  reportSubtitle: string;
  metrics: Metric[];
  concerns: Observation[];
  recommendations: Recommendation[];
};

// ======================================================
// DESIGN TOKENS
// ======================================================

const C = {
  pink: '#E98CB4',
  pinkLight: '#F9DCE9',
  pinkSoft: '#FFF0F6',
  pinkDeep: '#A94F79',
  purple: '#B49ADF',
  purpleSoft: '#F1EBFA',
  mint: '#6BBDA5',
  mintSoft: '#E8F6F0',
  amber: '#E9B46F',
  amberSoft: '#FFF5E6',
  blue: '#7DAFD2',
  ink: '#332A32',
  muted: '#958893',
  white: '#FFFFFF',
  border: '#F0E3EA',
  background: '#FFF9FC',
  dark: '#211820',
};

// ======================================================
// SEEDED DEMONSTRATION REPORT GENERATORS
// ======================================================

function createSeededRandom(seedText: string) {
  let seed = 0;

  for (let i = 0; i < seedText.length; i++) {
    seed = (Math.imul(seed, 31) + seedText.charCodeAt(i)) | 0;
  }

  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

function randomBetween(
  random: () => number,
  min: number,
  max: number,
) {
  return Math.round(min + random() * (max - min));
}

function shuffleItems<T>(items: T[], random: () => number): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function getObservationLevel(score: number) {
  if (score < 65) return 'Moderate';
  if (score < 80) return 'Mild';
  return 'Low';
}

function getObservationColor(score: number) {
  return score < 65 ? C.amber : C.mint;
}

function createDemoReport(
  analysisMode: AnalysisMode,
  textureArea: TextureArea,
  scanId: string,
): DemoReport {
  const overallReport = analysisMode === 'overall';

  const random = createSeededRandom(
    `${scanId}:${analysisMode}:${textureArea}`,
  );

  const metricTemplates: Metric[] = overallReport
    ? [
        {
          name: 'Hydration appearance',
          score: 76,
          description: 'Illustrative hydration indicator',
          color: C.mint,
          detail:
            'Hydration is represented as a simulated indicator. Genuine assessment requires appropriate imaging conditions and validation.',
        },
        {
          name: 'Surface texture',
          score: 88,
          description: 'Illustrative texture indicator',
          color: C.pink,
          detail:
            'Texture assessments can consider visible surface patterns. A photograph cannot reliably measure physical skin texture.',
        },
        {
          name: 'Tone uniformity',
          score: 81,
          description: 'Illustrative complexion indicator',
          color: C.purple,
          detail:
            'Lighting and camera white balance can influence apparent skin tone.',
        },
        {
          name: 'Visible pores',
          score: 73,
          description: 'Illustrative pore appearance',
          color: C.amber,
          detail:
            'Pore visibility naturally varies across facial regions and image conditions.',
        },
        {
          name: 'Surface clarity',
          score: 86,
          description: 'Illustrative clarity indicator',
          color: C.blue,
          detail:
            'Surface clarity is a cosmetic concept and is not a measurement of skin disease.',
        },
        {
          name: 'Skin barrier appearance',
          score: 79,
          description: 'Illustrative barrier indicator',
          color: '#83B99E',
          detail:
            'The skin barrier cannot be directly measured using an ordinary selfie.',
        },
      ]
    : [
        {
          name: 'Surface smoothness',
          score: 82,
          description: 'Illustrative surface texture indicator',
          color: C.pink,
          detail:
            'A genuine texture model could investigate local variations in image patterns.',
        },
        {
          name: 'Visible pore appearance',
          score: 74,
          description: 'Illustrative pore visibility indicator',
          color: C.purple,
          detail:
            'Pore appearance is affected by focus, lighting, camera quality and facial region.',
        },
        {
          name: 'Fine-line appearance',
          score: 86,
          description: 'Illustrative fine-line indicator',
          color: C.amber,
          detail:
            'Fine-line appearance can be influenced by expression, shadows and image conditions.',
        },
        {
          name: 'Roughness appearance',
          score: 78,
          description: 'Illustrative roughness indicator',
          color: C.mint,
          detail:
            'A real model could investigate local texture patterns and unevenness.',
        },
        {
          name: 'Texture uniformity',
          score: 80,
          description: 'Illustrative consistency indicator',
          color: C.blue,
          detail:
            'Texture uniformity describes consistency across the captured region.',
        },
        {
          name: 'Dryness appearance',
          score: 72,
          description: 'Illustrative dryness indicator',
          color: '#D99AB6',
          detail:
            'Visible flaking may be considered by a future image model, but dryness cannot be confirmed from a photograph alone.',
        },
      ];

  const metrics = metricTemplates.map(metric => ({
    ...metric,
    score: Math.max(
      35,
      Math.min(97, metric.score + randomBetween(random, -10, 10)),
    ),
  }));

  const overallScore = Math.round(
    metrics.reduce((total, metric) => total + metric.score, 0) /
      metrics.length,
  );

  const hydrationMetric = metrics.find(metric =>
    overallReport
      ? metric.name === 'Hydration appearance'
      : metric.name === 'Surface smoothness',
  );

  const hydration = hydrationMetric?.score ?? metrics[0].score;

  const skinTypeOptions = [
    'Combination',
    'Normal',
    'Dry',
    'Oily',
  ];

  const skinType = overallReport
    ? skinTypeOptions[
        Math.floor(random() * skinTypeOptions.length)
      ]
    : 'Not assessed';

  const skinHealth =
    overallScore >= 80
      ? 'Balanced appearance'
      : overallScore >= 65
        ? 'Moderate appearance'
        : 'Developing appearance';

  const overallConcerns: Observation[] = [
    {
      title: 'Dehydration appearance',
      level: getObservationLevel(hydration),
      description:
        'An illustrative hydration-related observation for general skincare consideration.',
      color: getObservationColor(hydration),
    },
    {
      title: 'Uneven texture',
      level: getObservationLevel(metrics[1].score),
      description:
        'A simulated observation of visible surface texture.',
      color: getObservationColor(metrics[1].score),
    },
    {
      title: 'Visible pores',
      level: getObservationLevel(metrics[3].score),
      description:
        'Pore appearance naturally varies and is influenced by imaging conditions.',
      color: getObservationColor(metrics[3].score),
    },
    {
      title: 'Uneven-looking tone',
      level: getObservationLevel(metrics[2].score),
      description:
        'A simulated observation relating to visible complexion uniformity.',
      color: getObservationColor(metrics[2].score),
    },
  ];

  const textureConcerns: Observation[] = [
    {
      title: 'Visible pore detail',
      level: getObservationLevel(metrics[1].score),
      description:
        `Illustrative pore appearance in the selected ${textureArea.toLowerCase()} region.`,
      color: getObservationColor(metrics[1].score),
    },
    {
      title: 'Surface roughness',
      level: getObservationLevel(metrics[3].score),
      description:
        'A simulated observation of surface texture consistency.',
      color: getObservationColor(metrics[3].score),
    },
    {
      title: 'Fine-line appearance',
      level: getObservationLevel(metrics[2].score),
      description:
        'Fine-line appearance can be affected by expression, shadows and lighting.',
      color: getObservationColor(metrics[2].score),
    },
    {
      title: 'Texture consistency',
      level: getObservationLevel(metrics[4].score),
      description:
        'A simulated observation of visible texture variation.',
      color: getObservationColor(metrics[4].score),
    },
  ];

  const concerns = shuffleItems(
    overallReport ? overallConcerns : textureConcerns,
    random,
  );

  const recommendationTemplates: Recommendation[] = [
    {
      step: '',
      category: 'CLEANSING',
      title: 'Gentle low-pH cleanser',
      description:
        'Choose a mild cleanser that removes daily impurities without leaving the skin feeling tight.',
      time: 'Morning and evening',
    },
    {
      step: '',
      category: 'HYDRATION',
      title: 'Hyaluronic acid serum',
      description:
        'A humectant-based serum can help support surface hydration when applied to slightly damp skin.',
      time: 'Morning or evening',
    },
    {
      step: '',
      category: 'MOISTURISING',
      title: 'Barrier-support moisturiser',
      description:
        'Look for ingredients such as ceramides and glycerin.',
      time: 'Morning and evening',
    },
    {
      step: '',
      category: 'PROTECTION',
      title: 'Broad-spectrum SPF 30+',
      description:
        'Use broad-spectrum sun protection during daytime.',
      time: 'Every morning',
    },
    {
      step: '',
      category: 'SKINCARE',
      title: 'Avoid excessive exfoliation',
      description:
        'Avoid overly aggressive exfoliation that may irritate the skin.',
      time: 'As needed',
    },
    {
      step: '',
      category: 'ROUTINE',
      title: 'Maintain a consistent routine',
      description:
        'Keep a simple routine and monitor changes over time.',
      time: 'Daily',
    },
  ];

  const recommendations = shuffleItems(
    recommendationTemplates,
    random,
  )
    .slice(0, 4)
    .map((item, index) => ({
      ...item,
      step: String(index + 1).padStart(2, '0'),
    }));

  return {
    overallScore,
    skinType,
    hydration,
    skinHealth,
    analysisMode,
    textureArea,

    reportTitle: overallReport
      ? 'Overall skin snapshot'
      : 'Close-up texture report',

    reportSubtitle: overallReport
      ? 'Full-face overview'
      : `${textureArea} texture overview`,

    summary: overallReport
      ? 'This demonstration report presents simulated cosmetic skin indicators covering hydration appearance, texture, tone and visible pores. These values are not calculated from your photograph.'
      : `This demonstration report presents simulated texture indicators for the selected ${textureArea.toLowerCase()} region. These values are not calculated from your photograph.`,

    metrics,
    concerns,
    recommendations,

    provider: 'Prototype simulation',

    model: overallReport
      ? 'Simulated overall skin report v2'
      : 'Simulated close-up texture report v2',
  };
}

// ======================================================
// ICON COMPONENT
// ======================================================

function Icon({
  name,
  size = 22,
  color = C.pinkDeep,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  switch (name) {
    case 'camera':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...common} d="M3 8a2 2 0 0 1 2-2h3l2-3h4l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
          <Circle {...common} cx="12" cy="13" r="4" />
        </Svg>
      );

    case 'sparkles':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...common} d="m12 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
          <Path {...common} d="m19 15 1.2 2.8L23 19l-2.8 1.2L19 23l-1.2-2.8L15 19l2.8-1.2L19 15Z" />
        </Svg>
      );

    case 'refresh':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...common} d="M20 7v5h-5M4 17v-5h5" />
          <Path {...common} d="M5.6 9a7 7 0 0 1 12-2L20 12M4 12l2.4 5a7 7 0 0 0 12-2" />
        </Svg>
      );

    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...common} d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
          <Path {...common} d="m9 12 2 2 4-4" />
        </Svg>
      );

    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...common} d="m5 12 4 4L19 6" />
        </Svg>
      );

    case 'clock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...common} cx="12" cy="12" r="9" />
          <Path {...common} d="M12 7v5l3 2" />
        </Svg>
      );

    case 'droplet':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...common} d="M12 3s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13Z" />
        </Svg>
      );

    case 'sun':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle {...common} cx="12" cy="12" r="4" />
          <Path {...common} d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
        </Svg>
      );

    case 'back':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...common} d="m15 18-6-6 6-6M9 12h12" />
        </Svg>
      );

    case 'focus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path {...common} d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
          <Circle {...common} cx="12" cy="12" r="3" />
        </Svg>
      );

    default:
      return null;
  }
}

// ======================================================
// SMALL COMPONENTS
// ======================================================

function SectionHeading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        )}
      </View>

      {!!right && (
        <Text style={styles.sectionRight}>{right}</Text>
      )}
    </View>
  );
}

function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[styles.glassCard, style]}>
      {children}
    </View>
  );
}

function ScoreBar({
  metric,
  index,
}: {
  metric: Metric;
  index: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: metric.score / 100,
      duration: 900 + index * 130,
      delay: 150,
      useNativeDriver: false,
    }).start();
  }, [metric.score, index, progress]);

  return (
    <View style={styles.metricContainer}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricName}>{metric.name}</Text>
        <Text style={styles.metricScore}>{metric.score}%</Text>
      </View>

      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: metric.color,
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <Text style={styles.metricDescription}>
        {metric.description}
      </Text>
    </View>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 39;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={styles.ringContainer}>
      <Svg width={112} height={112} viewBox="0 0 112 112">
        <Defs>
          <LinearGradient
            id="scoreGradient"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <Stop offset="0" stopColor="#F6A7C7" />
            <Stop offset="1" stopColor="#A879BE" />
          </LinearGradient>
        </Defs>

        <Circle
          cx="56"
          cy="56"
          r={radius}
          stroke="#F4E7ED"
          strokeWidth="8"
          fill="none"
        />

        <Circle
          cx="56"
          cy="56"
          r={radius}
          stroke="url(#scoreGradient)"
          strokeWidth="8"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - score / 100)}
          strokeLinecap="round"
          fill="none"
          rotation="-90"
          origin="56, 56"
        />
      </Svg>

      <View style={styles.ringCenter}>
        <Icon name="sparkles" size={20} />
        <Text style={styles.ringCenterText}>SKIN</Text>
      </View>
    </View>
  );
}

function MetricDetail({ metric }: { metric: Metric }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={styles.metricDetail}
    >
      <View style={styles.metricDetailHeader}>
        <View style={styles.metricDetailLeft}>
          <View
            style={[
              styles.metricDetailDot,
              { backgroundColor: metric.color },
            ]}
          />
          <Text style={styles.metricDetailTitle}>
            {metric.name}
          </Text>
        </View>

        <Text style={styles.metricDetailToggle}>
          {expanded ? '−' : '+'}
        </Text>
      </View>

      {expanded && (
        <Text style={styles.metricDetailDescription}>
          {metric.detail}
        </Text>
      )}
    </Pressable>
  );
}

// ======================================================
// MAIN SCREEN
// ======================================================

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<ScreenMode>('camera');
  const [analysisMode, setAnalysisMode] =
    useState<AnalysisMode>('overall');
  const [textureArea, setTextureArea] =
    useState<TextureArea>('Cheeks');
  const [facing, setFacing] = useState<'front' | 'back'>('front');

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  const [analysisResult, setAnalysisResult] =
    useState<DemoReport | null>(null);

  const [savedScanId, setSavedScanId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [syncMessage, setSyncMessage] = useState(
    'Saved on this device. Waiting for cloud synchronization.',
  );
  const [syncing, setSyncing] = useState(false);

  const cameraRef = useRef<CameraView>(null);

  const aura = useRef(new Animated.Value(0.35)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  // ----------------------------------------------------
  // CLOUD SYNC LISTENER
  // ----------------------------------------------------

  useEffect(() => {
    const stopListener = startScanSyncListener();

    return () => {
      stopListener();
    };
  }, []);

  // ----------------------------------------------------
  // SYNC CURRENT SCAN
  // ----------------------------------------------------

  const syncCurrentScan = async (scanId: string) => {
    if (syncing) return;

    setSyncing(true);
    setSyncStatus('syncing');
    setSyncMessage('Uploading your saved scan securely...');

    try {
      await syncPendingScans();

      setSyncStatus('synced');
      setSyncMessage(
        'Your scan has been synchronized with your account.',
      );
    } catch (error) {
      console.error('Scan synchronization error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Cloud synchronization could not be completed.';

      setSyncStatus('error');
      setSyncMessage(
        `Saved locally. Cloud synchronization failed: ${message}`,
      );
    } finally {
      setSyncing(false);
    }
  };

  // ----------------------------------------------------
  // ANIMATIONS
  // ----------------------------------------------------

  useEffect(() => {
    const auraLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(aura, {
          toValue: 0.9,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(aura, {
          toValue: 0.35,
          duration: 2400,
          useNativeDriver: true,
        }),
      ]),
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ]),
    );

    auraLoop.start();
    floatLoop.start();

    return () => {
      auraLoop.stop();
      floatLoop.stop();
    };
  }, [aura, float]);

  useEffect(() => {
    if (mode !== 'preview' || !analysing) {
      scan.stopAnimation();
      scan.setValue(0);
      return;
    }

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scan, {
          toValue: 1,
          duration: 1900,
          useNativeDriver: true,
        }),
        Animated.timing(scan, {
          toValue: 0,
          duration: 1900,
          useNativeDriver: true,
        }),
      ]),
    );

    scanLoop.start();

    return () => scanLoop.stop();
  }, [mode, analysing, scan]);

  // ----------------------------------------------------
  // SELECT ANALYSIS MODE
  // ----------------------------------------------------

  const selectAnalysisMode = (nextMode: AnalysisMode) => {
    if (analysing) return;

    setAnalysisMode(nextMode);
    setAnalysisResult(null);
    setSavedScanId(null);
    setSaveError(null);
    setSyncStatus('local');
    setSyncMessage(
      'Saved on this device. Waiting for cloud synchronization.',
    );
  };

  // ----------------------------------------------------
  // CAPTURE
  // ----------------------------------------------------

  const capturePhoto = async () => {
    if (!cameraRef.current || analysing) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error('The camera did not return an image.');
      }

      setPhotoUri(photo.uri);
      setAnalysisResult(null);
      setSavedScanId(null);
      setSaveError(null);
      setSyncStatus('local');
      setSyncMessage(
        'Your photograph has been captured and is ready for review.',
      );
      setMode('preview');
    } catch (error) {
      Alert.alert(
        'Capture failed',
        error instanceof Error
          ? error.message
          : 'Unable to capture photograph.',
      );
    }
  };

  // ----------------------------------------------------
  // PROTOTYPE ANALYSIS + LOCAL STORAGE + CLOUD SYNC
  // ----------------------------------------------------

  const analysePhoto = async () => {
    if (!photoUri || analysing) return;

    setAnalysing(true);
    setSaveError(null);
    setSyncStatus('local');

    try {
      // Demonstration delay only.
      // This is NOT actual AI or computer vision inference.
      await new Promise(resolve => setTimeout(resolve, 2600));

      // Supabase scans.id is a UUID.
      const scanId = Crypto.randomUUID();

      // Preserve the original image in app document storage.
      const permanentUri = await savePhotoPermanently(
        photoUri,
        scanId,
      );

      // Generate deterministic simulated report data.
      const report = createDemoReport(
        analysisMode,
        textureArea,
        scanId,
      );

      // Convert detailed report data into SQLite format.
      const savedAnalysis: SkinAnalysisResult = {
        overallScore: report.overallScore,
        skinType: report.skinType,
        hydration: report.hydration,
        skinHealth: report.skinHealth,
        summary: report.summary,

        metrics: report.metrics.map(metric => ({
          name: metric.name,
          score: metric.score,
          description: metric.description,
          color: metric.color,
        })),

        concerns: report.concerns.map(concern => ({
          name: concern.title,
          level: concern.level,
          color: concern.color,
        })),

        recommendations: report.recommendations.map(item => ({
          step: item.step,
          title: item.title,
          description: item.description,
          category: item.category,
        })),

        provider: report.provider,
        model: report.model,
      };

      // Save locally before attempting any cloud operation.
      await saveScan({
        id: scanId,
        photoUri: permanentUri,
        createdAt: new Date().toISOString(),
        status: 'completed',
        analysis: savedAnalysis,
      });

      // Display the report even if the device is offline.
      setPhotoUri(permanentUri);
      setAnalysisResult(report);
      setSavedScanId(scanId);
      setMode('results');
      setSyncStatus('local');
      setSyncMessage(
        'Your photograph and report are saved locally on this device.',
      );

      // Attempt cloud synchronization after local persistence.
      // If this fails, the locally saved scan remains available.
      void syncCurrentScan(scanId);
    } catch (error) {
      console.error('Analysis/save error:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to save this scan.';

      setSaveError(message);

      Alert.alert(
        'Could not save scan',
        `${message}\n\nYour photograph is still available in the current session.`,
      );
    } finally {
      setAnalysing(false);
    }
  };

  // ----------------------------------------------------
  // RETAKE
  // ----------------------------------------------------

  const retakePhoto = () => {
    if (analysing) return;

    setPhotoUri(null);
    setAnalysisResult(null);
    setSavedScanId(null);
    setSaveError(null);
    setSyncStatus('local');
    setSyncMessage(
      'Saved on this device. Waiting for cloud synchronization.',
    );
    setMode('camera');
  };

  // ----------------------------------------------------
  // ANIMATION VALUES
  // ----------------------------------------------------

  const scanTranslateY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 340],
  });

  const isTextureMode = analysisMode === 'texture';

  // ----------------------------------------------------
  // PERMISSIONS
  // ----------------------------------------------------

  if (!permission) {
    return (
      <View style={styles.permissionScreen}>
        <ActivityIndicator size="large" color={C.pinkDeep} />
        <Text style={styles.permissionText}>
          Preparing your skin studio...
        </Text>
      </View>
    );
  }

  if (!permission.granted && mode === 'camera') {
    return (
      <View style={styles.permissionScreen}>
        <View style={styles.permissionGlow}>
          <Icon name="camera" size={34} />
        </View>

        <Text style={styles.permissionTitle}>
          Camera access required
        </Text>

        <Text style={styles.permissionText}>
          Allow camera access to capture your photograph and explore the SkinAIAnalyzer experience.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={requestPermission}
        >
          <Icon name="camera" color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>
            Enable camera
          </Text>
        </Pressable>
      </View>
    );
  }

  // ----------------------------------------------------
  // RENDER
  // ----------------------------------------------------

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.eyebrow}>
                SKINAI PERSONAL STUDIO
              </Text>
            </View>

            <Text style={styles.title}>Skin Analysis</Text>

            <Text style={styles.headerSubtitle}>
              A closer look at your skincare journey.
            </Text>
          </View>

          <Animated.View
            style={[
              styles.headerBadge,
              {
                transform: [
                  {
                    translateY: float.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -5],
                    }),
                  },
                ],
              },
            ]}
          >
            <Icon name="sparkles" size={23} />
          </Animated.View>
        </View>

        {/* STEP INDICATOR */}

        <View style={styles.stepContainer}>
          {[
            { label: 'Capture', active: mode === 'camera' },
            { label: 'Review', active: mode === 'preview' },
            { label: 'Insights', active: mode === 'results' },
          ].map((step, index) => (
            <View key={step.label} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  step.active && styles.stepDotActive,
                ]}
              >
                {step.active ? (
                  <View style={styles.stepDotInner} />
                ) : (
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                )}
              </View>

              <Text
                style={[
                  styles.stepLabel,
                  step.active && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </View>

        {/* CAMERA MODE */}

        {mode === 'camera' && (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Icon name="sparkles" size={20} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>
                  Your skin, in focus.
                </Text>

                <Text style={styles.heroDescription}>
                  Choose a scan type and capture a clear photograph to begin your skincare assessment experience.
                </Text>
              </View>
            </View>

            <SectionHeading
              title="Choose your scan"
              subtitle="Select the type of skin analysis you want to explore."
            />

            <View style={styles.modeSelector}>
              <Pressable
                onPress={() => selectAnalysisMode('overall')}
                style={[
                  styles.modeCard,
                  !isTextureMode && styles.modeCardActive,
                ]}
              >
                <View
                  style={[
                    styles.modeIcon,
                    !isTextureMode && styles.modeIconActive,
                  ]}
                >
                  <Icon
                    name="camera"
                    size={22}
                    color={!isTextureMode ? '#FFFFFF' : C.pinkDeep}
                  />
                </View>

                <View style={styles.modeCardText}>
                  <Text style={styles.modeCardTitle}>
                    Overall Skin Analysis
                  </Text>

                  <Text style={styles.modeCardDescription}>
                    Full-face overview of hydration appearance, skin tone, texture, pores and visible concerns.
                  </Text>

                  <Text style={styles.modeCardMeta}>
                    FULL-FACE SCAN
                  </Text>
                </View>

                <View
                  style={[
                    styles.modeRadio,
                    !isTextureMode && styles.modeRadioActive,
                  ]}
                >
                  {!isTextureMode && (
                    <View style={styles.modeRadioInner} />
                  )}
                </View>
              </Pressable>

              <Pressable
                onPress={() => selectAnalysisMode('texture')}
                style={[
                  styles.modeCard,
                  isTextureMode && styles.modeCardActive,
                ]}
              >
                <View
                  style={[
                    styles.modeIcon,
                    isTextureMode && styles.modeIconActive,
                  ]}
                >
                  <Icon
                    name="focus"
                    size={22}
                    color={isTextureMode ? '#FFFFFF' : C.pinkDeep}
                  />
                </View>

                <View style={styles.modeCardText}>
                  <Text style={styles.modeCardTitle}>
                    Close-up Texture Analysis
                  </Text>

                  <Text style={styles.modeCardDescription}>
                    Closer view of visible pores, fine-line appearance, roughness and surface texture.
                  </Text>

                  <Text style={styles.modeCardMeta}>
                    DETAILED AREA SCAN
                  </Text>
                </View>

                <View
                  style={[
                    styles.modeRadio,
                    isTextureMode && styles.modeRadioActive,
                  ]}
                >
                  {isTextureMode && (
                    <View style={styles.modeRadioInner} />
                  )}
                </View>
              </Pressable>
            </View>

            {isTextureMode && (
              <GlassCard style={styles.areaSelector}>
                <Text style={styles.areaTitle}>
                  Select the area to focus on
                </Text>

                <Text style={styles.areaSubtitle}>
                  Position the selected region inside the camera guide.
                </Text>

                <View style={styles.areaOptions}>
                  {(
                    ['Cheeks', 'Forehead', 'Nose', 'Chin'] as TextureArea[]
                  ).map(area => (
                    <Pressable
                      key={area}
                      onPress={() => setTextureArea(area)}
                      style={[
                        styles.areaChip,
                        textureArea === area && styles.areaChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.areaChipText,
                          textureArea === area && styles.areaChipTextActive,
                        ]}
                      >
                        {area}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </GlassCard>
            )}

            {/* CAMERA */}

            <View style={styles.cameraWrap}>
              <Animated.View
                style={[
                  styles.cameraAuraOuter,
                  { opacity: aura },
                ]}
              />

              <Animated.View
                style={[
                  styles.cameraAuraInner,
                  {
                    opacity: aura.interpolate({
                      inputRange: [0.35, 0.9],
                      outputRange: [0.2, 0.65],
                    }),
                  },
                ]}
              />

              <View style={styles.cameraEdge}>
                <View style={styles.cameraFrame}>
                  <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing={facing}
                  />

                  <View style={styles.cameraOverlay}>
                    <View style={styles.cameraTop}>
                      <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>
                          CAMERA ACTIVE
                        </Text>
                      </View>

                      <Pressable
                        style={styles.flipButton}
                        onPress={() =>
                          setFacing(current =>
                            current === 'front' ? 'back' : 'front',
                          )
                        }
                      >
                        <Icon
                          name="refresh"
                          color="#FFFFFF"
                          size={19}
                        />
                      </Pressable>
                    </View>

                    <View
                      style={[
                        styles.faceGuide,
                        isTextureMode && styles.textureGuide,
                      ]}
                    >
                      <View style={styles.guideCornerTL} />
                      <View style={styles.guideCornerTR} />
                      <View style={styles.guideCornerBL} />
                      <View style={styles.guideCornerBR} />

                      <View style={styles.guideCenter}>
                        {isTextureMode ? (
                          <View style={styles.textureTarget}>
                            <View style={styles.textureTargetInner} />
                          </View>
                        ) : (
                          <View style={styles.guideFaceCircle} />
                        )}

                        <Text style={styles.guideText}>
                          {isTextureMode
                            ? `FOCUS ON ${textureArea.toUpperCase()}`
                            : 'POSITION YOUR FACE'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cameraBottom}>
                      <View style={styles.cameraHintPill}>
                        <Icon
                          name="sun"
                          color="#FFFFFF"
                          size={13}
                        />
                        <Text style={styles.cameraHint}>
                          {isTextureMode
                            ? 'Move closer while keeping the area in focus'
                            : 'Natural lighting recommended'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* CAPTURE BUTTON */}

            <View style={styles.captureArea}>
              <Text style={styles.captureInstruction}>
                {isTextureMode
                  ? `Ready to capture your ${textureArea.toLowerCase()}?`
                  : 'Ready for your skin check?'}
              </Text>

              <Pressable
                onPress={capturePhoto}
                style={({ pressed }) => [
                  styles.captureOuter,
                  pressed && { transform: [{ scale: 0.94 }] },
                ]}
              >
                <View style={styles.captureInner}>
                  <Icon
                    name="camera"
                    size={27}
                    color={C.pinkDeep}
                  />
                </View>
              </Pressable>

              <Text style={styles.captureHint}>
                Tap the shutter to capture
              </Text>
            </View>

            <SectionHeading
              title="Before you begin"
              subtitle={
                isTextureMode
                  ? 'Tips for capturing more detailed skin texture.'
                  : 'A few simple steps for a consistent full-face photo.'
              }
            />

            <View style={styles.guidanceGrid}>
              <GlassCard style={styles.guidanceCard}>
                <View style={styles.guidanceIcon}>
                  <Icon name="sun" color={C.amber} size={20} />
                </View>
                <Text style={styles.guidanceTitle}>Good lighting</Text>
                <Text style={styles.guidanceDescription}>
                  Use soft, even natural light.
                </Text>
              </GlassCard>

              <GlassCard style={styles.guidanceCard}>
                <View style={styles.guidanceIcon}>
                  <Icon name="focus" color={C.pinkDeep} size={20} />
                </View>
                <Text style={styles.guidanceTitle}>
                  {isTextureMode ? 'Sharp focus' : 'No filters'}
                </Text>
                <Text style={styles.guidanceDescription}>
                  {isTextureMode
                    ? 'Keep the selected area clear and focused.'
                    : 'Avoid beauty effects and filters.'}
                </Text>
              </GlassCard>

              <GlassCard style={styles.guidanceCard}>
                <View style={styles.guidanceIcon}>
                  <Icon name="shield" color={C.mint} size={20} />
                </View>
                <Text style={styles.guidanceTitle}>Clean skin</Text>
                <Text style={styles.guidanceDescription}>
                  Remove heavy makeup where possible.
                </Text>
              </GlassCard>
            </View>

            <View style={styles.noticeCard}>
              <Icon name="shield" color={C.mint} size={19} />
              <Text style={styles.noticeText}>
                Your captured photograph is stored locally when you complete a scan. This prototype does not perform genuine AI skin analysis.
              </Text>
            </View>
          </>
        )}

        {/* PREVIEW MODE */}

        {mode === 'preview' && photoUri && (
          <>
            <SectionHeading
              title="Review your photograph"
              subtitle={
                isTextureMode
                  ? `Check that your ${textureArea.toLowerCase()} area is clear and in focus.`
                  : 'Make sure your face is clearly visible before continuing.'
              }
            />

            <View style={styles.previewGlow}>
              <View style={styles.previewFrame}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />

                {analysing && (
                  <>
                    <View style={styles.scanOverlay} />

                    <Animated.View
                      style={[
                        styles.scanLine,
                        {
                          transform: [
                            { translateY: scanTranslateY },
                          ],
                        },
                      ]}
                    />
                  </>
                )}

                <View style={styles.previewTopBadge}>
                  <View style={styles.previewBadgeDot} />
                  <Text style={styles.previewBadgeText}>
                    {analysing
                      ? 'PROCESSING DEMONSTRATION'
                      : isTextureMode
                        ? 'CLOSE-UP PHOTO CAPTURED'
                        : 'FULL-FACE PHOTO CAPTURED'}
                  </Text>
                </View>
              </View>
            </View>

            <GlassCard style={styles.previewInfo}>
              <View style={styles.previewInfoIcon}>
                <Icon name="check" size={19} color={C.mint} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.previewInfoTitle}>
                  {isTextureMode
                    ? 'Texture photograph ready'
                    : 'Photograph ready'}
                </Text>

                <Text style={styles.previewInfoDescription}>
                  {isTextureMode
                    ? `Selected area: ${textureArea}. Review the image before generating your texture report.`
                    : 'Your image is ready for the overall prototype report workflow.'}
                </Text>
              </View>
            </GlassCard>

            <View style={styles.selectedModeSummary}>
              <Icon
                name={isTextureMode ? 'focus' : 'camera'}
                size={17}
              />

              <Text style={styles.selectedModeSummaryText}>
                {isTextureMode
                  ? `Close-up Texture Analysis • ${textureArea}`
                  : 'Overall Skin Analysis • Full face'}
              </Text>
            </View>

            <View style={styles.previewActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={retakePhoto}
                disabled={analysing}
              >
                <Icon name="refresh" size={17} />
                <Text style={styles.secondaryButtonText}>
                  Retake
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.primaryButton,
                  { flex: 1 },
                  analysing && { opacity: 0.65 },
                ]}
                onPress={analysePhoto}
                disabled={analysing}
              >
                {analysing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Icon
                      name="sparkles"
                      color="#FFFFFF"
                      size={17}
                    />
                    <Text style={styles.primaryButtonText}>
                      Generate report
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {analysing && (
              <GlassCard style={styles.processingCard}>
                <ActivityIndicator
                  color={C.pinkDeep}
                  size="large"
                />

                <Text style={styles.processingTitle}>
                  Preparing your report
                </Text>

                <Text style={styles.processingDescription}>
                  Simulating your {isTextureMode ? 'texture' : 'overall skin'} report experience...
                </Text>

                <Text style={styles.simulationLabel}>
                  PROTOTYPE SIMULATION
                </Text>
              </GlassCard>
            )}
          </>
        )}

        {/* RESULTS MODE */}

        {mode === 'results' && analysisResult && (
          <>
            {/* REPORT HERO */}

            <View style={styles.reportHero}>
              <View style={styles.reportHeroTop}>
                <View style={styles.reportHeroIcon}>
                  <Icon
                    name="sparkles"
                    color="#FFFFFF"
                    size={23}
                  />
                </View>

                <View style={styles.demoBadge}>
                  <View style={styles.demoDot} />
                  <Text style={styles.demoBadgeText}>
                    DEMO REPORT
                  </Text>
                </View>
              </View>

              <Text style={styles.reportEyebrow}>
                {analysisResult.analysisMode === 'texture'
                  ? 'CLOSE-UP TEXTURE ANALYSIS'
                  : 'OVERALL SKIN ANALYSIS'}
              </Text>

              <Text style={styles.reportTitle}>
                {analysisResult.reportTitle}
              </Text>

              <Text style={styles.reportDescription}>
                {analysisResult.summary}
              </Text>

              <View style={styles.reportDate}>
                <Icon name="clock" color="#F9DCE9" size={13} />
                <Text style={styles.reportDateText}>
                  {new Date().toLocaleString()}
                </Text>
              </View>
            </View>

            {/* SCAN INFORMATION */}

            <GlassCard style={styles.scanInfoCard}>
              <View style={styles.scanInfoIcon}>
                <Icon
                  name={
                    analysisResult.analysisMode === 'texture'
                      ? 'focus'
                      : 'camera'
                  }
                  size={19}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.scanInfoLabel}>
                  SCAN TYPE
                </Text>

                <Text style={styles.scanInfoTitle}>
                  {analysisResult.analysisMode === 'texture'
                    ? 'Close-up Texture Analysis'
                    : 'Overall Skin Analysis'}
                </Text>

                <Text style={styles.scanInfoSubtitle}>
                  {analysisResult.analysisMode === 'texture'
                    ? `Selected area: ${analysisResult.textureArea}`
                    : 'Full-face overview'}
                </Text>
              </View>
            </GlassCard>

            {/* OVERALL SCORE */}

            <SectionHeading
              title={
                analysisResult.analysisMode === 'texture'
                  ? 'Texture overview'
                  : 'Skin overview'
              }
              subtitle="Illustrative indicators for the prototype."
            />

            <GlassCard style={styles.scoreCard}>
              <View style={styles.scoreLeft}>
                <Text style={styles.scoreLabel}>
                  {analysisResult.analysisMode === 'texture'
                    ? 'TEXTURE INDICATOR'
                    : 'OVERALL SKIN INDICATOR'}
                </Text>

                <Text style={styles.scoreNumber}>
                  {analysisResult.overallScore}
                  <Text style={styles.scoreOutOf}> / 100</Text>
                </Text>

                <View style={styles.scoreStatus}>
                  <View style={styles.scoreStatusDot} />
                  <Text style={styles.scoreStatusText}>
                    {analysisResult.skinHealth}
                  </Text>
                </View>

                <Text style={styles.scoreFootnote}>
                  Simulated prototype value
                </Text>
              </View>

              <ScoreRing score={analysisResult.overallScore} />
            </GlassCard>

            {/* PROFILE */}

            <View style={styles.profileGrid}>
              <GlassCard style={styles.profileCard}>
                <View style={styles.profileCardIcon}>
                  <Icon name="sparkles" size={19} />
                </View>

                <Text style={styles.profileLabel}>
                  {analysisResult.analysisMode === 'texture'
                    ? 'ANALYSIS AREA'
                    : 'SAMPLE SKIN PROFILE'}
                </Text>

                <Text style={styles.profileType}>
                  {analysisResult.analysisMode === 'texture'
                    ? analysisResult.textureArea
                    : analysisResult.skinType}
                </Text>

                <Text style={styles.profileDescription}>
                  {analysisResult.analysisMode === 'texture'
                    ? 'Selected facial region.'
                    : 'Demonstration classification only.'}
                </Text>
              </GlassCard>

              <GlassCard style={styles.profileCard}>
                <View style={styles.profileCardIcon}>
                  <Icon name="droplet" size={19} />
                </View>

                <Text style={styles.profileLabel}>
                  {analysisResult.analysisMode === 'texture'
                    ? 'SURFACE INDICATOR'
                    : 'HYDRATION INDICATOR'}
                </Text>

                <Text style={styles.profileType}>
                  {analysisResult.hydration}%
                </Text>

                <Text style={styles.profileDescription}>
                  Simulated prototype value.
                </Text>
              </GlassCard>
            </View>

            {/* METRICS */}

            <SectionHeading
              title={
                analysisResult.analysisMode === 'texture'
                  ? 'Texture breakdown'
                  : 'Skin analysis breakdown'
              }
              subtitle={
                analysisResult.analysisMode === 'texture'
                  ? 'Illustrative close-up texture categories.'
                  : 'Six illustrative categories with individual scores.'
              }
              right={`${analysisResult.metrics.length} METRICS`}
            />

            <GlassCard style={styles.metricsCard}>
              {analysisResult.metrics.map((metric, index) => (
                <ScoreBar
                  key={metric.name}
                  metric={metric}
                  index={index}
                />
              ))}
            </GlassCard>

            {/* METRIC EXPLANATIONS */}

            <SectionHeading
              title="Understanding your indicators"
              subtitle="Explore what each category represents."
            />

            <GlassCard style={styles.detailCard}>
              {analysisResult.metrics.map((metric, index) => (
                <View key={metric.name}>
                  <MetricDetail metric={metric} />

                  {index !== analysisResult.metrics.length - 1 && (
                    <View style={styles.detailDivider} />
                  )}
                </View>
              ))}
            </GlassCard>

            {/* OBSERVATIONS */}

            <SectionHeading
              title={
                analysisResult.analysisMode === 'texture'
                  ? 'Texture observations'
                  : 'Skin observations'
              }
              subtitle="Illustrative areas to consider in your routine."
            />

            <View style={styles.observationsCard}>
              {analysisResult.concerns.map((concern, index) => (
                <View
                  key={concern.title}
                  style={[
                    styles.observationRow,
                    index === analysisResult.concerns.length - 1 && {
                      borderBottomWidth: 0,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.observationIcon,
                      { backgroundColor: `${concern.color}20` },
                    ]}
                  >
                    <Icon
                      name="sparkles"
                      color={concern.color}
                      size={17}
                    />
                  </View>

                  <View style={styles.observationCopy}>
                    <View style={styles.observationHeading}>
                      <Text style={styles.observationTitle}>
                        {concern.title}
                      </Text>

                      <View
                        style={[
                          styles.levelBadge,
                          { backgroundColor: `${concern.color}20` },
                        ]}
                      >
                        <Text
                          style={[
                            styles.levelBadgeText,
                            { color: concern.color },
                          ]}
                        >
                          {concern.level}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.observationDescription}>
                      {concern.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ROUTINE */}

            <SectionHeading
              title="Your skincare routine"
              subtitle="A general routine structure for skincare maintenance."
            />

            <View style={styles.routineCard}>
              <View style={styles.routineHeader}>
                <View>
                  <Text style={styles.routineTitle}>
                    Daily routine
                  </Text>

                  <Text style={styles.routineSubtitle}>
                    Four general skincare steps
                  </Text>
                </View>

                <View style={styles.routineBadge}>
                  <Icon name="sparkles" size={15} />
                </View>
              </View>

              {analysisResult.recommendations.map(item => (
                <View key={item.step} style={styles.routineRow}>
                  <View style={styles.routineNumber}>
                    <Text style={styles.routineNumberText}>
                      {item.step}
                    </Text>
                  </View>

                  <View style={styles.routineCopy}>
                    <Text style={styles.routineCategory}>
                      {item.category}
                    </Text>

                    <Text style={styles.routineItemTitle}>
                      {item.title}
                    </Text>

                    <Text style={styles.routineDescription}>
                      {item.description}
                    </Text>

                    <View style={styles.routineTime}>
                      <Icon
                        name="clock"
                        size={12}
                        color={C.muted}
                      />

                      <Text style={styles.routineTimeText}>
                        {item.time}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* MORNING AND EVENING */}

            <SectionHeading
              title="Routine guidance"
              subtitle="An example of how the routine can be structured."
            />

            <View style={styles.routineSplit}>
              <GlassCard style={styles.routineSplitCard}>
                <View style={styles.routineSplitIcon}>
                  <Icon name="sun" color={C.amber} size={19} />
                </View>

                <Text style={styles.routineSplitTitle}>Morning</Text>

                <Text style={styles.routineSplitText}>
                  Cleanse, hydrate, moisturise and apply sunscreen.
                </Text>
              </GlassCard>

              <GlassCard style={styles.routineSplitCard}>
                <View style={styles.routineSplitIcon}>
                  <Icon name="sparkles" color={C.purple} size={19} />
                </View>

                <Text style={styles.routineSplitTitle}>Evening</Text>

                <Text style={styles.routineSplitText}>
                  Gently cleanse, hydrate and support the skin barrier.
                </Text>
              </GlassCard>
            </View>

            {/* SAVED AND SYNC STATUS */}

            {savedScanId && (
              <View style={styles.savedCard}>
                <View style={styles.savedIcon}>
                  <Icon
                    name="check"
                    color={C.mint}
                    size={18}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.savedTitle}>
                    Scan saved on this device
                  </Text>

                  <Text style={styles.savedDescription}>
                    Your photograph and prototype report are stored locally. Scan type:{' '}
                    {analysisResult.analysisMode === 'texture'
                      ? `Close-up Texture (${analysisResult.textureArea})`
                      : 'Overall Skin Analysis'}.
                  </Text>
                </View>
              </View>
            )}

            {savedScanId && (
              <View
                style={[
                  styles.syncCard,
                  syncStatus === 'synced' && styles.syncCardSuccess,
                  syncStatus === 'error' && styles.syncCardError,
                ]}
              >
                <View style={styles.syncIcon}>
                  {syncStatus === 'syncing' || syncing ? (
                    <ActivityIndicator
                      size="small"
                      color={C.pinkDeep}
                    />
                  ) : (
                    <Icon
                      name={
                        syncStatus === 'synced'
                          ? 'check'
                          : syncStatus === 'error'
                            ? 'refresh'
                            : 'clock'
                      }
                      color={
                        syncStatus === 'synced'
                          ? C.mint
                          : syncStatus === 'error'
                            ? C.amber
                            : C.pinkDeep
                      }
                      size={18}
                    />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.syncTitle}>
                    {syncStatus === 'synced'
                      ? 'Cloud synchronization complete'
                      : syncStatus === 'syncing'
                        ? 'Synchronizing scan'
                        : syncStatus === 'error'
                          ? 'Cloud synchronization failed'
                          : 'Waiting for synchronization'}
                  </Text>

                  <Text style={styles.syncDescription}>
                    {syncMessage}
                  </Text>

                  {syncStatus !== 'synced' && (
                    <Pressable
                      style={styles.retrySyncButton}
                      onPress={() => syncCurrentScan(savedScanId)}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <ActivityIndicator
                          size="small"
                          color={C.pinkDeep}
                        />
                      ) : (
                        <Icon
                          name="refresh"
                          size={13}
                          color={C.pinkDeep}
                        />
                      )}

                      <Text style={styles.retrySyncText}>
                        {syncing ? 'Please wait...' : 'Retry synchronization'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {saveError && (
              <View style={styles.noticeCard}>
                <Icon name="shield" color={C.amber} size={19} />
                <Text style={styles.noticeText}>{saveError}</Text>
              </View>
            )}

            {/* DISCLAIMER */}

            <View style={styles.disclaimerCard}>
              <Icon name="shield" size={20} color={C.amber} />

              <View style={{ flex: 1 }}>
                <Text style={styles.disclaimerTitle}>
                  Prototype analysis disclaimer
                </Text>

                <Text style={styles.disclaimerText}>
                  All scores, skin classifications, observations and recommendations shown in this report are simulated demonstration data. They are not calculated from your photograph, even in close-up mode, and should not be used to make medical or treatment decisions. A genuine AI model must be integrated before these results can be presented as actual skin analysis.
                </Text>
              </View>
            </View>

            {/* NEW SCAN */}

            <Pressable
              style={styles.primaryButton}
              onPress={retakePhoto}
            >
              <Icon name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                Start another skin scan
              </Text>
            </Pressable>
          </>
        )}

        {/* WATERMARK */}

        <View style={styles.watermark}>
          <View style={styles.watermarkLine} />

          <View style={styles.watermarkBrand}>
            <Icon name="sparkles" size={13} color={C.pink} />
            <Text style={styles.watermarkText}>
              Developed &amp; Engineered by Vaishnavi Hurnaum
            </Text>
          </View>

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
    backgroundColor: C.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 48 : 55,
    paddingBottom: 65,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 7,
  },

  brandDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.pink,
  },

  eyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: C.pinkDeep,
  },

  title: {
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -1,
    color: C.ink,
  },

  headerSubtitle: {
    fontSize: 12,
    color: C.muted,
    marginTop: 5,
  },

  headerBadge: {
    width: 49,
    height: 49,
    borderRadius: 18,
    backgroundColor: C.pinkSoft,
    borderWidth: 1,
    borderColor: '#F4C6D9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.pink,
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 3,
  },

  stepContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 23,
    paddingHorizontal: 8,
  },

  stepItem: {
    alignItems: 'center',
    gap: 7,
  },

  stepDot: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  stepDotActive: {
    borderColor: C.pink,
    backgroundColor: C.pinkSoft,
  },

  stepDotInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.pinkDeep,
  },

  stepNumber: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '700',
  },

  stepLabel: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '600',
  },

  stepLabelActive: {
    color: C.pinkDeep,
    fontWeight: '800',
  },

  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 17,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F5E0E9',
    marginBottom: 22,
    gap: 13,
    shadowColor: C.pink,
    shadowOpacity: 0.07,
    shadowRadius: 15,
    elevation: 2,
  },

  heroIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.pinkSoft,
  },

  heroTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: C.ink,
    marginBottom: 5,
  },

  heroDescription: {
    fontSize: 10,
    lineHeight: 16,
    color: C.muted,
  },

  modeSelector: {
    gap: 11,
    marginBottom: 17,
  },

  modeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 15,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.pink,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  modeCardActive: {
    backgroundColor: '#FFF5F9',
    borderColor: '#E7A3C1',
    borderWidth: 1.5,
    shadowColor: C.pink,
    shadowOpacity: 0.13,
    shadowRadius: 14,
    elevation: 3,
  },

  modeIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: C.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modeIconActive: {
    backgroundColor: C.pinkDeep,
  },

  modeCardText: {
    flex: 1,
  },

  modeCardTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: C.ink,
    marginBottom: 5,
  },

  modeCardDescription: {
    fontSize: 10,
    lineHeight: 16,
    color: C.muted,
  },

  modeCardMeta: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    color: C.pinkDeep,
    marginTop: 8,
  },

  modeRadio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#DCCBD4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },

  modeRadioActive: {
    borderColor: C.pinkDeep,
  },

  modeRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.pinkDeep,
  },

  areaSelector: {
    padding: 15,
    marginBottom: 20,
  },

  areaTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: C.ink,
  },

  areaSubtitle: {
    fontSize: 9,
    color: C.muted,
    marginTop: 5,
  },

  areaOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 13,
  },

  areaChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFFFFF',
  },

  areaChipActive: {
    backgroundColor: C.pinkDeep,
    borderColor: C.pinkDeep,
  },

  areaChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: C.muted,
  },

  areaChipTextActive: {
    color: '#FFFFFF',
  },

  cameraWrap: {
    position: 'relative',
    marginBottom: 26,
  },

  cameraAuraOuter: {
    position: 'absolute',
    top: 9,
    bottom: -11,
    left: 11,
    right: 11,
    borderRadius: 34,
    backgroundColor: '#F2A5C7',
    shadowColor: '#E979AA',
    shadowOpacity: 0.7,
    shadowRadius: 25,
    elevation: 9,
  },

  cameraAuraInner: {
    position: 'absolute',
    top: 2,
    bottom: -4,
    left: 3,
    right: 3,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#F8B9D4',
  },

  cameraEdge: {
    padding: 3,
    borderRadius: 27,
    backgroundColor: '#F3B9D2',
    shadowColor: C.pinkDeep,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 7,
  },

  cameraFrame: {
    height: 405,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: C.dark,
  },

  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 15,
    justifyContent: 'space-between',
  },

  cameraTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(24,17,25,0.62)',
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF739E',
  },

  liveText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  flipButton: {
    width: 41,
    height: 41,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24,17,25,0.62)',
  },

  faceGuide: {
    width: '76%',
    height: 270,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },

  textureGuide: {
    width: '65%',
    height: 215,
  },

  guideCornerTL: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 39,
    height: 39,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#FFFFFF',
    borderTopLeftRadius: 15,
  },

  guideCornerTR: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 39,
    height: 39,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#FFFFFF',
    borderTopRightRadius: 15,
  },

  guideCornerBL: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 39,
    height: 39,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#FFFFFF',
    borderBottomLeftRadius: 15,
  },

  guideCornerBR: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 39,
    height: 39,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#FFFFFF',
    borderBottomRightRadius: 15,
  },

  guideCenter: {
    alignItems: 'center',
    gap: 14,
  },

  guideFaceCircle: {
    width: 145,
    height: 190,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.75)',
    borderRadius: 85,
  },

  textureTarget: {
    width: 135,
    height: 135,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  textureTargetInner: {
    width: 75,
    height: 75,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },

  guideText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowRadius: 7,
    textAlign: 'center',
  },

  cameraBottom: {
    alignItems: 'center',
  },

  cameraHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(24,17,25,0.65)',
  },

  cameraHint: {
    fontSize: 9,
    color: '#FFFFFF',
    flexShrink: 1,
  },

  captureArea: {
    alignItems: 'center',
    marginBottom: 29,
  },

  captureInstruction: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 17,
  },

  captureOuter: {
    width: 83,
    height: 83,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: C.pink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: C.pink,
    shadowOpacity: 0.35,
    shadowRadius: 17,
    elevation: 7,
  },

  captureInner: {
    width: 65,
    height: 65,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.pinkSoft,
  },

  captureHint: {
    color: C.muted,
    fontSize: 10,
    marginTop: 12,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 14,
    gap: 10,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: C.ink,
  },

  sectionSubtitle: {
    fontSize: 10,
    lineHeight: 15,
    color: C.muted,
    marginTop: 5,
  },

  sectionRight: {
    fontSize: 8,
    fontWeight: '900',
    color: C.pinkDeep,
    letterSpacing: 0.7,
  },

  guidanceGrid: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 19,
  },

  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 19,
    shadowColor: '#DDA5BF',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },

  guidanceCard: {
    flex: 1,
    padding: 12,
  },

  guidanceIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: C.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },

  guidanceTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: C.ink,
  },

  guidanceDescription: {
    fontSize: 9,
    lineHeight: 14,
    color: C.muted,
    marginTop: 4,
  },

  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.mintSoft,
    borderWidth: 1,
    borderColor: '#D7EDE3',
    marginBottom: 18,
  },

  noticeText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    color: '#668F7D',
  },

  previewGlow: {
    padding: 3,
    borderRadius: 25,
    backgroundColor: '#F3BDD3',
    shadowColor: C.pink,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
    marginBottom: 17,
  },

  previewFrame: {
    height: 390,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: C.dark,
  },

  previewImage: {
    width: '100%',
    height: '100%',
  },

  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(231,129,174,0.08)',
  },

  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#FF8FBB',
    shadowColor: '#FF8FBB',
    shadowOpacity: 1,
    shadowRadius: 13,
    elevation: 8,
  },

  previewTopBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(45,25,38,0.75)',
  },

  previewBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.pink,
  },

  previewBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },

  previewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 12,
    marginBottom: 13,
  },

  previewInfoIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: C.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  previewInfoTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: C.ink,
  },

  previewInfoDescription: {
    fontSize: 10,
    lineHeight: 15,
    color: C.muted,
    marginTop: 4,
  },

  selectedModeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 13,
    borderRadius: 14,
    backgroundColor: C.pinkSoft,
    marginBottom: 17,
  },

  selectedModeSummaryText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    color: C.pinkDeep,
  },

  previewActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },

  primaryButton: {
    minHeight: 51,
    paddingHorizontal: 17,
    borderRadius: 16,
    backgroundColor: C.pinkDeep,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    shadowColor: C.pinkDeep,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  secondaryButton: {
    minHeight: 51,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: C.pinkSoft,
    borderWidth: 1,
    borderColor: '#F0C4D7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  secondaryButtonText: {
    color: C.pinkDeep,
    fontSize: 11,
    fontWeight: '900',
  },

  processingCard: {
    padding: 22,
    alignItems: 'center',
    gap: 11,
  },

  processingTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: C.ink,
  },

  processingDescription: {
    fontSize: 10,
    color: C.muted,
    textAlign: 'center',
  },

  simulationLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: C.pinkDeep,
    letterSpacing: 1.1,
    marginTop: 5,
  },

  reportHero: {
    padding: 21,
    borderRadius: 23,
    backgroundColor: '#9D5579',
    marginBottom: 16,
    overflow: 'hidden',
  },

  reportHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  reportHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  demoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFE5A9',
  },

  demoBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.9,
  },

  reportEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    color: '#F9DCE9',
    letterSpacing: 1.3,
  },

  reportTitle: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 7,
  },

  reportDescription: {
    fontSize: 10,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.84)',
    marginTop: 10,
  },

  reportDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 15,
  },

  reportDateText: {
    fontSize: 9,
    color: '#F9DCE9',
  },

  scanInfoCard: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },

  scanInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scanInfoLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
    color: C.muted,
  },

  scanInfoTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: C.ink,
    marginTop: 4,
  },

  scanInfoSubtitle: {
    fontSize: 9,
    color: C.muted,
    marginTop: 3,
  },

  scoreCard: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  scoreLeft: {
    flex: 1,
  },

  scoreLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
    color: C.muted,
  },

  scoreNumber: {
    fontSize: 39,
    fontWeight: '900',
    color: C.pinkDeep,
    marginTop: 7,
  },

  scoreOutOf: {
    fontSize: 13,
    color: C.muted,
  },

  scoreStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },

  scoreStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.mint,
  },

  scoreStatusText: {
    fontSize: 9,
    color: C.muted,
  },

  scoreFootnote: {
    fontSize: 8,
    color: C.pinkDeep,
    marginTop: 8,
  },

  ringContainer: {
    width: 112,
    height: 112,
    justifyContent: 'center',
    alignItems: 'center',
  },

  ringCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },

  ringCenterText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
    color: C.muted,
  },

  profileGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },

  profileCard: {
    flex: 1,
    padding: 15,
  },

  profileCardIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: C.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  profileLabel: {
    fontSize: 7,
    fontWeight: '900',
    color: C.muted,
    letterSpacing: 0.7,
  },

  profileType: {
    fontSize: 20,
    fontWeight: '900',
    color: C.pinkDeep,
    marginTop: 6,
  },

  profileDescription: {
    fontSize: 9,
    lineHeight: 14,
    color: C.muted,
    marginTop: 5,
  },

  metricsCard: {
    padding: 16,
    gap: 20,
    marginBottom: 15,
  },

  metricContainer: {
    gap: 8,
  },

  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  metricName: {
    fontSize: 11,
    fontWeight: '800',
    color: C.ink,
    flex: 1,
  },

  metricScore: {
    fontSize: 12,
    fontWeight: '900',
    color: C.pinkDeep,
  },

  progressTrack: {
    height: 7,
    borderRadius: 5,
    backgroundColor: '#F4EAF0',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 5,
  },

  metricDescription: {
    fontSize: 9,
    color: C.muted,
  },

  detailCard: {
    paddingHorizontal: 15,
    marginBottom: 16,
  },

  metricDetail: {
    paddingVertical: 14,
  },

  metricDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  metricDetailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  metricDetailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  metricDetailTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.ink,
  },

  metricDetailToggle: {
    fontSize: 19,
    color: C.pinkDeep,
    fontWeight: '700',
  },

  metricDetailDescription: {
    fontSize: 10,
    lineHeight: 17,
    color: C.muted,
    marginTop: 11,
  },

  detailDivider: {
    height: 1,
    backgroundColor: C.border,
  },

  observationsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 15,
    marginBottom: 16,
  },

  observationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 11,
  },

  observationIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },

  observationCopy: {
    flex: 1,
  },

  observationHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 7,
  },

  observationTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    color: C.ink,
  },

  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },

  levelBadgeText: {
    fontSize: 8,
    fontWeight: '900',
  },

  observationDescription: {
    fontSize: 9,
    lineHeight: 15,
    color: C.muted,
    marginTop: 6,
  },

  routineCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },

  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  routineTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: C.ink,
  },

  routineSubtitle: {
    fontSize: 9,
    color: C.muted,
    marginTop: 4,
  },

  routineBadge: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: C.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  routineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 21,
  },

  routineNumber: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.pinkSoft,
  },

  routineNumberText: {
    fontSize: 10,
    fontWeight: '900',
    color: C.pinkDeep,
  },

  routineCopy: {
    flex: 1,
  },

  routineCategory: {
    fontSize: 8,
    fontWeight: '900',
    color: C.pinkDeep,
    letterSpacing: 0.9,
    marginBottom: 4,
  },

  routineItemTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: C.ink,
  },

  routineDescription: {
    fontSize: 9,
    lineHeight: 15,
    color: C.muted,
    marginTop: 5,
  },

  routineTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
  },

  routineTimeText: {
    fontSize: 8,
    color: C.muted,
  },

  routineSplit: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 17,
  },

  routineSplitCard: {
    flex: 1,
    padding: 15,
  },

  routineSplitIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: C.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },

  routineSplitTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: C.ink,
  },

  routineSplitText: {
    fontSize: 9,
    lineHeight: 15,
    color: C.muted,
    marginTop: 6,
  },

  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
    backgroundColor: C.mintSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5EDE2',
    marginBottom: 12,
  },

  savedIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  savedTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#4F927B',
  },

  savedDescription: {
    fontSize: 9,
    lineHeight: 14,
    color: '#719888',
    marginTop: 4,
  },

  syncCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 14,
    backgroundColor: C.pinkSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0D5E1',
    marginBottom: 15,
  },

  syncCardSuccess: {
    backgroundColor: C.mintSoft,
    borderColor: '#D5EDE2',
  },

  syncCardError: {
    backgroundColor: C.amberSoft,
    borderColor: '#F3E4C9',
  },

  syncIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  syncTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: C.ink,
  },

  syncDescription: {
    fontSize: 9,
    lineHeight: 14,
    color: C.muted,
    marginTop: 4,
  },

  retrySyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 9,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },

  retrySyncText: {
    fontSize: 9,
    fontWeight: '900',
    color: C.pinkDeep,
  },

  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 15,
    borderRadius: 17,
    backgroundColor: C.amberSoft,
    borderWidth: 1,
    borderColor: '#F3E4C9',
    marginBottom: 20,
  },

  disclaimerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#A77B3E',
    marginBottom: 6,
  },

  disclaimerText: {
    fontSize: 9,
    lineHeight: 16,
    color: '#967B5B',
  },

  permissionScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.background,
    padding: 30,
  },

  permissionGlow: {
    width: 82,
    height: 82,
    borderRadius: 27,
    backgroundColor: C.pinkSoft,
    borderWidth: 1,
    borderColor: '#F3BDD3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: C.pink,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 5,
  },

  permissionTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: C.ink,
    marginBottom: 10,
  },

  permissionText: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    color: C.muted,
    marginBottom: 22,
  },

  watermark: {
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 8,
  },

  watermarkLine: {
    width: 38,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#EABBD0',
    marginBottom: 13,
  },

  watermarkBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  watermarkText: {
    fontSize: 9,
    fontWeight: '800',
    color: C.muted,
    letterSpacing: 0.25,
    textAlign: 'center',
  },

  watermarkSubtext: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: C.pinkDeep,
    marginTop: 7,
  },
});
