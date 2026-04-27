import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from './hooks/useAuthSession';
import { useGageRRWorkspace } from './hooks/useGageRRWorkspace';
import LoadingPage from './pages/LoadingPage';
import LoginPage from './pages/LoginPage';
import AnalysisPage from './pages/AnalysisPage';
import ToolsPage from './pages/ToolsPage';
import SixSigmaPage from './pages/SixSigmaPage';
import AdminAccessGatePage from './pages/AdminAccessGatePage';
import AdminUserAccessPage from './pages/AdminUserAccessPage';
import type { Lang } from './types/common';

const ADMIN_ROUTE = '/admin_user_access';
const TOOLS_ROUTE = '/';
const GAGE_RR_TOOL_ROUTE = '/tools/gage-rr';
const SIX_SIGMA_TOOL_ROUTE = '/tools/six-sigma';

const parseAllowedAdminEmails = (rawValue?: string): string[] =>
  (rawValue || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export default function App() {
  const [lang, setLang] = useState<Lang>('es');
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const authSession = useAuthSession(lang);
  const workspace = useGageRRWorkspace(lang);
  const allowedAdminEmails = useMemo(
    () => parseAllowedAdminEmails(import.meta.env.VITE_ADMIN_ALLOWED_EMAILS || 'j.diaz@ilssg.org'),
    []
  );

  const toggleLang = () => setLang((current) => (current === 'es' ? 'en' : 'es'));
  const isAdminRoute = pathname === ADMIN_ROUTE;
  const isGageRRToolRoute = pathname === GAGE_RR_TOOL_ROUTE;
  const isSixSigmaToolRoute = pathname === SIX_SIGMA_TOOL_ROUTE;
  const loggedEmail = (authSession.user?.email || '').toLowerCase();
  const canSeeAdminEntry =
    allowedAdminEmails.includes(loggedEmail) && authSession.signInProvider === 'google.com';

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

  const isAuthorizedAdminUser =
    allowedAdminEmails.includes(loggedEmail) && authSession.signInProvider === 'google.com';

  useEffect(() => {
    if (!isAdminRoute) return;
    if (authSession.loadingAuth) return;
    if (!authSession.user) return;
    if (isAuthorizedAdminUser) return;

    navigateTo(TOOLS_ROUTE, true);
  }, [isAdminRoute, authSession.loadingAuth, authSession.user, isAuthorizedAdminUser]);

  if (authSession.loadingAuth) {
    return <LoadingPage />;
  }

  if (isAdminRoute) {
    if (!authSession.user) {
      return (
        <AdminAccessGatePage
          lang={lang}
          isAuthLoading={authSession.isAuthLoading}
          authError={authSession.authError}
          onGoogleLogin={authSession.handleLoginWithGoogle}
          onBackHome={() => navigateTo(TOOLS_ROUTE)}
        />
      );
    }

    if (!isAuthorizedAdminUser) {
      return <LoadingPage />;
    }

    return (
      <AdminUserAccessPage
        adminEmail={authSession.user.email || ''}
        onLogout={handleLogout}
        onBackHome={() => navigateTo(TOOLS_ROUTE)}
      />
    );
  }

  if (!authSession.user) {
    return (
      <LoginPage
        lang={lang}
        authError={authSession.authError}
        isAuthLoading={authSession.isAuthLoading}
        onGoogleLogin={authSession.handleLoginWithGoogle}
        onEmailLogin={authSession.handleLoginWithEmail}
        onEmailRegister={authSession.handleRegisterWithEmail}
        onToggleLang={toggleLang}
      />
    );
  }

  if (isGageRRToolRoute) {
    return (
      <AnalysisPage
        lang={lang}
        onToggleLang={toggleLang}
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

  if (isSixSigmaToolRoute) {
    return (
      <SixSigmaPage
        lang={lang}
        onToggleLang={toggleLang}
        onBackToTools={() => navigateTo(TOOLS_ROUTE)}
      />
    );
  }

  return (
    <ToolsPage
      lang={lang}
      onToggleLang={toggleLang}
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
      showAdminAccessButton={canSeeAdminEntry}
      onGoToAdminAccess={() => navigateTo(ADMIN_ROUTE)}
    />
  );
}
