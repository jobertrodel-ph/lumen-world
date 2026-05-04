import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginScreen from './components/LoginScreen';
import GameContainer from './components/GameContainer';
import AvatarPicker from './components/AvatarPicker';
import { loadProfile } from './shared/profile';

function AppContent() {
  const { user, loading } = useAuth();
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Load saved profile when user signs in.
  useEffect(() => {
    if (user) {
      const profile = loadProfile(user.uid);
      setAvatarId(profile.avatarId);
      setConfirmed(false);
    } else {
      setAvatarId(null);
      setConfirmed(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="boot">
        <div className="boot__pulse" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (!confirmed || !avatarId) {
    return (
      <AvatarPicker
        initialAvatarId={avatarId ?? 'ember'}
        onConfirm={(id) => {
          setAvatarId(id);
          setConfirmed(true);
        }}
      />
    );
  }

  return <GameContainer avatarId={avatarId} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
