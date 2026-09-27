import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Agendamento } from '../../types';
import { Calendar, Phone, Mail } from '../icons';
import { formatarDataHora, ordenarPorHorario } from '../../lib/agendamentos';

const rotulo: Record<string, string> = {
  recusado: 'Recusado',
  cancelado: 'Cancelado',
};

export default function RecusadosList() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, horarios_disponiveis(data, hora)')
        .in('status', ['recusado', 'cancelado']);

      if (!error) setAgendamentos(ordenarPorHorario((data as unknown as Agendamento[]) ?? []));
      setCarregando(false);
    }
    carregar();
  }, []);

  return (
    <div className="admin-panel">
      <h2>Recusados e cancelados</h2>
      <p className="admin-panel__hint">
        Pedidos recusados antes de confirmar e consultas que foram confirmadas e depois
        canceladas.
      </p>

      {carregando && <p className="scheduling__loading">Carregando...</p>}

      {!carregando && agendamentos.length === 0 && (
        <div className="empty-state">Nenhum recusado ou cancelado por aqui.</div>
      )}

      {!carregando &&
        agendamentos.map((a) => (
          <div className="request-card" key={a.id}>
            <div className="request-card__info">
              <div className="request-card__name">
                {a.nome_paciente} <span className={`badge badge-${a.status}`}>{rotulo[a.status]}</span>
              </div>
              <div className="request-card__meta">
                <span>
                  <Calendar size={14} strokeWidth={2} aria-hidden="true" />{' '}
                  {formatarDataHora(a.horarios_disponiveis?.data, a.horarios_disponiveis?.hora)}
                </span>
                <span>
                  <Phone size={14} strokeWidth={2} aria-hidden="true" /> {a.telefone}
                </span>
                <span>
                  <Mail size={14} strokeWidth={2} aria-hidden="true" /> {a.email}
                </span>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
