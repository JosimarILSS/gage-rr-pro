type ManageUserAccessPayload = {
  email: string;
  premium: boolean;
  unlimited: boolean;
  months?: number;
};

type ManageUserAccessResult = {
  ok: boolean;
  uid: string;
  email: string;
  created: boolean;
  premium: boolean;
  unlimited: boolean;
  monthsApplied: number | null;
  expiresAt: string | null;
};

export const manageUserAccess = async (
  apiBaseUrl: string,
  token: string,
  payload: ManageUserAccessPayload
): Promise<ManageUserAccessResult> => {
  const response = await fetch(`${apiBaseUrl}/api/admin/user-access`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Admin action failed.');
  }

  return data as ManageUserAccessResult;
};

export type { ManageUserAccessPayload, ManageUserAccessResult };
