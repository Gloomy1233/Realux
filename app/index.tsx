import { Redirect } from 'expo-router';

import { sessionBootstrapComplete, useSessionStore } from '@/store/sessionStore';

export default function Index() {
  const firebaseConfigured = useSessionStore((s) => s.firebaseConfigured);
  const user = useSessionStore((s) => s.user);

  if (!sessionBootstrapComplete()) {
    return null;
  }

  if (!firebaseConfigured) {
    return <Redirect href="/firebase-setup" />;
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return <Redirect href="/home" />;
}
