import { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type AuthCredential,
  type UserCredential,
  type User,
} from 'firebase/auth';
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
  isAuthLoading: boolean;
  isCheckoutLoading: boolean;
  checkoutError: string | null;
  handleLoginWithGoogle: () => Promise<void>;
  handleLoginWithEmail: (email: string, password: string) => Promise<void>;
  handleRegisterWithEmail: (email: string, password: string, confirmPassword: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleUnlockPremium: () => Promise<void>;
};

type PendingGoogleLink = {
  email: string;
  credential: AuthCredential;
};

export const useAuthSession = (lang: Lang): UseAuthSessionResult => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [esPremium, setEsPremium] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingGoogleLink, setPendingGoogleLink] = useState<PendingGoogleLink | null>(null);

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
        } catch {
          // Silencioso para no exponer detalles internos al cliente.
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
      } catch {
        // Silencioso para no exponer detalles internos al cliente.
      } finally {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('checkout');
        newUrl.searchParams.delete('session_id');
        window.history.replaceState({}, '', newUrl.toString());
      }
    };

    syncCheckoutReturn();
  }, [apiBaseUrl, user]);

  const clearPendingGoogleLinkIfUnmatched = (email: string) => {
    if (!pendingGoogleLink) return;
    if (pendingGoogleLink.email.toLowerCase() !== email.toLowerCase()) return;
    setPendingGoogleLink(null);
  };

  const tryLinkPendingGoogleCredential = async (signedInUser: User, email: string) => {
    if (!pendingGoogleLink) return;
    if (pendingGoogleLink.email.toLowerCase() !== email.toLowerCase()) return;

    const hasGoogleProvider = signedInUser.providerData.some((provider) => provider.providerId === 'google.com');
    if (hasGoogleProvider) {
      setPendingGoogleLink(null);
      return;
    }

    try {
      await linkWithCredential(signedInUser, pendingGoogleLink.credential);
      setPendingGoogleLink(null);
    } catch (error: any) {
      const code = error?.code as string | undefined;
      if (code === 'auth/provider-already-linked') {
        setPendingGoogleLink(null);
        return;
      }
      if (code === 'auth/credential-already-in-use') {
        setPendingGoogleLink(null);
        setAuthError(
          lang === 'es'
            ? 'Ya existe una cuenta de Google separada para este correo. Activa "One account per email address" en Firebase y elimina duplicados para vincular correctamente.'
            : 'A separate Google account already exists for this email. Enable "One account per email address" in Firebase and remove duplicates to link correctly.'
        );
        return;
      }
      // Silencioso para no exponer detalles internos al cliente.
    }
  };

  const validateGoogleSignInResult = async (result: UserCredential): Promise<boolean> => {
    const email = result.user.email?.trim().toLowerCase();
    if (!email) return true;

    const methods = await fetchSignInMethodsForEmail(auth, email);
    const hasPasswordMethod = methods.includes('password');
    const currentHasPasswordProvider = result.user.providerData.some(
      (provider) => provider.providerId === 'password'
    );

    if (!hasPasswordMethod || currentHasPasswordProvider) {
      setPendingGoogleLink(null);
      return true;
    }

    const pendingCredential = GoogleAuthProvider.credentialFromResult(result);
    if (pendingCredential) {
      setPendingGoogleLink({
        email,
        credential: pendingCredential,
      });
    }

    await signOut(auth);
    setAuthError(
      lang === 'es'
        ? 'Este correo ya usa contraseña. Inicia sesión con correo y contraseña para vincular Google automáticamente.'
        : 'This email already uses password sign-in. Sign in with email and password to link Google automatically.'
    );
    return false;
  };

  const handleLoginWithGoogle = async () => {
    if (isAuthLoading) return;

    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await validateGoogleSignInResult(result);
    } catch (error: any) {
      const code = error?.code as string | undefined;

      if (code === 'auth/account-exists-with-different-credential') {
        const pendingCredential = GoogleAuthProvider.credentialFromError(error);
        const email = error?.customData?.email as string | undefined;
        if (pendingCredential && email) {
          setPendingGoogleLink({
            email: email.toLowerCase(),
            credential: pendingCredential,
          });
        }
        setAuthError(getAuthErrorMessage(code, lang, error?.message));
        return;
      }

      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(getAuthErrorMessage(code, lang, error?.message));
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError: any) {
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
      setIsAuthLoading(false);
    }
  };

  const handleLoginWithEmail = async (email: string, password: string) => {
    if (isAuthLoading) return;

    const normalizedEmail = email.trim().toLowerCase();
    let signInMethods: string[] = [];
    const genericEmailLoginHint =
      lang === 'es'
        ? 'No se pudo ingresar, el correo o la contraseña son incorrectos o anteriormente se ha iniciado sesión con Google con este mismo correo, si es así, favor de dar click en "Iniciar sesión con Google" y el mismo correo con el cual quieres ingresar.'
        : 'Could not sign in. The email or password is incorrect, or this email has previously used Google sign-in. If so, click "Sign in with Google" and choose the same email.';
    setIsAuthLoading(true);
    setAuthError(null);

    try {
      signInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
      const googleEnabled = signInMethods.includes('google.com');
      const passwordEnabled = signInMethods.includes('password');

      if (googleEnabled && !passwordEnabled) {
        setAuthError(genericEmailLoginHint);
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      await tryLinkPendingGoogleCredential(credential.user, normalizedEmail);
      clearPendingGoogleLinkIfUnmatched(normalizedEmail);
    } catch (error: any) {
      const code = error?.code as string | undefined;

      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        const googleEnabled = signInMethods.includes('google.com');
        const passwordEnabled = signInMethods.includes('password');

        if (googleEnabled && !passwordEnabled) {
          setAuthError(genericEmailLoginHint);
          return;
        }

        if (signInMethods.length === 0) {
          setAuthError(genericEmailLoginHint);
          return;
        }

        setAuthError(genericEmailLoginHint);
        return;
      }

      setAuthError(getAuthErrorMessage(code, lang, error?.message));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRegisterWithEmail = async (email: string, password: string, confirmPassword: string) => {
    if (isAuthLoading) return;

    const normalizedEmail = email.trim().toLowerCase();
    setAuthError(null);

    if (!normalizedEmail || !password || !confirmPassword) {
      setAuthError(
        lang === 'es'
          ? 'Completa correo, contraseña y confirmacion de contraseña.'
          : 'Please complete email, password, and password confirmation.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setAuthError(
        lang === 'es'
          ? 'Las contraseñas no coinciden.'
          : 'Passwords do not match.'
      );
      return;
    }

    setIsAuthLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      await tryLinkPendingGoogleCredential(credential.user, normalizedEmail);
      clearPendingGoogleLinkIfUnmatched(normalizedEmail);
    } catch (error: any) {
      const code = error?.code as string | undefined;
      setAuthError(getAuthErrorMessage(code, lang, error?.message));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Silencioso para no exponer detalles internos al cliente.
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
    } catch {
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
    isAuthLoading,
    isCheckoutLoading,
    checkoutError,
    handleLoginWithGoogle,
    handleLoginWithEmail,
    handleRegisterWithEmail,
    handleLogout,
    handleUnlockPremium,
  };
};

export type { UseAuthSessionResult };
