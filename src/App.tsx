import { useState } from 'react';
import { useAuthSession } from './hooks/useAuthSession';
import { useGageRRWorkspace } from './hooks/useGageRRWorkspace';
import LoadingPage from './pages/LoadingPage';
import LoginPage from './pages/LoginPage';
import AnalysisPage from './pages/AnalysisPage';
import type { Lang } from './types/common';

export default function App() {
  const [lang, setLang] = useState<Lang>('es');
  const authSession = useAuthSession(lang);
  const workspace = useGageRRWorkspace(lang);

  const toggleLang = () => setLang((current) => (current === 'es' ? 'en' : 'es'));

  if (authSession.loadingAuth) {
    return <LoadingPage />;
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
