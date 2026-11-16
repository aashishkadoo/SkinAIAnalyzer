
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { theme } from '../constants/theme';

// ======================================================
// TYPES
// ======================================================

export interface SkinAnalysisSummary {
  skinType?: string;
  concerns?: string[];
  confidence?: number;
  analyzedAt?: string;
}

interface ShopScreenProps {
  analysis?: SkinAnalysisSummary | null;
}

type Category =
  | 'All'
  | 'Cleansers'
  | 'Serums'
  | 'Moisturisers'
  | 'Sunscreen'
  | 'Treatments'
  | 'Eye Care';

interface Product {
  id: string;
  name: string;
  brand: string;
  category: Exclude<Category, 'All'>;
  image: string | null;
  ingredients: string;
  description: string;
  barcode: string;
  productUrl: string;
  quantity: string;
  countries: string;
  lastUpdated: string;
}

interface OpenBeautyFactsProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
  ingredients_text?: string;
  categories?: string;
  generic_name?: string;
  quantity?: string;
  countries?: string;
  url?: string;
  last_modified_t?: number;
}

interface OpenBeautyFactsResponse {
  count?: number;
  page?: number;
  page_count?: number;
  products?: OpenBeautyFactsProduct[];
}

// ======================================================
// API CONFIGURATION
// ======================================================

const API_BASE_URL =
  'https://world.openbeautyfacts.org/cgi/search.pl';

const API_FIELDS = [
  'code',
  'product_name',
  'brands',
  'image_front_url',
  'image_url',
  'ingredients_text',
  'categories',
  'generic_name',
  'quantity',
  'countries',
  'url',
  'last_modified_t',
].join(',');

const API_SEARCH_TERMS = [
  'face cleanser',
  'facial serum',
  'face moisturiser',
  'sunscreen',
  'face cream',
  'skin treatment',
];

const CATEGORIES: Category[] = [
  'All',
  'Cleansers',
  'Serums',
  'Moisturisers',
  'Sunscreen',
  'Treatments',
  'Eye Care',
];

const CONCERNS = [
  { label: 'Acne & Blemishes', value: 'Acne', icon: '◉' },
  { label: 'Dark Spots', value: 'Dark spots', icon: '✦' },
  { label: 'Dryness', value: 'Dryness', icon: '◌' },
  { label: 'Redness', value: 'Redness', icon: '♡' },
  { label: 'Oily Skin', value: 'Oiliness', icon: '◍' },
  { label: 'Uneven Texture', value: 'Texture', icon: '◇' },
  { label: 'Sensitivity', value: 'Sensitivity', icon: '❀' },
  { label: 'Fine Lines', value: 'Fine lines', icon: '⌁' },
  { label: 'Dark Circles', value: 'Dark circles', icon: '◎' },
  { label: 'Dehydration', value: 'Dehydration', icon: '◉' },
];

// ======================================================
// API HELPERS
// ======================================================

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function classifyCategory(
  product: OpenBeautyFactsProduct,
): Exclude<Category, 'All'> {
  const text = normalise(
    `${product.product_name ?? ''} ${product.categories ?? ''} ${
      product.generic_name ?? ''
    }`,
  );

  if (/sunscreen|sun screen|sun protection|sunblock|spf/.test(text)) {
    return 'Sunscreen';
  }

  if (/cleanser|cleansing|face wash|facial wash|make-up remover/.test(text)) {
    return 'Cleansers';
  }

  if (/serum|ampoule|concentrate|face oil/.test(text)) {
    return 'Serums';
  }

  if (/eye cream|eye contour|eye gel|dark circle/.test(text)) {
    return 'Eye Care';
  }

  if (
    /moisturi[sz]er|hydrating cream|face cream|night cream|day cream|barrier cream/.test(
      text,
    )
  ) {
    return 'Moisturisers';
  }

  return 'Treatments';
}

function mapProduct(
  item: OpenBeautyFactsProduct,
): Product | null {
  const name = item.product_name?.trim();

  if (!name || !item.code) {
    return null;
  }

  const image =
    item.image_front_url ||
    item.image_url ||
    null;

  return {
    id: item.code,
    barcode: item.code,
    name,
    brand: item.brands?.trim() || 'Brand not listed',
    category: classifyCategory(item),
    image,
    ingredients: item.ingredients_text?.trim() || '',
    description:
      item.generic_name?.trim() ||
      item.categories?.trim() ||
      'Product information supplied by Open Beauty Facts.',
    productUrl:
      item.url ||
      `https://world.openbeautyfacts.org/product/${item.code}`,
    quantity: item.quantity?.trim() || '',
    countries: item.countries?.trim() || '',
    lastUpdated: item.last_modified_t
      ? new Date(item.last_modified_t * 1000).toLocaleDateString()
      : '',
  };
}

