import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Home,
  Image,
  KeyRound,
  LogOut,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  createAdminCompany,
  deleteAdminCompany,
  listAdminCompanies,
  listAdminUsers,
  manageUserAccess,
  updateAdminCompany,
  type AdminCompany,
  type AdminListedUser,
  type AdminPremiumStatusFilter,
  type AdminSearchField,
  type ListAdminUsersParams,
  type ManageUserAccessPayload,
  type ManageUserAccessResult,
} from '../services/admin-user';
import { auth } from '../firebase';
import { PLATFORM_TOOLS, buildDefaultToolFlags, normalizeToolFlags, type ToolFlags, type ToolId } from '../config/tools';
import AppNavbar from '../components/common/AppNavbar';
import type { AppTheme } from '../types/common';
import { DEFAULT_COMPANY_COLORS } from '../types/company';

type AdminUserAccessPageProps = {
  adminEmail: string;
  appTheme: AppTheme;
  onLogout: () => Promise<void>;
  onBackHome: () => void;
  onToggleTheme: () => void;
};

type AdminTab = 'users' | 'create' | 'companies';
type AccessMode = 'months' | 'vip' | 'none';

type UserEditorForm = {
  email: string;
  displayName: string;
  accessMode: AccessMode;
  monthsInput: string;
  companyId: string | null;
  toolAccess: ToolFlags;
  premiumTools: ToolFlags;
};

type CompanyForm = {
  name: string;
  noLogo: boolean;
  logoUrl: string;
  logoAlt: string;
  primaryColor: string;
  headerColor: string;
  logoBackgroundColor: string;
  useDefaultPrimaryColor: boolean;
  useDefaultHeaderColor: boolean;
  useDefaultLogoBackgroundColor: boolean;
  emailDomains: string[];
  emailDomainEnabled: boolean;
};

const LOGO_BACKGROUND_COLOR_PICKER_FALLBACK = '#ffffff';

const emptyUserForm = (): UserEditorForm => ({
  email: '',
  displayName: '',
  accessMode: 'months',
  monthsInput: '6',
  companyId: null,
  toolAccess: buildDefaultToolFlags(true),
  premiumTools: buildDefaultToolFlags(true),
});

const emptyCompanyForm = (): CompanyForm => ({
  name: '',
  noLogo: false,
  logoUrl: '',
  logoAlt: '',
  primaryColor: DEFAULT_COMPANY_COLORS.primaryColor,
  headerColor: DEFAULT_COMPANY_COLORS.headerColor,
  logoBackgroundColor: LOGO_BACKGROUND_COLOR_PICKER_FALLBACK,
  useDefaultPrimaryColor: true,
  useDefaultHeaderColor: true,
  useDefaultLogoBackgroundColor: true,
  emailDomains: [],
  emailDomainEnabled: false,
});

const companyToForm = (company: AdminCompany): CompanyForm => {
  const logoBackgroundColor = company.logoBackgroundColor || DEFAULT_COMPANY_COLORS.logoBackgroundColor;
  const useDefaultLogoBackgroundColor =
    logoBackgroundColor === DEFAULT_COMPANY_COLORS.logoBackgroundColor;
  const emailDomains =
    company.emailDomains?.length ? company.emailDomains : company.emailDomain ? [company.emailDomain] : [];

  return {
    name: company.name,
    noLogo: !company.logoUrl,
    logoUrl: company.logoUrl || '',
    logoAlt: company.logoAlt || '',
    primaryColor: company.primaryColor || DEFAULT_COMPANY_COLORS.primaryColor,
    headerColor: company.headerColor || DEFAULT_COMPANY_COLORS.headerColor,
    logoBackgroundColor: useDefaultLogoBackgroundColor
      ? LOGO_BACKGROUND_COLOR_PICKER_FALLBACK
      : logoBackgroundColor,
    useDefaultPrimaryColor: company.primaryColor === DEFAULT_COMPANY_COLORS.primaryColor,
    useDefaultHeaderColor: company.headerColor === DEFAULT_COMPANY_COLORS.headerColor,
    useDefaultLogoBackgroundColor,
    emailDomains,
    emailDomainEnabled: company.emailDomainEnabled === true && emailDomains.length > 0,
  };
};

const normalizeCompanyFormDomains = (domains: string[]) =>
  Array.from(
    new Set(
      domains
        .map((domain) => domain.trim().toLowerCase().replace(/^@+/, ''))
        .filter(Boolean)
    )
  );

const locale = 'es-MX';

