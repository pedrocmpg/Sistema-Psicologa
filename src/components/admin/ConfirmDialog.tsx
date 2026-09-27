import { useEffect, useRef } from 'react';

export interface AcaoDialog {
  rotulo: string;
  variante: 'primary' | 'ghost' | 'danger';
  onClick: () => void;
}

interface ConfirmDialogProps {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  acoes: AcaoDialog[];
  onFechar: () => void;
}

const classePorVariante: Record<AcaoDialog['variante'], string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger-solid',
};

/** Confirmação modal usando <dialog> nativo (foco preso, Esc fecha, acessível sem biblioteca). */
export default function ConfirmDialog({ aberto, titulo, descricao, acoes, onFechar }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-titulo"
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
      onClick={(e) => {
        // clique no backdrop (fora da caixa) fecha
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="confirm-dialog__body">
        <h2 id="confirm-dialog-titulo" className="confirm-dialog__title">
          {titulo}
        </h2>
        {descricao && <p className="confirm-dialog__desc">{descricao}</p>}
      </div>
      <div className="confirm-dialog__actions">
        {acoes.map((a) => (
          <button key={a.rotulo} type="button" className={`btn btn-sm ${classePorVariante[a.variante]}`} onClick={a.onClick}>
            {a.rotulo}
          </button>
        ))}
      </div>
    </dialog>
  );
}
