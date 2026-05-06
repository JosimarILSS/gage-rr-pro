import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from './hooks/useAuthSession';
import { useGageRRWorkspace } from './hooks/useGageRRWorkspace';
import LoadingPage from './pages/LoadingPage';
import LoginPage from './pages/LoginPage';
import AnalysisPage from './pages/AnalysisPage';
import ToolsPage from './pages/ToolsPage';
import SixSigmaPage from './pages/SixSigmaPage';
import FeedForwardPage from './pages/FeedForwardPage';
import AdminAccessGatePage from './pages/AdminAccessGatePage';
import AdminUserAccessPage from './pages/AdminUserAccessPage';
import { isToolEnabled } from './config/tools';
import { CompanyBrandProvider } from './contexts/CompanyBrandContext';
import type { AppTheme, Lang } from './types/common';

const ADMIN_ROUTE = '/admin_user_access';
const TOOLS_ROUTE = '/';
const GAGE_RR_TOOL_ROUTE = '/tools/gage-rr';
const SIX_SIGMA_TOOL_ROUTE = '/tools/six-sigma';
const FEED_FORWARD_TOOL_ROUTE = '/tools/feed-forward';

const parseAllowedAdminEmails = (rawValue?: string): string[] =>
  (rawValue || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export default function App() {
  const [lang, setLang] = useState<Lang>('es');
  const [appTheme, setAppTheme] = useState<AppTheme>(() => {
    const storedTheme = window.localStorage.getItem('app-theme');
    const initialTheme: AppTheme = storedTheme === 'day' ? 'day' : 'night';
    document.documentElement.dataset.theme = initialTheme;
    return initialTheme;
  });
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const authSession = useAuthSession(lang);
  const workspace = useGageRRWorkspace(lang);
  const allowedAdminEmails = useMemo(
    () => parseAllowedAdminEmails(import.meta.env.VITE_ADMIN_ALLOWED_EMAILS || 'j.diaz@ilssg.org'),
    []
  );

  const toggleLang = () => setLang((current) => (current === 'es' ? 'en' : 'es'));
  const toggleTheme = () => setAppTheme((current) => (current === 'night' ? 'day' : 'night'));
  const isAdminRoute = pathname === ADMIN_ROUTE;
  const isGageRRToolRoute = pathname === GAGE_RR_TOOL_ROUTE;
  const isSixSigmaToolRoute = pathname === SIX_SIGMA_TOOL_ROUTE;
  const isFeedForwardToolRoute = pathname === FEED_FORWARD_TOOL_ROUTE;
  const loggedEmail = (authSession.user?.email || '').toLowerCase();
  const canSeeAdminEntry =
    allowedAdminEmails.includes(loggedEmail) && authSession.signInProvider === 'google.com';
  const hasGageRRAccess = isToolEnabled(authSession.accountProfile?.toolAccess, 'gage-rr', true);
  const hasSixSigmaAccess = isToolEnabled(authSession.accountProfile?.toolAccess, 'six-sigma', true);
  const hasFeedForwardAccess = isToolEnabled(authSession.accountProfile?.toolAccess, 'feed-forward', true);
  const hasBlockedToolRoute =
    (isGageRRToolRoute && !hasGageRRAccess) ||
    (isSixSigmaToolRoute && !hasSixSigmaAccess) ||
    (isFeedForwardToolRoute && !hasFeedForwardAccess);

  const navigateTo = (path: string, replace = false) => {
    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
    setPathname(path);
  };

  const handleLogout = async () => {
    await authSession.handleLogout();
    navigateTo(TOOLS_ROUTE, true);
  };

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = appTheme;
    window.localStorage.setItem('app-theme', appTheme);
  }, [appTheme]);

  const isAuthorizedAdminUser =
    allowedAdminEmails.includes(loggedEmail) && authSession.signInProvider === 'google.com';

  useEffect(() => {
    if (!isAdminRoute) return;
    if (authSession.loadingAuth) return;
    if (!authSession.user) return;
    if (isAuthorizedAdminUser) return;

    navigateTo(TOOLS_ROUTE, true);
  }, [isAdminRoute, authSession.loadingAuth, authSession.user, isAuthorizedAdminUser]);

  useEffect(() => {
    if (!hasBlockedToolRoute) return;
    navigateTo(TOOLS_ROUTE, true);
  }, [hasBlockedToolRoute]);

  const renderContent = () => {
    if (authSession.loadingAuth) {
      return <LoadingPage />;
    }

    if (isAdminRoute) {
      if (!authSession.user) {
        return (
          <AdminAccessGatePage
            lang={lang}
            appTheme={appTheme}
            isAuthLoading={authSession.isAuthLoading}
            authError={authSession.authError}
            onGoogleLogin={authSession.handleLoginWithGoogle}
            onBackHome={() => navigateTo(TOOLS_ROUTE)}
            onToggleTheme={toggleTheme}
          />
        );
      }

      if (!isAuthorizedAdminUser) {
        return <LoadingPage />;
      }

      return (
        <AdminUserAccessPage
          adminEmail={authSession.user.email || ''}
          appTheme={appTheme}
          onLogout={handleLogout}
          onBackHome={() => navigateTo(TOOLS_ROUTE)}
          onToggleTheme={toggleTheme}
        />
      );
    }

    if (!authSession.user) {
      return (
        <LoginPage
          lang={lang}
          appTheme={appTheme}
          authError={authSession.authError}
          isAuthLoading={authSession.isAuthLoading}
          onGoogleLogin={authSession.handleLoginWithGoogle}
          onEmailLogin={authSession.handleLoginWithEmail}
          onEmailRegister={authSession.handleRegisterWithEmail}
          onToggleLang={toggleLang}
          onToggleTheme={toggleTheme}
        />
      );
    }

    if (isGageRRToolRoute && hasGageRRAccess) {
      return (
        <AnalysisPage
          lang={lang}
          appTheme={appTheme}
          onToggleLang={toggleLang}
          onToggleTheme={toggleTheme}
          userEmail={authSession.user.email}
          onLogout={handleLogout}
          esPremium={authSession.esPremium}
          isCheckoutLoading={authSession.isCheckoutLoading}
          checkoutError={authSession.checkoutError}
          onUnlockPremium={authSession.handleUnlockPremium}
          workspace={workspace}
          onBackToTools={() => navigateTo(TOOLS_ROUTE)}
          showAdminAccessButton={canSeeAdminEntry}
          onGoToAdminAccess={() => navigateTo(ADMIN_ROUTE)}
        />
      );
    }

    if (isSixSigmaToolRoute && hasSixSigmaAccess) {
      return (
        <SixSigmaPage
          lang={lang}
          appTheme={appTheme}
          onToggleLang={toggleLang}
          onToggleTheme={toggleTheme}
          onBackToTools={() => navigateTo(TOOLS_ROUTE)}
        />
      );
    }

    if (isFeedForwardToolRoute && hasFeedForwardAccess) {
      return (
        <FeedForwardPage
          lang={lang}
          appTheme={appTheme}
          onToggleLang={toggleLang}
          onToggleTheme={toggleTheme}
          onBackToTools={() => navigateTo(TOOLS_ROUTE)}
          getIdToken={() => authSession.user!.getIdToken()}
        />
      );
    }

    return (
      <ToolsPage
        lang={lang}
        appTheme={appTheme}
        onToggleLang={toggleLang}
        onToggleTheme={toggleTheme}
        accountProfile={authSession.accountProfile}
        userEmail={authSession.user.email}
        userDisplayName={authSession.user.displayName}
        userPhotoURL={authSession.user.photoURL}
        signInProvider={authSession.signInProvider}
        onLogout={handleLogout}
        esPremium={authSession.esPremium}
        isCheckoutLoading={authSession.isCheckoutLoading}
        checkoutError={authSession.checkoutError}
        onUnlockPremium={authSession.handleUnlockPremium}
        onOpenGageRR={() => navigateTo(GAGE_RR_TOOL_ROUTE)}
        onOpenSixSigma={() => navigateTo(SIX_SIGMA_TOOL_ROUTE)}
        onOpenFeedForward={() => navigateTo(FEED_FORWARD_TOOL_ROUTE)}
        toolAccess={authSession.accountProfile?.toolAccess}
        showAdminAccessButton={canSeeAdminEntry}
        onGoToAdminAccess={() => navigateTo(ADMIN_ROUTE)}
      />
    );
  };

  return (
    <CompanyBrandProvider brand={isAdminRoute ? null : authSession.accountProfile?.companyBrand || null}>
      {renderContent()}
    </CompanyBrandProvider>
  );
}
