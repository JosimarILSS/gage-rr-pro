import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import type { Lang } from '../types/common';

/**
 * Verifica el acceso premium leyendo Firestore directamente.
 *
 * Reglas:
 * - premium === false → sin acceso
 * - premium === true && premiumExpiresAt === null → acceso ilimitado (manual)
 * - premium === true && premiumExpiresAt > ahora → acceso activo
 * - premium === true && premiumExpiresAt <= ahora → acceso expirado
 */
export const checkPremiumStatus = async (user: User | null): Promise<boolean> => {
  if (!user) return false;

  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    if (!snap.exists()) {
      // Documento aún no creado — fallback al Custom Claim
      const tokenResult = await user.getIdTokenResult(true);
      return tokenResult.claims?.premium === true;
    }

    const data = snap.data();

    if (!data.premium) return false;

    // null = acceso manual ilimitado
    if (data.premiumExpiresAt === null || data.premiumExpiresAt === undefined) return true;

    // Comparar timestamp de Firestore con la fecha actual
    const expiresMs: number = data.premiumExpiresAt.toMillis
      ? data.premiumExpiresAt.toMillis()
      : Number(data.premiumExpiresAt);

    return Date.now() < expiresMs;
  } catch {
    // Si Firestore falla, no bloquear al usuario — usar claim como respaldo
    const tokenResult = await user.getIdTokenResult(true);
    return tokenResult.claims?.premium === true;
  }
};

export const getAuthErrorMessage = (
  code: string | undefined,
  lang: Lang,
  rawMessage?: string
): string => {
  const messages = {
    es: {
      invalidApiKey:
        'La API key de Firebase Web no es valida. Actualiza `VITE_FIREBASE_API_KEY` en tu .env con la configuracion real del proyecto Firebase.',
      accountExistsDifferentCredential:
        'Este correo ya existe con otro metodo de acceso. Inicia sesion con correo y contraseña para vincular Google automaticamente.',
      unauthorizedDomain:
        "Dominio no autorizado en Firebase. Agrega el dominio actual (por ejemplo `localhost` o `0.0.0.0`) en Authentication > Settings > Authorized domains.",
      operationNotAllowed:
        'Google Sign-In no está habilitado en Firebase. Actívalo en Authentication > Sign-in method > Google.',
      networkFailed: 'No se pudo conectar con Firebase. Revisa tu conexión e inténtalo de nuevo.',
      popupBlocked: 'El navegador bloqueó la ventana emergente. Se intentará iniciar sesión por redirección.',
      emailAlreadyInUse:
        'Ese correo ya esta registrado. Inicia sesion o usa Google con ese mismo correo.',
      invalidEmail: 'Correo invalido. Verifica el formato.',
      invalidCredential: 'Credenciales invalidas. Revisa correo y contraseña.',
      weakPassword: 'La contraseña debe tener al menos 6 caracteres.',
      tooManyRequests:
        'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
      defaultError: 'No se pudo iniciar sesión con Google. Revisa la consola para más detalles.',
    },
    en: {
      invalidApiKey:
        'The Firebase Web API key is invalid. Update `VITE_FIREBASE_API_KEY` in .env using the real Firebase app config.',
      accountExistsDifferentCredential:
        'This email already exists with a different sign-in method. Sign in with email and password to link Google automatically.',
      unauthorizedDomain:
        'Unauthorized Firebase domain. Add the current host (for example `localhost` or `0.0.0.0`) in Authentication > Settings > Authorized domains.',
      operationNotAllowed:
        'Google Sign-In is not enabled in Firebase. Enable it in Authentication > Sign-in method > Google.',
      networkFailed: 'Could not connect to Firebase. Check your network and try again.',
      popupBlocked: 'The browser blocked the popup window. Redirect sign-in will be attempted.',
      emailAlreadyInUse:
        'That email is already registered. Sign in instead or use Google with the same email.',
      invalidEmail: 'Invalid email format.',
      invalidCredential: 'Invalid credentials. Check email and password.',
      weakPassword: 'Password must be at least 6 characters.',
      tooManyRequests: 'Too many attempts. Please wait a few minutes and try again.',
      defaultError: 'Google sign-in failed. Check the console for details.',
    },
  };

  const normalizedMessage = rawMessage?.toLowerCase() || '';
  if (code === 'auth/invalid-api-key' || normalizedMessage.includes('api key not valid')) {
    return messages[lang].invalidApiKey;
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return messages[lang].accountExistsDifferentCredential;
  }
  if (code === 'auth/unauthorized-domain') return messages[lang].unauthorizedDomain;
  if (code === 'auth/operation-not-allowed') return messages[lang].operationNotAllowed;
  if (code === 'auth/network-request-failed') return messages[lang].networkFailed;
  if (code === 'auth/email-already-in-use') return messages[lang].emailAlreadyInUse;
  if (code === 'auth/invalid-email') return messages[lang].invalidEmail;
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return messages[lang].invalidCredential;
  }
  if (code === 'auth/weak-password') return messages[lang].weakPassword;
  if (code === 'auth/too-many-requests') return messages[lang].tooManyRequests;
  if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return messages[lang].popupBlocked;
  }
  return messages[lang].defaultError;
};
