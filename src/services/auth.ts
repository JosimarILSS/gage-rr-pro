import type { User } from 'firebase/auth';
import type { Lang } from '../types/common';

export const checkPremiumStatus = async (user: User | null): Promise<boolean> => {
  if (!user) return false;

  const tokenResult = await user.getIdTokenResult(true);
  return tokenResult.claims?.premium === true;
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
      unauthorizedDomain:
        "Dominio no autorizado en Firebase. Agrega el dominio actual (por ejemplo `localhost` o `0.0.0.0`) en Authentication > Settings > Authorized domains.",
      operationNotAllowed:
        'Google Sign-In no está habilitado en Firebase. Actívalo en Authentication > Sign-in method > Google.',
      networkFailed: 'No se pudo conectar con Firebase. Revisa tu conexión e inténtalo de nuevo.',
      popupBlocked: 'El navegador bloqueó la ventana emergente. Se intentará iniciar sesión por redirección.',
      defaultError: 'No se pudo iniciar sesión con Google. Revisa la consola para más detalles.',
    },
    en: {
      invalidApiKey:
        'The Firebase Web API key is invalid. Update `VITE_FIREBASE_API_KEY` in .env using the real Firebase app config.',
      unauthorizedDomain:
        'Unauthorized Firebase domain. Add the current host (for example `localhost` or `0.0.0.0`) in Authentication > Settings > Authorized domains.',
      operationNotAllowed:
        'Google Sign-In is not enabled in Firebase. Enable it in Authentication > Sign-in method > Google.',
      networkFailed: 'Could not connect to Firebase. Check your network and try again.',
      popupBlocked: 'The browser blocked the popup window. Redirect sign-in will be attempted.',
      defaultError: 'Google sign-in failed. Check the console for details.',
    },
  };

  const normalizedMessage = rawMessage?.toLowerCase() || '';
  if (code === 'auth/invalid-api-key' || normalizedMessage.includes('api key not valid')) {
    return messages[lang].invalidApiKey;
  }
  if (code === 'auth/unauthorized-domain') return messages[lang].unauthorizedDomain;
  if (code === 'auth/operation-not-allowed') return messages[lang].operationNotAllowed;
  if (code === 'auth/network-request-failed') return messages[lang].networkFailed;
  if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return messages[lang].popupBlocked;
  }
  return messages[lang].defaultError;
};
