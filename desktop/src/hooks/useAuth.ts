import { useState, useEffect } from 'react';
import { UserProfile, AuthStatus } from '../types/auth';
import {
  subscribeToAuthChanges,
  loginWithEmail,
  signupWithEmail,
  loginWithGoogle,
  loginWithAnonymous,
  logoutUser,
  formatAuthError,
} from '../services/authService';

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((profile) => {
      setUser(profile);
      setStatus(profile ? 'authenticated' : 'unauthenticated');
    });

    return () => unsubscribe();
  }, []);

  const handleEmailLogin = async (email: string, pass: string) => {
    try {
      setError(null);
      const profile = await loginWithEmail(email, pass);
      setUser(profile);
      setStatus('authenticated');
      return profile;
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const handleEmailSignup = async (email: string, pass: string, name?: string) => {
    try {
      setError(null);
      const profile = await signupWithEmail(email, pass, name);
      setUser(profile);
      setStatus('authenticated');
      return profile;
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      const profile = await loginWithGoogle();
      setUser(profile);
      setStatus('authenticated');
    } catch (err: any) {
      setError(formatAuthError(err));
    }
  };

  const handleAnonymousLogin = async () => {
    try {
      setError(null);
      const profile = await loginWithAnonymous();
      setUser(profile);
      setStatus('authenticated');
    } catch (err: any) {
      setError(formatAuthError(err));
    }
  };

  const handleLogout = async () => {
    try {
      setError(null);
      await logoutUser();
      setUser(null);
      setStatus('unauthenticated');
    } catch (err: any) {
      setError(formatAuthError(err));
    }
  };

  return {
    user,
    status,
    error,
    loginWithEmail: handleEmailLogin,
    signupWithEmail: handleEmailSignup,
    loginWithGoogle: handleGoogleLogin,
    loginWithAnonymous: handleAnonymousLogin,
    logout: handleLogout,
    clearError: () => setError(null),
  };
};

