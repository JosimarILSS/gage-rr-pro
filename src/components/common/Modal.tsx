import React from 'react';

type ModalProps = {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

export default function Modal({ isOpen, title, children, onClose }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 cursor-pointer"
      />
      <div className="relative z-10 w-full max-w-lg app-panel shadow-2xl">
        <div className="p-5 border-b app-divider flex items-center justify-between">
          <h3 className="text-lg app-title">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="app-button app-button-secondary px-3 py-2 text-sm"
          >
            Cerrar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
