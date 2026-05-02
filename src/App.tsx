import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginScreen from './components/LoginScreen';
import GameContainer from './components/GameContainer';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="boot">
        <div className="boot__pulse" />
      </div>
    );
  }

  return user ? <GameContainer /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
