import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Home,
  Image,
  KeyRound,
  LogOut,
  Palette,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  createAdminCompany,
  listAdminCompanies,
  listAdminUsers,
  manageUserAccess,
  type AdminCompany,
  type AdminPremiumMonthAction,
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

type AdminUserAccessPageProps = {
  adminEmail: string;
  appTheme: AppTheme;
  onLogout: () => Promise<void>;
  onBackHome: () => void;
  onToggleTheme: () => void;
};

export default function AdminUserAccessPage({
  adminEmail,
  appTheme,
  onLogout,
  onBackHome,
  onToggleTheme,
}: AdminUserAccessPageProps) {
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserAccessMode, setNewUserAccessMode] = useState<'months' | 'vip' | 'none'>('months');
  const [newUserMonthsInput, setNewUserMonthsInput] = useState('6');
  const [newUserToolAccess, setNewUserToolAccess] = useState<ToolFlags>(() => buildDefaultToolFlags(true));
  const [newUserPremiumTools, setNewUserPremiumTools] = useState<ToolFlags>(() => buildDefaultToolFlags(true));
  const [newUserCompanyId, setNewUserCompanyId] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    logoUrl: '',
    logoAlt: '',
    primaryColor: '#2476ff',
    headerColor: '#0e1628',
    logoBackgroundColor: '#ffffff',
  });
  const [companyModalTarget, setCompanyModalTarget] = useState<
    { type: 'new' } | { type: 'existing'; user: AdminListedUser } | null
  >(null);

  const [users, setUsers] = useState<AdminListedUser[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [monthsByUser, setMonthsByUser] = useState<Record<string, string>>({});
  const [toolAccessByUser, setToolAccessByUser] = useState<Record<string, ToolFlags>>({});
  const [premiumToolsByUser, setPremiumToolsByUser] = useState<Record<string, ToolFlags>>({});

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

  const getCompanyLabel = (companyId: string | null | undefined) => {
    if (!companyId) return 'Sin empresa';
    return companyById.get(companyId)?.name || 'Empresa no encontrada';
  };

  const getCompanyLogoAlt = (company: AdminCompany) =>
    company.logoAlt || company.name || 'Logo de empresa';

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

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

  const loadCompanies = useCallback(async () => {
    setIsLoadingCompanies(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No hay sesion activa.');
      }

      const token = await currentUser.getIdToken(true);
      const data = await listAdminCompanies(apiBaseUrl, token);
      setCompanies(data.companies);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el listado de empresas.');
    } finally {
      setIsLoadingCompanies(false);
    }
  }, [apiBaseUrl]);

  const formatDate = (value: string | null): string => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('es-MX');
  };

  const getInitials = (user: AdminListedUser): string => {
    const source = (user.displayName || user.email || '').trim();
    if (!source) return 'U';

    const chunks = source.split(/\s+/).filter(Boolean);
    if (chunks.length >= 2) {
      return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  };

  const summarizeTools = (flags: ToolFlags) => {
    const selected = PLATFORM_TOOLS.filter((tool) => flags[tool.id]);
    if (selected.length === PLATFORM_TOOLS.length) return 'Todas';
    if (selected.length === 0) return 'Ninguna';
    return selected.map((tool) => tool.label).join(', ');
  };

  const toggleToolFlag = (flags: ToolFlags, toolId: ToolId): ToolFlags => ({
    ...flags,
    [toolId]: !flags[toolId],
  });

  const updateRowFromResult = (targetEmail: string, result: ManageUserAccessResult) => {
    setUsers((previous) =>
      previous.map((item) => {
        if (item.email !== targetEmail.toLowerCase()) return item;

        const expirationMs = result.expiresAt ? new Date(result.expiresAt).getTime() : null;
        const premiumActive =
          result.premium && (result.unlimited || (expirationMs != null && expirationMs > Date.now()));

        return {
          ...item,
          displayName: result.displayName || item.displayName,
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

    setToolAccessByUser((previous) => ({
      ...previous,
      [result.uid]: normalizeToolFlags(result.toolAccess, true),
    }));
    setPremiumToolsByUser((previous) => ({
      ...previous,
      [result.uid]: normalizeToolFlags(result.premiumTools, true),
    }));
  };

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
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No hay sesion activa.');
        }

        const token = await currentUser.getIdToken(true);
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

        setMonthsByUser((previous) => {
          const next = { ...previous };
          data.users.forEach((item) => {
            if (next[item.uid] == null) next[item.uid] = '6';
          });
          return next;
        });
        setToolAccessByUser((previous) => {
          const next = append ? { ...previous } : {};
          data.users.forEach((item) => {
            next[item.uid] = normalizeToolFlags(item.toolAccess, true);
          });
          return next;
        });
        setPremiumToolsByUser((previous) => {
          const next = append ? { ...previous } : {};
          data.users.forEach((item) => {
            next[item.uid] = normalizeToolFlags(item.premiumTools, true);
          });
          return next;
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
    if (!target || !nextPageToken || isLoadingList || isLoadingMore) return;

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
  }, [loadUsers, listParams, nextPageToken, isLoadingList, isLoadingMore]);

  const handleMonthsChange = (uid: string, rawValue: string) => {
    const onlyDigits = rawValue.replace(/\D/g, '');
    if (!onlyDigits) {
      setMonthsByUser((previous) => ({ ...previous, [uid]: '' }));
      return;
    }

    const normalized = onlyDigits.replace(/^0+(?=\d)/, '');
    setMonthsByUser((previous) => ({ ...previous, [uid]: normalized }));
  };

  const handleNewUserMonthsChange = (rawValue: string) => {
    const onlyDigits = rawValue.replace(/\D/g, '');
    if (!onlyDigits) {
      setNewUserMonthsInput('');
      return;
    }
    const normalized = onlyDigits.replace(/^0+(?=\d)/, '');
    setNewUserMonthsInput(normalized);
  };

  const updateCompanyForm = (key: keyof typeof companyForm, value: string) => {
    setCompanyForm((current) => ({ ...current, [key]: value }));
  };

  const handleCreateCompany = async () => {
    const normalizedName = companyForm.name.trim();
    const normalizedLogoUrl = companyForm.logoUrl.trim();
    const normalizedLogoAlt = companyForm.logoAlt.trim();

    if (!normalizedName) {
      setError('Ingresa el nombre de la empresa.');
      return;
    }

    setIsCreatingCompany(true);
    setError(null);
    setSuccess(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No hay sesión activa.');
      }

      const token = await currentUser.getIdToken(true);
      const result = await createAdminCompany(apiBaseUrl, token, {
        name: normalizedName,
        logoUrl: normalizedLogoUrl || null,
        logoAlt: normalizedLogoAlt || null,
        primaryColor: companyForm.primaryColor,
        headerColor: companyForm.headerColor,
        logoBackgroundColor: companyForm.logoBackgroundColor,
      });

      setCompanies((current) =>
        [...current, result.company].sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))
      );
      setCompanyForm({
        name: '',
        logoUrl: '',
        logoAlt: '',
        primaryColor: '#2476ff',
        headerColor: '#0e1628',
        logoBackgroundColor: '#ffffff',
      });
      setSuccess(`Empresa creada: ${result.company.name}.`);
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la empresa.');
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const handleCreateUser = async () => {
    const normalizedEmail = newUserEmail.trim().toLowerCase();
    const normalizedDisplayName = newUserDisplayName.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
      setError('Ingresa un correo válido para crear el usuario.');
      return;
    }

    if (normalizedDisplayName.length > 120) {
      setError('El nombre opcional no puede exceder 120 caracteres.');
      return;
    }

    const months = Number(newUserMonthsInput);
    if (newUserAccessMode === 'months' && (!Number.isInteger(months) || months <= 0)) {
      setError('Los meses deben ser un número entero mayor a 0.');
      return;
    }

    setIsCreatingUser(true);
    setError(null);
    setSuccess(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No hay sesión activa.');
      }

      const token = await currentUser.getIdToken(true);
      const payload: ManageUserAccessPayload = {
        email: normalizedEmail,
        displayName: normalizedDisplayName || undefined,
        premium: newUserAccessMode !== 'none',
        unlimited: newUserAccessMode === 'vip',
        months: newUserAccessMode === 'months' ? months : undefined,
        monthAction: newUserAccessMode === 'months' ? 'set' : undefined,
        toolAccess: newUserToolAccess,
        premiumTools: newUserPremiumTools,
        companyId: newUserCompanyId,
      };

      const result = await manageUserAccess(apiBaseUrl, token, payload);
      await loadUsers(false, null, listParams);

      setSuccess(
        result.created
          ? `Usuario creado: ${result.email}`
          : `Usuario actualizado: ${result.email}`
      );

      setNewUserEmail('');
      setNewUserDisplayName('');
      setNewUserAccessMode('months');
      setNewUserMonthsInput('6');
      setNewUserToolAccess(buildDefaultToolFlags(true));
      setNewUserPremiumTools(buildDefaultToolFlags(true));
      setNewUserCompanyId(null);
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear/actualizar el usuario.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const applyActionToUser = async (
    user: AdminListedUser,
    payload: {
      premium?: boolean;
      unlimited?: boolean;
      months?: number;
      monthAction?: AdminPremiumMonthAction;
      toolAccess?: ToolFlags;
      premiumTools?: ToolFlags;
      companyId?: string | null;
    },
    actionLabel: string
  ) => {
    if (!user.email) {
      setError('No se puede aplicar cambios a un usuario sin correo.');
      return;
    }

    const actionKey = `${user.uid}:${actionLabel}`;
    setActiveActionKey(actionKey);
    setError(null);
    setSuccess(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No hay sesion activa.');
      }

      const token = await currentUser.getIdToken(true);
      const result = await manageUserAccess(apiBaseUrl, token, {
        email: user.email,
        ...payload,
      });

      updateRowFromResult(user.email, result);
      setSuccess(`Cambios aplicados para ${user.email}.`);
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar el usuario.');
    } finally {
      setActiveActionKey(null);
    }
  };

  const applyToolSettingsToUser = async (user: AdminListedUser) => {
    await applyActionToUser(
      user,
      {
        toolAccess: toolAccessByUser[user.uid] || normalizeToolFlags(user.toolAccess, true),
        premiumTools: premiumToolsByUser[user.uid] || normalizeToolFlags(user.premiumTools, true),
      },
      'tools'
    );
  };

  const handleSelectCompanyFromModal = async (companyId: string | null) => {
    if (!companyModalTarget) return;

    if (companyModalTarget.type === 'new') {
      setNewUserCompanyId(companyId);
      setCompanyModalTarget(null);
      return;
    }

    const targetUser = companyModalTarget.user;
    await applyActionToUser(
      targetUser,
      { companyId },
      'company'
    );
    setCompanyModalTarget(null);
  };

  const selectedModalCompanyId =
    companyModalTarget?.type === 'new'
      ? newUserCompanyId
      : companyModalTarget?.user.companyId || null;
  const isCompanyModalApplying =
    companyModalTarget?.type === 'existing' &&
    activeActionKey?.startsWith(`${companyModalTarget.user.uid}:`) === true;

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
            <h1 className="text-2xl font-bold text-slate-800 mt-3">Administración de usuarios</h1>
            <p className="text-sm text-slate-600 mt-1">Sesión autorizada: {adminEmail}</p>
          </div>
        }
        right={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => loadUsers(false, null, listParams)}
              disabled={isLoadingList}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
              Recargar
            </button>
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
              Cerrar sesión
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto space-y-5 p-4 md:p-8">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="border border-slate-200 rounded-2xl bg-slate-50">
            <div className="p-5 border-b border-slate-200 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-800">Empresas</h2>
              </div>
              <p className="text-sm text-slate-500">
                Crea configuraciones de marca para asignarlas después a usuarios nuevos o existentes.
              </p>
            </div>

            <div className="p-5 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Empresas registradas</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Estas opciones aparecen en el modal de asignación de empresa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadCompanies}
                    disabled={isLoadingCompanies}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCompanies ? 'animate-spin' : ''}`} />
                    Recargar
                  </button>
                </div>

                {isLoadingCompanies ? (
                  <div className="mt-4 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4">
                    Cargando empresas...
                  </div>
                ) : companies.length === 0 ? (
                  <div className="mt-4 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
                    Todavía no hay empresas registradas.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {companies.map((company) => (
                      <div key={company.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
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
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                                <span
                                  className="w-3 h-3 rounded-full border border-slate-300"
                                  style={{ backgroundColor: company.primaryColor }}
                                />
                                Primario
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                                <span
                                  className="w-3 h-3 rounded-full border border-slate-300"
                                  style={{ backgroundColor: company.headerColor }}
                                />
                                Header
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <Palette className="w-4 h-4 text-indigo-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Crear empresa</p>
                    <p className="text-xs text-slate-500 mt-1">
                      El logo se guarda como URL pública; los colores se aplican al entrar con un usuario asignado.
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

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">URL del logo</span>
                    <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-300">
                      <Image className="w-4 h-4 text-slate-400" />
                      <input
                        type="url"
                        value={companyForm.logoUrl}
                        onChange={(event) => updateCompanyForm('logoUrl', event.target.value)}
                        placeholder="https://..."
                        className="w-full bg-transparent outline-none text-sm"
                      />
                    </div>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">Texto alternativo del logo</span>
                    <input
                      type="text"
                      value={companyForm.logoAlt}
                      onChange={(event) => updateCompanyForm('logoAlt', event.target.value)}
                      placeholder="Opcional"
                      className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-slate-600">Primario</span>
                      <input
                        type="color"
                        value={companyForm.primaryColor}
                        onChange={(event) => updateCompanyForm('primaryColor', event.target.value)}
                        className="h-11 w-full border border-slate-300 rounded-xl bg-white p-1"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-slate-600">Header</span>
                      <input
                        type="color"
                        value={companyForm.headerColor}
                        onChange={(event) => updateCompanyForm('headerColor', event.target.value)}
                        className="h-11 w-full border border-slate-300 rounded-xl bg-white p-1"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-slate-600">Fondo logo</span>
                      <input
                        type="color"
                        value={companyForm.logoBackgroundColor}
                        onChange={(event) => updateCompanyForm('logoBackgroundColor', event.target.value)}
                        className="h-11 w-full border border-slate-300 rounded-xl bg-white p-1"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateCompany}
                    disabled={isCreatingCompany}
                    className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-indigo-600 border border-indigo-600 hover:bg-indigo-700 rounded-xl px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {isCreatingCompany ? 'Creando empresa...' : 'Crear empresa'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl bg-slate-50">
            <div className="p-5 border-b border-slate-200 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-800">Crear o actualizar usuario</h2>
              </div>
              <p className="text-sm text-slate-500">
                Define primero los datos, permisos y premium. Después guarda los cambios para ese usuario.
              </p>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">Correo</span>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(event) => setNewUserEmail(event.target.value)}
                    placeholder="usuario@dominio.com"
                    className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">Nombre visible (opcional)</span>
                  <input
                    type="text"
                    value={newUserDisplayName}
                    onChange={(event) => setNewUserDisplayName(event.target.value)}
                    placeholder="Nombre del usuario"
                    className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </label>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Empresa asignada</p>
                    <p className="text-sm text-slate-600 mt-1">{getCompanyLabel(newUserCompanyId)}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Si queda sin empresa, el usuario verá el diseño default.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCompanyModalTarget({ type: 'new' })}
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl px-4 py-2.5 transition-colors cursor-pointer"
                >
                  <Building2 className="w-4 h-4" />
                  Escoger empresa
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[260px_220px_minmax(0,1fr)] gap-4 items-start">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">Estado premium inicial</span>
                  <select
                    value={newUserAccessMode}
                    onChange={(event) =>
                      setNewUserAccessMode(event.target.value as 'months' | 'vip' | 'none')
                    }
                    className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="months">Premium con vencimiento</option>
                    <option value="vip">VIP ilimitado</option>
                    <option value="none">Sin premium</option>
                  </select>
                </label>

                {newUserAccessMode === 'months' && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">Meses desde hoy</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={newUserMonthsInput}
                      onChange={(event) => handleNewUserMonthsChange(event.target.value)}
                      className="border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </label>
                )}

                <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                  Al crear o actualizar con premium por meses, la vigencia se ajusta exactamente desde hoy.
                  Si eliges "Sin premium", los permisos de herramientas se conservan para cuando se active.
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 bg-white">
                  <div className="flex items-start gap-2">
                    <KeyRound className="w-4 h-4 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Herramientas disponibles</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Controla qué herramientas puede abrir. Todas vienen activas por default.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PLATFORM_TOOLS.map((tool) => (
                      <label
                        key={tool.id}
                        className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={newUserToolAccess[tool.id]}
                          onChange={() => setNewUserToolAccess((current) => toggleToolFlag(current, tool.id))}
                          className="accent-indigo-600"
                        />
                        {tool.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 bg-white">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Beneficio premium por herramienta</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Solo aplica si el usuario tiene premium activo. Todas vienen seleccionadas por default.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {PLATFORM_TOOLS.map((tool) => (
                      <label
                        key={tool.id}
                        className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={newUserPremiumTools[tool.id]}
                          onChange={() => setNewUserPremiumTools((current) => toggleToolFlag(current, tool.id))}
                          className="accent-indigo-600"
                        />
                        {tool.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Úsalo también para actualizar permisos o premium de un usuario que ya existe.
                </p>
                <button
                  type="button"
                  onClick={handleCreateUser}
                  disabled={isCreatingUser}
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-indigo-600 border border-indigo-600 hover:bg-indigo-700 rounded-xl px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isCreatingUser ? 'Guardando...' : 'Crear / actualizar usuario'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800">Gestión de usuarios y premium</h2>
            <p className="text-sm text-slate-500">{users.length} resultados cargados</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[220px_220px_minmax(0,1fr)] gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-600">Filtrar por</span>
              <select
                value={searchField}
                onChange={(event) => setSearchField(event.target.value as AdminSearchField)}
                className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="all">Correo o nombre de usuario</option>
                <option value="email">Solo correo</option>
                <option value="displayName">Solo nombre de usuario</option>
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
              <span className="text-sm text-slate-600">Búsqueda rápida</span>
              <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-300">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Ejemplo: correo@dominio.com o nombre de usuario"
                  className="w-full bg-transparent outline-none text-sm"
                />
              </div>
            </label>
          </div>

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
          {success && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              {success}
            </div>
          )}

          {isLoadingList ? (
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4">
              Cargando usuarios...
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="min-w-[1760px] w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-slate-700">
                    <th className="px-4 py-3 font-semibold">Usuario</th>
                    <th className="px-4 py-3 font-semibold">Correo</th>
                    <th className="px-4 py-3 font-semibold">Empresa</th>
                    <th className="px-4 py-3 font-semibold">Estado premium</th>
                    <th className="px-4 py-3 font-semibold">Herramientas</th>
                    <th className="px-4 py-3 font-semibold">Obtenido</th>
                    <th className="px-4 py-3 font-semibold">Vence</th>
                    <th className="px-4 py-3 font-semibold w-[660px]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const monthsInput = monthsByUser[user.uid] ?? '6';
                    const months = Number(monthsInput);
                    const canApplyMonths = Number.isInteger(months) && months > 0;
                    const isBusy = activeActionKey?.startsWith(`${user.uid}:`) === true;
                    const toolAccess = toolAccessByUser[user.uid] || normalizeToolFlags(user.toolAccess, true);
                    const premiumTools = premiumToolsByUser[user.uid] || normalizeToolFlags(user.premiumTools, true);
                    const assignedCompany = user.companyId ? companyById.get(user.companyId) : null;

                    const stateLabel = user.premiumActive
                      ? user.premiumUnlimited
                        ? 'Activo (VIP ilimitado)'
                        : 'Activo'
                      : user.premium && user.premiumExpiresAt
                        ? 'Expirado'
                        : 'Sin acceso';

                    const stateStyle = user.premiumActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : user.premium && user.premiumExpiresAt
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200';

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
                              <p className="text-xs text-slate-500">UID: {user.uid}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {user.email ? (
                            <span className="text-slate-700">{user.email}</span>
                          ) : (
                            <span className="text-slate-400">Sin correo</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {assignedCompany?.logoUrl ? (
                                <span
                                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0"
                                  style={{ backgroundColor: assignedCompany.logoBackgroundColor }}
                                >
                                  <img
                                    src={assignedCompany.logoUrl}
                                    alt={getCompanyLogoAlt(assignedCompany)}
                                    className="w-full h-full object-contain p-1"
                                  />
                                </span>
                              ) : (
                                <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center shrink-0">
                                  <Building2 className="w-4 h-4" />
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {getCompanyLabel(user.companyId)}
                                </p>
                                {user.companyId && !assignedCompany && (
                                  <p className="text-xs text-amber-600">Revisa si fue eliminada</p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={!user.email || isBusy}
                              onClick={() => setCompanyModalTarget({ type: 'existing', user })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              Escoger empresa
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg border text-xs font-medium ${stateStyle}`}>
                            {stateLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 space-y-1">
                          <p>
                            <span className="font-semibold text-slate-700">Acceso:</span> {summarizeTools(toolAccess)}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700">Premium:</span> {summarizeTools(premiumTools)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{formatDate(user.premiumGrantedAt)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatDate(user.premiumExpiresAt)}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-3">
                            <div className="border border-slate-200 rounded-xl p-3 bg-white">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-slate-800">Permisos por herramienta</p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Acceso permite abrir la herramienta; Premium limita beneficios dentro de cada una.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={!user.email || isBusy}
                                  onClick={() => applyToolSettingsToUser(user)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  Guardar permisos
                                </button>
                              </div>

                              <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                  <p className="text-xs font-semibold text-slate-700 mb-2">Herramientas disponibles</p>
                                  <div className="flex flex-wrap gap-2">
                                    {PLATFORM_TOOLS.map((tool) => (
                                      <label
                                        key={tool.id}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={toolAccess[tool.id]}
                                          onChange={() =>
                                            setToolAccessByUser((previous) => ({
                                              ...previous,
                                              [user.uid]: toggleToolFlag(toolAccess, tool.id),
                                            }))
                                          }
                                          className="accent-indigo-600"
                                        />
                                        {tool.label}
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                                  <p className="text-xs font-semibold text-slate-700 mb-2">Beneficio premium</p>
                                  <div className="flex flex-wrap gap-2">
                                    {PLATFORM_TOOLS.map((tool) => (
                                      <label
                                        key={tool.id}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={premiumTools[tool.id]}
                                          onChange={() =>
                                            setPremiumToolsByUser((previous) => ({
                                              ...previous,
                                              [user.uid]: toggleToolFlag(premiumTools, tool.id),
                                            }))
                                          }
                                          className="accent-indigo-600"
                                        />
                                        {tool.label}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="border border-indigo-100 rounded-xl p-3 bg-indigo-50/40">
                              <div className="flex items-start gap-2">
                                <CalendarClock className="w-4 h-4 text-indigo-700 mt-0.5" />
                                <div>
                                  <p className="text-xs font-semibold text-slate-800">Vigencia premium</p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Agregar extiende desde el vencimiento actual. Quitar descuenta del vencimiento actual.
                                    Ajustar reinicia la vigencia desde hoy.
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-1 lg:grid-cols-[120px_minmax(0,1fr)] gap-3">
                                <label className="flex flex-col gap-1">
                                  <span className="text-xs font-semibold text-slate-600">Meses</span>
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={monthsInput}
                                    onChange={(event) => handleMonthsChange(user.uid, event.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                  />
                                </label>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <button
                                    type="button"
                                    disabled={!user.email || isBusy || !canApplyMonths}
                                    onClick={() =>
                                      applyActionToUser(
                                        user,
                                        {
                                          premium: true,
                                          unlimited: false,
                                          months,
                                          monthAction: 'add',
                                          toolAccess,
                                          premiumTools,
                                        },
                                        'add-months'
                                      )
                                    }
                                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                                  >
                                    Agregar meses
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!user.email || isBusy || !canApplyMonths || !user.premiumExpiresAt}
                                    onClick={() =>
                                      applyActionToUser(
                                        user,
                                        {
                                          premium: true,
                                          unlimited: false,
                                          months,
                                          monthAction: 'subtract',
                                          toolAccess,
                                          premiumTools,
                                        },
                                        'subtract-months'
                                      )
                                    }
                                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 bg-white hover:bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                                  >
                                    Quitar meses
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!user.email || isBusy || !canApplyMonths}
                                    onClick={() =>
                                      applyActionToUser(
                                        user,
                                        {
                                          premium: true,
                                          unlimited: false,
                                          months,
                                          monthAction: 'set',
                                          toolAccess,
                                          premiumTools,
                                        },
                                        'set-months'
                                      )
                                    }
                                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                                  >
                                    Ajustar vencimiento
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={!user.email || isBusy}
                                  onClick={() =>
                                    applyActionToUser(
                                      user,
                                      { premium: true, unlimited: true, toolAccess, premiumTools },
                                      'vip'
                                    )
                                  }
                                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                                >
                                  Convertir a VIP ilimitado
                                </button>
                                <button
                                  type="button"
                                  disabled={!user.email || isBusy}
                                  onClick={() =>
                                    applyActionToUser(
                                      user,
                                      { premium: false, unlimited: false, toolAccess, premiumTools },
                                      'remove'
                                    )
                                  }
                                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                                >
                                  Quitar premium completo
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
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
              Carga progresiva activa: 30 usuarios por bloque con scroll automático.
            </p>
            {nextPageToken && (
              <button
                type="button"
                onClick={() => loadUsers(true, nextPageToken, listParams)}
                disabled={isLoadingMore}
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg px-3 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  'Cargar más usuarios'
                )}
              </button>
            )}
          </div>

          <div ref={infiniteLoaderRef} className="h-2" aria-hidden="true" />
        </div>
      </div>

      {companyModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar selector de empresa"
            onClick={() => setCompanyModalTarget(null)}
            className="absolute inset-0 bg-slate-900/50 cursor-pointer"
          />
          <div className="relative z-10 w-full max-w-4xl max-h-[88vh] overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Escoger empresa</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {companyModalTarget.type === 'new'
                    ? 'Selecciona la empresa para el usuario que estás creando o actualizando.'
                    : `Selecciona la empresa para ${companyModalTarget.user.email || 'este usuario'}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompanyModalTarget(null)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(88vh-96px)] space-y-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-white text-slate-500 border border-slate-200 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Sin empresa</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Mantiene el logo, colores y diseño default de la plataforma.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={selectedModalCompanyId === null || isCompanyModalApplying}
                  onClick={() => handleSelectCompanyFromModal(null)}
                  className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                >
                  {selectedModalCompanyId === null ? 'Seleccionado' : 'Usar default'}
                </button>
              </div>

              {companies.length === 0 ? (
                <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  No hay empresas disponibles. Crea una empresa primero desde el apartado de empresas.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {companies.map((company) => {
                    const isSelected = selectedModalCompanyId === company.id;

                    return (
                      <div key={company.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-16 h-16 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0"
                            style={{ backgroundColor: company.logoBackgroundColor }}
                          >
                            {company.logoUrl ? (
                              <img
                                src={company.logoUrl}
                                alt={getCompanyLogoAlt(company)}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Building2 className="w-7 h-7 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-800 truncate">{company.name}</p>
                              {isSelected && (
                                <span className="inline-flex px-2 py-0.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold">
                                  Seleccionada
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-1">ID: {company.id}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1">
                                <span
                                  className="w-3 h-3 rounded-full border border-slate-300"
                                  style={{ backgroundColor: company.primaryColor }}
                                />
                                Primario
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1">
                                <span
                                  className="w-3 h-3 rounded-full border border-slate-300"
                                  style={{ backgroundColor: company.headerColor }}
                                />
                                Header
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isSelected || isCompanyModalApplying}
                          onClick={() => handleSelectCompanyFromModal(company.id)}
                          className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl px-4 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                        >
                          {isSelected ? 'Seleccionada' : 'Escoger esta empresa'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
