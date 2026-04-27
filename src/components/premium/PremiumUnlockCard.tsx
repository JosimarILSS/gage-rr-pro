import { useState } from 'react';
import Modal from '../common/Modal';
import type { Lang } from '../../types/common';

type PremiumUnlockCardProps = {
  lang: Lang;
  isCheckoutLoading: boolean;
  checkoutError: string | null;
  onUnlockPremium: () => Promise<void>;
};

export default function PremiumUnlockCard({
  lang,
  isCheckoutLoading,
  checkoutError,
  onUnlockPremium,
}: PremiumUnlockCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const copy = {
    es: {
      title: 'Interpretación Profesional Lista',
      description:
        'Los cálculos de ANOVA se han completado. Para desbloquear el diagnóstico detallado y las recomendaciones de acción, adquiere acceso premium por 6 meses.',
      button: 'Desbloquear por 150 MXN',
      loading: 'Abriendo checkout...',
      footer: 'Pago seguro vía Stripe',
      modalTitle: 'Confirmar Compra',
      modalBody:
        'Vas a abrir Stripe Checkout para pagar 150 MXN por 6 meses de acceso premium. Al confirmar el pago, tu cuenta se marcará como premium automáticamente.',
      modalCancel: 'Cancelar',
      modalConfirm: 'Continuar a pago',
    },
    en: {
      title: 'Professional Interpretation Ready',
      description:
        'ANOVA calculations are complete. To unlock detailed diagnostics and action recommendations, purchase 6 months of premium access.',
      button: 'Unlock for 150 MXN',
      loading: 'Opening checkout...',
      footer: 'Secure Stripe payment',
      modalTitle: 'Confirm Purchase',
      modalBody:
        'You are about to open Stripe Checkout for 150 MXN for 6 months of premium access. Once paid, your account will be marked as premium automatically.',
      modalCancel: 'Cancel',
      modalConfirm: 'Continue to payment',
    },
  }[lang];

  const handleConfirm = async () => {
    await onUnlockPremium();
  };

  return (
    <>
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-10 rounded-2xl text-center my-4 shadow-inner">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-xl font-bold text-slate-800">{copy.title}</h3>
        <p className="text-slate-600 mb-6 max-w-sm mx-auto">{copy.description}</p>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isCheckoutLoading}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all hover:scale-105 shadow-lg shadow-indigo-100 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
        >
          {isCheckoutLoading ? copy.loading : copy.button}
        </button>
        {checkoutError && <p className="text-sm text-red-700 mt-3">{checkoutError}</p>}
        <p className="text-xs text-slate-400 mt-4 italic">{copy.footer}</p>
      </div>

      <Modal isOpen={isModalOpen} title={copy.modalTitle} onClose={() => setIsModalOpen(false)}>
        <p className="text-sm text-slate-600 mb-5">{copy.modalBody}</p>
        {checkoutError && <p className="text-sm text-red-700 mb-4">{checkoutError}</p>}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {copy.modalCancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isCheckoutLoading}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed enabled:cursor-pointer"
          >
            {isCheckoutLoading ? copy.loading : copy.modalConfirm}
          </button>
        </div>
      </Modal>
    </>
  );
}
