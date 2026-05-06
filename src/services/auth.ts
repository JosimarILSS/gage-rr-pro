import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import { normalizeToolFlags, type ToolFlags } from '../config/tools';
import type { Lang } from '../types/common';
import { normalizeCompanyBrand, type CompanyBrand } from '../types/company';

export type UserAccountProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  premium: boolean;
  premiumActive: boolean;
  premiumUnlimited: boolean;
  premiumGrantedAt: number | null;
  premiumExpiresAt: number | null;
  toolAccess: ToolFlags;
  premiumTools: ToolFlags;
  toolPremiumActive: ToolFlags;
  companyId: string | null;
  companyBrand: CompanyBrand | null;
  createdAt: number | null;
};

const toTimestampMs = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === 'object') {
    const maybeTimestamp = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof maybeTimestamp.toMillis === 'function') return maybeTimestamp.toMillis();
    if (typeof maybeTimestamp.seconds === 'number') {
      return maybeTimestamp.seconds * 1000 + Math.floor((maybeTimestamp.nanoseconds || 0) / 1000000);
    }
  }

  return null;
};

const normalizeCompanyId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const readCompanyBrand = async (companyId: string | null): Promise<CompanyBrand | null> => {
  if (!companyId) return null;

  try {
    const snap = await getDoc(doc(db, 'empresas', companyId));
    if (!snap.exists()) return null;
    return normalizeCompanyBrand(snap.id, snap.data());
  } catch {
    return null;
  }
};

const buildProfile = (
  user: User,
  data: Record<string, unknown> = {},
  claims: Record<string, unknown> = {},
  companyBrand: CompanyBrand | null = null
): UserAccountProfile => {
  const hasFirestorePremium = typeof data.premium === 'boolean';
  const hasFirestoreExpiration = Object.prototype.hasOwnProperty.call(data, 'premiumExpiresAt');
  const hasFirestoreGrantedAt = Object.prototype.hasOwnProperty.call(data, 'premiumGrantedAt');
  const expirationRaw = hasFirestoreExpiration ? data.premiumExpiresAt : claims.premiumExpiresAt;
  const grantedAtRaw = hasFirestoreGrantedAt ? data.premiumGrantedAt : claims.premiumUpdatedAt;
  const premium = hasFirestorePremium ? data.premium === true : claims.premium === true;
  const premiumExpiresAt = toTimestampMs(expirationRaw);
  const premiumGrantedAt = toTimestampMs(grantedAtRaw);
  const createdAt = toTimestampMs(data.createdAt);
  const premiumUnlimited = premium && (expirationRaw === null || expirationRaw === undefined);
  const premiumActive = premium && (premiumUnlimited || (premiumExpiresAt !== null && Date.now() < premiumExpiresAt));
  const toolAccess = normalizeToolFlags(
    (data.toolAccess as Record<string, unknown> | undefined) || (claims.toolAccess as Record<string, unknown> | undefined),
    true
  );
  const premiumTools = normalizeToolFlags(
    (data.premiumTools as Record<string, unknown> | undefined) || (claims.premiumTools as Record<string, unknown> | undefined),
    true
  );
  const toolPremiumActive = normalizeToolFlags(
    Object.fromEntries(
      Object.entries(premiumTools).map(([toolId, enabled]) => [toolId, premiumActive && enabled])
    ),
    false
  );
  const companyId = normalizeCompanyId(data.companyId) || normalizeCompanyId(claims.companyId);

  return {
    uid: user.uid,
    email: (data.email as string | null | undefined) || user.email || null,
    displayName: (data.displayName as string | null | undefined) || user.displayName || null,
    photoURL: (data.photoURL as string | null | undefined) || user.photoURL || null,
    premium,
    premiumActive,
    premiumUnlimited,
    premiumGrantedAt,
    premiumExpiresAt,
    toolAccess,
    premiumTools,
    toolPremiumActive,
    companyId,
    companyBrand: companyId ? companyBrand : null,
    createdAt,
  };
};

export const getUserAccountProfile = async (user: User | null): Promise<UserAccountProfile | null> => {
  if (!user) return null;

  try {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      const companyId = normalizeCompanyId(data.companyId);
      const companyBrand = await readCompanyBrand(companyId);
      return buildProfile(user, data, {}, companyBrand);
    }
  } catch {
    // Si Firestore falla, se usa Custom Claims como respaldo.
  }

  try {
    const tokenResult = await user.getIdTokenResult(true);
    const claims = tokenResult.claims as Record<string, unknown>;
    const companyId = normalizeCompanyId(claims.companyId);
    const companyBrand = await readCompanyBrand(companyId);
    return buildProfile(user, {}, claims, companyBrand);
  } catch {
    return buildProfile(user);
  }
};

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
  const profile = await getUserAccountProfile(user);
  return profile?.premiumActive === true;
};

export const getAuthErrorMessage = (
  code: string | undefined,
  lang: Lang,
  rawMessage?: string
): string => {
  const messages = {
    es: {
      invalidApiKey:
        'No se pudo iniciar sesión en este momento. Inténtalo nuevamente en unos minutos.',
      accountExistsDifferentCredential:
        'Este correo ya existe con otro metodo de acceso. Inicia sesion con correo y contraseña para vincular Google automaticamente.',
      unauthorizedDomain:
        'No se pudo completar el inicio de sesión desde este entorno. Inténtalo más tarde.',
      operationNotAllowed:
        'Este método de inicio de sesión no está disponible por el momento.',
      networkFailed: 'No se pudo conectar al servicio. Revisa tu conexión e inténtalo de nuevo.',
      popupBlocked: 'El navegador bloqueó la ventana emergente. Se intentará iniciar sesión por redirección.',
      emailAlreadyInUse:
        'Ese correo ya esta registrado. Inicia sesion o usa Google con ese mismo correo.',
      invalidEmail: 'Correo invalido. Verifica el formato.',
      invalidCredential: 'Credenciales invalidas. Revisa correo y contraseña.',
      weakPassword: 'La contraseña debe tener al menos 6 caracteres.',
      tooManyRequests:
        'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
      defaultError: 'No se pudo iniciar sesión con Google. Inténtalo nuevamente.',
    },
    en: {
      invalidApiKey:
        'Could not sign in right now. Please try again in a few minutes.',
      accountExistsDifferentCredential:
        'This email already exists with a different sign-in method. Sign in with email and password to link Google automatically.',
      unauthorizedDomain:
        'Sign-in could not be completed from this environment. Please try again later.',
      operationNotAllowed:
        'This sign-in method is currently unavailable.',
      networkFailed: 'Could not connect to the service. Check your network and try again.',
      popupBlocked: 'The browser blocked the popup window. Redirect sign-in will be attempted.',
      emailAlreadyInUse:
        'That email is already registered. Sign in instead or use Google with the same email.',
      invalidEmail: 'Invalid email format.',
      invalidCredential: 'Invalid credentials. Check email and password.',
      weakPassword: 'Password must be at least 6 characters.',
      tooManyRequests: 'Too many attempts. Please wait a few minutes and try again.',
      defaultError: 'Google sign-in failed. Please try again.',
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
