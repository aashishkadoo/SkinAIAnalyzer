
// src/screens/SettingsScreen.tsx

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { decode } from 'base64-arraybuffer';

import { supabase } from '../lib/supabase';
import { useSession } from '../hooks/useSession';
import { theme } from '../constants/theme';

import {
  getAllScans,
  type SavedSkinScan,
} from '../services/skinAnalysisStorage';

// ======================================================
// TYPES
// ======================================================

type SkinType =
  | 'Normal'
  | 'Dry'
  | 'Oily'
  | 'Combination'
  | 'Sensitive';

type Preferences = {
  notifications: boolean;
  reminders: boolean;
  darkMode: boolean;
};

type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  skin_type: string | null;
  skin_concerns: string[] | null;
  avatar_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// ======================================================
// CONSTANTS
// ======================================================

const SKIN_TYPES: SkinType[] = [
  'Normal',
  'Dry',
  'Oily',
  'Combination',
  'Sensitive',
];

const SKIN_CONCERNS = [
  'Acne',
  'Dark spots',
  'Dryness',
  'Uneven texture',
  'Fine lines',
  'Visible pores',
  'Redness',
  'Oiliness',
  'Dullness',
  'Dark circles',
];

const DEFAULT_PREFERENCES: Preferences = {
  notifications: true,
  reminders: true,
  darkMode: false,
};

const PREFERENCES_PREFIX = 'skinai:settings:';

const colors = {
  background: theme.colors.background,
  surface: theme.colors.surface,
  text: theme.colors.text,
  muted: theme.colors.textMuted,
  primary: theme.colors.primary,
  primaryDeep: theme.colors.primaryDeep,
  primarySoft: theme.colors.primarySoft,
  border: theme.colors.border,
};

// ======================================================
// HELPERS
// ======================================================

function formatDate(date: string | null | undefined) {
  if (!date) return 'No scans yet';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return 'Unavailable';
  }

  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getAvatarInitial(name: string) {
  return name.trim()
    ? name.trim().charAt(0).toUpperCase()
    : 'S';
}

function isCompleted(status?: string | null) {
  return ['completed', 'done'].includes(
    status?.toLowerCase() ?? '',
  );
}

// ======================================================
// MAIN SCREEN
// ======================================================

