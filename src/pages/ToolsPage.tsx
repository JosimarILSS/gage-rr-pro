import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Crown,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  TrendingUp,
  UserCircle,
} from 'lucide-react';
import type { UserAccountProfile } from '../services/auth';
import type { Lang } from '../types/common';

type ToolsPageProps = {
  lang: Lang;
  onToggleLang: () => void;
  accountProfile: UserAccountProfile | null;
  userEmail: string | null | undefined;
  userDisplayName: string | null | undefined;
  userPhotoURL: string | null | undefined;
  signInProvider: string | null;
  onLogout: () => Promise<void>;
  esPremium: boolean;
  isCheckoutLoading: boolean;
  checkoutError: string | null;
  onUnlockPremium: () => Promise<void>;
  onOpenGageRR: () => void;
  onOpenSixSigma: () => void;
  showAdminAccessButton?: boolean;
  onGoToAdminAccess?: () => void;
};

const localeByLang = {
  es: 'es-MX',
  en: 'en-US',
};

const formatDate = (value: number | null | undefined, lang: Lang) => {
  if (!value) return null;
  return new Intl.DateTimeFormat(localeByLang[lang], { dateStyle: 'medium' }).format(new Date(value));
};

const getProviderLabel = (provider: string | null, lang: Lang) => {
  if (provider === 'google.com') return 'Google';
  if (provider === 'password') return lang === 'es' ? 'Correo y contraseña' : 'Email and password';
  return provider || (lang === 'es' ? 'No disponible' : 'Unavailable');
};

const getInitials = (value: string) =>
  value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

