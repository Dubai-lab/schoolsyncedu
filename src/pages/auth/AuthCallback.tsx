import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * Handles Supabase auth redirects (email confirmation, magic links, OAuth).
 * Supabase redirects here with ?code=... (PKCE) or #access_token=... (implicit).
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        // PKCE flow — exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          return;
        }
      }

      // After session is established (or for hash-based flow handled by detectSessionInUrl),
      // check if the user is now authenticated and redirect accordingly
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        navigate('/dashboard', { replace: true });
      } else {
        // No session — send to login with a success message
        navigate('/auth/login?confirmed=true', { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-red-600">Confirmation Failed</h2>
          <p className="mb-4 text-gray-600">{error}</p>
          <a href="/auth/login" className="text-blue-600 underline hover:text-blue-800">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-gray-600">Confirming your account...</p>
      </div>
    </div>
  );
}
