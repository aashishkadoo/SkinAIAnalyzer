import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import {
  HomeIcon,
  ShopIcon,
  CameraIcon,
  SettingsIcon,
} from '../icons/TabIcons';

const ICONS = {
  Home: HomeIcon,
  Shop: ShopIcon,
  Camera: CameraIcon,
  Settings: SettingsIcon,
} as const;

type TabName = keyof typeof ICONS;

function TabButton({
  name,
  focused,
  onPress,
}: {
  name: TabName;
  focused: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const Icon = ICONS[name];

  useEffect(() => {
    Animated.spring(lift, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  }, [focused]);

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 40,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
    }).start();
  };

  const color = focused ? theme.colors.text : theme.colors.textMuted;
  const translateY = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.tab}
      android_ripple={{ color: 'transparent' }}
    >
      <Animated.View
        style={[styles.iconWrap, { transform: [{ scale }, { translateY }] }]}
      >
        <Icon size={24} color={color} focused={focused} />
      </Animated.View>
      <Text
        style={[styles.label, { color }, focused && styles.labelFocused]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {name}
      </Text>
    </Pressable>
  );
}

export default function Navbar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <View style={styles.pill}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={60}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(255,255,255,0.92)' },
            ]}
          />
        )}
        <View style={styles.inner}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const name = route.name as TabName;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TabButton
                key={route.key}
                name={name}
                focused={isFocused}
                onPress={onPress}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
    // Subtle shadow on the wrapper (not the pill) so it can't render as a
    // rectangular artifact behind the rounded corners on Android.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  pill: {
    borderRadius: 28,
    overflow: 'hidden',
    // NO backgroundColor here — the inner BlurView/View provides it
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
    // NO elevation — that's the rectangle-behind bug on Android
  },
  inner: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  iconWrap: {
    marginBottom: 3,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
    includeFontPadding: false,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  labelFocused: {
    fontWeight: '700',
  },
});