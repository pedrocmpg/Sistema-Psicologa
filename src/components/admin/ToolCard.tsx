import { useId, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from '../icons';

interface ToolCardProps {
  titulo: string;
  Icon: LucideIcon;
  inicialmenteAberto?: boolean;
  children: ReactNode;
}

/** Card colapsável para as ferramentas do painel (adicionar horário, lote, agendamento manual). */
export default function ToolCard({ titulo, Icon, inicialmenteAberto = false, children }: ToolCardProps) {
  const [aberto, setAberto] = useState(inicialmenteAberto);
  const corpoId = useId();

  return (
    <div className={`tool-card ${aberto ? 'is-open' : ''}`}>
      <button
        type="button"
        className="tool-card__toggle"
        aria-expanded={aberto}
        aria-controls={corpoId}
        onClick={() => setAberto((a) => !a)}
      >
        <span className="tool-card__toggle-icon" aria-hidden="true">
          <Icon size={18} strokeWidth={2} />
        </span>
        {titulo}
        <ChevronRight className="tool-card__chevron" size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {aberto && (
        <div className="tool-card__body fade-in" id={corpoId}>
          {children}
        </div>
      )}
    </div>
  );
}