export default function SettingsScreen() {
  const { user } = useSession();

  const userId = user?.id ?? null;
  const email = user?.email ?? '';

  // ----------------------------------------------------
  // STATE
  // ----------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [role, setRole] = useState('user');

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [skinType, setSkinType] = useState<SkinType | ''>('');
  const [skinConcerns, setSkinConcerns] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [scans, setScans] = useState<SavedSkinScan[]>([]);

  const [notifications, setNotifications] = useState(
    DEFAULT_PREFERENCES.notifications,
  );

  const [reminders, setReminders] = useState(
    DEFAULT_PREFERENCES.reminders,
  );

  const [darkMode, setDarkMode] = useState(
    DEFAULT_PREFERENCES.darkMode,
  );

  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const preferencesRef = useRef<Preferences>(DEFAULT_PREFERENCES);
  const activeUserRef = useRef<string | null>(userId);

  // ----------------------------------------------------
  // PREFERENCES
  // ----------------------------------------------------

  const loadPreferences = useCallback(async (id: string) => {
    try {
      const stored = await AsyncStorage.getItem(
        `${PREFERENCES_PREFIX}${id}`,
      );

      let parsed: Partial<Preferences> = {};

      if (stored) {
        parsed = JSON.parse(stored);
      }

      const next: Preferences = {
        notifications:
          typeof parsed.notifications === 'boolean'
            ? parsed.notifications
            : DEFAULT_PREFERENCES.notifications,

        reminders:
          typeof parsed.reminders === 'boolean'
            ? parsed.reminders
            : DEFAULT_PREFERENCES.reminders,

        darkMode:
          typeof parsed.darkMode === 'boolean'
            ? parsed.darkMode
            : DEFAULT_PREFERENCES.darkMode,
      };

      if (activeUserRef.current !== id) return;

      preferencesRef.current = next;

      setNotifications(next.notifications);
      setReminders(next.reminders);
      setDarkMode(next.darkMode);
    } catch (error) {
      console.warn('Unable to load settings preferences:', error);
    }
  }, []);

  const updatePreference = useCallback(
    async (key: keyof Preferences, value: boolean) => {
      if (!userId) {
        Alert.alert(
          'Not authenticated',
          'Please sign in before changing your preferences.',
        );
        return;
      }

      const next: Preferences = {
        ...preferencesRef.current,
        [key]: value,
      };

      preferencesRef.current = next;

      if (key === 'notifications') setNotifications(value);
      if (key === 'reminders') setReminders(value);
      if (key === 'darkMode') setDarkMode(value);

      try {
        await AsyncStorage.setItem(
          `${PREFERENCES_PREFIX}${userId}`,
          JSON.stringify(next),
        );
      } catch (error) {
        console.error('Unable to save preference:', error);

        Alert.alert(
          'Preference not saved',
          'The setting could not be saved on this device.',
        );
      }
    },
    [userId],
  );

  // ----------------------------------------------------
  // PROFILE LOADING
  // ----------------------------------------------------

  const applyProfile = useCallback((profile: Profile | null) => {
    setDisplayName(profile?.display_name ?? '');
    setBio(profile?.bio ?? '');

    const savedSkinType = profile?.skin_type ?? '';

    setSkinType(
      SKIN_TYPES.includes(savedSkinType as SkinType)
        ? (savedSkinType as SkinType)
        : '',
    );

    setSkinConcerns(
      Array.isArray(profile?.skin_concerns)
        ? profile.skin_concerns.filter(
            (item): item is string => typeof item === 'string',
          )
        : [],
    );

    setAvatarUrl(profile?.avatar_url ?? null);
  }, []);

  const loadProfile = useCallback(
    async (id: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;

        if (activeUserRef.current !== id) return;

        if (data) {
          applyProfile(data as Profile);
        } else {
          applyProfile(null);
        }
      } catch (error) {
        console.error('Profile loading error:', error);

        // Keep the existing form values if the network
        // request fails. Do not erase the user's edits.
      }
    },
    [applyProfile],
  );

  // ----------------------------------------------------
  // SCAN HISTORY
  //
  // Same backend and loading method as HomeScreen.
  // All scan statistics come from local SQLite.
  // No cloud merge or account-specific scan query.
  // ----------------------------------------------------

  const loadScans = useCallback(async () => {
    try {
      const localScans = await getAllScans();

      // HomeScreen uses the same local scan records.
      const sortedScans = [...localScans].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      );

      setScans(sortedScans);
    } catch (error) {
      console.error('Unable to load local scans:', error);

      Alert.alert(
        'Scan history unavailable',
        'Unable to read your locally saved scan history.',
      );
    }
  }, []);

  // ----------------------------------------------------
  // LOAD SETTINGS WHEN SCREEN IS FOCUSED
  // ----------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadSettings = async () => {
        setLoading(true);

        try {
          if (!userId) {
            setRole('user');
            applyProfile(null);
            setScans([]);
            setLoading(false);
            return;
          }

          activeUserRef.current = userId;

          await Promise.all([
            loadPreferences(userId),
            loadProfile(userId),
            loadScans(),
          ]);

          if (!active) return;

          // Account role is optional.
          try {
            const { data, error } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', userId)
              .limit(1)
              .maybeSingle();

            if (error) throw error;

            if (active) {
              setRole(data?.role ?? 'user');
            }
          } catch (error) {
            console.warn('Unable to load account role:', error);

            if (active) setRole('user');
          }
        } catch (error) {
          console.error('Settings loading error:', error);

          if (active) {
            Alert.alert(
              'Unable to load settings',
              error instanceof Error
                ? error.message
                : 'Please try again later.',
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      };

      void loadSettings();

      return () => {
        active = false;
      };
    }, [
      userId,
      applyProfile,
      loadPreferences,
      loadProfile,
      loadScans,
    ]),
  );

  // ----------------------------------------------------
  // NETWORK STATUS
  // ----------------------------------------------------

  useEffect(() => {
    let mounted = true;

    const checkInitialConnection = async () => {
      try {
        const state = await NetInfo.fetch();

        if (!mounted) return;

        setIsOnline(
          state.isConnected === true &&
          state.isInternetReachable !== false,
        );
      } catch (error) {
        console.warn('Unable to check network status:', error);

        if (mounted) setIsOnline(null);
      }
    };

    void checkInitialConnection();

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(
        state.isConnected === true &&
        state.isInternetReachable !== false,
      );
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // ----------------------------------------------------
  // AVATAR UPLOAD
  // ----------------------------------------------------

  const handleAvatarUpload = useCallback(async () => {
    if (!userId) {
      Alert.alert(
        'Not authenticated',
        'Please sign in before changing your profile picture.',
      );
      return;
    }

    if (isOnline === false) {
      Alert.alert(
        'Internet connection required',
        'You need an internet connection to upload a profile picture.',
      );
      return;
    }

    if (uploadingAvatar) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Please allow photo library access to select a profile picture.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.length) return;

      setUploadingAvatar(true);

      const asset = result.assets[0];

      const mimeType = (
        asset.mimeType ?? 'image/jpeg'
      ).toLowerCase();

      const extension =
        mimeType === 'image/png'
          ? 'png'
          : mimeType === 'image/webp'
            ? 'webp'
            : 'jpg';

      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
      ) {
        throw new Error(
          'Please select a JPG, PNG or WebP image.',
        );
      }

      const base64 = await FileSystem.readAsStringAsync(
        asset.uri,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      const imageBuffer = decode(base64);

      const filePath = `${userId}/avatar.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, imageBuffer, {
          contentType: mimeType,
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl =
        `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            avatar_url: publicUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );

      if (profileError) throw profileError;

      setAvatarUrl(publicUrl);

      Alert.alert(
        'Profile picture updated',
        'Your new profile picture has been saved.',
      );
    } catch (error) {
      console.error('Avatar upload error:', error);

      Alert.alert(
        'Upload failed',
        error instanceof Error
          ? error.message
          : 'Unable to upload your profile picture.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  }, [userId, isOnline, uploadingAvatar]);

  // ----------------------------------------------------
  // PROFILE UPDATES
  // ----------------------------------------------------

  const toggleConcern = useCallback((concern: string) => {
    setSkinConcerns(previous =>
      previous.includes(concern)
        ? previous.filter(item => item !== concern)
        : [...previous, concern],
    );
  }, []);

  const saveProfile = useCallback(async () => {
    if (!userId) {
      Alert.alert(
        'Not authenticated',
        'Please sign in again.',
      );
      return;
    }

    if (isOnline === false) {
      Alert.alert(
        'Internet connection required',
        'Your profile changes cannot be uploaded while offline.',
      );
      return;
    }

    if (saving) return;

    try {
      setSaving(true);

      const payload = {
        id: userId,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        skin_type: skinType || null,
        skin_concerns: skinConcerns,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      // Upsert is used so a missing profile row can also
      // be created. It also saves skin_concerns and avatar_url,
      // which are not included in the limited updateProfile patch.
      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;

      Alert.alert(
        'Profile updated',
        'Your profile and skincare preferences have been saved.',
      );
    } catch (error) {
      console.error('Profile update error:', error);

      Alert.alert(
        'Save failed',
        error instanceof Error
          ? error.message
          : 'Unable to save your profile.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    userId,
    isOnline,
    saving,
    displayName,
    bio,
    skinType,
    skinConcerns,
    avatarUrl,
  ]);

  // ----------------------------------------------------
  // ACCOUNT ACTIONS
  // ----------------------------------------------------

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out of SkinAIAnalyzer?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();

            if (error) {
              Alert.alert(
                'Sign out failed',
                error.message,
              );
            }
          },
        },
      ],
    );
  }, []);

  const handleDeleteAccountInfo = useCallback(() => {
    Alert.alert(
      'Account deletion',
      'Account deletion is not available from this screen. Contact support to request deletion of your account and associated data.',
    );
  }, []);

  // ----------------------------------------------------
  // DERIVED STATISTICS
  // ----------------------------------------------------

  const scanCount = scans.length;

  const latestScan = scans[0]?.createdAt ?? null;

  const pendingScans = scans.filter(
    scan =>
      isCompleted(scan.status) &&
      (scan.syncStatus === 'pending' ||
        scan.syncStatus === 'syncing'),
  ).length;

  const failedScans = scans.filter(
    scan => scan.syncStatus === 'error',
  ).length;

  const syncedScans = scans.filter(
    scan => scan.syncStatus === 'synced',
  ).length;

  const completedScans = scans.filter(
    scan => isCompleted(scan.status),
  ).length;

  const avatarInitial = getAvatarInitial(displayName);

  // ----------------------------------------------------
  // LOADING
  // ----------------------------------------------------

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingAura} />

        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text style={styles.loadingText}>
          Loading your settings...
        </Text>
      </View>
    );
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>
              PERSONALISE YOUR EXPERIENCE
            </Text>

            <Text style={styles.headerTitle}>
              Settings
            </Text>

            <Text style={styles.headerSubtitle}>
              Manage your account and skincare preferences.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>✦</Text>
          </View>
        </View>

        {/* PROFILE HERO */}

        <View style={styles.profileHero}>
          <View style={styles.heroAura} />

          <Pressable
            onPress={handleAvatarUpload}
            disabled={uploadingAvatar}
            style={({ pressed }) => [
              styles.avatarWrapper,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>
                  {avatarInitial}
                </Text>
              )}

              {uploadingAvatar && (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator
                    color="#FFFFFF"
                    size="small"
                  />
                </View>
              )}
            </View>

            <View style={styles.editAvatarBadge}>
              <Text style={styles.editAvatarText}>✎</Text>
            </View>
          </Pressable>

          <View style={styles.heroInfo}>
            <Text style={styles.heroName} numberOfLines={1}>
              {displayName.trim() || 'SkinAI User'}
            </Text>

            <Text style={styles.heroEmail} numberOfLines={1}>
              {email || 'No email available'}
            </Text>

            <Pressable
              onPress={handleAvatarUpload}
              disabled={uploadingAvatar}
              style={styles.changePhotoButton}
            >
              <Text style={styles.changePhotoText}>
                {uploadingAvatar
                  ? 'Uploading photo...'
                  : avatarUrl
                    ? 'Change profile picture'
                    : 'Add profile picture'}
              </Text>
            </Pressable>

            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {role.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.heroSparkle}>
            <Text style={styles.heroSparkleText}>✧</Text>
          </View>
        </View>

        {/* CONNECTION */}

        <View style={styles.card}>
          <View style={styles.accountRow}>
            <View
              style={[
                styles.preferenceIcon,
                {
                  backgroundColor:
                    isOnline === false
                      ? '#FCE8E8'
                      : '#E5F5EC',
                },
              ]}
            >
              <Text style={styles.preferenceIconText}>
                {isOnline === false ? '!' : '●'}
              </Text>
            </View>

            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>
                {isOnline === null
                  ? 'Checking connection'
                  : isOnline
                    ? 'Internet connected'
                    : 'Offline mode'}
              </Text>

              <Text style={styles.preferenceDescription}>
                {isOnline === false
                  ? 'Your locally saved scan history remains available.'
                  : 'Cloud profile services are available when connected.'}
              </Text>
            </View>
          </View>
        </View>

        {/* SCAN STATISTICS */}

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>◉</Text>

            <Text style={styles.statValue}>
              {scanCount}
            </Text>

            <Text style={styles.statLabel}>
              Total scans
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>◷</Text>

            <Text style={styles.statValueSmall}>
              {formatDate(latestScan)}
            </Text>

            <Text style={styles.statLabel}>
              Last analysis
            </Text>
          </View>
        </View>

        {/* SCAN SYNCHRONIZATION */}

        <SectionHeader
          title="Scan synchronization"
          subtitle="Upload status of your locally saved scans"
        />

        <View style={styles.card}>
          <AccountRow
            icon="◷"
            title="Waiting to upload"
            value={String(pendingScans)}
          />

          <View style={styles.innerDivider} />

          <AccountRow
            icon="✓"
            title="Successfully synchronized"
            value={String(syncedScans)}
          />

          <View style={styles.innerDivider} />

          <AccountRow
            icon="!"
            title="Upload errors"
            value={String(failedScans)}
          />

          <View style={styles.innerDivider} />

          <AccountRow
            icon="◉"
            title="Completed analyses"
            value={String(completedScans)}
          />

          <Text style={styles.localPreferenceNote}>
            Scan statistics are read directly from local SQLite,
            using the same scan history as your Home dashboard.
          </Text>
        </View>

        {/* PERSONAL INFORMATION */}

        <SectionHeader
          title="Personal information"
          subtitle="Your account profile"
        />

        <View style={styles.card}>
          <FieldLabel label="Display name" />

          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={60}
          />

          <FieldLabel label="About me" />

          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us a little about yourself..."
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.bioInput]}
            multiline
            textAlignVertical="top"
            maxLength={250}
          />

          <Text style={styles.characterCount}>
            {bio.length}/250 characters
          </Text>
        </View>

        {/* SKIN PROFILE */}

        <SectionHeader
          title="Skin profile"
          subtitle="Help personalise your skincare experience"
        />

        <View style={styles.card}>
          <FieldLabel label="Your skin type" />

          <View style={styles.chipContainer}>
            {SKIN_TYPES.map(type => {
              const selected = skinType === type;

              return (
                <Pressable
                  key={type}
                  onPress={() => setSkinType(type)}
                  style={[
                    styles.chip,
                    selected && styles.chipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {type}
                  </Text>

                  {selected && (
                    <Text style={styles.chipCheck}>✓</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.innerDivider} />

          <FieldLabel label="Skin concerns" />

          <Text style={styles.fieldDescription}>
            Select the concerns you want to focus on.
          </Text>

          <View style={styles.chipContainer}>
            {SKIN_CONCERNS.map(concern => {
              const selected = skinConcerns.includes(concern);

              return (
                <Pressable
                  key={concern}
                  onPress={() => toggleConcern(concern)}
                  style={[
                    styles.concernChip,
                    selected && styles.chipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {selected ? '✓ ' : '+ '}
                    {concern}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.selectionCount}>
            {skinConcerns.length} concern
            {skinConcerns.length === 1 ? '' : 's'} selected
          </Text>
        </View>

        {/* SAVE PROFILE */}

        <Pressable
          onPress={saveProfile}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.buttonPressed,
            saving && styles.disabledButton,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              Save profile changes
            </Text>
          )}
        </Pressable>

        {/* APP PREFERENCES */}

        <SectionHeader
          title="App preferences"
          subtitle="Control your experience"
        />

        <View style={styles.card}>
          <PreferenceRow
            icon="♧"
            title="Notifications"
            description="Save your notification preference"
            value={notifications}
            onValueChange={value =>
              updatePreference('notifications', value)
            }
          />

          <View style={styles.innerDivider} />

          <PreferenceRow
            icon="◷"
            title="Skincare reminders"
            description="Save your daily reminder preference"
            value={reminders}
            onValueChange={value =>
              updatePreference('reminders', value)
            }
          />

          <View style={styles.innerDivider} />

          <PreferenceRow
            icon="◐"
            title="Dark appearance"
            description="Save your appearance preference"
            value={darkMode}
            onValueChange={value =>
              updatePreference('darkMode', value)
            }
          />

          <Text style={styles.localPreferenceNote}>
            Preferences are saved locally on this device and
            separated by account. Notification delivery,
            reminder scheduling and global dark theme activation
            require additional app integration.
          </Text>
        </View>

        {/* ACCOUNT */}

        <SectionHeader
          title="Account"
          subtitle="Security and account management"
        />

        <View style={styles.card}>
          <AccountRow
            icon="✉"
            title="Email address"
            value={email || 'Not available'}
          />

          <View style={styles.innerDivider} />

          <AccountRow
            icon="♙"
            title="Account role"
            value={role}
          />

          <View style={styles.innerDivider} />

          <Pressable
            onPress={handleDeleteAccountInfo}
            style={styles.accountAction}
          >
            <View style={styles.accountActionIcon}>
              <Text style={styles.dangerIcon}>!</Text>
            </View>

            <View style={styles.accountActionText}>
              <Text style={styles.dangerTitle}>
                Delete account
              </Text>

              <Text style={styles.accountDescription}>
                Request account and data deletion
              </Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        {/* SIGN OUT */}

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.signOutIcon}>↪</Text>

          <Text style={styles.signOutText}>
            Sign out
          </Text>
        </Pressable>

        {/* FOOTER */}

        <View style={styles.footer}>
          <View style={styles.footerIcon}>
            <Text style={styles.footerIconText}>✦</Text>
          </View>

          <Text style={styles.footerBrand}>
            SkinAIAnalyzer
          </Text>

          <Text style={styles.footerVersion}>
            Version 1.0.0 · AI-powered skincare companion
          </Text>

          <Text style={styles.watermark}>
            Developed &amp; Engineered by Vaishnavi Hurnaum
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ======================================================
// REUSABLE COMPONENTS
// ======================================================

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
    </Text>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  value,
  onValueChange,
}: {
  icon: string;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceIcon}>
        <Text style={styles.preferenceIconText}>
          {icon}
        </Text>
      </View>

      <View style={styles.preferenceInfo}>
        <Text style={styles.preferenceTitle}>
          {title}
        </Text>

        <Text style={styles.preferenceDescription}>
          {description}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: '#E8DDE3',
          true: '#E7A1C1',
        }}
        thumbColor={value ? '#C94D8B' : '#FFFFFF'}
      />
    </View>
  );
}

function AccountRow({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <View style={styles.accountRow}>
      <View style={styles.preferenceIcon}>
        <Text style={styles.preferenceIconText}>
          {icon}
        </Text>
      </View>

      <View style={styles.preferenceInfo}>
        <Text style={styles.preferenceTitle}>
          {title}
        </Text>

        <Text style={styles.accountValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 42,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingAura: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.primarySoft,
    opacity: 0.45,
  },

  loadingText: {
    marginTop: 16,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
  },

  // HEADER

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  headerCopy: {
    flex: 1,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 7,
  },

  headerTitle: {
    color: colors.text,
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -0.8,
  },

  headerSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
    lineHeight: 19,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  headerIconText: {
    color: colors.primary,
    fontSize: 25,
  },

  // PROFILE HERO

  profileHero: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 18,
  },

  heroAura: {
    position: 'absolute',
    right: -38,
    top: -48,
    width: 145,
    height: 145,
    borderRadius: 75,
    backgroundColor: colors.primarySoft,
    opacity: 0.55,
  },

  avatarWrapper: {
    width: 82,
    height: 82,
    position: 'relative',
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.surface,
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.primaryDeep,
  },

  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  editAvatarBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  heroInfo: {
    flex: 1,
    marginLeft: 15,
    minWidth: 0,
  },

  heroName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },

  heroEmail: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },

  changePhotoButton: {
    alignSelf: 'flex-start',
    marginTop: 9,
  },

  changePhotoText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },

  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },

  roleBadgeText: {
    color: colors.primaryDeep,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  heroSparkle: {
    position: 'absolute',
    right: 14,
    bottom: 10,
  },

  heroSparkleText: {
    color: colors.primary,
    fontSize: 20,
  },

  // CARDS

  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 17,
    marginBottom: 16,
  },

  // STATISTICS

  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 19,
    marginBottom: 26,
  },

  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  statIcon: {
    color: colors.primary,
    fontSize: 20,
    marginBottom: 7,
  },

  statValue: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '800',
  },

  statValueSmall: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 7,
    marginBottom: 5,
  },

  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
  },

  statDivider: {
    width: 1,
    height: 62,
    backgroundColor: colors.border,
  },

  // SECTION HEADERS

  sectionHeader: {
    marginTop: 11,
    marginBottom: 12,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },

  sectionSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },

  // INPUTS

  fieldLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 9,
    marginTop: 5,
  },

  input: {
    minHeight: 49,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    marginBottom: 17,
  },

  bioInput: {
    minHeight: 105,
    paddingTop: 13,
  },

  characterCount: {
    color: colors.muted,
    fontSize: 10,
    textAlign: 'right',
    marginTop: -11,
    marginBottom: 4,
  },

  fieldDescription: {
    color: colors.muted,
    fontSize: 11,
    marginTop: -3,
    marginBottom: 12,
  },

  // CHIPS

  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 20,
  },

  concernChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
  },

  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },

  chipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },

  chipTextSelected: {
    color: colors.primaryDeep,
    fontWeight: '800',
  },

  chipCheck: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 5,
  },

  innerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },

  selectionCount: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 14,
  },

  // SAVE BUTTON

  saveButton: {
    minHeight: 53,
    backgroundColor: colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 24,
    elevation: 2,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  disabledButton: {
    opacity: 0.65,
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },

  // PREFERENCES

  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
  },

  preferenceIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  preferenceIconText: {
    color: colors.primaryDeep,
    fontSize: 17,
    fontWeight: '800',
  },

  preferenceInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  preferenceTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },

  preferenceDescription: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  localPreferenceNote: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 12,
  },

  // ACCOUNT

  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
  },

  accountValue: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
  },

  accountAction: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },

  accountActionIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: '#FCE8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dangerIcon: {
    color: '#D65B6C',
    fontSize: 18,
    fontWeight: '900',
  },

  accountActionText: {
    flex: 1,
    marginLeft: 12,
  },

  dangerTitle: {
    color: '#D65B6C',
    fontSize: 12,
    fontWeight: '800',
  },

  accountDescription: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4,
  },

  chevron: {
    color: colors.muted,
    fontSize: 25,
    marginRight: 4,
  },

  // SIGN OUT

  signOutButton: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E9C9D5',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  signOutIcon: {
    color: colors.primary,
    fontSize: 20,
    marginRight: 9,
  },

  signOutText: {
    color: colors.primaryDeep,
    fontSize: 13,
    fontWeight: '800',
  },

  // FOOTER

  footer: {
    alignItems: 'center',
    marginTop: 31,
    paddingBottom: 12,
  },

  footerIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  footerIconText: {
    color: colors.primary,
    fontSize: 22,
  },

  footerBrand: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },

  footerVersion: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 5,
  },

  watermark: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 16,
    opacity: 0.75,
  },
});
