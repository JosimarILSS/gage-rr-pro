import type { ToolFlags } from '../config/tools';
import type { CompanyDefaultTheme } from '../types/company';

type AdminPremiumMonthAction = 'add' | 'subtract' | 'set';

type ManageUserAccessPayload = {
  uid?: string;
  email: string;
  displayName?: string;
  createOnly?: boolean;
  premium?: boolean;
  unlimited?: boolean;
  months?: number;
  monthAction?: AdminPremiumMonthAction;
  toolAccess?: ToolFlags;
  premiumTools?: ToolFlags;
  companyId?: string | null;
};

type AdminCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
  logoAlt: string | null;
  primaryColor: string;
  headerColor: string;
  logoBackgroundColor: string;
  emailDomains: string[];
  emailDomain: string | null;
  emailDomainEnabled: boolean;
  defaultTheme: CompanyDefaultTheme;
  defaultToolAccess: ToolFlags;
  defaultPremiumTools: ToolFlags;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type CreateAdminCompanyPayload = {
  name: string;
  logoUrl?: string | null;
  logoAlt?: string | null;
  primaryColor: string;
  headerColor: string;
  logoBackgroundColor: string;
  emailDomains?: string[];
  emailDomain?: string | null;
  emailDomainEnabled?: boolean;
  defaultTheme?: CompanyDefaultTheme;
  defaultToolAccess?: ToolFlags;
  defaultPremiumTools?: ToolFlags;
};

type UpdateAdminCompanyPayload = CreateAdminCompanyPayload & {
  id: string;
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
  toolAccess: ToolFlags;
  premiumTools: ToolFlags;
  companyId: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
};

type ListAdminCompaniesResult = {
  ok: boolean;
  companies: AdminCompany[];
};

type CreateAdminCompanyResult = {
  ok: boolean;
  company: AdminCompany;
  affectedUsers?: number;
  customClaimsUpdated?: number;
  customClaimsFailed?: number;
};

type DeleteAdminCompanyResult = {
  ok: boolean;
  id: string;
  affectedUsers: number;
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
  monthActionApplied: AdminPremiumMonthAction | null;
  expiresAt: string | null;
  premiumGrantedAt: string | null;
  toolAccess: ToolFlags;
  premiumTools: ToolFlags;
  companyId: string | null;
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

export const listAdminCompanies = async (
  apiBaseUrl: string,
  token: string
): Promise<ListAdminCompaniesResult> => {
  const response = await fetch(`${apiBaseUrl}/api/admin/companies`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Could not list companies.');
  }

  return data as ListAdminCompaniesResult;
};

export const createAdminCompany = async (
  apiBaseUrl: string,
  token: string,
  payload: CreateAdminCompanyPayload
): Promise<CreateAdminCompanyResult> => {
  const response = await fetch(`${apiBaseUrl}/api/admin/companies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Could not create company.');
  }

  return data as CreateAdminCompanyResult;
};

export const updateAdminCompany = async (
  apiBaseUrl: string,
  token: string,
  payload: UpdateAdminCompanyPayload
): Promise<CreateAdminCompanyResult> => {
  const response = await fetch(`${apiBaseUrl}/api/admin/companies`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Could not update company.');
  }

  return data as CreateAdminCompanyResult;
};

export const deleteAdminCompany = async (
  apiBaseUrl: string,
  token: string,
  id: string
): Promise<DeleteAdminCompanyResult> => {
  const response = await fetch(`${apiBaseUrl}/api/admin/companies`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Could not delete company.');
  }

  return data as DeleteAdminCompanyResult;
};

export type {
  ManageUserAccessPayload,
  ManageUserAccessResult,
  AdminListedUser,
  AdminCompany,
  CreateAdminCompanyPayload,
  UpdateAdminCompanyPayload,
  ListAdminUsersResult,
  ListAdminCompaniesResult,
  ListAdminUsersParams,
  AdminSearchField,
  AdminPremiumStatusFilter,
  AdminPremiumMonthAction,
};
