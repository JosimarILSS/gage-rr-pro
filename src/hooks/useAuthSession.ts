import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { checkPremiumStatus, getAuthErrorMessage } from '../services/auth';
import {
  confirmCheckoutSession,
  createCheckoutSession,
  getCheckoutErrorMessage,
} from '../services/checkout';
import type { Lang } from '../types/common';

type UseAuthSessionResult = {
  user: User | null;
  loadingAuth: boolean;
  esPremium: boolean;
  authError: string | null;
  isLoggingIn: boolean;
  isCheckoutLoading: boolean;
  checkoutError: string | null;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  handleUnlockPremium: () => Promise<void>;
};

export const useAuthSession = (lang: Lang): UseAuthSessionResult => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [esPremium, setEsPremium] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const apiBaseUrl = useMemo(
    // Empty string = same origin (Vercel). Fallback to localhost only in local dev.
    () => (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') || (import.meta.env.DEV ? 'http://localhost:4242' : ''),
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);

      if (currentUser) {
        // Registrar en Firestore si es la primera vez (el endpoint ignora si ya existe)
        try {
          const token = await currentUser.getIdToken();
          await fetch(`${apiBaseUrl}/api/user/register`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (err) {
          console.error('[auth] register failed (non-fatal):', err);
        }
      }
    });

    return () => unsubscribe();
  }, [apiBaseUrl]);

  useEffect(() => {
    const refreshPremium = async () => {
      const premium = await checkPremiumStatus(user);
      setEsPremium(premium);
    };

    refreshPremium();
  }, [user]);

  useEffect(() => {
    const syncCheckoutReturn = async () => {
      if (!user) return;

      const params = new URLSearchParams(window.location.search);
      const checkoutState = params.get('checkout');
      const sessionId = params.get('session_id');
      if (checkoutState !== 'success') return;

      try {
        if (sessionId) {
          const token = await user.getIdToken();
          await confirmCheckoutSession(apiBaseUrl, token, sessionId);
        }

        const premium = await checkPremiumStatus(user);
        setEsPremium(premium);
      } catch (error) {
        console.error('Error syncing checkout return:', error);
      } finally {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('checkout');
        newUrl.searchParams.delete('session_id');
        window.history.replaceState({}, '', newUrl.toString());
      }
    };

    syncCheckoutReturn();
  }, [apiBaseUrl, user]);

  const handleLogin = async () => {
    if (isLoggingIn) return;

    setIsLoggingIn(true);
    setAuthError(null);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      const code = error?.code as string | undefined;
      console.error('Error logging in:', error);

      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(getAuthErrorMessage(code, lang, error?.message));
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError: any) {
          console.error('Error redirect login:', redirectError);
          setAuthError(
            getAuthErrorMessage(
              redirectError?.code as string | undefined,
              lang,
              redirectError?.message
            )
          );
        }
      } else {
        setAuthError(getAuthErrorMessage(code, lang, error?.message));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleUnlockPremium = async () => {
    if (!user || isCheckoutLoading) return;

    setCheckoutError(null);
    setIsCheckoutLoading(true);
    try {
      const token = await user.getIdToken();
      const payload = await createCheckoutSession(apiBaseUrl, token);

      if (payload?.alreadyPaid) {
        setEsPremium(true);
        return;
      }

      await loadStripe(payload.publishableKey || '');
      if (!payload?.url) throw new Error('Checkout URL missing.');
      // Guardar posición de scroll para restaurarla al volver (la app siempre irá a sección 5)
      sessionStorage.setItem('scrollBeforeCheckout', String(window.scrollY));
      window.location.assign(payload.url);
    } catch (error) {
      console.error('Error starting Stripe checkout:', error);
      setCheckoutError(getCheckoutErrorMessage(lang));
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  return {
    user,
    loadingAuth,
    esPremium,
    authError,
    isLoggingIn,
    isCheckoutLoading,
    checkoutError,
    handleLogin,
    handleLogout,
    handleUnlockPremium,
  };
};

export type { UseAuthSessionResult };
