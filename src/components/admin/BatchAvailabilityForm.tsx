import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { gerarHorariosLote } from '../../lib/lote';
import { hojeISO } from '../../lib/date';
import DatePicker from './DatePicker';

interface BatchAvailabilityFormProps {
  onAdicionados: () => void;
}

const DIAS_SEMANA = [
  { valor: 1, rotulo: 'Seg' },
  { valor: 2, rotulo: 'Ter' },
  { valor: 3, rotulo: 'Qua' },
  { valor: 4, rotulo: 'Qui' },
  { valor: 5, rotulo: 'Sex' },
  { valor: 6, rotulo: 'Sáb' },
  { valor: 0, rotulo: 'Dom' },
];

const OPCOES_INTERVALO = [30, 45, 60, 90, 120];

function rotuloIntervalo(min: number) {
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${horas}h${resto}min` : `${horas}h`;
}

export default function BatchAvailabilityForm({ onAdicionados }: BatchAvailabilityFormProps) {
  const [aberto, setAberto] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([]);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [intervalo, setIntervalo] = useState(60);
  const [dataFinal, setDataFinal] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  function alternarDia(v: number) {
    setResultado(null);
    setDiasSelecionados((atual) => (atual.includes(v) ? atual.filter((d) => d !== v) : [...atual, v].sort()));
  }

  async function gerarLote(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setResultado(null);

    if (diasSelecionados.length === 0) {
      setErro('Escolha ao menos um dia da semana.');
      return;
    }
    if (!horaInicio || !horaFim || horaFim <= horaInicio) {
      setErro('O horário final precisa ser depois do horário inicial.');
      return;
    }
    if (!dataFinal) {
      setErro('Escolha até quando repetir.');
      return;
    }

    const hoje = hojeISO();
    if (dataFinal < hoje) {
      setErro('A data final precisa ser hoje ou no futuro.');
      return;
    }

    const gerados = gerarHorariosLote({
      diasSemana: diasSelecionados,
      dataInicial: hoje,
      dataFinal,
      horaInicio,
      horaFim,
      intervaloMinutos: intervalo,
    });

    if (gerados.length === 0) {
      setErro('Nenhum horário seria gerado com esses critérios.');
      return;
    }

    setGerando(true);

    const { data: existentes, error: erroConsulta } = await supabase
      .from('horarios_disponiveis')
      .select('data, hora')
      .gte('data', hoje)
      .lte('data', dataFinal);

    if (erroConsulta) {
      setGerando(false);
      setErro('Não foi possível verificar os horários já cadastrados.');
      return;
    }

    const chavesExistentes = new Set((existentes ?? []).map((h) => `${h.data}|${h.hora.slice(0, 5)}`));
    const novos = gerados.filter((g) => !chavesExistentes.has(`${g.data}|${g.hora}`));
    const ignorados = gerados.length - novos.length;

    if (novos.length === 0) {
      setGerando(false);
      setResultado(`Nenhum horário novo — os ${gerados.length} horários desse período já existiam.`);
      return;
    }

    const { error: erroInsercao } = await supabase
      .from('horarios_disponiveis')
      .insert(novos.map((n) => ({ data: n.data, hora: n.hora, status: 'disponivel' })));

    setGerando(false);

    if (erroInsercao) {
      setErro('Não foi possível adicionar os horários em lote.');
      return;
    }

    setResultado(
      ignorados > 0
        ? `${novos.length} horários adicionados. ${ignorados} já existiam e foram ignorados.`
        : `${novos.length} horários adicionados.`
    );
    setDiasSelecionados([]);
    setHoraInicio('');
    setHoraFim('');
    setDataFinal('');
    setIntervalo(60);
    onAdicionados();
  }

  return (
    <div className="batch-form-wrapper">
      <button type="button" className="batch-form__toggle" onClick={() => setAberto((a) => !a)}>
        {aberto ? '– Fechar adição em lote' : '+ Adicionar em lote (repetir por várias semanas)'}
      </button>

      {aberto && (
        <form className="batch-form" onSubmit={gerarLote}>
          <p className="admin-panel__hint">
            Escolha os dias da semana, a faixa de horário e até quando repetir — os horários são
            gerados automaticamente a partir de hoje, pulando qualquer um que já exista.
          </p>

          {erro && <div className="alert alert-error">{erro}</div>}
          {resultado && <div className="alert alert-success">{resultado}</div>}

          <div className="field">
            <label>Dias da semana</label>
            <div className="weekday-picker">
              {DIAS_SEMANA.map((d) => (
                <button
                  type="button"
                  key={d.valor}
                  className={`weekday-picker__day ${diasSelecionados.includes(d.valor) ? 'is-selected' : ''}`}
                  onClick={() => alternarDia(d.valor)}
                >
                  {d.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div className="batch-form__row">
            <div className="field">
              <label htmlFor="lote-hora-inicio">Das</label>
              <input
                id="lote-hora-inicio"
                type="time"
                required
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="lote-hora-fim">Às</label>
              <input
                id="lote-hora-fim"
                type="time"
                required
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="lote-intervalo">Intervalo entre consultas</label>
              <select
                id="lote-intervalo"
                value={intervalo}
                onChange={(e) => setIntervalo(Number(e.target.value))}
              >
                {OPCOES_INTERVALO.map((min) => (
                  <option key={min} value={min}>
                    {rotuloIntervalo(min)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Repetir até</label>
            <DatePicker value={dataFinal} onChange={setDataFinal} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={gerando}>
            {gerando ? 'Gerando horários...' : 'Gerar horários'}
          </button>
        </form>
      )}
    </div>
  );
}
