import { useEffect, useState } from 'react';
import { useAuthSession } from './hooks/useAuthSession';
import { useGageRRWorkspace } from './hooks/useGageRRWorkspace';
import LoadingPage from './pages/LoadingPage';
import LoginPage from './pages/LoginPage';
import AnalysisPage from './pages/AnalysisPage';
import AdminAccessGatePage from './pages/AdminAccessGatePage';
import AdminUserAccessPage from './pages/AdminUserAccessPage';
import type { Lang } from './types/common';

const ADMIN_ROUTE = '/admin_user_access';
const ADMIN_EMAIL = 'j.diaz@ilssg.org';

export default function App() {
  const [lang, setLang] = useState<Lang>('es');
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const authSession = useAuthSession(lang);
  const workspace = useGageRRWorkspace(lang);

  const toggleLang = () => setLang((current) => (current === 'es' ? 'en' : 'es'));
  const isAdminRoute = pathname === ADMIN_ROUTE;

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const isAuthorizedAdminUser =
    (authSession.user?.email || '').toLowerCase() === ADMIN_EMAIL &&
    authSession.user?.providerData?.some((provider) => provider.providerId === 'google.com');

  useEffect(() => {
    if (!isAdminRoute) return;
    if (authSession.loadingAuth) return;
    if (!authSession.user) return;
    if (isAuthorizedAdminUser) return;

    window.history.replaceState({}, '', '/');
    setPathname('/');
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
        />
      );
    }

    if (!isAuthorizedAdminUser) {
      return <LoadingPage />;
    }

    return (
      <AdminUserAccessPage
        adminEmail={authSession.user.email || ADMIN_EMAIL}
        onLogout={authSession.handleLogout}
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

  return (
    <AnalysisPage
      lang={lang}
      onToggleLang={toggleLang}
      userEmail={authSession.user.email}
      onLogout={authSession.handleLogout}
      esPremium={authSession.esPremium}
      isCheckoutLoading={authSession.isCheckoutLoading}
      checkoutError={authSession.checkoutError}
      onUnlockPremium={authSession.handleUnlockPremium}
      workspace={workspace}
    />
  );
}