async function searchOpenBeautyFacts(
  searchTerm: string,
): Promise<Product[]> {
  const params = new URLSearchParams({
    search_terms: searchTerm,
    search_simple: '1',
    action: 'process',
    json: '1',
    page: '1',
    page_size: '30',
    fields: API_FIELDS,
  });

  const response = await fetch(
    `${API_BASE_URL}?${params.toString()}`,
    {
      headers: {
        'User-Agent': 'SkinAIAnalyzer/1.0',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Product API returned ${response.status}`);
  }

  const data: OpenBeautyFactsResponse = await response.json();

  return (data.products ?? [])
    .map(mapProduct)
    .filter((product): product is Product => product !== null);
}

async function fetchCatalogue(): Promise<Product[]> {
  const responses = await Promise.all(
    API_SEARCH_TERMS.map((term) =>
      searchOpenBeautyFacts(term),
    ),
  );

  const uniqueProducts = new Map<string, Product>();

  responses.flat().forEach((product) => {
    if (!uniqueProducts.has(product.id)) {
      uniqueProducts.set(product.id, product);
    }
  });

  return Array.from(uniqueProducts.values());
}

// ======================================================
// PRODUCT MATCHING
// ======================================================

const CONCERN_KEYWORDS: Record<string, string[]> = {
  acne: [
    'salicylic acid',
    'niacinamide',
    'acne',
    'blemish',
    'zinc',
    'tea tree',
  ],
  'dark spots': [
    'vitamin c',
    'ascorbic acid',
    'niacinamide',
    'alpha arbutin',
    'kojic acid',
    'brightening',
  ],
  dryness: [
    'glycerin',
    'ceramide',
    'squalane',
    'shea butter',
    'hyaluronic acid',
    'moistur',
  ],
  redness: [
    'centella',
    'panthenol',
    'allantoin',
    'madecassoside',
    'soothing',
  ],
  oiliness: [
    'niacinamide',
    'salicylic acid',
    'zinc',
    'oil control',
    'sebum',
  ],
  texture: [
    'glycolic acid',
    'lactic acid',
    'pha',
    'aha',
    'bha',
    'retinol',
  ],
  sensitivity: [
    'ceramide',
    'panthenol',
    'allantoin',
    'centella',
    'fragrance-free',
  ],
  'fine lines': [
    'retinol',
    'hyaluronic acid',
    'peptide',
    'vitamin c',
  ],
  'dark circles': [
    'caffeine',
    'hyaluronic acid',
    'vitamin c',
  ],
  dehydration: [
    'hyaluronic acid',
    'glycerin',
    'panthenol',
    'sodium hyaluronate',
  ],
};

function getProductSearchText(product: Product): string {
  return normalise(
    [
      product.name,
      product.brand,
      product.category,
      product.ingredients,
      product.description,
    ].join(' '),
  );
}

function getMatchScore(
  product: Product,
  concerns: string[],
): number {
  if (!concerns.length) return 0;

  const searchableText = getProductSearchText(product);

  let score = 0;

  concerns.forEach((concern) => {
    const key = normalise(concern);

    const keywords =
      CONCERN_KEYWORDS[key] ??
      [key];

    const matches = keywords.some((keyword) =>
      searchableText.includes(normalise(keyword)),
    );

    if (matches) {
      score += 1;
    }
  });

  return score;
}

function getIngredientPreview(ingredients: string): string {
  if (!ingredients) {
    return 'Ingredient information unavailable';
  }

  return ingredients.length > 90
    ? `${ingredients.slice(0, 87)}...`
    : ingredients;
}

// ======================================================
// REUSABLE UI COMPONENTS
// ======================================================

function SectionTitle({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>

      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ProductImage({
  uri,
}: {
  uri: string | null;
}) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={styles.imageFallback}>
        <Text style={styles.imageFallbackIcon}>✧</Text>
        <Text style={styles.imageFallbackText}>
          Image unavailable
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.productImageActual}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

function ProductCard({
  product,
  saved,
  matchScore,
  onToggleSave,
  onPress,
}: {
  product: Product;
  saved: boolean;
  matchScore?: number;
  onToggleSave: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.productCard,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.productImageContainer}>
        <ProductImage uri={product.image} />

        <View style={styles.productCategoryBadge}>
          <Text style={styles.productCategoryBadgeText}>
            {product.category.toUpperCase()}
          </Text>
        </View>

        {matchScore && matchScore > 0 ? (
          <View style={styles.matchBadge}>
            <Text style={styles.matchBadgeText}>
              {matchScore} MATCH{matchScore > 1 ? 'ES' : ''}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            saved ? 'Remove from favourites' : 'Add to favourites'
          }
          onPress={onToggleSave}
          style={styles.favoriteButton}
        >
          <Text style={styles.favoriteIcon}>
            {saved ? '♥' : '♡'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productBrand} numberOfLines={1}>
          {product.brand}
        </Text>

        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>

        <Text style={styles.productIngredient} numberOfLines={2}>
          {getIngredientPreview(product.ingredients)}
        </Text>

        <View style={styles.productBottom}>
          <Text style={styles.productBarcode}>
            ID {product.barcode}
          </Text>
          <Text style={styles.viewProduct}>View →</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ConcernCard({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.concernCard,
        selected && styles.concernCardSelected,
      ]}
    >
      <Text style={styles.concernIcon}>{icon}</Text>
      <Text
        style={[
          styles.concernLabel,
          selected && styles.concernLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ======================================================
// MAIN SHOP SCREEN
// ======================================================

export default function ShopScreen({
  analysis,
}: ShopScreenProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] =
    useState<Category>('All');

  const [activeConcern, setActiveConcern] =
    useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [savedProducts, setSavedProducts] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  const [question, setQuestion] = useState('');

  // --------------------------------------------------
  // LOAD REAL PRODUCT CATALOGUE
  // --------------------------------------------------

  const loadProducts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setApiError(null);

      const catalogue = await fetchCatalogue();

      setProducts(catalogue);

      if (catalogue.length === 0) {
        setApiError(
          'The product database returned no matching products. Try refreshing later.',
        );
      }
    } catch (error) {
      console.error('Open Beauty Facts error:', error);

      setApiError(
        'Unable to connect to the product catalogue. Check your internet connection and try again.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // --------------------------------------------------
  // SKIN PROFILE
  // --------------------------------------------------

  const hasAnalysis = Boolean(
    analysis &&
      (analysis.skinType ||
        (analysis.concerns && analysis.concerns.length > 0)),
  );

  const skinType = analysis?.skinType || 'Not analysed';

  const analysisConcerns = analysis?.concerns ?? [];

  // --------------------------------------------------
  // RECOMMENDATIONS
  // --------------------------------------------------

  const recommendedProducts = useMemo(() => {
    if (!hasAnalysis || analysisConcerns.length === 0) {
      return products.slice(0, 4);
    }

    return products
      .map((product) => ({
        product,
        score: getMatchScore(product, analysisConcerns),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.product);
  }, [products, hasAnalysis, analysisConcerns]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (activeCategory !== 'All') {
      result = result.filter(
        (product) => product.category === activeCategory,
      );
    }

    if (activeConcern) {
      result = result.filter(
        (product) =>
          getMatchScore(product, [activeConcern]) > 0,
      );
    }

    if (showSavedOnly) {
      result = result.filter((product) =>
        savedProducts.includes(product.id),
      );
    }

    if (search.trim()) {
      const query = normalise(search);

      result = result.filter((product) =>
        getProductSearchText(product).includes(query),
      );
    }

    return result;
  }, [
    products,
    activeCategory,
    activeConcern,
    showSavedOnly,
    savedProducts,
    search,
  ]);

  // --------------------------------------------------
  // PRODUCT ACTIONS
  // --------------------------------------------------

  const toggleSaved = (id: string) => {
    setSavedProducts((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const openProduct = (product: Product) => {
    const ingredients = product.ingredients
      ? product.ingredients
      : 'Ingredient list has not been supplied by the database.';

    const details = [
      product.brand,
      '',
      `Category: ${product.category}`,
      product.quantity ? `Size: ${product.quantity}` : '',
      '',
      'INGREDIENTS',
      ingredients,
      '',
      `Barcode: ${product.barcode}`,
      '',
      'Product information is provided by Open Beauty Facts. Verify the packaging and ingredients before use.',
    ]
      .filter((line) => line !== undefined)
      .join('\n');

    Alert.alert(
      product.name,
      details,
      [
        {
          text: 'Close',
          style: 'cancel',
        },
        {
          text: savedProducts.includes(product.id)
            ? 'Remove favourite'
            : 'Save product',
          onPress: () => toggleSaved(product.id),
        },
        {
          text: 'Open product source',
          onPress: () => {
            Linking.openURL(product.productUrl).catch(() => {
              Alert.alert(
                'Unable to open product',
                'Please try opening the product source in your browser.',
              );
            });
          },
        },
      ],
    );
  };

  // --------------------------------------------------
  // FILTER ACTIONS
  // --------------------------------------------------

  const clearFilters = () => {
    setActiveCategory('All');
    setActiveConcern(null);
    setSearch('');
    setShowSavedOnly(false);
    setShowAllProducts(false);
  };

  const selectConcern = (concern: string) => {
    setActiveConcern((current) =>
      current === concern ? null : concern,
    );

    setShowSavedOnly(false);
    setShowAllProducts(true);
  };

  // --------------------------------------------------
  // DERMATOLOGIST DISCOVERY
  // --------------------------------------------------

  const findDermatologists = () => {
    const url =
      'https://www.google.com/maps/search/?api=1&query=dermatologist+near+me';

    Linking.openURL(url).catch(() => {
      Alert.alert(
        'Unable to open maps',
        'Please search for a registered dermatologist in your browser.',
      );
    });
  };

  const findOnlineDermatologists = () => {
    const url =
      'https://www.google.com/search?q=dermatologist+Mauritius+clinic';

    Linking.openURL(url).catch(() => {
      Alert.alert(
        'Unable to open search',
        'Please try again in your browser.',
      );
    });
  };

  // --------------------------------------------------
  // DERM GUIDE
  // --------------------------------------------------

  const askDermGuide = () => {
    if (!question.trim()) {
      Alert.alert(
        'Ask your Derm Guide',
        'Enter a skincare question first.',
      );
      return;
    }

    Alert.alert(
      'AI Derm Guide',
      'The interface is ready, but an AI service has not yet been connected. Connect your backend or AI provider to enable real responses.',
      [{ text: 'Understood' }],
    );
  };

  // --------------------------------------------------
  // INGREDIENT EDUCATION
  // --------------------------------------------------

  const ingredients = [
    {
      name: 'Niacinamide',
      description: 'Supports an even-looking complexion and skin barrier.',
      icon: '✦',
      color: '#F7EAF1',
    },
    {
      name: 'Hyaluronic Acid',
      description: 'Helps attract and retain moisture.',
      icon: '◌',
      color: '#E8F1FC',
    },
    {
      name: 'Vitamin C',
      description: 'An antioxidant used in brightening routines.',
      icon: '◉',
      color: '#FFF0E1',
    },
    {
      name: 'Ceramides',
      description: 'Help support the skin barrier.',
      icon: '❀',
      color: '#F6EAF0',
    },
  ];

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProducts(true)}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerEyebrow}>
              YOUR PERSONAL SKIN STUDIO
            </Text>

            <Text style={styles.headerTitle}>
              Discover your glow.
            </Text>

            <Text style={styles.headerSubtitle}>
              Real skincare products. Smarter discovery.
            </Text>
          </View>

          <Pressable
            onPress={() => {
              setShowSavedOnly((value) => !value);
              setActiveCategory('All');
              setActiveConcern(null);
              setShowAllProducts(true);
            }}
            style={[
              styles.headerFavorite,
              showSavedOnly && styles.headerFavoriteActive,
            ]}
          >
            <Text style={styles.headerFavoriteIcon}>
              {showSavedOnly ? '♥' : '♡'}
            </Text>

            <Text style={styles.favoriteCount}>
              {savedProducts.length}
            </Text>
          </Pressable>
        </View>

        {/* API STATUS */}

        <View style={styles.sourceBanner}>
          <View style={styles.sourceStatusDot} />

          <View style={{ flex: 1 }}>
            <Text style={styles.sourceTitle}>
              OPEN BEAUTY FACTS CATALOGUE
            </Text>
            <Text style={styles.sourceSubtitle}>
              Live product data · Real brands · Packaging images
            </Text>
          </View>

          <Pressable
            onPress={() => loadProducts(true)}
            hitSlop={10}
          >
            <Text style={styles.refreshText}>↻</Text>
          </Pressable>
        </View>

        {/* SKIN PROFILE */}

        <View style={styles.aiSummaryCard}>
          <View style={styles.aiSummaryTop}>
            <View style={styles.aiIcon}>
              <Text style={styles.aiIconText}>✦</Text>
            </View>

            <View style={styles.aiSummaryHeading}>
              <Text style={styles.aiSummaryEyebrow}>
                {hasAnalysis
                  ? 'CAMERA ANALYSIS CONNECTED'
                  : 'SKIN PROFILE'}
              </Text>

              <Text style={styles.aiSummaryTitle}>
                {hasAnalysis
                  ? 'Your skin profile'
                  : 'Discover your skin needs'}
              </Text>
            </View>

            <View style={styles.aiOnlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.aiOnlineText}>
                {hasAnalysis ? 'CONNECTED' : 'WAITING'}
              </Text>
            </View>
          </View>

          <Text style={styles.aiSummaryDescription}>
            {hasAnalysis
              ? 'Product suggestions are compared against the concerns supplied by your camera analysis.'
              : 'Complete a camera analysis to personalise product suggestions using your skin profile.'}
          </Text>

          <View style={styles.skinProfileRow}>
            <View style={styles.skinProfileItem}>
              <Text style={styles.skinProfileLabel}>
                SKIN TYPE
              </Text>

              <Text style={styles.skinProfileValue}>
                {skinType}
              </Text>
            </View>

            <View style={styles.skinProfileDivider} />

            <View style={styles.skinProfileItem}>
              <Text style={styles.skinProfileLabel}>
                FOCUS AREAS
              </Text>

              <Text style={styles.skinProfileValue}>
                {analysisConcerns.length} concerns
              </Text>
            </View>
          </View>

          {hasAnalysis && analysisConcerns.length > 0 ? (
            <View style={styles.aiConcernTags}>
              {analysisConcerns.slice(0, 5).map((concern) => (
                <View key={concern} style={styles.aiConcernTag}>
                  <Text style={styles.aiConcernTagText}>
                    {concern}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.demoDisclaimer}>
              No camera analysis has been supplied. Catalogue browsing is available.
            </Text>
          )}
        </View>

        {/* RECOMMENDATIONS */}

        <SectionTitle
          title="Picked for your skin"
          subtitle={
            hasAnalysis
              ? 'Products with ingredient matches for your profile'
              : 'Explore real products from the catalogue'
          }
          action="Explore all"
          onAction={() => {
            setActiveCategory('All');
            setActiveConcern(null);
            setShowSavedOnly(false);
            setShowAllProducts(true);
          }}
        />

        <View style={styles.recommendationBanner}>
          <View style={styles.recommendationBannerIcon}>
            <Text style={styles.recommendationSparkle}>✧</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.recommendationBannerTitle}>
              {hasAnalysis
                ? 'Ingredient-based profile matching'
                : 'Real product discovery'}
            </Text>

            <Text style={styles.recommendationBannerText}>
              {hasAnalysis
                ? 'Matches are based on recorded product ingredients and your supplied concerns.'
                : 'Browse actual products and their available ingredient lists.'}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
            />

            <Text style={styles.loadingText}>
              Discovering skincare products...
            </Text>

            <Text style={styles.loadingSubtext}>
              Connecting to Open Beauty Facts
            </Text>
          </View>
        ) : recommendedProducts.length > 0 ? (
          <View style={styles.productGrid}>
            {recommendedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                saved={savedProducts.includes(product.id)}
                matchScore={
                  hasAnalysis
                    ? getMatchScore(product, analysisConcerns)
                    : undefined
                }
                onToggleSave={() => toggleSaved(product.id)}
                onPress={() => openProduct(product)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyMatchCard}>
            <Text style={styles.emptyMatchTitle}>
              No ingredient matches found yet
            </Text>

            <Text style={styles.emptyMatchText}>
              The catalogue may not contain enough ingredient information to match your current profile. Browse the full collection instead.
            </Text>
          </View>
        )}

        {/* CONCERNS */}

        <SectionTitle
          title="Shop by skin concern"
          subtitle="Explore products based on specific skincare interests"
        />

        <View style={styles.concernGrid}>
          {CONCERNS.map((concern) => (
            <ConcernCard
              key={concern.value}
              icon={concern.icon}
              label={concern.label}
              selected={activeConcern === concern.value}
              onPress={() => selectConcern(concern.value)}
            />
          ))}
        </View>

        {/* ROUTINE BUILDER */}

        <SectionTitle
          title="Build your skincare routine"
          subtitle="Four simple steps to organise your daily care"
        />

        <View style={styles.routineCard}>
          <View style={styles.routineHeader}>
            <View>
              <Text style={styles.routineEyebrow}>
                YOUR DAILY RITUAL
              </Text>

              <Text style={styles.routineTitle}>
                The essentials
              </Text>
            </View>

            <Text style={styles.routineDecoration}>✧</Text>
          </View>

          {[
            {
              number: '01',
              title: 'Cleanse',
              description:
                'Gently remove dirt, oil and daily residue.',
              icon: '◌',
              color: '#E7F0F8',
              time: 'AM / PM',
            },
            {
              number: '02',
              title: 'Treat',
              description:
                'Choose a suitable serum or targeted treatment.',
              icon: '✦',
              color: '#F8EAF1',
              time: 'AM / PM',
            },
            {
              number: '03',
              title: 'Moisturise',
              description:
                'Support your skin barrier with moisturiser.',
              icon: '❀',
              color: '#EAF2E9',
              time: 'AM / PM',
            },
            {
              number: '04',
              title: 'Protect',
              description:
                'Use broad-spectrum SPF 30 or higher during the day.',
              icon: '☼',
              color: '#FFF0D9',
              time: 'AM',
            },
          ].map((step, index) => (
            <React.Fragment key={step.number}>
              <View style={styles.routineStep}>
                <View
                  style={[
                    styles.routineStepIcon,
                    { backgroundColor: step.color },
                  ]}
                >
                  <Text style={styles.routineEmoji}>
                    {step.icon}
                  </Text>
                </View>

                <View style={styles.routineStepCopy}>
                  <Text style={styles.routineStepTitle}>
                    {step.number} · {step.title}
                  </Text>

                  <Text style={styles.routineStepDescription}>
                    {step.description}
                  </Text>
                </View>

                <Text style={styles.routineTime}>
                  {step.time}
                </Text>
              </View>

              {index < 3 ? (
                <View style={styles.routineDivider} />
              ) : null}
            </React.Fragment>
          ))}

          <Text style={styles.routineNote}>
            Introduce active ingredients gradually. Avoid combining multiple strong treatments without appropriate guidance.
          </Text>
        </View>

        {/* AI DERM GUIDE */}

        <SectionTitle
          title="Your AI Derm Guide"
          subtitle="Skincare education and ingredient guidance"
        />

        <View style={styles.dermCard}>
          <View style={styles.dermCardHeader}>
            <View style={styles.dermAvatar}>
              <Text style={styles.dermAvatarText}>✦</Text>
            </View>

            <View style={styles.dermHeaderCopy}>
              <Text style={styles.dermTitle}>
                Skin knowledge, made simple.
              </Text>

              <Text style={styles.dermSubtitle}>
                AI skincare assistant · Integration pending
              </Text>
            </View>

            <View style={styles.dermBadge}>
              <Text style={styles.dermBadgeText}>AI</Text>
            </View>
          </View>

          <Text style={styles.dermDescription}>
            Ask general questions about ingredients, skincare routines, product compatibility and common skin concerns.
          </Text>

          <View style={styles.suggestedQuestions}>
            {[
              'What does niacinamide do?',
              'How should I layer skincare?',
              'What is a skin barrier?',
            ].map((item) => (
              <Pressable
                key={item}
                onPress={() => setQuestion(item)}
                style={styles.suggestedQuestion}
              >
                <Text style={styles.suggestedQuestionText}>
                  {item}
                </Text>

                <Text style={styles.suggestedArrow}>↗</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask a skincare question..."
            placeholderTextColor={theme.colors.textMuted}
            style={styles.questionInput}
            multiline
          />

          <Pressable
            onPress={askDermGuide}
            style={({ pressed }) => [
              styles.askButton,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.askButtonText}>
              Ask AI Derm Guide
            </Text>

            <Text style={styles.askButtonArrow}>→</Text>
          </Pressable>

          <View style={styles.aiMedicalNotice}>
            <Text style={styles.medicalNoticeIcon}>ⓘ</Text>

            <Text style={styles.medicalNoticeText}>
              This is an educational assistant interface, not a medical professional. It does not diagnose skin conditions or prescribe treatments.
            </Text>
          </View>
        </View>

        {/* DERMATOLOGISTS */}

        <SectionTitle
          title="Meet a real skin specialist"
          subtitle="Professional care when skincare products aren't enough"
        />

        <View style={styles.doctorCard}>
          <View style={styles.doctorIllustration}>
            <Text style={styles.doctorEmoji}>✚</Text>

            <View style={styles.doctorIllustrationSparkle}>
              <Text style={{ color: '#FFFFFF' }}>✦</Text>
            </View>
          </View>

          <Text style={styles.doctorEyebrow}>
            PROFESSIONAL SKINCARE
          </Text>

          <Text style={styles.doctorTitle}>
            Get advice from a dermatologist.
          </Text>

          <Text style={styles.doctorDescription}>
            Find skin specialists and clinics. Persistent acne, unexplained rashes, changing moles and ongoing skin irritation deserve professional assessment.
          </Text>

          <Pressable
            onPress={findDermatologists}
            style={styles.doctorPrimaryButton}
          >
            <Text style={styles.doctorPrimaryButtonText}>
              Find dermatologists near me
            </Text>

            <Text style={styles.doctorButtonArrow}>↗</Text>
          </Pressable>

          <Pressable
            onPress={findOnlineDermatologists}
            style={styles.doctorSecondaryButton}
          >
            <Text style={styles.doctorSecondaryButtonText}>
              Search dermatology clinics in Mauritius
            </Text>
          </Pressable>

          <Text style={styles.doctorDisclaimer}>
            External search results are not verified by this app. Check practitioner qualifications, registration and clinic details before booking.
          </Text>
        </View>

        {/* PRODUCT CATALOGUE */}

        <SectionTitle
          title="Explore the collection"
          subtitle="Real products from an open cosmetics database"
          action="Clear filters"
          onAction={clearFilters}
        />

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setShowAllProducts(true);
            }}
            placeholder="Search brands, products, ingredients..."
            placeholderTextColor={theme.colors.textMuted}
            style={styles.searchInput}
          />

          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')}>
              <Text style={styles.clearSearch}>×</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {CATEGORIES.map((category) => {
            const active = activeCategory === category;

            return (
              <Pressable
                key={category}
                onPress={() => {
                  setActiveCategory(category);
                  setShowSavedOnly(false);
                  setShowAllProducts(true);
                }}
                style={[
                  styles.categoryChip,
                  active && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {activeConcern ? (
          <View style={styles.activeFilter}>
            <Text style={styles.activeFilterText}>
              Concern: {activeConcern}
            </Text>

            <Pressable onPress={() => setActiveConcern(null)}>
              <Text style={styles.removeFilter}>×</Text>
            </Pressable>
          </View>
        ) : null}

        {showSavedOnly ? (
          <Text style={styles.resultsHeading}>
            YOUR SAVED PRODUCTS
          </Text>
        ) : (
          <Text style={styles.resultsHeading}>
            {filteredProducts.length} PRODUCTS FOUND
          </Text>
        )}

        {loading && products.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
            />
            <Text style={styles.loadingText}>
              Loading catalogue...
            </Text>
          </View>
        ) : apiError && products.length === 0 ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsIcon}>⌁</Text>

            <Text style={styles.noResultsTitle}>
              Catalogue unavailable
            </Text>

            <Text style={styles.noResultsDescription}>
              {apiError}
            </Text>

            <Pressable onPress={() => loadProducts()}>
              <Text style={styles.noResultsAction}>
                Try again
              </Text>
            </Pressable>
          </View>
        ) : filteredProducts.length > 0 ? (
          <>
            <View style={styles.productGrid}>
              {(showAllProducts
                ? filteredProducts
                : filteredProducts.slice(0, 6)
              ).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  saved={savedProducts.includes(product.id)}
                  matchScore={
                    activeConcern
                      ? getMatchScore(product, [activeConcern])
                      : undefined
                  }
                  onToggleSave={() => toggleSaved(product.id)}
                  onPress={() => openProduct(product)}
                />
              ))}
            </View>

            {!showAllProducts && filteredProducts.length > 6 ? (
              <Pressable
                onPress={() => setShowAllProducts(true)}
                style={styles.loadMoreButton}
              >
                <Text style={styles.loadMoreText}>
                  View all {filteredProducts.length} products
                </Text>

                <Text style={styles.loadMoreArrow}>↓</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View style={styles.noResults}>
            <Text style={styles.noResultsIcon}>⌕</Text>

            <Text style={styles.noResultsTitle}>
              No products found
            </Text>

            <Text style={styles.noResultsDescription}>
              Try another search term or remove some filters.
            </Text>

            <Pressable onPress={clearFilters}>
              <Text style={styles.noResultsAction}>
                Clear all filters
              </Text>
            </Pressable>
          </View>
        )}

        {/* INGREDIENT SPOTLIGHT */}

        <SectionTitle
          title="Ingredient spotlight"
          subtitle="Understand what goes into your skincare"
        />

        <View style={styles.ingredientGrid}>
          {ingredients.map((ingredient) => (
            <View
              key={ingredient.name}
              style={styles.ingredientCard}
            >
              <View
                style={[
                  styles.ingredientIcon,
                  { backgroundColor: ingredient.color },
                ]}
              >
                <Text style={styles.ingredientEmoji}>
                  {ingredient.icon}
                </Text>
              </View>

              <Text style={styles.ingredientName}>
                {ingredient.name}
              </Text>

              <Text style={styles.ingredientDescription}>
                {ingredient.description}
              </Text>
            </View>
          ))}
        </View>

        {/* DATA SOURCE NOTICE */}

        <View style={styles.dataSourceCard}>
          <Text style={styles.dataSourceTitle}>
            About the product data
          </Text>

          <Text style={styles.dataSourceText}>
            Product names, brands, images and ingredient lists are retrieved from Open Beauty Facts. The database is community-maintained, so some entries may be incomplete or outdated. Prices, retailer stock and local availability are not provided by this catalogue.
          </Text>

          <Pressable
            onPress={() =>
              Linking.openURL('https://world.openbeautyfacts.org/')
            }
          >
            <Text style={styles.dataSourceLink}>
              Visit Open Beauty Facts ↗
            </Text>
          </Pressable>
        </View>

        {/* FOOTER */}

        <View style={styles.footerNote}>
          <Text style={styles.footerNoteIcon}>♡</Text>

          <Text style={styles.footerNoteText}>
            Your skincare journey is personal. Introduce new products gradually, check ingredient lists and protect your skin from the sun.
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 90,
  },

  // Header

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  headerEyebrow: {
    color: theme.colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 7,
  },

  headerTitle: {
    color: theme.colors.text,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.8,
  },

  headerSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 5,
  },

  headerFavorite: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerFavoriteActive: {
    backgroundColor: '#FBEAF1',
    borderColor: '#EABBD0',
  },

  headerFavoriteIcon: {
    color: theme.colors.primary,
    fontSize: 22,
    lineHeight: 25,
  },

  favoriteCount: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },

  // API status

  sourceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8EDF2',
    borderWidth: 1,
    borderColor: '#EFD7E2',
    borderRadius: 15,
    padding: 12,
    marginBottom: 20,
  },

  sourceStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#43A77A',
    marginRight: 10,
  },

  sourceTitle: {
    color: theme.colors.primaryDeep,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  sourceSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 4,
  },

  refreshText: {
    color: theme.colors.primary,
    fontSize: 23,
    paddingHorizontal: 5,
  },

  // AI summary

  aiSummaryCard: {
    padding: 17,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryDeep,
    marginBottom: 29,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 15,
    elevation: 5,
  },

  aiSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  aiIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  aiIconText: {
    color: '#FFFFFF',
    fontSize: 24,
  },

  aiSummaryHeading: {
    flex: 1,
  },

  aiSummaryEyebrow: {
    color: '#F9D9E7',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },

  aiSummaryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  aiOnlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#B8F0CB',
    marginRight: 5,
  },

  aiOnlineText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '800',
  },

  aiSummaryDescription: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 15,
  },

  skinProfileRow: {
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.19)',
  },

  skinProfileItem: {
    flex: 1,
  },

  skinProfileDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 15,
  },

  skinProfileLabel: {
    color: '#F7D7E5',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },

  skinProfileValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  aiConcernTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
  },

  aiConcernTag: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  aiConcernTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
  },

  demoDisclaimer: {
    color: '#F7D7E5',
    fontSize: 9,
    marginTop: 13,
    fontStyle: 'italic',
  },

  // Sections

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
    marginTop: 3,
  },

  sectionHeadingCopy: {
    flex: 1,
  },

  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  sectionSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },

  sectionAction: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    paddingLeft: 8,
  },

  // Recommendation banner

  recommendationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 15,
    backgroundColor: '#F9EDF3',
    borderWidth: 1,
    borderColor: '#F0D6E2',
    marginBottom: 13,
  },

  recommendationBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#F2D8E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  recommendationSparkle: {
    color: theme.colors.primaryDeep,
    fontSize: 22,
  },

  recommendationBannerTitle: {
    color: theme.colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
  },

  recommendationBannerText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 3,
    lineHeight: 13,
  },

  // Product cards

  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 27,
  },

  productCard: {
    width: '48.2%',
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 13,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 2,
  },

  cardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },

  productImageContainer: {
    height: 150,
    backgroundColor: '#FBF6F8',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 10,
  },

  productImageActual: {
    width: '100%',
    height: '100%',
  },

  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F8EDF2',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },

  imageFallbackIcon: {
    color: theme.colors.primary,
    fontSize: 32,
  },

  imageFallbackText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 5,
  },

  productCategoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },

  productCategoryBadgeText: {
    color: theme.colors.primaryDeep,
    fontSize: 6,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  matchBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: theme.colors.primaryDeep,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },

  matchBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '800',
  },

  favoriteButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 31,
    height: 31,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  favoriteIcon: {
    color: theme.colors.primary,
    fontSize: 19,
    lineHeight: 22,
  },

  productInfo: {
    padding: 11,
  },

  productBrand: {
    color: theme.colors.primary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 5,
  },

  productName: {
    color: theme.colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    minHeight: 32,
  },

  productIngredient: {
    color: theme.colors.textMuted,
    fontSize: 9,
    lineHeight: 13,
    marginTop: 6,
    minHeight: 26,
  },

  productBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  productBarcode: {
    color: theme.colors.textMuted,
    fontSize: 7,
    fontWeight: '600',
  },

  viewProduct: {
    color: theme.colors.primary,
    fontSize: 9,
    fontWeight: '800',
  },

  // Empty states

  loadingContainer: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    marginBottom: 25,
    padding: 20,
  },

  loadingText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
  },

  loadingSubtext: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 5,
  },

  emptyMatchCard: {
    padding: 17,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 25,
  },

  emptyMatchTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },

  emptyMatchText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 7,
  },

  // Concerns

  concernGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  concernCard: {
    width: '23.5%',
    minHeight: 91,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
    marginBottom: 9,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  concernCardSelected: {
    backgroundColor: '#F9EAF1',
    borderColor: '#E8AFC8',
  },

  concernIcon: {
    color: theme.colors.primary,
    fontSize: 23,
    marginBottom: 7,
  },

  concernLabel: {
    color: theme.colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
  },

  concernLabelSelected: {
    color: theme.colors.primaryDeep,
  },

  // Routine

  routineCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 29,
  },

  routineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 13,
  },

  routineEyebrow: {
    color: theme.colors.primary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },

  routineTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
  },

  routineDecoration: {
    color: theme.colors.primary,
    fontSize: 28,
  },

  routineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },

  routineStepIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  routineEmoji: {
    color: theme.colors.primaryDeep,
    fontSize: 22,
  },

  routineStepCopy: {
    flex: 1,
  },

  routineStepTitle: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },

  routineStepDescription: {
    color: theme.colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  routineTime: {
    color: theme.colors.primary,
    fontSize: 8,
    fontWeight: '800',
    marginLeft: 5,
  },

  routineDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },

  routineNote: {
    color: theme.colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 13,
    fontStyle: 'italic',
  },

  // Derm Guide

  dermCard: {
    padding: 16,
    borderRadius: 21,
    backgroundColor: '#F8EAF1',
    borderWidth: 1,
    borderColor: '#EFD6E1',
    marginBottom: 29,
  },

  dermCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dermAvatar: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: theme.colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  dermAvatarText: {
    color: '#FFFFFF',
    fontSize: 25,
  },

  dermHeaderCopy: {
    flex: 1,
  },

  dermTitle: {
    color: theme.colors.primaryDeep,
    fontSize: 13,
    fontWeight: '800',
  },

  dermSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 4,
  },

  dermBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  dermBadgeText: {
    color: theme.colors.primary,
    fontSize: 9,
    fontWeight: '900',
  },

  dermDescription: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 13,
    marginBottom: 13,
  },

  suggestedQuestions: {
    gap: 7,
    marginBottom: 12,
  },

  suggestedQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },

  suggestedQuestionText: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '600',
  },

  suggestedArrow: {
    color: theme.colors.primary,
    fontSize: 14,
  },

  questionInput: {
    minHeight: 48,
    maxHeight: 100,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBD4DF',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 11,
    color: theme.colors.text,
    textAlignVertical: 'top',
  },

  askButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  askButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  askButtonArrow: {
    color: '#FFFFFF',
    fontSize: 17,
    marginLeft: 9,
  },

  aiMedicalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 13,
  },

  medicalNoticeIcon: {
    color: theme.colors.primary,
    fontSize: 13,
    marginRight: 7,
  },

  medicalNoticeText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
  },

  // Dermatologist discovery

  doctorCard: {
    padding: 17,
    borderRadius: 21,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 29,
  },

  doctorIllustration: {
    height: 95,
    borderRadius: 16,
    backgroundColor: '#EAF0F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    position: 'relative',
  },

  doctorEmoji: {
    color: theme.colors.primaryDeep,
    fontSize: 43,
    fontWeight: '800',
  },

  doctorIllustrationSparkle: {
    position: 'absolute',
    top: 15,
    right: 25,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  doctorEyebrow: {
    color: theme.colors.primary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },

  doctorTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },

  doctorDescription: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 8,
    marginBottom: 15,
  },

  doctorPrimaryButton: {
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: theme.colors.primaryDeep,
  },

  doctorPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  doctorButtonArrow: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 8,
  },

  doctorSecondaryButton: {
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E9B9CF',
    backgroundColor: '#FFF8FB',
    marginTop: 9,
    paddingHorizontal: 10,
  },

  doctorSecondaryButtonText: {
    color: theme.colors.primaryDeep,
    fontSize: 10,
    fontWeight: '800',
  },

  doctorDisclaimer: {
    color: theme.colors.textMuted,
    fontSize: 8,
    lineHeight: 13,
    marginTop: 12,
  },

  // Search and filters

  searchContainer: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 13,
  },

  searchIcon: {
    color: theme.colors.primary,
    fontSize: 24,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 11,
    paddingVertical: 10,
  },

  clearSearch: {
    color: theme.colors.textMuted,
    fontSize: 22,
    paddingHorizontal: 5,
  },

  categoryList: {
    gap: 8,
    paddingBottom: 13,
  },

  categoryChip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  categoryChipActive: {
    backgroundColor: theme.colors.primaryDeep,
    borderColor: theme.colors.primaryDeep,
  },

  categoryChipText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },

  categoryChipTextActive: {
    color: '#FFFFFF',
  },

  activeFilter: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9EAF1',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },

  activeFilterText: {
    color: theme.colors.primaryDeep,
    fontSize: 9,
    fontWeight: '700',
  },

  removeFilter: {
    color: theme.colors.primaryDeep,
    fontSize: 17,
    marginLeft: 9,
  },

  resultsHeading: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 2,
  },

  noResults: {
    alignItems: 'center',
    padding: 25,
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    marginBottom: 25,
  },

  noResultsIcon: {
    color: theme.colors.primary,
    fontSize: 29,
  },

  noResultsTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 9,
  },

  noResultsDescription: {
    color: theme.colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 5,
  },

  noResultsAction: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 13,
  },

  loadMoreButton: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E9B9CF',
    backgroundColor: '#FFF8FB',
    marginBottom: 29,
  },

  loadMoreText: {
    color: theme.colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
  },

  loadMoreArrow: {
    color: theme.colors.primary,
    fontSize: 15,
    marginLeft: 8,
  },

  // Ingredients

  ingredientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  ingredientCard: {
    width: '48.2%',
    padding: 13,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
  },

  ingredientIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  ingredientEmoji: {
    color: theme.colors.primaryDeep,
    fontSize: 22,
  },

  ingredientName: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },

  ingredientDescription: {
    color: theme.colors.textMuted,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 5,
  },

  // Data source

  dataSourceCard: {
    padding: 14,
    borderRadius: 15,
    backgroundColor: '#F8EDF2',
    borderWidth: 1,
    borderColor: '#F0DCE5',
    marginBottom: 13,
  },

  dataSourceTitle: {
    color: theme.colors.primaryDeep,
    fontSize: 11,
    fontWeight: '800',
  },

  dataSourceText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    lineHeight: 15,
    marginTop: 7,
  },

  dataSourceLink: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 10,
  },

  // Footer

  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 15,
    backgroundColor: '#F9EDF3',
    marginTop: 3,
  },

  footerNoteIcon: {
    color: theme.colors.primary,
    fontSize: 20,
    marginRight: 9,
  },

  footerNoteText: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: 9,
    lineHeight: 15,
  },

  watermark: {
    alignItems: 'center',
    paddingTop: 25,
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
