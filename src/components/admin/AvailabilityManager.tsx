import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import type { HorarioDisponivel, StatusHorario } from '../../types';
import DatePicker from './DatePicker';
import BatchAvailabilityForm from './BatchAvailabilityForm';

function formatarDataLonga(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(d);
}

const rotuloStatus: Record<StatusHorario, string> = {
  disponivel: 'Disponível',
  reservado: 'Pedido pendente',
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

  return (
    <div className="admin-panel">
      <h2>Agenda de horários</h2>
      <p className="admin-panel__hint">
        Adicione os horários em que você está disponível para atendimento. Eles aparecem
        automaticamente para os pacientes no site.
      </p>

      {erro && <div className="alert alert-error">{erro}</div>}

      <form className="add-slot-form" onSubmit={adicionarHorario}>
        <div className="field">
          <label>Dia</label>
          <DatePicker
            value={data}
            onChange={(novaData) => {
              setData(novaData);
              setHora('');
            }}
          />
        </div>

        {data && (
          <div className="field">
            <label htmlFor="nova-hora">Horário</label>
            <input
              id="nova-hora"
              type="time"
              required
              autoFocus
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
        )}

        {data && (
          <button type="submit" className="btn btn-primary" disabled={salvando || !hora}>
            {salvando ? 'Adicionando...' : 'Adicionar horário'}
          </button>
        )}
      </form>

      <BatchAvailabilityForm onAdicionados={carregar} />

      {carregando && <p className="scheduling__loading">Carregando agenda...</p>}

      {!carregando && grupos.length === 0 && (
        <div className="empty-state">Nenhum horário cadastrado ainda.</div>
      )}

      {!carregando &&
        grupos.map((g) => (
          <div className="admin-slot-group" key={g.data}>
            <div className="admin-slot-group__date">{formatarDataLonga(g.data)}</div>
            {g.itens.map((h) => (
              <div className="admin-slot-row" key={h.id}>
                <span className="admin-slot-row__time">{h.hora.slice(0, 5)}</span>
                <span className={`badge badge-${h.status}`}>{rotuloStatus[h.status]}</span>
                <span className="admin-slot-row__spacer" />
                {h.status === 'disponivel' && (
                  <button className="btn btn-danger btn-sm" onClick={() => removerHorario(h.id)}>
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
