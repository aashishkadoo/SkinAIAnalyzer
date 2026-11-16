
import type { SkinAnalysisResult } from './skinAnalysisStorage';

export type AnalysisMode = 'overall' | 'texture';

type MetricDefinition = {
  name: string;
  description: string;
  color: string;
  min: number;
  max: number;
};

const METRICS: Record<AnalysisMode, MetricDefinition[]> = {
  overall: [
    {
      name: 'Hydration',
      description: 'Simulated hydration indicator',
      color: '#42A5F5',
      min: 45,
      max: 95,
    },
    {
      name: 'Skin texture',
      description: 'Simulated surface texture indicator',
      color: '#8E7CC3',
      min: 40,
      max: 95,
    },
    {
      name: 'Evenness',
      description: 'Simulated skin tone evenness indicator',
      color: '#E5A44D',
      min: 45,
      max: 95,
    },
    {
      name: 'Smoothness',
      description: 'Simulated smoothness indicator',
      color: '#4CAF87',
      min: 40,
      max: 95,
    },
  ],
  texture: [
    {
      name: 'Texture',
      description: 'Simulated surface texture indicator',
      color: '#8E7CC3',
      min: 40,
      max: 95,
    },
    {
      name: 'Pore appearance',
      description: 'Simulated pore appearance indicator',
      color: '#42A5F5',
      min: 35,
      max: 95,
    },
    {
      name: 'Smoothness',
      description: 'Simulated surface smoothness indicator',
      color: '#4CAF87',
      min: 40,
      max: 95,
    },
  ],
};

const CONCERNS = [
  {
    name: 'Dryness appearance',
    descriptions: [
      'A simulated indicator of visible dryness.',
      'The demonstration model suggests possible dryness.',
      'A variable dryness observation for this demonstration.',
    ],
  },
  {
    name: 'Uneven tone appearance',
    descriptions: [
      'A simulated observation of uneven-looking skin tone.',
      'A demonstration indicator of tone variation.',
      'A variable observation related to skin tone appearance.',
    ],
  },
  {
    name: 'Texture appearance',
    descriptions: [
      'A simulated observation of surface texture.',
      'A demonstration indicator of visible texture variation.',
      'A variable surface texture observation.',
    ],
  },
];

const RECOMMENDATIONS = [
  {
    title: 'Gentle cleansing',
    description: 'Use a gentle cleanser and avoid excessive washing.',
    category: 'Cleansing',
  },
  {
    title: 'Daily moisturising',
    description: 'Consider a moisturiser suitable for your skin type.',
    category: 'Hydration',
  },
  {
    title: 'Sun protection',
    description: 'Consider broad-spectrum SPF 30 or higher during daytime.',
    category: 'Protection',
  },
  {
    title: 'Consistent skincare',
    description: 'Keep a consistent routine and monitor changes over time.',
    category: 'Routine',
  },
  {
    title: 'Avoid harsh exfoliation',
    description: 'Avoid excessive exfoliation that may irritate the skin.',
    category: 'Care',
  },
  {
    title: 'Maintain hydration',
    description: 'Maintain regular fluid intake and moisturise when needed.',
    category: 'Hydration',
  },
];

function createRandomGenerator(seedText: string) {
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

function shuffle<T>(
  items: T[],
  random: () => number,
): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

export function generateSimulatedAnalysis(
  scanId: string,
  mode: AnalysisMode,
): SkinAnalysisResult {
  const random = createRandomGenerator(`${scanId}:${mode}`);

  const definitions = METRICS[mode];

  const metrics = definitions.map((definition) => ({
    name: definition.name,
    score: randomBetween(random, definition.min, definition.max),
    description: definition.description,
    color: definition.color,
  }));

  const overallScore = Math.round(
    metrics.reduce((total, metric) => total + metric.score, 0) /
      metrics.length,
  );

  const concerns = shuffle(CONCERNS, random)
    .slice(0, 2)
    .map((concern) => ({
      name: concern.name,
      level:
        random() > 0.65
          ? 'Moderate'
          : random() > 0.4
            ? 'Mild'
            : 'Low',
      color: '#D9A441',
    }));

  const recommendations = shuffle(RECOMMENDATIONS, random)
    .slice(0, 4)
    .map((item, index) => ({
      step: `Step ${index + 1}`,
      ...item,
    }));

  const skinTypeOptions = [
    'Normal',
    'Combination',
    'Dry',
    'Oily',
  ];

  const skinType =
    skinTypeOptions[
      Math.floor(random() * skinTypeOptions.length)
    ];

  return {
    overallScore,
    skinType,
    hydration:
      metrics.find((metric) => metric.name === 'Hydration')?.score ??
      metrics[0].score,
    skinHealth:
      overallScore >= 80
        ? 'High demonstration score'
        : overallScore >= 60
          ? 'Moderate demonstration score'
          : 'Developing demonstration score',
    summary:
      'This is a simulated demonstration report. Scores and observations are randomly generated from a scan-specific seed. They are not calculated from the photograph and are not a medical assessment.',
    metrics,
    concerns,
    recommendations,
    provider: 'Local simulation engine',
    model: 'SkinAI Demo v2',
  };
}
