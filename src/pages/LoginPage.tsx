import { useState, type FormEvent } from 'react';
import { BarChart3, Globe, Mail, Lock } from 'lucide-react';
import AppNavbar from '../components/common/AppNavbar';
import { t } from '../translations';
import type { AppTheme, Lang } from '../types/common';

type LoginPageProps = {
  lang: Lang;
  appTheme: AppTheme;
  authError: string | null;
  isAuthLoading: boolean;
  onGoogleLogin: () => Promise<void>;
  onEmailLogin: (email: string, password: string) => Promise<void>;
  onEmailRegister: (email: string, password: string, confirmPassword: string) => Promise<void>;
  onToggleLang: () => void;
  onToggleTheme: () => void;
};

export default function LoginPage({
  lang,
  appTheme,
  authError,
  isAuthLoading,
  onGoogleLogin,
  onEmailLogin,
  onEmailRegister,
  onToggleLang,
  onToggleTheme,
}: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const hasConfirmValue = confirmPassword.length > 0;
  const passwordsMatch = password.length > 0 && confirmPassword === password;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'login') {
      await onEmailLogin(email, password);
      return;
    }
    await onEmailRegister(email, password, confirmPassword);
  };

  return (
    <div className="app-shell flex flex-col">
      <AppNavbar
        lang={lang}
        appTheme={appTheme}
        onToggleTheme={onToggleTheme}
        right={
          <button
            onClick={onToggleLang}
            className="app-button app-button-secondary text-sm px-3 py-2"
          >
            <Globe className="w-4 h-4" /> {lang === 'es' ? 'EN' : 'ES'}
          </button>
        }
      />

      <div className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full app-panel p-8 text-center space-y-5">
        <div className="app-icon-tile mx-auto mb-4" style={{ width: '4rem', height: '4rem' }}>
          <BarChart3 className="w-8 h-8" />
        </div>
        <h1 className="text-3xl app-title">{t[lang].landingTitle}</h1>
        <p className="app-muted">{t[lang].landingDesc}</p>

        <button
          onClick={onGoogleLogin}
          disabled={isAuthLoading}
          className="app-button app-button-secondary w-full py-3 px-4"
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
          {isAuthLoading ? (lang === 'es' ? 'Procesando...' : 'Processing...') : t[lang].loginGoogle}
        </button>

        <div className="relative py-1">
          <div className="border-t app-divider" />
          <span className="absolute left-1/2 -translate-x-1/2 -top-2 px-2 text-xs app-muted" style={{ background: 'var(--app-surface)' }}>
            {lang === 'es' ? 'o con correo' : 'or with email'}
          </span>
        </div>

        <div className="app-tabs app-tabs-stretch">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`app-tab justify-center ${mode === 'login' ? 'app-tab-active' : ''}`}
          >
            {lang === 'es' ? 'Iniciar sesión' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`app-tab justify-center ${mode === 'register' ? 'app-tab-active' : ''}`}
          >
            {lang === 'es' ? 'Crear cuenta' : 'Create account'}
          </button>
        </div>

        <form className="space-y-3 text-left" onSubmit={handleSubmit}>
          <label className="text-sm app-muted flex items-center gap-2">
            <Mail className="w-4 h-4" />
            {lang === 'es' ? 'Correo' : 'Email'}
          </label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={lang === 'es' ? 'tu@correo.com' : 'you@email.com'}
            className="app-input px-3 py-2"
            required
          />

          <label className="text-sm app-muted flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {lang === 'es' ? 'Contraseña' : 'Password'}
          </label>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={lang === 'es' ? 'Mínimo 6 caracteres' : 'At least 6 characters'}
            className="app-input px-3 py-2"
            minLength={6}
            required
          />

          {mode === 'register' && (
            <>
              <label className="text-sm app-muted flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {lang === 'es' ? 'Repetir contraseña' : 'Confirm password'}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={lang === 'es' ? 'Repite tu contraseña' : 'Repeat your password'}
                className={`app-input px-3 py-2 ${
                  hasConfirmValue
                    ? passwordsMatch
                      ? 'app-input-valid'
                      : 'app-input-invalid'
                    : ''
                }`}
                minLength={6}
                required
              />
              {hasConfirmValue && (
                <p className={`text-xs ${passwordsMatch ? 'app-text-success' : 'app-text-danger'}`}>
                  {passwordsMatch
                    ? (lang === 'es' ? 'Las contraseñas coinciden.' : 'Passwords match.')
                    : (lang === 'es' ? 'Las contraseñas no coinciden.' : 'Passwords do not match.')}
                </p>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={isAuthLoading}
            className="app-button app-button-primary w-full py-2.5 px-4"
          >
            {isAuthLoading
              ? (lang === 'es' ? 'Procesando...' : 'Processing...')
              : mode === 'login'
                ? (lang === 'es' ? 'Entrar con correo' : 'Sign in with email')
                : (lang === 'es' ? 'Crear cuenta' : 'Create account')}
          </button>
        </form>

        {authError && (
          <div className="text-left text-sm app-alert app-alert-danger">
            {authError}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
