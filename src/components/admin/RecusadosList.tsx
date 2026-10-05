import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Agendamento, ConfigWhatsApp } from '../../types';
import { Ban, Calendar } from '../icons';
import { formatarDataHora, ordenarPorHorario } from '../../lib/agendamentos';
import ContatoPaciente from './ContatoPaciente';
import EmptyState, { Carregando } from './EmptyState';
import NotificacaoSelo from './NotificacaoSelo';
import { useNotificacoes } from '../../hooks/useNotificacoes';

const rotulo: Record<string, string> = {
  recusado: 'Recusado',
  cancelado: 'Cancelado',
};

function formatarDiaCurto(data?: string) {
  if (!data) return '';
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(ano, mes - 1, dia))
    .replace('.', '');
}

interface RecusadosListProps {
  configWhatsApp: ConfigWhatsApp | null;
}

export default function RecusadosList({ configWhatsApp }: RecusadosListProps) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { notificacoes, acompanhar } = useNotificacoes();

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

      {carregando && <Carregando>Carregando...</Carregando>}

      {!carregando && agendamentos.length === 0 && (
        <EmptyState Icon={Ban}>Nenhum recusado ou cancelado por aqui.</EmptyState>
      )}

      {!carregando && agendamentos.length > 0 && (
        <div className="day-group__list">
          {agendamentos.map((a) => (
            <article className="request-card" key={a.id}>
              <div className="request-card__time">
                {a.horarios_disponiveis?.hora.slice(0, 5) ?? '—'}
                <small>{formatarDiaCurto(a.horarios_disponiveis?.data)}</small>
              </div>
              <div className="request-card__info">
                <div className="request-card__name">
                  {a.nome_paciente} <span className={`badge badge-${a.status}`}>{rotulo[a.status]}</span>
                </div>
                <div className="request-card__meta">
                  <span>
                    <Calendar size={14} strokeWidth={2} aria-hidden="true" />{' '}
                    {formatarDataHora(a.horarios_disponiveis?.data, a.horarios_disponiveis?.hora)}
                  </span>
                  <ContatoPaciente telefone={a.telefone} email={a.email} />
                </div>
                <NotificacaoSelo
                  agendamento={a}
                  lista={agendamentos}
                  notificacoes={notificacoes}
                  config={configWhatsApp}
                  onReenviado={acompanhar}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
