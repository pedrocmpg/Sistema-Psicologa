import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from '../icons';

interface DatePickerProps {
  value: string;
  onChange: (data: string) => void;
}

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function paraISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function deISO(s: string) {
  const [ano, mes, dia] = s.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [mesVisivel, setMesVisivel] = useState(() => {
    const base = value ? deISO(value) : hoje;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, []);

  const primeiroDiaSemana = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1).getDay();
  const diasNoMes = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 0).getDate();

  const celulas: (Date | null)[] = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let dia = 1; dia <= diasNoMes; dia++) {
    celulas.push(new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), dia));
  }

  function selecionar(d: Date) {
    onChange(paraISO(d));
    setAberto(false);
  }

  const rotuloMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(mesVisivel);
  const textoTrigger = value
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(deISO(value))
    : 'Selecionar dia';

  return (
    <div className="date-picker" ref={containerRef}>
      <button
        type="button"
        className={`date-picker__trigger ${!value ? 'is-placeholder' : ''}`}
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
      >
        <Calendar size={16} strokeWidth={2} aria-hidden="true" />
        {textoTrigger}
      </button>

      {/* no celular o painel vira bottom-sheet; o backdrop fica dentro do container para o clique-fora funcionar */}
      {aberto && <div className="date-picker__backdrop" onClick={() => setAberto(false)} />}

      {aberto && (
        <div className="date-picker__panel" role="dialog" aria-label="Selecionar dia">
          <div className="date-picker__header">
            <button
              type="button"
              onClick={() => setMesVisivel((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <span>{rotuloMes}</span>
            <button
              type="button"
              onClick={() => setMesVisivel((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              aria-label="Próximo mês"
            >
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="date-picker__weekdays">
            {DIAS_SEMANA.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="date-picker__grid">
            {celulas.map((d, i) => {
              if (!d) return <span key={`vazio-${i}`} />;
              const desabilitado = d < hoje;
              const selecionado = value === paraISO(d);
              const ehHoje = d.getTime() === hoje.getTime();
              return (
                <button
                  key={i}
                  type="button"
                  disabled={desabilitado}
                  aria-current={ehHoje ? 'date' : undefined}
                  className={`date-picker__day ${selecionado ? 'is-selected' : ''} ${ehHoje ? 'is-today' : ''}`}
                  onClick={() => selecionar(d)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
