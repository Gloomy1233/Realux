import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  // sendEmailVerification,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { ensureUserAndDeviceDocs } from '@/lib/firebase/ensureUserDocuments';
import { useSessionStore } from '@/store/sessionStore';

function formatAuthError(e: unknown, fallback: string): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: string }).code) : '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled in Firebase. Open the Firebase console → Authentication → Sign-in method → enable Email/Password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Use Sign in instead.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Sign in failed. Check your email and password.';
    default:
      break;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}

export default function SignInScreen() {
  const router = useRouter();
  const deviceId = useSessionStore((s) => s.deviceId);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignIn() {
    setBusy(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

      // --- Email verification: off for this prototype (sign-in allowed even if emailVerified is false) ---
      // if (!cred.user.emailVerified) {
      //   setError('Please verify your email first.');
      //   await signOut(auth);
      //   return;
      // }

      if (deviceId) {
        await ensureUserAndDeviceDocs({
          uid: cred.user.uid,
          deviceId,
          email: cred.user.email,
        });
      }
      router.replace('/home');
    } catch (e) {
      setError(formatAuthError(e, 'Sign in failed'));
    } finally {
      setBusy(false);
    }
  }

  async function onSignUp() {
    setBusy(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // --- Email verification: off for this prototype ---
      // Firebase does not send a verification email unless you call sendEmailVerification.
      // To enable later: import sendEmailVerification from 'firebase/auth' and uncomment:
      // await sendEmailVerification(cred.user);

      if (deviceId) {
        await ensureUserAndDeviceDocs({
          uid: cred.user.uid,
          deviceId,
          email: cred.user.email,
        });
      }
      router.replace('/home');
    } catch (e) {
      setError(formatAuthError(e, 'Sign up failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}>
        <Text style={styles.title}>Realux</Text>
        <Text style={styles.subtitle}>Register captures and verify them against your Firebase records.</Text>
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {busy ? <ActivityIndicator style={styles.spin} /> : null}
        <View style={styles.btnBlock}>
          <PrimaryButton title="Create account" onPress={onSignUp} disabled={busy} />
          <SecondaryButton title="Sign in" onPress={onSignIn} disabled={busy} />
        </View>
        <Text style={styles.hint}>Already registered? Use the Sign in button below Create account.</Text>
        <Text style={styles.note}>
          Prototype mode: verification confirms alignment with app-generated Firebase data, not third-party chain of
          custody.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f6f8f9' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    justifyContent: 'center',
    gap: 12,
  },
  btnBlock: { gap: 16, marginTop: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#0d3d3d' },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 8, color: '#444' },
  input: {
    borderWidth: 1,
    borderColor: '#e1e8ec',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  err: { color: '#b00020', fontSize: 14 },
  spin: { marginVertical: 4 },
  hint: { fontSize: 14, lineHeight: 20, opacity: 0.75, textAlign: 'center' },
  note: { fontSize: 13, lineHeight: 18, opacity: 0.8, marginTop: 12 },
});
