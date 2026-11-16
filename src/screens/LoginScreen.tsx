import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react-native';

import { signIn } from '../services/authService';
import { supabase } from '../lib/supabase';

// ======================================================
// THEME
// ======================================================

const COLORS = {
  background: '#FFF5F9',
  pink: '#F27EAE',
  deepPink: '#D94F8B',
  text: '#382331',
  muted: '#A58D9A',
  border: '#F3DCE7',
  error: '#D94B68',
  success: '#32866C',
};

// ======================================================
// FLOATING PARTICLES
// ======================================================

const PARTICLES = [
  { left: '8%', top: '13%', size: 7, duration: 3400, delay: 0 },
  { left: '83%', top: '10%', size: 5, duration: 4200, delay: 400 },
  { left: '91%', top: '32%', size: 9, duration: 3800, delay: 900 },
  { left: '5%', top: '42%', size: 5, duration: 4600, delay: 300 },
  { left: '15%', top: '72%', size: 8, duration: 3900, delay: 1200 },
  { left: '88%', top: '75%', size: 6, duration: 4400, delay: 600 },
  { left: '70%', top: '88%', size: 9, duration: 3600, delay: 1500 },
  { left: '35%', top: '8%', size: 4, duration: 4100, delay: 800 },
  { left: '52%', top: '92%', size: 6, duration: 4300, delay: 200 },
  { left: '96%', top: '55%', size: 4, duration: 3700, delay: 1100 },
];

type ParticleConfig = (typeof PARTICLES)[number];

function FloatingParticle({
  particle,
}: {
  particle: ParticleConfig;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.15)).current;
  const scale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(particle.delay),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(translateY, {
              toValue: -45,
              duration: particle.duration,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: 0,
              duration: particle.duration,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.85,
              duration: particle.duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.12,
              duration: particle.duration / 2,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.3,
              duration: particle.duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 0.7,
              duration: particle.duration / 2,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [particle, translateY, opacity, scale]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: particle.left,
          top: particle.top,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    />
  );
}

// ======================================================
// MAIN SCREEN
// ======================================================

