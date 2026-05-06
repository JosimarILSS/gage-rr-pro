import { Shield, LogIn, Home } from 'lucide-react';
import AppNavbar from '../components/common/AppNavbar';
import type { AppTheme, Lang } from '../types/common';

type AdminAccessGatePageProps = {
  lang: Lang;
  appTheme: AppTheme;
  isAuthLoading: boolean;
  authError: string | null;
  onGoogleLogin: () => Promise<void>;
  onBackHome: () => void;
  onToggleTheme: () => void;
};

export default function AdminAccessGatePage({
  lang,
  appTheme,
  isAuthLoading,
  authError,
  onGoogleLogin,
  onBackHome,
  onToggleTheme,
}: AdminAccessGatePageProps) {
  return (
    <div className="min-h-screen app-shell flex flex-col font-sans">
      <AppNavbar lang={lang} appTheme={appTheme} onToggleTheme={onToggleTheme} />
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-lg p-8 space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
          <Shield className="w-7 h-7 text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Admin User Access</h1>
        <p className="text-sm text-slate-600">
          {lang === 'es'
            ? 'Esta pagina requiere iniciar sesion con Google usando el correo autorizado.'
            : 'This page requires Google sign-in with the authorized email.'}
        </p>
        <button
          type="button"
          onClick={onBackHome}
          className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4" />
          {lang === 'es' ? 'Regresar al inicio' : 'Back to home'}
        </button>
        <button
          onClick={onGoogleLogin}
          disabled={isAuthLoading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          {isAuthLoading
            ? (lang === 'es' ? 'Validando...' : 'Validating...')
            : (lang === 'es' ? 'Entrar con Google' : 'Continue with Google')}
        </button>
        {authError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {authError}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
