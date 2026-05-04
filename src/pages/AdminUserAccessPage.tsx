import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home, LogOut, RefreshCw, Search, ShieldCheck, UserPlus } from 'lucide-react';
import {
  listAdminUsers,
  manageUserAccess,
  type AdminListedUser,
  type AdminPremiumStatusFilter,
  type AdminSearchField,
  type ListAdminUsersParams,
  type ManageUserAccessResult,
} from '../services/admin-user';
import { auth } from '../firebase';
import { PLATFORM_TOOLS, buildDefaultToolFlags, normalizeToolFlags, type ToolFlags, type ToolId } from '../config/tools';

type AdminUserAccessPageProps = {
  adminEmail: string;
  onLogout: () => Promise<void>;
  onBackHome: () => void;
};

export default function AdminUserAccessPage({ adminEmail, onLogout, onBackHome }: AdminUserAccessPageProps) {
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserAccessMode, setNewUserAccessMode] = useState<'months' | 'vip' | 'none'>('months');
  const [newUserMonthsInput, setNewUserMonthsInput] = useState('6');
  const [newUserToolAccess, setNewUserToolAccess] = useState<ToolFlags>(() => buildDefaultToolFlags(true));
  const [newUserPremiumTools, setNewUserPremiumTools] = useState<ToolFlags>(() => buildDefaultToolFlags(true));
  const [isCreatingUser, setIsCreatingUser] = useState(false);

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
      const payload = {
        email: normalizedEmail,
        displayName: normalizedDisplayName || undefined,
        premium: newUserAccessMode !== 'none',
        unlimited: newUserAccessMode === 'vip',
        months: newUserAccessMode === 'months' ? months : undefined,
        toolAccess: newUserToolAccess,
        premiumTools: newUserPremiumTools,
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
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear/actualizar el usuario.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const applyActionToUser = async (
    user: AdminListedUser,
    payload: { premium?: boolean; unlimited?: boolean; months?: number; toolAccess?: ToolFlags; premiumTools?: ToolFlags },
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

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1">
              <ShieldCheck className="w-4 h-4" />
              Acceso administrativo restringido
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mt-3">Admin User Access</h1>
            <p className="text-sm text-slate-600 mt-1">Sesión autorizada: {adminEmail}</p>
          </div>
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
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-semibold text-slate-800">Agregar nuevo usuario</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Correo</span>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                  placeholder="usuario@dominio.com"
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Nombre (opcional)</span>
                <input
                  type="text"
                  value={newUserDisplayName}
                  onChange={(event) => setNewUserDisplayName(event.target.value)}
                  placeholder="Nombre del usuario"
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[220px_200px_auto] gap-3 items-end">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Tipo de acceso</span>
                <select
                  value={newUserAccessMode}
                  onChange={(event) =>
                    setNewUserAccessMode(event.target.value as 'months' | 'vip' | 'none')
                  }
                  className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="months">Premium por meses</option>
                  <option value="vip">Premium ilimitado (VIP)</option>
                  <option value="none">Sin premium</option>
                </select>
              </label>

              {newUserAccessMode === 'months' && (
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-slate-600">Meses</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={newUserMonthsInput}
                    onChange={(event) => handleNewUserMonthsChange(event.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </label>
              )}

              <button
                type="button"
                onClick={handleCreateUser}
                disabled={isCreatingUser}
                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-white bg-indigo-600 border border-indigo-600 hover:bg-indigo-700 rounded-lg px-4 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
              >
                {isCreatingUser ? 'Guardando...' : 'Crear / actualizar usuario'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl p-3 bg-white">
                <p className="text-sm font-semibold text-slate-700">Acceso a herramientas</p>
                <p className="text-xs text-slate-500 mt-1">Todas están activas por default.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PLATFORM_TOOLS.map((tool) => (
                    <label
                      key={tool.id}
                      className="inline-flex items-center gap-2 text-xs text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50"
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

              <div className="border border-slate-200 rounded-xl p-3 bg-white">
                <p className="text-sm font-semibold text-slate-700">Premium por herramienta</p>
                <p className="text-xs text-slate-500 mt-1">Aplica cuando el usuario tenga premium activo.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PLATFORM_TOOLS.map((tool) => (
                    <label
                      key={tool.id}
                      className="inline-flex items-center gap-2 text-xs text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50"
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
              <table className="min-w-[1350px] w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-slate-700">
                    <th className="px-4 py-3 font-semibold">Usuario</th>
                    <th className="px-4 py-3 font-semibold">Correo</th>
                    <th className="px-4 py-3 font-semibold">Estado premium</th>
                    <th className="px-4 py-3 font-semibold">Herramientas</th>
                    <th className="px-4 py-3 font-semibold">Obtenido</th>
                    <th className="px-4 py-3 font-semibold">Vence</th>
                    <th className="px-4 py-3 font-semibold w-[520px]">Acciones</th>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="border border-slate-200 rounded-lg p-2">
                                <p className="text-xs font-semibold text-slate-700 mb-2">Acceso</p>
                                <div className="flex flex-wrap gap-2">
                                  {PLATFORM_TOOLS.map((tool) => (
                                    <label key={tool.id} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
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

                              <div className="border border-slate-200 rounded-lg p-2">
                                <p className="text-xs font-semibold text-slate-700 mb-2">Premium</p>
                                <div className="flex flex-wrap gap-2">
                                  {PLATFORM_TOOLS.map((tool) => (
                                    <label key={tool.id} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
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

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={!user.email || isBusy}
                                onClick={() => applyToolSettingsToUser(user)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                              >
                                Guardar herramientas
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={monthsInput}
                              onChange={(event) => handleMonthsChange(user.uid, event.target.value)}
                              className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                            <button
                              type="button"
                              disabled={!user.email || isBusy || !canApplyMonths}
                              onClick={() =>
                                applyActionToUser(
                                  user,
                                  { premium: true, unlimited: false, months, toolAccess, premiumTools },
                                  'months'
                                )
                              }
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                            >
                              Dar meses
                            </button>
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
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                            >
                              VIP ilimitado
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
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                            >
                              Quitar premium
                            </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
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
    </div>
  );
}
