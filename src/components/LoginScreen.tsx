import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function LoginScreen() {
  const { signIn, error } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signIn();
    } catch {
      // Error captured in context; just stop the spinner.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      {/* Atmospheric depth — three drifting blobs behind everything */}
      <div className="login__atmosphere" aria-hidden="true">
        <span className="blob blob--peach" />
        <span className="blob blob--coral" />
        <span className="blob blob--violet" />
      </div>

      <main className="login__panel">
        <div className="brand">
          <span className="brand__dot" />
          <span className="brand__name">LUMEN</span>
        </div>

        <h1 className="login__headline">
          <span className="headline__line">A place</span>
          <span className="headline__line headline__line--accent">to gather.</span>
        </h1>

        <p className="login__sub">
          Step into a small, lived-in world. Walk up to someone, hear their voice,
          stay as long as the conversation lasts.
        </p>

        <button
          className="google-button"
          onClick={handleSignIn}
          disabled={busy}
          type="button"
        >
          <GoogleMark />
          <span>{busy ? 'Opening Google\u2026' : 'Continue with Google'}</span>
        </button>

        {error && <p className="login__error" role="alert">{error}</p>}

        <p className="login__legal">
          By continuing you agree to be kind to the other people in here.
        </p>
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
