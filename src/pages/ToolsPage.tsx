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
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  UserCircle,
  Wrench,
} from 'lucide-react';
import type { UserAccountProfile } from '../services/auth';
import { isToolEnabled, type ToolFlags, type ToolId } from '../config/tools';
import AppNavbar from '../components/common/AppNavbar';
import { useCompanyBrand } from '../contexts/CompanyBrandContext';
import type { AppTheme, Lang } from '../types/common';

type ToolsPageProps = {
  lang: Lang;
  appTheme: AppTheme;
  onToggleLang: () => void;
  onToggleTheme: () => void;
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
  onOpenFeedForward: () => void;
  toolAccess?: ToolFlags;
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
  appTheme,
  onToggleLang,
  onToggleTheme,
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
  onOpenFeedForward,
  toolAccess,
  showAdminAccessButton = false,
  onGoToAdminAccess,
}: ToolsPageProps) {
  const companyBrand = useCompanyBrand();
  const copy = {
    es: {
      appName: 'ILSS Labs',
      toolsTitle: 'Herramientas',
      toolsSubtitle: 'Selecciona la herramienta con la que vas a trabajar.',
      toolStatus: 'Disponible',
      toolTitle: 'Gage R&R (ANOVA)',
      toolDescription:
        'Carga datos CSV o XLSX, valida supuestos, ejecuta el análisis ANOVA y genera resultados listos para revisión.',
      sixSigmaTitle: 'Six Sigma Master',
      sixSigmaDescription:
        'Analiza capacidad de proceso, gráficas de control, normalidad, histogramas y distribuciones sugeridas.',
      feedForwardTitle: 'ILSS FeedFoward',
      feedForwardDescription:
        'Convierte observaciones de desempeño en una sesión de retroalimentación estructurada y lista para entregar.',
      openTool: 'Abrir herramienta',
      noAccess: 'Sin acceso',
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
        'Acceso a resultados premium una vez realizado el pago.',
      ],
      unlock: 'Contratar premium por 150 MXN',
      loading: 'Abriendo checkout...',
      secure: 'Pago seguro vía Stripe',
      logout: 'Cerrar sesión',
      admin: 'Administración',
      language: 'EN',
    },
    en: {
      appName: 'ILSS Labs',
      toolsTitle: 'Tools',
      toolsSubtitle: 'Choose the tool you want to work with.',
      toolStatus: 'Available',
      toolTitle: 'Gage R&R (ANOVA)',
      toolDescription:
        'Upload CSV or XLSX data, validate assumptions, run the ANOVA analysis, and generate review-ready results.',
      sixSigmaTitle: 'Six Sigma Master',
      sixSigmaDescription:
        'Analyze process capability, control charts, normality, histograms, and suggested distributions.',
      feedForwardTitle: 'ILSS FeedFoward',
      feedForwardDescription:
        'Turn performance observations into a structured feedback session ready to deliver.',
      openTool: 'Open tool',
      noAccess: 'No access',
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
  const isPremiumActive =
    accountProfile
      ? accountProfile.premiumActive && isToolEnabled(accountProfile.premiumTools, 'gage-rr', true)
      : esPremium;
  const hadPremium =
    accountProfile?.premium === true && isToolEnabled(accountProfile.premiumTools, 'gage-rr', true);
  const premiumExpiresAt = formatDate(accountProfile?.premiumExpiresAt, lang);
  const premiumGrantedAt = formatDate(accountProfile?.premiumGrantedAt, lang);
  const createdAt = formatDate(accountProfile?.createdAt, lang);
  const premiumStatusLabel = isPremiumActive
    ? copy.premiumActive
    : hadPremium
      ? copy.premiumExpired
      : copy.premiumInactive;
  const premiumStatusClass = isPremiumActive
    ? 'app-badge-success'
    : hadPremium
      ? 'app-badge-warning'
      : '';
  const canOpenTool = (toolId: ToolId) => isToolEnabled(toolAccess, toolId, true);
  const getToolCardClass = (toolId: ToolId) =>
    `group min-h-[220px] text-left app-card p-5 flex flex-col ${
      canOpenTool(toolId)
        ? 'app-card-hover cursor-pointer'
        : 'opacity-60 cursor-not-allowed'
    }`;
  const handleToolOpen = (toolId: ToolId, callback: () => void) => {
    if (!canOpenTool(toolId)) return;
    callback();
  };

  return (
    <div className="app-shell">
      <AppNavbar
        lang={lang}
        appTheme={appTheme}
        onToggleTheme={onToggleTheme}
        left={
          <div className="flex items-center gap-3 min-w-0">
            <div className="app-icon-tile shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm app-muted flex min-w-0 flex-wrap items-center gap-x-2">
                <span>{copy.appName}</span>
                {companyBrand?.name && (
                  <>
                    <span className="app-company-inline-separator" aria-hidden="true">·</span>
                    <span className="app-company-inline-name truncate">{companyBrand.name}</span>
                  </>
                )}
              </p>
              <h1 className="text-2xl app-title">{copy.toolsTitle}</h1>
            </div>
          </div>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            {showAdminAccessButton && onGoToAdminAccess && (
              <button
                type="button"
                onClick={onGoToAdminAccess}
                className="app-button app-button-soft px-3 py-2 text-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                {copy.admin}
              </button>
            )}
            <button
              type="button"
              onClick={onToggleLang}
              className="app-button app-button-secondary px-3 py-2 text-sm"
            >
              <Globe className="w-4 h-4" />
              {copy.language}
            </button>
          </div>
        }
      />

      <main className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-6 lg:py-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8">
        <section className="space-y-5">
          <div>
            <h2 className="text-lg app-title">{copy.toolsTitle}</h2>
            <p className="text-sm app-muted mt-1">{copy.toolsSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => handleToolOpen('gage-rr', onOpenGageRR)}
              disabled={!canOpenTool('gage-rr')}
              className={getToolCardClass('gage-rr')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="app-icon-tile app-icon-tile-lg">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className={`app-badge ${canOpenTool('gage-rr') ? 'app-badge-success' : 'app-badge-danger'}`}>
                  {canOpenTool('gage-rr') ? copy.toolStatus : copy.noAccess}
                </span>
              </div>

              <div className="mt-5 flex-1">
                <h3 className="text-lg app-title">{copy.toolTitle}</h3>
                <p className="text-sm app-muted mt-2 leading-6">{copy.toolDescription}</p>
              </div>

              <div className="mt-5 inline-flex items-center gap-2 text-sm app-link-action">
                {copy.openTool}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleToolOpen('six-sigma', onOpenSixSigma)}
              disabled={!canOpenTool('six-sigma')}
              className={getToolCardClass('six-sigma')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="app-icon-tile app-icon-tile-lg app-icon-tile-success">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className={`app-badge ${canOpenTool('six-sigma') ? 'app-badge-success' : 'app-badge-danger'}`}>
                  {canOpenTool('six-sigma') ? copy.toolStatus : copy.noAccess}
                </span>
              </div>

              <div className="mt-5 flex-1">
                <h3 className="text-lg app-title">{copy.sixSigmaTitle}</h3>
                <p className="text-sm app-muted mt-2 leading-6">{copy.sixSigmaDescription}</p>
              </div>

              <div className="mt-5 inline-flex items-center gap-2 text-sm app-link-action">
                {copy.openTool}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleToolOpen('feed-forward', onOpenFeedForward)}
              disabled={!canOpenTool('feed-forward')}
              className={getToolCardClass('feed-forward')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="app-icon-tile app-icon-tile-lg app-icon-tile-warning">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <span className={`app-badge ${canOpenTool('feed-forward') ? 'app-badge-success' : 'app-badge-danger'}`}>
                  {canOpenTool('feed-forward') ? copy.toolStatus : copy.noAccess}
                </span>
              </div>

              <div className="mt-5 flex-1">
                <h3 className="text-lg app-title">{copy.feedForwardTitle}</h3>
                <p className="text-sm app-muted mt-2 leading-6">{copy.feedForwardDescription}</p>
              </div>

              <div className="mt-5 inline-flex items-center gap-2 text-sm app-link-action">
                {copy.openTool}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          </div>
        </section>

        <aside className="app-panel overflow-hidden">
          <div className="p-5 border-b app-divider">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg app-title">{copy.profileTitle}</h2>
              <button
                type="button"
                onClick={onLogout}
                className="app-button app-button-danger px-3 py-2 text-sm"
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
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                  style={{ border: '1px solid var(--app-border)' }}
                />
              ) : (
                <div className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'var(--app-surface-muted)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
                  {getInitials(displayName || email)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm app-muted">{copy.account}</p>
                <p className="font-semibold truncate" title={email}>
                  {email}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 border-b app-divider space-y-4">
            <h3 className="text-sm app-title">{copy.accountData}</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <UserCircle className="w-4 h-4 app-icon-muted mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <dt className="app-muted">{copy.name}</dt>
                  <dd className="font-medium truncate" title={displayName}>
                    {displayName}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 app-icon-muted mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <dt className="app-muted">{copy.email}</dt>
                  <dd className="font-medium truncate" title={email}>
                    {email}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <KeyRound className="w-4 h-4 app-icon-muted mt-0.5 shrink-0" />
                <div>
                  <dt className="app-muted">{copy.provider}</dt>
                  <dd className="font-medium">{getProviderLabel(signInProvider, lang)}</dd>
                </div>
              </div>
              {createdAt && (
                <div className="flex items-start gap-3">
                  <CalendarDays className="w-4 h-4 app-icon-muted mt-0.5 shrink-0" />
                  <div>
                    <dt className="app-muted">{copy.createdAt}</dt>
                    <dd className="font-medium">{createdAt}</dd>
                  </div>
                </div>
              )}
              {/* {accountProfile?.uid && (
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 app-icon-muted mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <dt className="app-muted">{copy.userId}</dt>
                    <dd className="font-medium truncate" title={accountProfile.uid}>
                      {accountProfile.uid}
                    </dd>
                  </div>
                </div>
              )} */}
            </dl>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm app-title flex items-center gap-2">
                <Crown className="w-4 h-4 app-text-warning" />
                {copy.premium}
              </h3>
              <span className={`app-badge ${premiumStatusClass}`}>
                {premiumStatusLabel}
              </span>
            </div>

            <dl className="space-y-2 text-sm app-muted">
              {isPremiumActive && premiumGrantedAt && (
                <div className="flex items-center justify-between gap-3">
                  <dt>{copy.premiumSince}</dt>
                  <dd className="font-semibold app-title">{premiumGrantedAt}</dd>
                </div>
              )}
              {(isPremiumActive || hadPremium) && (
                <div className="flex items-center justify-between gap-3">
                  <dt>{isPremiumActive ? copy.expires : copy.expired}</dt>
                  <dd className="font-semibold app-title">
                    {accountProfile?.premiumUnlimited ? copy.noExpiration : premiumExpiresAt || copy.noExpiration}
                  </dd>
                </div>
              )}
            </dl>

            <div className="border-t app-divider pt-4">
              <h4 className="text-sm app-title">{copy.offerTitle}</h4>
              <ul className="mt-3 space-y-2">
                {copy.benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-2 text-sm app-muted">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--app-success)' }} />
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
                  className="app-button app-button-primary w-full px-4 py-3 text-sm"
                >
                  <CreditCard className="w-4 h-4" />
                  {isCheckoutLoading ? copy.loading : copy.unlock}
                </button>
                {checkoutError && <p className="mt-3 text-sm app-text-danger">{checkoutError}</p>}
                <p className="mt-2 text-xs app-muted">{copy.secure}</p>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
