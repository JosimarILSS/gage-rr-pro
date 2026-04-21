type ManageUserAccessPayload = {
  email: string;
  displayName?: string;
  premium: boolean;
  unlimited: boolean;
  months?: number;
};

type AdminSearchField = 'all' | 'email' | 'displayName';
type AdminPremiumStatusFilter = 'all' | 'active' | 'expired' | 'vip' | 'noAccess';

type AdminListedUser = {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  premium: boolean;
  premiumActive: boolean;
  premiumUnlimited: boolean;
  premiumGrantedAt: string | null;
  premiumExpiresAt: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
};

type ListAdminUsersResult = {
  ok: boolean;
  users: AdminListedUser[];
  nextPageToken: string | null;
};

type ManageUserAccessResult = {
  ok: boolean;
  uid: string;
  email: string;
  displayName: string | null;
  created: boolean;
  premium: boolean;
  unlimited: boolean;
  monthsApplied: number | null;
  expiresAt: string | null;
  premiumGrantedAt: string | null;
};

type ListAdminUsersParams = {
  pageToken?: string | null;
  pageSize?: number;
  searchQuery?: string;
  searchField?: AdminSearchField;
  premiumStatus?: AdminPremiumStatusFilter;
};

export const listAdminUsers = async (
  apiBaseUrl: string,
  token: string,
  paramsInput: ListAdminUsersParams = {}
): Promise<ListAdminUsersResult> => {
  const {
    pageToken = null,
    pageSize = 30,
    searchQuery = '',
    searchField = 'all',
    premiumStatus = 'all',
  } = paramsInput;

  const params = new URLSearchParams();
  params.set('pageSize', String(pageSize));
  if (pageToken) params.set('pageToken', pageToken);
  if (searchQuery.trim()) params.set('q', searchQuery.trim());
  params.set('searchField', searchField);
  params.set('premiumStatus', premiumStatus);

  const response = await fetch(`${apiBaseUrl}/api/admin/user-access?${params.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Could not list users.');
  }

  return data as ListAdminUsersResult;
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

export type {
  ManageUserAccessPayload,
  ManageUserAccessResult,
  AdminListedUser,
  ListAdminUsersResult,
  ListAdminUsersParams,
  AdminSearchField,
  AdminPremiumStatusFilter,
};
