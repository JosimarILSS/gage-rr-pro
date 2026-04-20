import { Shield, LogIn } from 'lucide-react';
import type { Lang } from '../types/common';

type AdminAccessGatePageProps = {
  lang: Lang;
  isAuthLoading: boolean;
  authError: string | null;
  onGoogleLogin: () => Promise<void>;
};

export default function AdminAccessGatePage({
  lang,
  isAuthLoading,
  authError,
  onGoogleLogin,
}: AdminAccessGatePageProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
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
  );
}
