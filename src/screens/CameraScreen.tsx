import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

export default function CameraScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera</Text>
      <Text style={styles.subtitle}>Scan capture will be built here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  title: { fontSize: theme.fontSize.xxl, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: theme.fontSize.md, color: theme.colors.textMuted },
});