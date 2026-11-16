export const theme = {
  colors: {
    // Backgrounds
    background: '#FFF5F8',       // very soft pink-white, replaces the gray
    surface: '#FFFFFF',           // cards stay white for contrast

    // Primary brand
    primary: '#E84A8A',           // rose pink, main accent — buttons, FAB, active tabs
    primarySoft: '#FBD5E4',       // light pink for pressed states, subtle fills
    primaryDeep: '#C13271',       // darker pink for shadows / pressed primary buttons

    // Text
    text: '#2A1B22',              // near-black with a warm pink undertone
    textMuted: '#8B7480',         // muted mauve-gray for secondary text
    textOnPrimary: '#FFFFFF',     // text that sits on primary-colored surfaces

    // Borders / dividers
    border: '#F4DEE7',            // soft pink border

    // Semantic
    danger: '#D64545',            // error red (kept distinct from pink so errors stand out)
    success: '#4A9B6E',           // success green

    // Glass / overlays
    glassBg: 'rgba(255, 245, 248, 0.85)',   // for BlurView fallback
    glassBorder: 'rgba(232, 74, 138, 0.15)', // subtle pink border on glass pill
    shadow: 'rgba(193, 50, 113, 0.15)',      // pink-tinted shadow, not black
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
  },
  fontSize: {
    sm: 12,
    md: 14,
    lg: 16,
    xl: 22,
    xxl: 28,
  },
};