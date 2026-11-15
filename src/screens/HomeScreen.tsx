import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useSession } from '../hooks/useSession';
import { useProfile } from '../hooks/useProfile';
import { signOut } from '../services/authService';

export default function HomeScreen() {
  const { user } = useSession();
  const { profile, loading } = useProfile(user?.id ?? null);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.name}>{profile?.display_name ?? 'User'}</Text>
        </View>
        <Pressable onPress={signOut} style={styles.logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Skin type</Text>
        <Text style={styles.cardValue}>{profile?.skin_type ?? 'Not set yet'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Bio</Text>
        <Text style={styles.cardValue}>{profile?.bio ?? 'Tell us about your skin'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Account</Text>
        <Text style={styles.cardValue}>{user?.email}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  greeting: { fontSize: 14, color: '#666' },
  name: { fontSize: 24, fontWeight: '700' },
  logout: { padding: 8 },
  logoutText: { color: '#c00', fontWeight: '600' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12,
  },
  cardLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 4 },
  cardValue: { fontSize: 16, fontWeight: '500' },
});