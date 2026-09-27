import type { NumerosResumo } from '../../hooks/useResumoPainel';
import type { Aba } from './abas';
import { CalendarCheck, Inbox, CalendarDays } from '../icons';

interface ResumoPainelProps {
  numeros: NumerosResumo | null;
  onNavegar: (aba: Aba) => void;
}

export default function ResumoPainel({ numeros, onNavegar }: ResumoPainelProps) {
  const pendentes = numeros?.pendentes ?? 0;

  return (
    <div className="resumo-painel">
      <button type="button" className="resumo-card" onClick={() => onNavegar('confirmados')}>
        <span className="resumo-card__icon" aria-hidden="true">
          <CalendarCheck size={22} strokeWidth={1.8} />
        </span>
        <span className="resumo-card__numero">{numeros ? numeros.confirmadasHoje : '—'}</span>
        <span className="resumo-card__label">Consultas hoje</span>
      </button>
      <button
        type="button"
        className={`resumo-card ${pendentes > 0 ? 'resumo-card--alerta' : ''}`}
        onClick={() => onNavegar('pendentes')}
      >
        <span className="resumo-card__icon" aria-hidden="true">
          <Inbox size={22} strokeWidth={1.8} />
        </span>
        <span className="resumo-card__numero">{numeros ? numeros.pendentes : '—'}</span>
        <span className="resumo-card__label">Pedidos pendentes</span>
      </button>
      <button type="button" className="resumo-card" onClick={() => onNavegar('confirmados')}>
        <span className="resumo-card__icon" aria-hidden="true">
          <CalendarDays size={22} strokeWidth={1.8} />
        </span>
        <span className="resumo-card__numero">{numeros ? numeros.confirmadasProximos7Dias : '—'}</span>
        <span className="resumo-card__label">Próximos 7 dias</span>
      </button>
    </div>
  );
}