export default function ToolsPage({
  lang,
  onToggleLang,
  accountProfile,
  userEmail,
  userDisplayName,
  userPhotoURL,
  signInProvider,
  onLogout,
  esPremium,
  isCheckoutLoading,
  checkoutError,
  onUnlockPremium,
  onOpenGageRR,
  onOpenSixSigma,
  showAdminAccessButton = false,
  onGoToAdminAccess,
}: ToolsPageProps) {
  const copy = {
    es: {
      appName: 'Gage R&R Pro',
      toolsTitle: 'Herramientas',
      toolsSubtitle: 'Selecciona la herramienta con la que vas a trabajar.',
      toolStatus: 'Disponible',
      toolTitle: 'Gage R&R (ANOVA)',
      toolDescription:
        'Carga datos CSV o XLSX, valida supuestos, ejecuta el análisis ANOVA y genera resultados listos para revisión.',
      sixSigmaTitle: 'Six Sigma Master',
      sixSigmaDescription:
        'Analiza capacidad de proceso, gráficas de control, normalidad, histogramas y distribuciones sugeridas.',
      openTool: 'Abrir herramienta',
      profileTitle: 'Mi perfil',
      account: 'Cuenta',
      accountData: 'Datos de cuenta',
      name: 'Nombre',
      email: 'Correo',
      provider: 'Acceso',
      createdAt: 'Alta',
      userId: 'ID de cuenta',
      noName: 'Sin nombre registrado',
      noEmail: 'Correo no disponible',
      premium: 'Premium',
      premiumActive: 'Premium activo',
      premiumExpired: 'Premium vencido',
      premiumInactive: 'Sin premium',
      expires: 'Vence',
      expired: 'Venció',
      noExpiration: 'Sin vencimiento',
      premiumSince: 'Activo desde',
      offerTitle: 'Qué ofrece premium',
      benefits: [
        'Interpretación profesional del diagnóstico Gage R&R.',
        'Recomendaciones de acción según la fuente principal de error.',
        'Acceso a resultados premium durante 6 meses desde el pago.',
      ],
      unlock: 'Contratar premium por 150 MXN',
      loading: 'Abriendo checkout...',
      secure: 'Pago seguro vía Stripe',
      logout: 'Cerrar sesión',
      admin: 'Administración',
      language: 'EN',
    },
    en: {
      appName: 'Gage R&R Pro',
      toolsTitle: 'Tools',
      toolsSubtitle: 'Choose the tool you want to work with.',
      toolStatus: 'Available',
      toolTitle: 'Gage R&R (ANOVA)',
      toolDescription:
        'Upload CSV or XLSX data, validate assumptions, run the ANOVA analysis, and generate review-ready results.',
      sixSigmaTitle: 'Six Sigma Master',
      sixSigmaDescription:
        'Analyze process capability, control charts, normality, histograms, and suggested distributions.',
      openTool: 'Open tool',
      profileTitle: 'My profile',
      account: 'Account',
      accountData: 'Account data',
      name: 'Name',
      email: 'Email',
      provider: 'Sign-in',
      createdAt: 'Created',
      userId: 'Account ID',
      noName: 'No name registered',
      noEmail: 'Email unavailable',
      premium: 'Premium',
      premiumActive: 'Premium active',
      premiumExpired: 'Premium expired',
      premiumInactive: 'No premium',
      expires: 'Expires',
      expired: 'Expired',
      noExpiration: 'No expiration',
      premiumSince: 'Active since',
      offerTitle: 'What premium includes',
      benefits: [
        'Professional Gage R&R diagnostic interpretation.',
        'Action recommendations based on the main source of error.',
        'Premium results access for 6 months after payment.',
      ],
      unlock: 'Get premium for 150 MXN',
      loading: 'Opening checkout...',
      secure: 'Secure Stripe payment',
      logout: 'Sign out',
      admin: 'Admin',
      language: 'ES',
    },
  }[lang];

  const email = accountProfile?.email || userEmail || copy.noEmail;
  const displayName = accountProfile?.displayName || userDisplayName || copy.noName;
  const photoURL = accountProfile?.photoURL || userPhotoURL || null;
  const isPremiumActive = accountProfile?.premiumActive ?? esPremium;
  const hadPremium = accountProfile?.premium === true;
  const premiumExpiresAt = formatDate(accountProfile?.premiumExpiresAt, lang);
  const premiumGrantedAt = formatDate(accountProfile?.premiumGrantedAt, lang);
  const createdAt = formatDate(accountProfile?.createdAt, lang);
  const premiumStatusLabel = isPremiumActive
    ? copy.premiumActive
    : hadPremium
      ? copy.premiumExpired
      : copy.premiumInactive;
  const premiumStatusClass = isPremiumActive
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : hadPremium
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{copy.appName}</p>
              <h1 className="text-2xl font-bold text-slate-900">{copy.toolsTitle}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showAdminAccessButton && onGoToAdminAccess && (
              <button
                type="button"
                onClick={onGoToAdminAccess}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                {copy.admin}
              </button>
            )}
            <button
              type="button"
              onClick={onToggleLang}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Globe className="w-4 h-4" />
              {copy.language}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-6 lg:py-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8">
        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{copy.toolsTitle}</h2>
            <p className="text-sm text-slate-500 mt-1">{copy.toolsSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={onOpenGageRR}
              className="group min-h-[220px] text-left bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                </div>
                <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {copy.toolStatus}
                </span>
              </div>

              <div className="mt-5 flex-1">
                <h3 className="text-lg font-bold text-slate-900">{copy.toolTitle}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-6">{copy.toolDescription}</p>
              </div>

              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
                {copy.openTool}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenSixSigma}
              className="group min-h-[220px] text-left bg-white border border-slate-200 rounded-lg p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {copy.toolStatus}
                </span>
              </div>

              <div className="mt-5 flex-1">
                <h3 className="text-lg font-bold text-slate-900">{copy.sixSigmaTitle}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-6">{copy.sixSigmaDescription}</p>
              </div>

              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
                {copy.openTool}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          </div>
        </section>

        <aside className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">{copy.profileTitle}</h2>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                {copy.logout}
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3 min-w-0">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                  {getInitials(displayName || email)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm text-slate-500">{copy.account}</p>
                <p className="font-semibold text-slate-900 truncate" title={email}>
                  {email}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 border-b border-slate-200 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">{copy.accountData}</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <UserCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-slate-500">{copy.name}</dt>
                  <dd className="font-medium text-slate-800 truncate" title={displayName}>
                    {displayName}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-slate-500">{copy.email}</dt>
                  <dd className="font-medium text-slate-800 truncate" title={email}>
                    {email}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <KeyRound className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-slate-500">{copy.provider}</dt>
                  <dd className="font-medium text-slate-800">{getProviderLabel(signInProvider, lang)}</dd>
                </div>
              </div>
              {createdAt && (
                <div className="flex items-start gap-3">
                  <CalendarDays className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <dt className="text-slate-500">{copy.createdAt}</dt>
                    <dd className="font-medium text-slate-800">{createdAt}</dd>
                  </div>
                </div>
              )}
              {accountProfile?.uid && (
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-slate-500">{copy.userId}</dt>
                    <dd className="font-medium text-slate-800 truncate" title={accountProfile.uid}>
                      {accountProfile.uid}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                {copy.premium}
              </h3>
              <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${premiumStatusClass}`}>
                {premiumStatusLabel}
              </span>
            </div>

            <dl className="space-y-2 text-sm text-slate-600">
              {isPremiumActive && premiumGrantedAt && (
                <div className="flex items-center justify-between gap-3">
                  <dt>{copy.premiumSince}</dt>
                  <dd className="font-semibold text-slate-900">{premiumGrantedAt}</dd>
                </div>
              )}
              {(isPremiumActive || hadPremium) && (
                <div className="flex items-center justify-between gap-3">
                  <dt>{isPremiumActive ? copy.expires : copy.expired}</dt>
                  <dd className="font-semibold text-slate-900">
                    {accountProfile?.premiumUnlimited ? copy.noExpiration : premiumExpiresAt || copy.noExpiration}
                  </dd>
                </div>
              )}
            </dl>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-900">{copy.offerTitle}</h4>
              <ul className="mt-3 space-y-2">
                {copy.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!isPremiumActive && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onUnlockPremium}
                  disabled={isCheckoutLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  {isCheckoutLoading ? copy.loading : copy.unlock}
                </button>
                {checkoutError && <p className="mt-3 text-sm text-red-700">{checkoutError}</p>}
                <p className="mt-2 text-xs text-slate-500">{copy.secure}</p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
