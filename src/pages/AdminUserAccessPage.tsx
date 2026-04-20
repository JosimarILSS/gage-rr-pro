import { useMemo, useState, type FormEvent } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { manageUserAccess, type ManageUserAccessResult } from '../services/admin-user';
import { auth } from '../firebase';

type AdminUserAccessPageProps = {
  adminEmail: string;
  onLogout: () => Promise<void>;
};

export default function AdminUserAccessPage({ adminEmail, onLogout }: AdminUserAccessPageProps) {
  const [email, setEmail] = useState('');
  const [premium, setPremium] = useState(true);
  const [unlimited, setUnlimited] = useState(false);
  const [months, setMonths] = useState(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManageUserAccessResult | null>(null);

  const apiBaseUrl = useMemo(
    () =>
      (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') ||
      (import.meta.env.DEV ? 'http://localhost:4242' : ''),
    []
  );

  const handleMonthsChange = (rawValue: string) => {
    const onlyDigits = rawValue.replace(/\D/g, '');
    if (!onlyDigits) {
      setMonths(1);
      return;
    }

    const normalized = onlyDigits.replace(/^0+/, '');
    const parsed = Number(normalized || '0');
    setMonths(parsed > 0 ? parsed : 1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Ingresa un correo valido.');
      return;
    }

    if (premium && !unlimited && (!Number.isInteger(months) || months <= 0)) {
      setError('Meses debe ser un entero mayor a 0.');
      return;
    }

    setError(null);
    setResult(null);
    setIsSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('No hay sesion activa.');
      }

      const token = await currentUser.getIdToken(true);
      const payload = {
        email: normalizedEmail,
        premium,
        unlimited: premium ? unlimited : false,
        months: premium && !unlimited ? months : undefined,
      };
      const data = await manageUserAccess(apiBaseUrl, token, payload);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar el usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1">
              <ShieldCheck className="w-4 h-4" />
              Acceso administrativo restringido
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mt-3">Admin User Access</h1>
            <p className="text-sm text-slate-600 mt-1">Sesión autorizada: {adminEmail}</p>
          </div>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Gestión manual de premium</h2>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Correo del usuario</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Estado premium</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPremium(true)}
                className={`px-3 py-2 rounded-lg text-sm border cursor-pointer ${
                  premium
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-300 text-slate-600'
                }`}
              >
                Activar premium
              </button>
              <button
                type="button"
                onClick={() => {
                  setPremium(false);
                  setUnlimited(false);
                }}
                className={`px-3 py-2 rounded-lg text-sm border cursor-pointer ${
                  !premium
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-white border-slate-300 text-slate-600'
                }`}
              >
                Quitar premium
              </button>
            </div>
          </div>

          {premium && (
            <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Premium ilimitado (VIP)
              </label>

              {!unlimited && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Meses de premium</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={months}
                    onChange={(e) => handleMonthsChange(e.target.value)}
                    className="w-full md:w-48 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Si el usuario ya tenía premium activo, se extiende desde su fecha actual.
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
          >
            {isSubmitting ? 'Aplicando cambios...' : 'Aplicar cambios'}
          </button>

          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
        </form>

        {result && (
          <div className="bg-white border border-emerald-200 rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-emerald-700 mb-3">Actualización aplicada</h3>
            <div className="text-sm text-slate-700 space-y-1">
              <p><span className="font-medium">Email:</span> {result.email}</p>
              <p><span className="font-medium">UID:</span> {result.uid}</p>
              <p><span className="font-medium">Usuario creado:</span> {result.created ? 'Sí' : 'No'}</p>
              <p><span className="font-medium">Premium:</span> {result.premium ? 'Sí' : 'No'}</p>
              {result.premium && (
                <>
                  <p><span className="font-medium">Modalidad:</span> {result.unlimited ? 'Ilimitado' : 'Por meses'}</p>
                  {!result.unlimited && (
                    <p><span className="font-medium">Meses aplicados:</span> {result.monthsApplied}</p>
                  )}
                  <p><span className="font-medium">Expira:</span> {result.expiresAt ? new Date(result.expiresAt).toLocaleString('es-MX') : 'Nunca'}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
