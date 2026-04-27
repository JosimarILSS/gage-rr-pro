import type { Lang } from '../types/common';

export type CheckoutSessionPayload = {
  alreadyPaid?: boolean;
  sessionId?: string;
  publishableKey?: string;
  url?: string;
};

const parseJsonResponse = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const createCheckoutSession = async (
  apiBaseUrl: string,
  idToken: string,
  returnPath = '/'
): Promise<CheckoutSessionPayload> => {
  const response = await fetch(`${apiBaseUrl}/api/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ returnPath }),
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(payload?.error || 'Checkout session failed.');
  }

  return payload as CheckoutSessionPayload;
};

export const confirmCheckoutSession = async (apiBaseUrl: string, idToken: string, sessionId: string): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/api/stripe/confirm-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    throw new Error(payload?.error || 'Checkout confirmation failed.');
  }
};

export const getCheckoutErrorMessage = (lang: Lang): string =>
  lang === 'es'
    ? 'No se pudo iniciar el pago. Inténtalo de nuevo en unos segundos.'
    : 'Could not start checkout. Please try again in a few seconds.';
