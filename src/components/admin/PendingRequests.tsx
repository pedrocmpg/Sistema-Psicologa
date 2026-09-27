import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Agendamento } from '../../types';
import { Inbox } from '../icons';
import { agruparPorDia, ordenarPorHorario } from '../../lib/agendamentos';
import { hojeISO, rotuloDia } from '../../lib/date';
import ContatoPaciente from './ContatoPaciente';
import EmptyState, { Carregando } from './EmptyState';

interface PendingRequestsProps {
  onChange?: () => void;
}

interface OpcoesRecorrencia {
  repetir: boolean;
  semanas: number;
}

const OPCOES_PADRAO: OpcoesRecorrencia = { repetir: false, semanas: 8 };

export default function PendingRequests({ onChange }: PendingRequestsProps) {
  const [pedidos, setPedidos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [opcoesPorPedido, setOpcoesPorPedido] = useState<Record<string, OpcoesRecorrencia>>({});

  async function carregar() {
    setCarregando(true);
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*, horarios_disponiveis(data, hora)')
      .eq('status', 'pendente');

    if (!error) setPedidos(ordenarPorHorario((data as unknown as Agendamento[]) ?? []));
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  function opcoesDe(id: string): OpcoesRecorrencia {
    return opcoesPorPedido[id] ?? OPCOES_PADRAO;
  }

  function atualizarOpcoes(id: string, mudanca: Partial<OpcoesRecorrencia>) {
    setOpcoesPorPedido((atual) => ({ ...atual, [id]: { ...opcoesDe(id), ...mudanca } }));
  }

  async function confirmar(p: Agendamento) {
    const opcoes = opcoesDe(p.id);
    setErro(null);
    setProcessando(p.id);

    const { error } = opcoes.repetir
      ? await supabase.rpc('confirmar_agendamento_recorrente', {
          p_agendamento_id: p.id,
          p_semanas: opcoes.semanas,
        })
      : await supabase.rpc('confirmar_agendamento', { p_agendamento_id: p.id });

    setProcessando(null);
    if (error) {
      setErro('Não foi possível confirmar o pedido.');
      return;
    }
    carregar();
    onChange?.();
  }

  async function recusar(id: string) {
    setErro(null);
    setProcessando(id);
    const { error } = await supabase.rpc('recusar_agendamento', { p_agendamento_id: id });
    setProcessando(null);
    if (error) {
      setErro('Não foi possível recusar o pedido.');
      return;
    }
    carregar();
    onChange?.();
  }

  const hoje = hojeISO();

  return (
    <div className="admin-panel">
      <h2>Pedidos pendentes</h2>
      <p className="admin-panel__hint">
        Confirme ou recuse os pedidos de agendamento enviados pelos pacientes. Ao confirmar, o
        horário fica reservado; ao recusar, ele volta a ficar disponível.
      </p>

      {erro && <div className="alert alert-error">{erro}</div>}

      {carregando && <Carregando>Carregando pedidos...</Carregando>}

      {!carregando && pedidos.length === 0 && (
        <EmptyState Icon={Inbox}>Nenhum pedido pendente no momento. Tudo em dia!</EmptyState>
      )}

      {!carregando &&
        agruparPorDia(pedidos).map((g) => (
          <section className="day-group" key={g.data}>
            <h3 className={`day-group__title ${g.data === hoje ? 'is-today' : ''}`}>
              {g.data ? rotuloDia(g.data) : 'Sem data'}
            </h3>
            <div className="day-group__list">
              {g.itens.map((p) => {
                const opcoes = opcoesDe(p.id);
                return (
                  <article className="request-card" key={p.id}>
                    <div className="request-card__time">{p.horarios_disponiveis?.hora.slice(0, 5) ?? '—'}</div>
                    <div className="request-card__info">
                      <div className="request-card__name">{p.nome_paciente}</div>
                      <div className="request-card__meta">
                        <ContatoPaciente telefone={p.telefone} email={p.email} />
                      </div>
                    </div>
                    <div className="request-card__actions">
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={processando === p.id}
                        onClick={() => confirmar(p)}
                      >
                        {processando === p.id ? 'Confirmando...' : 'Confirmar'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={processando === p.id}
                        onClick={() => recusar(p.id)}
                      >
                        Recusar
                      </button>
                    </div>

                    <div className="request-card__extra">
                      <label className="field-checkbox">
                        <input
                          type="checkbox"
                          checked={opcoes.repetir}
                          onChange={(e) => atualizarOpcoes(p.id, { repetir: e.target.checked })}
                        />
                        Repetir semanalmente neste mesmo horário
                      </label>

                      {opcoes.repetir && (
                        <div className="field field--narrow">
                          <label htmlFor={`semanas-${p.id}`}>Por quantas semanas?</label>
                          <input
                            id={`semanas-${p.id}`}
                            type="number"
                            inputMode="numeric"
                            min={2}
                            max={52}
                            value={opcoes.semanas}
                            onChange={(e) =>
                              atualizarOpcoes(p.id, {
                                semanas: Math.max(2, Math.min(52, Number(e.target.value) || 2)),
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