export default function AdminUserAccessPage({
  adminEmail,
  appTheme,
  onLogout,
  onBackHome,
  onToggleTheme,
}: AdminUserAccessPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [createForm, setCreateForm] = useState<UserEditorForm>(() => emptyUserForm());
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [editingUser, setEditingUser] = useState<AdminListedUser | null>(null);
  const [editForm, setEditForm] = useState<UserEditorForm>(() => emptyUserForm());
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState<AdminCompany | null>(null);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(() => emptyCompanyForm());

  const [users, setUsers] = useState<AdminListedUser[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [searchField, setSearchField] = useState<AdminSearchField>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [premiumStatusFilter, setPremiumStatusFilter] = useState<AdminPremiumStatusFilter>('all');

  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const infiniteLoaderRef = useRef<HTMLDivElement | null>(null);
  const requestSeqRef = useRef(0);

  const apiBaseUrl = useMemo(
    () =>
      (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') ||
      (import.meta.env.DEV ? 'http://localhost:4242' : ''),
    []
  );

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies]
  );

  const listParams = useMemo<ListAdminUsersParams>(
    () => ({
      pageSize: 30,
      searchField,
      searchQuery,
      premiumStatus: premiumStatusFilter,
    }),
    [searchField, searchQuery, premiumStatusFilter]
  );

  const hasActiveFilters =
    Boolean(searchQuery) || searchField !== 'all' || premiumStatusFilter !== 'all';

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const getIdToken = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('No hay sesion activa.');
    return currentUser.getIdToken(true);
  };

  const loadCompanies = useCallback(async () => {
    setIsLoadingCompanies(true);
    setError(null);

    try {
      const token = await getIdToken();
      const data = await listAdminCompanies(apiBaseUrl, token);
      setCompanies(data.companies);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el listado de empresas.');
    } finally {
      setIsLoadingCompanies(false);
    }
  }, [apiBaseUrl]);

  const loadUsers = useCallback(
    async (
      append: boolean,
      pageToken: string | null = null,
      paramsOverride?: ListAdminUsersParams
    ) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoadingList(true);
        setUsers([]);
        setNextPageToken(null);
      }

      setError(null);
      setSuccess(null);

      const requestId = ++requestSeqRef.current;

      try {
        const token = await getIdToken();
        const params: ListAdminUsersParams = {
          ...(paramsOverride || listParams),
          pageToken,
          pageSize: 30,
        };
        const data = await listAdminUsers(apiBaseUrl, token, params);

        if (requestId !== requestSeqRef.current) return;

        setUsers((previous) => {
          if (!append) return data.users;

          const byUid = new Map<string, AdminListedUser>();
          previous.forEach((item) => byUid.set(item.uid, item));
          data.users.forEach((item) => byUid.set(item.uid, item));
          return Array.from(byUid.values());
        });
        setNextPageToken(data.nextPageToken);
      } catch (err: any) {
        if (requestId !== requestSeqRef.current) return;
        setError(err?.message || 'No se pudo cargar el listado de usuarios.');
      } finally {
        if (requestId !== requestSeqRef.current) return;

        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsLoadingList(false);
        }
      }
    },
    [apiBaseUrl, listParams]
  );

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    loadUsers(false, null, listParams);
  }, [loadUsers, listParams]);

  useEffect(() => {
    const target = infiniteLoaderRef.current;
    if (!target || !nextPageToken || isLoadingList || isLoadingMore || activeTab !== 'users') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!nextPageToken || isLoadingMore || isLoadingList) return;
        loadUsers(true, nextPageToken, listParams);
      },
      {
        root: null,
        rootMargin: '300px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, loadUsers, listParams, nextPageToken, isLoadingList, isLoadingMore]);

  const updateCreateForm = <K extends keyof UserEditorForm>(key: K, value: UserEditorForm[K]) => {
    setCreateForm((current) => ({ ...current, [key]: value }));
  };

  const updateEditForm = <K extends keyof UserEditorForm>(key: K, value: UserEditorForm[K]) => {
    setEditForm((current) => ({ ...current, [key]: value }));
  };

  const updateCompanyForm = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => {
    setCompanyForm((current) => ({ ...current, [key]: value }));
  };

  const addCompanyEmailDomain = () => {
    setCompanyForm((current) => ({
      ...current,
      emailDomains: [...current.emailDomains, ''],
    }));
  };

  const updateCompanyEmailDomain = (index: number, value: string) => {
    setCompanyForm((current) => ({
      ...current,
      emailDomains: current.emailDomains.map((domain, domainIndex) =>
        domainIndex === index ? value.trim().toLowerCase().replace(/^@+/, '') : domain
      ),
    }));
  };

  const removeCompanyEmailDomain = (index: number) => {
    setCompanyForm((current) => ({
      ...current,
      emailDomains: current.emailDomains.filter((_, domainIndex) => domainIndex !== index),
    }));
  };

  const setCompanyColorDefault = (
    colorKey: 'primaryColor' | 'headerColor' | 'logoBackgroundColor',
    defaultKey: 'useDefaultPrimaryColor' | 'useDefaultHeaderColor' | 'useDefaultLogoBackgroundColor',
    defaultColor: string,
    enabled: boolean
  ) => {
    const fallbackColor =
      defaultColor === DEFAULT_COMPANY_COLORS.logoBackgroundColor
        ? LOGO_BACKGROUND_COLOR_PICKER_FALLBACK
        : defaultColor;

    setCompanyForm((current) => ({
      ...current,
      [defaultKey]: enabled,
      [colorKey]: enabled ? fallbackColor : current[colorKey],
    }));
  };

  const normalizeMonthInput = (rawValue: string) => {
    const onlyDigits = rawValue.replace(/\D/g, '');
    if (!onlyDigits) return '';
    return onlyDigits.replace(/^0+(?=\d)/, '');
  };

  const toggleToolFlag = (flags: ToolFlags, toolId: ToolId): ToolFlags => ({
    ...flags,
    [toolId]: !flags[toolId],
  });

  const formatDate = (value: string | null): string => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString(locale);
  };

  const getCompanyLabel = (companyId: string | null | undefined) => {
    if (!companyId) return 'Sin empresa';
    return companyById.get(companyId)?.name || 'Empresa no encontrada';
  };

  const getCompanyLogoAlt = (company: AdminCompany) =>
    company.logoAlt || company.name || 'Logo de empresa';

  const getInitials = (user: AdminListedUser): string => {
    const source = (user.displayName || user.email || '').trim();
    if (!source) return 'U';

    const chunks = source.split(/\s+/).filter(Boolean);
    if (chunks.length >= 2) return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
    return source.slice(0, 2).toUpperCase();
  };

  const summarizeTools = (flags: ToolFlags) => {
    const selected = PLATFORM_TOOLS.filter((tool) => flags[tool.id]);
    if (selected.length === PLATFORM_TOOLS.length) return 'Todas';
    if (selected.length === 0) return 'Ninguna';
    return selected.map((tool) => tool.label).join(', ');
  };

  const getPremiumState = (user: AdminListedUser) => {
    if (user.premiumActive && user.premiumUnlimited) {
      return {
        label: 'VIP ilimitado',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }

    if (user.premiumActive) {
      return {
        label: 'Activo',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }

    if (user.premium && user.premiumExpiresAt) {
      return {
        label: 'Expirado',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }

    return {
      label: 'Sin acceso',
      className: 'bg-slate-50 text-slate-700 border-slate-200',
    };
  };

  const validateUserForm = (form: UserEditorForm) => {
    const email = form.email.trim().toLowerCase();
    const displayName = form.displayName.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const months = Number(form.monthsInput);

    if (!email || !emailRegex.test(email)) {
      return { errorMessage: 'Ingresa un correo valido.', email, displayName, months };
    }

    if (displayName.length > 120) {
      return { errorMessage: 'El nombre visible no puede exceder 120 caracteres.', email, displayName, months };
    }

    if (form.accessMode === 'months' && (!Number.isInteger(months) || months <= 0)) {
      return { errorMessage: 'Los meses deben ser un numero entero mayor a 0.', email, displayName, months };
    }

    return { errorMessage: null, email, displayName, months };
  };

  const buildUserPayload = (
    form: UserEditorForm,
    options: { uid?: string; createOnly?: boolean }
  ): ManageUserAccessPayload | null => {
    const validation = validateUserForm(form);
    if (validation.errorMessage) {
      setError(validation.errorMessage);
      return null;
    }

    return {
      ...options,
      email: validation.email,
      displayName: validation.displayName,
      createOnly: options.createOnly,
      premium: form.accessMode !== 'none',
      unlimited: form.accessMode === 'vip',
      months: form.accessMode === 'months' ? validation.months : undefined,
      monthAction: form.accessMode === 'months' ? 'set' : undefined,
      companyId: form.companyId,
      toolAccess: form.toolAccess,
      premiumTools: form.premiumTools,
    };
  };

  const updateRowFromResult = (result: ManageUserAccessResult) => {
    setUsers((previous) =>
      previous.map((item) => {
        if (item.uid !== result.uid) return item;

        const expirationMs = result.expiresAt ? new Date(result.expiresAt).getTime() : null;
        const premiumActive =
          result.premium && (result.unlimited || (expirationMs != null && expirationMs > Date.now()));

        return {
          ...item,
          email: result.email,
          displayName: result.displayName,
          premium: result.premium,
          premiumActive,
          premiumUnlimited: result.premium && result.unlimited,
          premiumExpiresAt: result.premium ? result.expiresAt : null,
          premiumGrantedAt:
            result.premium
              ? result.premiumGrantedAt || item.premiumGrantedAt || new Date().toISOString()
              : null,
          toolAccess: normalizeToolFlags(result.toolAccess, true),
          premiumTools: normalizeToolFlags(result.premiumTools, true),
          companyId: result.companyId,
        };
      })
    );
  };

  const handleCreateUser = async () => {
    const payload = buildUserPayload(createForm, { createOnly: true });
    if (!payload) return;
    if (!createForm.companyId) {
      delete payload.companyId;
    }

    setIsCreatingUser(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getIdToken();
      const result = await manageUserAccess(apiBaseUrl, token, payload);
      await loadUsers(false, null, listParams);

      setCreateForm(emptyUserForm());
      setActiveTab('users');
      setSuccess(`Usuario creado: ${result.email}.`);
    } catch (err: any) {
      const message = err?.message || '';
      setError(
        message.includes('User already exists')
          ? 'Ese usuario ya existe. Usa Editar usuario desde la tabla.'
          : message || 'No se pudo crear el usuario.'
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const buildCompanyPayload = () => {
    const normalizedName = companyForm.name.trim();
    const normalizedLogoUrl = companyForm.noLogo ? '' : companyForm.logoUrl.trim();
    const normalizedLogoAlt = companyForm.noLogo ? '' : companyForm.logoAlt.trim();
    const normalizedEmailDomains = normalizeCompanyFormDomains(companyForm.emailDomains);
    const primaryColor = companyForm.useDefaultPrimaryColor
      ? DEFAULT_COMPANY_COLORS.primaryColor
      : companyForm.primaryColor;
    const headerColor = companyForm.useDefaultHeaderColor
      ? DEFAULT_COMPANY_COLORS.headerColor
      : companyForm.headerColor;
    const logoBackgroundColor = companyForm.useDefaultLogoBackgroundColor
      ? DEFAULT_COMPANY_COLORS.logoBackgroundColor
      : companyForm.logoBackgroundColor;

    if (!normalizedName) {
      setError('Ingresa el nombre de la empresa.');
      return null;
    }

    if (companyForm.emailDomainEnabled && normalizedEmailDomains.length === 0) {
      setError('Agrega por lo menos un dominio de correo o desactiva la regla automatica.');
      return null;
    }

    return {
      name: normalizedName,
      logoUrl: normalizedLogoUrl || null,
      logoAlt: normalizedLogoAlt || null,
      primaryColor,
      headerColor,
      logoBackgroundColor,
      emailDomains: normalizedEmailDomains,
      emailDomain: normalizedEmailDomains[0] || null,
      emailDomainEnabled: companyForm.emailDomainEnabled && normalizedEmailDomains.length > 0,
    };
  };

  const resetCompanyEditor = () => {
    setEditingCompany(null);
    setCompanyForm(emptyCompanyForm());
  };

  const handleSaveCompany = async () => {
    const payload = buildCompanyPayload();
    if (!payload) return;

    setIsCreatingCompany(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getIdToken();
      const result = editingCompany
        ? await updateAdminCompany(apiBaseUrl, token, { id: editingCompany.id, ...payload })
        : await createAdminCompany(apiBaseUrl, token, payload);

      setCompanies((current) => {
        const next = editingCompany
          ? current.map((company) => (company.id === result.company.id ? result.company : company))
          : [...current, result.company];
        return next.sort((a, b) => a.name.localeCompare(b.name, locale));
      });
      resetCompanyEditor();
      setSuccess(
        editingCompany
          ? `Empresa actualizada: ${result.company.name}.`
          : `Empresa creada: ${result.company.name}.`
      );
    } catch (err: any) {
      const message = err?.message || '';
      setError(
        message.includes('Domain already assigned')
          ? 'Ese dominio ya esta activo en otra empresa.'
          : message || 'No se pudo guardar la empresa.'
      );
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const handleEditCompany = (company: AdminCompany) => {
    setEditingCompany(company);
    setCompanyForm(companyToForm(company));
    setError(null);
    setSuccess(null);
  };

  const handleDeleteCompany = async (company: AdminCompany) => {
    const confirmed = window.confirm(
      `¿Borrar la empresa "${company.name}"? Los usuarios asignados volveran al diseño default.`
    );
    if (!confirmed) return;

    setDeletingCompanyId(company.id);
    setError(null);
    setSuccess(null);

    try {
      const token = await getIdToken();
      const result = await deleteAdminCompany(apiBaseUrl, token, company.id);

      setCompanies((current) => current.filter((item) => item.id !== company.id));
      setUsers((current) =>
        current.map((user) =>
          user.companyId === company.id ? { ...user, companyId: null } : user
        )
      );
      if (editingCompany?.id === company.id) resetCompanyEditor();

      setSuccess(
        `Empresa borrada: ${company.name}. Usuarios actualizados: ${result.affectedUsers}.`
      );
    } catch (err: any) {
      setError(err?.message || 'No se pudo borrar la empresa.');
    } finally {
      setDeletingCompanyId(null);
    }
  };

  const openEditUserModal = (user: AdminListedUser) => {
    setEditingUser(user);
    setEditForm({
      email: user.email || '',
      displayName: user.displayName || '',
      accessMode: user.premium ? (user.premiumUnlimited ? 'vip' : 'months') : 'none',
      monthsInput: '6',
      companyId: user.companyId || null,
      toolAccess: normalizeToolFlags(user.toolAccess, true),
      premiumTools: normalizeToolFlags(user.premiumTools, true),
    });
    setError(null);
    setSuccess(null);
  };

  const closeEditUserModal = () => {
    setEditingUser(null);
    setEditForm(emptyUserForm());
    setIsSavingEdit(false);
  };

  const handleSaveEditedUser = async () => {
    if (!editingUser) return;

    const payload = buildUserPayload(editForm, { uid: editingUser.uid });
    if (!payload) return;

    setIsSavingEdit(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getIdToken();
      const result = await manageUserAccess(apiBaseUrl, token, payload);
      updateRowFromResult(result);
      closeEditUserModal();
      setSuccess(`Usuario actualizado: ${result.email}.`);
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar el usuario.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const renderToolCheckboxes = (
    flags: ToolFlags,
    onChange: (next: ToolFlags) => void
  ) => (
    <div className="flex flex-wrap gap-2">
      {PLATFORM_TOOLS.map((tool) => (
        <label
          key={tool.id}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <input
            type="checkbox"
            checked={flags[tool.id]}
            onChange={() => onChange(toggleToolFlag(flags, tool.id))}
            className="accent-indigo-600"
          />
          {tool.label}
        </label>
      ))}
    </div>
  );

  const renderCompanySelect = (
    companyId: string | null,
    onChange: (companyId: string | null) => void
  ) => {
    const selectedCompany = companyId ? companyById.get(companyId) : null;

    return (
      <div className="space-y-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Empresa</span>
          <select
            value={companyId || ''}
            onChange={(event) => onChange(event.target.value || null)}
            className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">Sin empresa</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>

        <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden bg-white shrink-0"
            style={selectedCompany ? { backgroundColor: selectedCompany.logoBackgroundColor } : undefined}
          >
            {selectedCompany?.logoUrl ? (
              <img
                src={selectedCompany.logoUrl}
                alt={getCompanyLogoAlt(selectedCompany)}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <Building2 className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {getCompanyLabel(companyId)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedCompany ? 'Marca aplicada al iniciar sesion.' : 'Usara el diseno default.'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderUserFormFields = (
    form: UserEditorForm,
    updateForm: <K extends keyof UserEditorForm>(key: K, value: UserEditorForm[K]) => void,
    mode: 'create' | 'edit'
  ) => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Correo</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateForm('email', event.target.value)}
            placeholder="usuario@dominio.com"
            className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Nombre visible</span>
          <input
            type="text"
            value={form.displayName}
            onChange={(event) => updateForm('displayName', event.target.value)}
            placeholder="Nombre del usuario"
            className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        {renderCompanySelect(form.companyId, (nextCompanyId) => updateForm('companyId', nextCompanyId))}

        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Estado premium</span>
            <select
              value={form.accessMode}
              onChange={(event) => updateForm('accessMode', event.target.value as AccessMode)}
              className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="months">Premium con vencimiento</option>
              <option value="vip">VIP ilimitado</option>
              <option value="none">Sin premium</option>
            </select>
          </label>

          {form.accessMode === 'months' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">
                {mode === 'edit' ? 'Meses desde hoy' : 'Meses iniciales'}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={form.monthsInput}
                onChange={(event) => updateForm('monthsInput', normalizeMonthInput(event.target.value))}
                className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </label>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
          <div className="flex items-start gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Herramientas disponibles</p>
              <p className="text-xs text-slate-500 mt-1">
                Controla que herramientas puede abrir.
              </p>
            </div>
          </div>
          {renderToolCheckboxes(form.toolAccess, (next) => updateForm('toolAccess', next))}
        </div>

        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
          <div className="flex items-start gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Beneficio premium</p>
              <p className="text-xs text-slate-500 mt-1">
                Solo aplica si el usuario tiene premium activo.
              </p>
            </div>
          </div>
          {renderToolCheckboxes(form.premiumTools, (next) => updateForm('premiumTools', next))}
        </div>
      </div>
    </div>
  );

  const renderAdminTabs = () => {
    const tabs: Array<{ id: AdminTab; label: string; icon: typeof Users }> = [
      { id: 'users', label: 'Usuarios', icon: Users },
      { id: 'create', label: 'Crear usuario', icon: UserPlus },
      { id: 'companies', label: 'Empresas', icon: Building2 },
    ];

    return (
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-2 p-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setError(null);
                  setSuccess(null);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderUsersTab = () => (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Usuarios</h2>
          <p className="text-sm text-slate-500 mt-1">
            Consulta usuarios y edita su perfil, empresa, permisos y premium desde un solo modal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-indigo-600 border border-indigo-600 hover:bg-indigo-700 rounded-xl px-4 py-2.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo usuario
          </button>
          <button
            type="button"
            onClick={() => loadUsers(false, null, listParams)}
            disabled={isLoadingList}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
            Recargar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_220px_minmax(0,1fr)] gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Filtrar por</span>
          <select
            value={searchField}
            onChange={(event) => setSearchField(event.target.value as AdminSearchField)}
            className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">Correo o nombre</option>
            <option value="email">Solo correo</option>
            <option value="displayName">Solo nombre</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Estado premium</span>
          <select
            value={premiumStatusFilter}
            onChange={(event) => setPremiumStatusFilter(event.target.value as AdminPremiumStatusFilter)}
            className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="all">Todos</option>
            <option value="active">Activo</option>
            <option value="expired">Expirado</option>
            <option value="vip">VIP ilimitado</option>
            <option value="noAccess">Sin acceso</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Busqueda rapida</span>
          <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-300">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="correo@dominio.com o nombre"
              className="w-full bg-transparent outline-none text-sm"
            />
          </div>
        </label>
      </div>

      {isLoadingList ? (
        <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4">
          Cargando usuarios...
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="min-w-[1120px] w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-slate-700">
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Empresa</th>
                <th className="px-4 py-3 font-semibold">Premium</th>
                <th className="px-4 py-3 font-semibold">Herramientas</th>
                <th className="px-4 py-3 font-semibold">Fechas</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const assignedCompany = user.companyId ? companyById.get(user.companyId) : null;
                const state = getPremiumState(user);

                return (
                  <tr key={user.uid} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt={user.displayName || user.email || 'Avatar'}
                            className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center font-semibold">
                            {getInitials(user)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {user.displayName || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{user.email || 'Sin correo'}</p>
                          <p className="text-[11px] text-slate-400 truncate">UID: {user.uid}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 bg-slate-100"
                          style={assignedCompany ? { backgroundColor: assignedCompany.logoBackgroundColor } : undefined}
                        >
                          {assignedCompany?.logoUrl ? (
                            <img
                              src={assignedCompany.logoUrl}
                              alt={getCompanyLogoAlt(assignedCompany)}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Building2 className="w-4 h-4 text-slate-500" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {getCompanyLabel(user.companyId)}
                          </p>
                          {user.companyId && !assignedCompany && (
                            <p className="text-xs text-amber-600">No encontrada</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg border text-xs font-medium ${state.className}`}>
                        {state.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 space-y-1">
                      <p>
                        <span className="font-semibold text-slate-700">Acceso:</span> {summarizeTools(user.toolAccess)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Premium:</span> {summarizeTools(user.premiumTools)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 space-y-1">
                      <p>
                        <span className="font-semibold text-slate-700">Alta:</span> {formatDate(user.createdAt)}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Vence:</span> {formatDate(user.premiumExpiresAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={!user.email}
                        onClick={() => openEditUserModal(user)}
                        className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl px-4 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Pencil className="w-4 h-4" />
                        Editar usuario
                      </button>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    {hasActiveFilters
                      ? 'No se encontraron usuarios con ese filtro.'
                      : 'No hay usuarios para mostrar.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Carga progresiva activa: 30 usuarios por bloque con scroll automatico.
        </p>
        {nextPageToken && (
          <button
            type="button"
            onClick={() => loadUsers(true, nextPageToken, listParams)}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg px-3 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoadingMore ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Cargando...
              </>
            ) : (
              'Cargar mas usuarios'
            )}
          </button>
        )}
      </div>

      <div ref={infiniteLoaderRef} className="h-2" aria-hidden="true" />
    </div>
  );

  const renderCreateUserTab = () => (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Crear usuario</h2>
          <p className="text-sm text-slate-500 mt-1">
            Alta manual de usuarios con empresa, permisos y premium inicial.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateForm(emptyUserForm())}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl px-4 py-2.5 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Limpiar
        </button>
      </div>

      {renderUserFormFields(createForm, updateCreateForm, 'create')}

      <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-slate-500">
          Si el correo ya existe, usa la accion Editar usuario desde la tabla.
        </p>
        <button
          type="button"
          onClick={handleCreateUser}
          disabled={isCreatingUser}
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-indigo-600 border border-indigo-600 hover:bg-indigo-700 rounded-xl px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {isCreatingUser ? 'Creando...' : 'Crear usuario'}
        </button>
      </div>
    </div>
  );

  const renderCompaniesTab = () => (
    <div className="p-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Empresas</h2>
            <p className="text-sm text-slate-500 mt-1">
              Configuraciones de marca disponibles para asignar a usuarios.
            </p>
          </div>
          <button
            type="button"
            onClick={loadCompanies}
            disabled={isLoadingCompanies}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingCompanies ? 'animate-spin' : ''}`} />
            Recargar
          </button>
        </div>

        {isLoadingCompanies ? (
          <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4">
            Cargando empresas...
          </div>
        ) : companies.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
            Todavia no hay empresas registradas.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {companies.map((company) => {
              const emailDomains =
                company.emailDomains?.length
                  ? company.emailDomains
                  : company.emailDomain
                    ? [company.emailDomain]
                    : [];

              return (
              <div key={company.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-start gap-3">
                  <div
                    className="w-14 h-14 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0"
                    style={{ backgroundColor: company.logoBackgroundColor }}
                  >
                    {company.logoUrl ? (
                      <img
                        src={company.logoUrl}
                        alt={getCompanyLogoAlt(company)}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{company.name}</p>
                    <p className="text-xs text-slate-500 truncate">ID: {company.id}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1 bg-white">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-300"
                          style={{ backgroundColor: company.primaryColor }}
                        />
                        Primario
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1 bg-white">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-300"
                          style={{ backgroundColor: company.headerColor }}
                        />
                        Header
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs border rounded-lg px-2 py-1 bg-white ${
                          company.emailDomainEnabled && emailDomains.length > 0
                            ? 'text-emerald-700 border-emerald-200'
                            : 'text-slate-500 border-slate-200'
                        }`}
                      >
                        {company.emailDomainEnabled && emailDomains.length > 0
                          ? emailDomains.map((domain) => `@${domain}`).join(', ')
                          : 'Dominio inactivo'}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditCompany(company)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCompany(company)}
                        disabled={deletingCompanyId === company.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingCompanyId === company.id ? 'Borrando...' : 'Borrar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
        <div className="flex items-start gap-2">
          <Palette className="w-4 h-4 text-indigo-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {editingCompany ? 'Editar empresa' : 'Crear empresa'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {editingCompany
                ? `Editando: ${editingCompany.name}`
                : 'El logo se guarda como URL publica; los colores se aplican al usuario asignado.'}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Nombre</span>
            <input
              type="text"
              value={companyForm.name}
              onChange={(event) => updateCompanyForm('name', event.target.value)}
              placeholder="Nombre de la empresa"
              className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Logo</p>
                <p className="text-xs text-slate-500 mt-1">
                  Puedes crear la empresa sin logo y conservar solo el fondo.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 shrink-0">
                <input
                  type="checkbox"
                  checked={companyForm.noLogo}
                  onChange={(event) =>
                    setCompanyForm((current) => ({
                      ...current,
                      noLogo: event.target.checked,
                      logoUrl: event.target.checked ? '' : current.logoUrl,
                      logoAlt: event.target.checked ? '' : current.logoAlt,
                    }))
                  }
                  className="accent-indigo-600"
                />
                Sin logo
              </label>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="w-16 h-16 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0"
                style={{
                  backgroundColor: companyForm.useDefaultLogoBackgroundColor
                    ? DEFAULT_COMPANY_COLORS.logoBackgroundColor
                    : companyForm.logoBackgroundColor,
                }}
              >
                {!companyForm.noLogo && companyForm.logoUrl ? (
                  <img
                    src={companyForm.logoUrl}
                    alt={companyForm.logoAlt || companyForm.name || 'Logo de empresa'}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Building2 className="w-7 h-7 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">URL del logo</span>
                  <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-indigo-300">
                    <Image className="w-4 h-4 text-slate-400" />
                    <input
                      type="url"
                      value={companyForm.logoUrl}
                      disabled={companyForm.noLogo}
                      onChange={(event) => updateCompanyForm('logoUrl', event.target.value)}
                      placeholder={companyForm.noLogo ? 'Sin logo' : 'https://...'}
                      className="w-full bg-transparent outline-none text-sm disabled:opacity-60"
                    />
                  </div>
                </label>
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Texto alternativo del logo</span>
              <input
                type="text"
                value={companyForm.logoAlt}
                disabled={companyForm.noLogo}
                onChange={(event) => updateCompanyForm('logoAlt', event.target.value)}
                placeholder={companyForm.noLogo ? 'Sin logo' : 'Opcional'}
                className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Dominio de correo</p>
                <p className="text-xs text-slate-500 mt-1">
                  Asigna esta empresa automaticamente a usuarios sin empresa cuyo correo coincida.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 shrink-0">
                <input
                  type="checkbox"
                  checked={companyForm.emailDomainEnabled}
                  onChange={(event) => updateCompanyForm('emailDomainEnabled', event.target.checked)}
                  className="accent-indigo-600"
                />
                Activo
              </label>
            </div>

            <div className="space-y-2">
              {companyForm.emailDomains.length === 0 ? (
                <div className="text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl p-3">
                  No hay dominios agregados.
                </div>
              ) : (
                companyForm.emailDomains.map((domain, index) => (
                  <label key={index} className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">
                      Dominio {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2 border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-indigo-300">
                        <span className="text-sm font-semibold text-slate-400">@</span>
                        <input
                          type="text"
                          value={domain}
                          onChange={(event) => updateCompanyEmailDomain(index, event.target.value)}
                          placeholder="bimbo.mx"
                          className="w-full bg-transparent outline-none text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCompanyEmailDomain(index)}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                        aria-label={`Quitar dominio ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </label>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={addCompanyEmailDomain}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <Plus className="w-4 h-4" />
              Agregar dominio
            </button>

            <p className="text-xs text-slate-500">
              Si esta inactivo o sin dominios, no se aplica ninguna asignacion automatica por dominio.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {renderColorControl(
              'Primario',
              'primaryColor',
              'useDefaultPrimaryColor',
              DEFAULT_COMPANY_COLORS.primaryColor
            )}
            {renderColorControl(
              'Header',
              'headerColor',
              'useDefaultHeaderColor',
              DEFAULT_COMPANY_COLORS.headerColor
            )}
            {renderColorControl(
              'Fondo logo',
              'logoBackgroundColor',
              'useDefaultLogoBackgroundColor',
              DEFAULT_COMPANY_COLORS.logoBackgroundColor
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {editingCompany && (
              <button
                type="button"
                onClick={resetCompanyEditor}
                disabled={isCreatingCompany}
                className="inline-flex flex-1 items-center justify-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveCompany}
              disabled={isCreatingCompany}
              className="inline-flex flex-1 items-center justify-center gap-2 text-sm font-semibold text-white bg-indigo-600 border border-indigo-600 hover:bg-indigo-700 rounded-xl px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isCreatingCompany
                ? 'Guardando...'
                : editingCompany
                  ? 'Guardar cambios'
                  : 'Crear empresa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderColorControl = (
    label: string,
    colorKey: 'primaryColor' | 'headerColor' | 'logoBackgroundColor',
    defaultKey: 'useDefaultPrimaryColor' | 'useDefaultHeaderColor' | 'useDefaultLogoBackgroundColor',
    defaultColor: string
  ) => {
    const usesDefault = companyForm[defaultKey];
    const isTransparentDefault =
      usesDefault && defaultColor === DEFAULT_COMPANY_COLORS.logoBackgroundColor;
    const rawColorValue = usesDefault ? defaultColor : companyForm[colorKey];
    const colorValue =
      rawColorValue === DEFAULT_COMPANY_COLORS.logoBackgroundColor
        ? LOGO_BACKGROUND_COLOR_PICKER_FALLBACK
        : rawColorValue;
    const visibleLabel = isTransparentDefault ? 'TRANSPARENTE' : colorValue.toUpperCase();

    return (
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-600">{label}</span>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={usesDefault}
              onChange={(event) =>
                setCompanyColorDefault(colorKey, defaultKey, defaultColor, event.target.checked)
              }
              className="accent-indigo-600"
            />
            Predeterminado
          </label>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2 items-center">
          <input
            type="color"
            value={colorValue}
            disabled={usesDefault}
            onChange={(event) => updateCompanyForm(colorKey, event.target.value)}
            className="h-11 w-full border border-slate-300 rounded-xl bg-white p-1 disabled:opacity-60"
          />
          <span className="text-xs font-semibold text-slate-500 text-right tabular-nums">
            {visibleLabel}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen app-shell font-sans">
      <AppNavbar
        lang="es"
        appTheme={appTheme}
        onToggleTheme={onToggleTheme}
        left={
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1">
              <ShieldCheck className="w-4 h-4" />
              Acceso administrativo restringido
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mt-3">Administracion</h1>
            <p className="text-sm text-slate-600 mt-1">Sesion autorizada: {adminEmail}</p>
          </div>
        }
        right={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Inicio
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesion
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {renderAdminTabs()}

          {(error || success) && (
            <div className="p-5 pb-0 space-y-3">
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  {success}
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'create' && renderCreateUserTab()}
          {activeTab === 'companies' && renderCompaniesTab()}
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar editor de usuario"
            onClick={closeEditUserModal}
            className="absolute inset-0 bg-slate-900/50 cursor-pointer"
          />
          <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
                  <UserCog className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-800">Editar usuario</h3>
                  <p className="text-sm text-slate-500 mt-1 truncate">
                    UID: {editingUser.uid}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditUserModal}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-154px)]">
              <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500">Alta</p>
                  <p className="text-sm text-slate-800 mt-1">{formatDate(editingUser.createdAt)}</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500">Premium obtenido</p>
                  <p className="text-sm text-slate-800 mt-1">{formatDate(editingUser.premiumGrantedAt)}</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500">Vencimiento actual</p>
                  <p className="text-sm text-slate-800 mt-1">{formatDate(editingUser.premiumExpiresAt)}</p>
                </div>
              </div>

              <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  Al guardar con premium por meses, la vigencia se ajusta desde hoy con el numero de meses indicado.
                </p>
              </div>

              {renderUserFormFields(editForm, updateEditForm, 'edit')}
            </div>

            <div className="p-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <button
                type="button"
                onClick={closeEditUserModal}
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl px-5 py-2.5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditedUser}
                disabled={isSavingEdit}
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-indigo-600 border border-indigo-600 hover:bg-indigo-700 rounded-xl px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isSavingEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
