import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import type { HorarioDisponivel, StatusHorario } from '../../types';
import { hojeISO, rotuloDia } from '../../lib/date';
import { CalendarDays, Plus, Trash } from '../icons';
import DatePicker from './DatePicker';
import BatchAvailabilityForm from './BatchAvailabilityForm';
import ToolCard from './ToolCard';
import EmptyState, { Carregando } from './EmptyState';

const rotuloStatus: Record<StatusHorario, string> = {
  disponivel: 'Livre',
  reservado: 'Pendente',
  confirmado: 'Confirmado',
};

export default function AvailabilityManager() {
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    const { data: rows, error } = await supabase
      .from('horarios_disponiveis')
      .select('*')
      .order('data', { ascending: true })
      .order('hora', { ascending: true });

    if (!error) setHorarios(rows ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function adicionarHorario(e: FormEvent) {
    e.preventDefault();
    if (!data || !hora) return;
    setSalvando(true);
    setErro(null);

    const { error } = await supabase.from('horarios_disponiveis').insert({ data, hora, status: 'disponivel' });

    setSalvando(false);
    if (error) {
      setErro(
        error.message.includes('duplicate') || error.message.includes('unique')
          ? 'Já existe um horário cadastrado nesse dia e hora.'
          : 'Não foi possível adicionar o horário.'
      );
      return;
    }

    setData('');
    setHora('');
    carregar();
  }

  async function removerHorario(id: string) {
    setErro(null);
    const { error } = await supabase.from('horarios_disponiveis').delete().eq('id', id);
    if (error) {
      setErro('Não foi possível remover o horário.');
      return;
    }
    carregar();
  }

  const grupos: { data: string; itens: HorarioDisponivel[] }[] = [];
  for (const h of horarios) {
    const g = grupos.find((x) => x.data === h.data);
    if (g) g.itens.push(h);
    else grupos.push({ data: h.data, itens: [h] });
  }

  const hoje = hojeISO();

  return (
    <div className="admin-panel">
      <h2>Agenda de horários</h2>
      <p className="admin-panel__hint">
        Adicione os horários em que você está disponível para atendimento. Eles aparecem
        automaticamente para os pacientes no site.
      </p>

      {erro && <div className="alert alert-error">{erro}</div>}

      <div className="admin-tools">
        <ToolCard titulo="Adicionar um horário" Icon={Plus} inicialmenteAberto>
          <form className="add-slot-form" onSubmit={adicionarHorario}>
            <div className="field">
              <span className="field-label">Dia</span>
              <DatePicker
                value={data}
                onChange={(novaData) => {
                  setData(novaData);
                  setHora('');
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="nova-hora">Horário</label>
              <input
                id="nova-hora"
                type="time"
                required
                disabled={!data}
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={salvando || !data || !hora}>
              {salvando ? 'Adicionando...' : 'Adicionar horário'}
            </button>
          </form>
        </ToolCard>

        <BatchAvailabilityForm onAdicionados={carregar} />
      </div>

      {carregando && <Carregando>Carregando agenda...</Carregando>}

      {!carregando && grupos.length === 0 && (
        <EmptyState Icon={CalendarDays}>Nenhum horário cadastrado ainda.</EmptyState>
      )}

      {!carregando &&
        grupos.map((g) => (
          <section className="day-group" key={g.data}>
            <h3 className={`day-group__title ${g.data === hoje ? 'is-today' : ''}`}>{rotuloDia(g.data)}</h3>
            <div className="slot-chips">
              {g.itens.map((h) => (
                <div className={`slot-chip slot-chip--${h.status}`} key={h.id}>
                  <span className="slot-chip__time">{h.hora.slice(0, 5)}</span>
                  <span className={`badge badge-${h.status}`}>{rotuloStatus[h.status]}</span>
                  {h.status === 'disponivel' && (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removerHorario(h.id)}
                      aria-label={`Remover horário de ${h.hora.slice(0, 5)}`}
                      title="Remover horário"
                    >
                      <Trash size={16} strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
