//src/components/chat/ChatFab.tsx
import React, { useEffect, useRef } from 'react';

import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

// =====================================================
// AI CHAT ICON
// =====================================================

function ChatIcon({ size = 29 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
    >
      <Defs>
        <LinearGradient
          id="chatStroke"
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#FFF0F7" />
        </LinearGradient>
      </Defs>

      {/* Chat bubble */}
      <Path
        d="M26 14.8C26 20.65 21.3 25.4 15.5 25.4C13.65 25.4 11.9 24.9 10.4 24.05L5 26L6.55 20.85C5.6 19.15 5 17.05 5 14.8C5 8.95 9.7 4.2 15.5 4.2C21.3 4.2 26 8.95 26 14.8Z"
        stroke="url(#chatStroke)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* AI sparkle */}
      <Path
        d="M20.4 8.2L21.5 11.2L24.5 12.3L21.5 13.4L20.4 16.4L19.3 13.4L16.3 12.3L19.3 11.2L20.4 8.2Z"
        fill="#FFFFFF"
      />

      {/* Chat detail */}
      <Circle cx="10.8" cy="17" r="1.15" fill="#FFFFFF" />
      <Circle cx="14.7" cy="17" r="1.15" fill="#FFFFFF" />
      <Circle cx="18.6" cy="17" r="1.15" fill="#FFFFFF" />

      {/* Small sparkle */}
      <Path
        d="M25.1 20.1L25.65 21.65L27.2 22.2L25.65 22.75L25.1 24.3L24.55 22.75L23 22.2L24.55 21.65L25.1 20.1Z"
        fill="#FFFFFF"
        opacity={0.9}
      />
    </Svg>
  );
}

// =====================================================
// CHAT FAB
// =====================================================

export default function ChatFab({
  onPress,
}: {
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1900,
          useNativeDriver: true,
        }),
      ]),
    );

    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 2300,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 2300,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseAnimation.start();
    shimmerAnimation.start();

    return () => {
      pulseAnimation.stop();
      shimmerAnimation.stop();
    };
  }, [pulse, shimmer]);

  // Soft expanding aura
  const auraScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.65],
  });

  const auraOpacity = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.15, 0],
  });

  // Breathing edge glow
  const edgeOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  const edgeScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.07],
  });

  // Subtle highlight
  const highlightOpacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.85, 0.35],
  });

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.91,
      useNativeDriver: true,
      speed: 35,
      bounciness: 5,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
      bounciness: 7,
    }).start();
  };

  return (
    <View
      style={styles.container}
      pointerEvents="box-none"
    >
      {/* Expanding ambient aura */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.aura,
          {
            opacity: auraOpacity,
            transform: [{ scale: auraScale }],
          },
        ]}
      />

      {/* Soft illuminated edge */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.edgeGlow,
          {
            opacity: edgeOpacity,
            transform: [{ scale: edgeScale }],
          },
        ]}
      />

      {/* Outer glass ring */}
      <View
        pointerEvents="none"
        style={styles.glassRing}
      />

      {/* Main button */}
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Open SkinAI chat assistant"
        hitSlop={8}
      >
        <Animated.View
          style={[
            styles.button,
            {
              transform: [{ scale }],
            },
          ]}
        >
          {/* Top glass highlight */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.highlight,
              { opacity: highlightOpacity },
            ]}
          />

          {/* AI icon */}
          <View style={styles.iconContainer}>
            <ChatIcon size={30} />
          </View>

          {/* Small online indicator */}
          <View style={styles.onlineRing}>
            <View style={styles.onlineDot} />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================

const SIZE = 60;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 24,
    bottom: 140,
    width: SIZE,
    height: SIZE,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Expanding pink aura

  aura: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#F0A8C7',
    shadowColor: '#E88EB7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 20,
    elevation: 9,
  },

  // Pulsating border glow

  edgeGlow: {
    position: 'absolute',
    width: SIZE + 7,
    height: SIZE + 7,
    borderRadius: (SIZE + 7) / 2,
    borderWidth: 1.8,
    borderColor: '#F0A6C7',
    shadowColor: '#E98BB8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },

  // Translucent outer ring

  glassRing: {
    position: 'absolute',
    width: SIZE + 3,
    height: SIZE + 3,
    borderRadius: (SIZE + 3) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  // Main glass-inspired button

  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#E99ABC',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',

    shadowColor: '#D77EA5',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 13,
    elevation: 10,
  },

  // Reflective surface

  highlight: {
    position: 'absolute',
    top: 3,
    left: 7,
    right: 7,
    height: 22,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },

  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Online status

  onlineRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    right: 1,
    bottom: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#53C59A',
  },
});