type AuthMode = 'login' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  const aura = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    mountedRef.current = true;

    const auraAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(aura, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(aura, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ]),
    );

    const logoAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.045,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );

    auraAnimation.start();
    logoAnimation.start();

    Animated.spring(entrance, {
      toValue: 1,
      tension: 45,
      friction: 8,
      useNativeDriver: true,
    }).start();

    return () => {
      mountedRef.current = false;
      auraAnimation.stop();
      logoAnimation.stop();
      entrance.stopAnimation();
    };
  }, [aura, entrance, logoPulse]);

  const isSignup = mode === 'signup';

  function switchMode(nextMode: AuthMode) {
    if (loading) return;

    setMode(nextMode);
    setError(null);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function validateForm() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }

    if (!password) {
      setError('Please enter your password.');
      return false;
    }

    if (isSignup && password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return false;
    }

    if (isSignup && password !== confirmPassword) {
      setError('Your passwords do not match.');
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    if (submittingRef.current || loading) return;

    setError(null);
    setMessage(null);

    if (!validateForm()) return;

    submittingRef.current = true;
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (isSignup) {
        const { data, error: signupError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
          });

        if (signupError) throw signupError;
        if (!mountedRef.current) return;

        if (data.session) {
          // RootNavigator handles the authenticated session.
          return;
        }

        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setMessage(
          'Account created! Check your email to verify your account before signing in.',
        );
      } else {
        await signIn(cleanEmail, password);

        // Do not navigate manually.
        // RootNavigator watches useSession().
      }
    } catch (e: unknown) {
      if (!mountedRef.current) return;

      setError(
        e instanceof Error
          ? e.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      submittingRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  const auraScale = aura.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.2],
  });

  const auraOpacity = aura.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.42],
  });

  const entranceY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
      />

      <LinearGradient
        colors={['#FFF9FC', '#FFEAF3', '#FFF1F7', '#FFFFFF']}
        locations={[0, 0.42, 0.78, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient pink aura */}

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

      {/* Floating particles */}

      {PARTICLES.map((particle, index) => (
        <FloatingParticle
          key={index}
          particle={particle}
        />
      ))}

      <View style={styles.decorativeCircleOne} />
      <View style={styles.decorativeCircleTwo} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: entrance,
                transform: [{ translateY: entranceY }],
              },
            ]}
          >
            {/* BRAND */}

            <View style={styles.brandContainer}>
              <Animated.View
                style={[
                  styles.logoOuter,
                  { transform: [{ scale: logoPulse }] },
                ]}
              >
                <Image
                  source={require('../../assets/icon.png')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />

                <View style={styles.logoSparkle}>
                  <Sparkles size={13} color="#FFFFFF" />
                </View>
              </Animated.View>

              <Text style={styles.brandName}>
                SkinAI<Text style={styles.brandAccent}>Analyzer</Text>
              </Text>

              <View style={styles.aiBadge}>
                <Sparkles size={11} color={COLORS.deepPink} />
                <Text style={styles.aiBadgeText}>
                  YOUR PERSONAL AI SKINCARE ASSISTANT
                </Text>
              </View>
            </View>

            {/* AUTHENTICATION CARD */}

            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <UserRound size={18} color={COLORS.deepPink} />
                </View>

                <Text style={styles.cardEyebrow}>
                  {isSignup ? 'START YOUR JOURNEY' : 'WELCOME BACK'}
                </Text>
              </View>

              <Text style={styles.heading}>
                {isSignup ? 'Create your account' : 'Your skin journey starts here.'}
              </Text>

              <Text style={styles.description}>
                {isSignup
                  ? 'Discover a smarter approach to skincare.'
                  : 'Access your personalized skincare dashboard and AI analysis.'}
              </Text>

              {/* MODE SWITCH */}

              <View style={styles.modeContainer}>
                <Pressable
                  onPress={() => switchMode('login')}
                  style={[
                    styles.modeButton,
                    !isSignup && styles.modeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeText,
                      !isSignup && styles.modeTextActive,
                    ]}
                  >
                    Sign In
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => switchMode('signup')}
                  style={[
                    styles.modeButton,
                    isSignup && styles.modeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeText,
                      isSignup && styles.modeTextActive,
                    ]}
                  >
                    Create Account
                  </Text>
                </Pressable>
              </View>

              {/* EMAIL */}

              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>

              <View style={styles.inputContainer}>
                <Mail size={17} color={COLORS.muted} />

                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#BBA9B2"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="next"
                  editable={!loading}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>

              {/* PASSWORD */}

              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>PASSWORD</Text>

                {!isSignup && (
                  <Text style={styles.passwordHint}>
                    Keep your account secure
                  </Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <LockKeyhole size={17} color={COLORS.muted} />

                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#BBA9B2"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  returnKeyType={isSignup ? 'next' : 'go'}
                  editable={!loading}
                  onSubmitEditing={() => {
                    if (isSignup) {
                      confirmPasswordRef.current?.focus();
                    } else {
                      handleSubmit();
                    }
                  }}
                />

                <Pressable
                  onPress={() => setShowPassword((previous) => !previous)}
                  hitSlop={10}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={COLORS.muted} />
                  ) : (
                    <Eye size={18} color={COLORS.muted} />
                  )}
                </Pressable>
              </View>

              {/* CONFIRM PASSWORD */}

              {isSignup && (
                <>
                  <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>

                  <View style={styles.inputContainer}>
                    <LockKeyhole size={17} color={COLORS.muted} />

                    <TextInput
                      ref={confirmPasswordRef}
                      style={styles.input}
                      placeholder="Re-enter your password"
                      placeholderTextColor="#BBA9B2"
                      value={confirmPassword}
                      onChangeText={(value) => {
                        setConfirmPassword(value);
                        setError(null);
                      }}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoComplete="new-password"
                      returnKeyType="go"
                      editable={!loading}
                      onSubmitEditing={handleSubmit}
                    />

                    <Pressable
                      onPress={() =>
                        setShowConfirmPassword((previous) => !previous)
                      }
                      hitSlop={10}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} color={COLORS.muted} />
                      ) : (
                        <Eye size={18} color={COLORS.muted} />
                      )}
                    </Pressable>
                  </View>
                </>
              )}

              {/* ERROR */}

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* SUCCESS */}

              {message && (
                <View style={styles.successBox}>
                  <ShieldCheck size={16} color={COLORS.success} />
                  <Text style={styles.successText}>{message}</Text>
                </View>
              )}

              {/* SUBMIT */}

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && !loading && styles.submitPressed,
                  loading && styles.submitDisabled,
                ]}
              >
                <LinearGradient
                  colors={['#F69BC0', '#E96E9F', '#D94F8B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.submitText}>
                        {isSignup ? 'Create My Account' : 'Sign In'}
                      </Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={styles.securityRow}>
                <ShieldCheck size={13} color="#B99EAD" />
                <Text style={styles.securityText}>
                  Secure authentication powered by Supabase
                </Text>
              </View>
            </View>

            {/* COMPACT FOOTER */}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                BEAUTY MEETS INTELLIGENCE
              </Text>

              <View style={styles.watermark}>
                <Sparkles size={10} color="#D982A8" />
                <Text style={styles.watermarkText}>
                  DEVELOPED & ENGINEERED BY
                </Text>
                <Text style={styles.developerName}>
                  Vaishnavi Hurnaum
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ======================================================
// STYLES
// ======================================================


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    minHeight: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },

  // BACKGROUND

  aura: {
    position: 'absolute',
    width: 330,
    height: 330,
    borderRadius: 200,
    backgroundColor: '#F6A4C6',
    top: '15%',
    alignSelf: 'center',
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#F18AB5',
    shadowColor: '#E66D9E',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 5,
  },
  decorativeCircleOne: {
    position: 'absolute',
    width: 135,
    height: 135,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 190, 215, 0.15)',
    top: '17%',
    right: -50,
  },
  decorativeCircleTwo: {
    position: 'absolute',
    width: 105,
    height: 105,
    borderRadius: 100,
    backgroundColor: 'rgba(240, 145, 185, 0.12)',
    bottom: '12%',
    left: -35,
  },

  // BRAND

  brandContainer: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logoOuter: {
    width: 72,
    height: 72,
    borderRadius: 24,
    padding: 4,
    backgroundColor: '#FFFFFF',
    elevation: 11,
    shadowColor: '#E875A5',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    marginBottom: 8,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  logoSparkle: {
    position: 'absolute',
    right: -7,
    top: -7,
    width: 26,
    height: 26,
    borderRadius: 15,
    backgroundColor: '#E66D9E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF5F9',
  },
  brandName: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  brandAccent: {
    color: COLORS.deepPink,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: '#F9DCE8',
  },
  aiBadgeText: {
    color: COLORS.deepPink,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
  },

  // CARD

  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingVertical: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.98)',
    elevation: 13,
    shadowColor: '#D77A9F',
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 8,
  },
  cardIcon: {
    width: 35,
    height: 35,
    borderRadius: 13,
    backgroundColor: '#FFF0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEyebrow: {
    color: COLORS.deepPink,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heading: {
    color: COLORS.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  description: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 14,
  },

  // MODE SELECTOR

  modeContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF2F7',
    padding: 4,
    borderRadius: 14,
    marginBottom: 15,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#C76C92',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  modeText: {
    color: '#B59BA9',
    fontSize: 11,
    fontWeight: '700',
  },
  modeTextActive: {
    color: COLORS.deepPink,
  },

  // INPUTS

  inputLabel: {
    color: '#927B88',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passwordHint: {
    color: '#B9A4AF',
    fontSize: 8,
    marginBottom: 6,
  },
  inputContainer: {
    height: 49,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFBFD',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    paddingVertical: 0,
  },

  // FEEDBACK

  errorBox: {
    backgroundColor: '#FFF0F2',
    borderColor: '#F6CFD7',
    borderWidth: 1,
    borderRadius: 11,
    padding: 9,
    marginBottom: 10,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EFFAF5',
    borderColor: '#D0EBDD',
    borderWidth: 1,
    borderRadius: 11,
    padding: 9,
    marginBottom: 10,
  },
  successText: {
    flex: 1,
    color: COLORS.success,
    fontSize: 11,
    lineHeight: 16,
  },

  // BUTTON

  submitButton: {
    marginTop: 5,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#D94F8B',
    shadowOpacity: 0.23,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  submitGradient: {
    height: 51,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  submitPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  submitDisabled: {
    opacity: 0.65,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  securityText: {
    color: '#B19AA7',
    fontSize: 9,
  },

  // FOOTER

  footer: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 2,
  },
  footerText: {
    color: '#C78AA7',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  watermark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
  },
  watermarkText: {
    color: '#C09AAA',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  developerName: {
    color: '#D66E9B',
    fontSize: 9,
    fontWeight: '800',
    marginLeft: 2,
  },
});
