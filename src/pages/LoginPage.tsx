import { BarChart3, Globe } from 'lucide-react';
import { t } from '../translations';
import type { Lang } from '../types/common';

type LoginPageProps = {
  lang: Lang;
  authError: string | null;
  isLoggingIn: boolean;
  onLogin: () => Promise<void>;
  onToggleLang: () => void;
};

export default function LoginPage({
  lang,
  authError,
  isLoggingIn,
  onLogin,
  onToggleLang,
}: LoginPageProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">{t[lang].landingTitle}</h1>
        <p className="text-slate-600">{t[lang].landingDesc}</p>
        <button
          onClick={onLogin}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isLoggingIn ? (lang === 'es' ? 'Abriendo Google...' : 'Opening Google...') : t[lang].loginGoogle}
        </button>
        {authError && (
          <div className="text-left text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {authError}
          </div>
        )}
        <div className="pt-4">
          <button
            onClick={onToggleLang}
            className="text-sm text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-1 mx-auto cursor-pointer"
          >
            <Globe className="w-4 h-4" /> {lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          </button>
        </div>
      </div>
    </div>
  );
}

