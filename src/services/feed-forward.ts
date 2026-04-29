import type { Lang } from '../types/common';

export type FeedForwardRequest = {
  lang: Lang;
  personName: string;
  methodology: string;
  personality: string;
  generation: string;
  companyDirectives: string;
  textInputs: Record<string, string>;
};

export type FeedForwardResponse = {
  feedback: string;
};

const parseJsonResponse = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const generateFeedForwardSession = async (
  apiBaseUrl: string,
  idToken: string,
  payload: FeedForwardRequest
): Promise<FeedForwardResponse> => {
  const response = await fetch(`${apiBaseUrl}/api/feed-forward/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const responsePayload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(responsePayload?.error || 'FeedFoward generation failed.');
  }

  return responsePayload as FeedForwardResponse;
};
