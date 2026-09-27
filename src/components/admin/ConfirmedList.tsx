import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Agendamento } from '../../types';
import { CalendarCheck, Repeat, Search } from '../icons';
import { agruparPorDia, formatarDataHora, ordenarPorHorario } from '../../lib/agendamentos';
import { hojeISO, rotuloDia } from '../../lib/date';
import ManualAppointmentForm from './ManualAppointmentForm';
import ContatoPaciente from './ContatoPaciente';
import ConfirmDialog from './ConfirmDialog';
import EmptyState, { Carregando } from './EmptyState';

interface ConfirmedListProps {
  onChange?: () => void;
}

type FuncaoCancelamento = 'cancelar_agendamento' | 'cancelar_serie_recorrente';

export default function ConfirmedList({ onChange }: ConfirmedListProps) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [alvoCancelamento, setAlvoCancelamento] = useState<Agendamento | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*, horarios_disponiveis(data, hora)')
      .eq('status', 'confirmado');

    if (!error) setAgendamentos(ordenarPorHorario((data as unknown as Agendamento[]) ?? []));
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function executarCancelamento(agendamentoId: string, funcaoRpc: FuncaoCancelamento) {
    setAlvoCancelamento(null);
    setErro(null);
    setCancelando(agendamentoId);
    const { error } = await supabase.rpc(funcaoRpc, { p_agendamento_id: agendamentoId });
    setCancelando(null);

    if (error) {
      setErro('Não foi possível cancelar a consulta.');
      return;
    }

    carregar();
    onChange?.();
  }

  const buscaNormalizada = busca.trim().toLowerCase();
  const filtrados = buscaNormalizada
    ? agendamentos.filter((a) => a.nome_paciente.toLowerCase().includes(buscaNormalizada))
    : agendamentos;

  const hoje = hojeISO();
  const alvo = alvoCancelamento;

  return (
    <div className="admin-panel">
      <h2>Consultas confirmadas</h2>
      <p className="admin-panel__hint">Agendamentos já aprovados, da data mais próxima para a mais distante.</p>

      <ManualAppointmentForm
        onCriado={() => {
          carregar();
          onChange?.();
        }}
      />

      {erro && <div className="alert alert-error">{erro}</div>}

      {!carregando && agendamentos.length > 0 && (
        <div className="admin-panel__toolbar">
          <div className="search-input-wrapper">
            <Search size={16} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              className="search-input"
              placeholder="Buscar por nome do paciente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar por nome do paciente"
            />
          </div>
        </div>
      )}

      {carregando && <Carregando>Carregando consultas...</Carregando>}

      {!carregando && agendamentos.length === 0 && (
        <EmptyState Icon={CalendarCheck}>Nenhuma consulta confirmada ainda.</EmptyState>
      )}

      {!carregando && agendamentos.length > 0 && filtrados.length === 0 && (
        <EmptyState Icon={Search}>Nenhuma consulta confirmada com esse nome.</EmptyState>
      )}

      {!carregando &&
        agruparPorDia(filtrados).map((g) => (
          <section className="day-group" key={g.data}>
            <h3 className={`day-group__title ${g.data === hoje ? 'is-today' : ''}`}>
              {g.data ? rotuloDia(g.data) : 'Sem data'}
            </h3>
            <div className="day-group__list">
              {g.itens.map((a) => (
                <article className="request-card" key={a.id}>
                  <div className="request-card__time">{a.horarios_disponiveis?.hora.slice(0, 5) ?? '—'}</div>
                  <div className="request-card__info">
                    <div className="request-card__name">
                      {a.nome_paciente}
                      {a.recorrencia_id && (
                        <span className="badge badge-semanal" title="Faz parte de uma série semanal">
                          <Repeat size={11} strokeWidth={2.5} aria-hidden="true" /> Semanal
                        </span>
                      )}
                    </div>
                    <div className="request-card__meta">
                      <ContatoPaciente telefone={a.telefone} email={a.email} />
                    </div>
                  </div>
                  <div className="request-card__actions">
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={cancelando === a.id}
                      onClick={() => {
                        setErro(null);
                        setAlvoCancelamento(a);
                      }}
                    >
                      {cancelando === a.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

      <ConfirmDialog
        aberto={!!alvo}
        titulo={alvo?.recorrencia_id ? 'Cancelar consulta da série semanal?' : 'Cancelar esta consulta?'}
        descricao={
          alvo
            ? `${alvo.nome_paciente} — ${formatarDataHora(alvo.horarios_disponiveis?.data, alvo.horarios_disponiveis?.hora)}${
                alvo.recorrencia_id ? '\n\nCancelar apenas esta consulta ou toda a série semanal?' : ''
              }`
            : undefined
        }
        onFechar={() => setAlvoCancelamento(null)}
        acoes={
          !alvo
            ? []
            : alvo.recorrencia_id
              ? [
                  { rotulo: 'Manter', variante: 'ghost', onClick: () => setAlvoCancelamento(null) },
                  { rotulo: 'Toda a série', variante: 'danger', onClick: () => executarCancelamento(alvo.id, 'cancelar_serie_recorrente') },
                  { rotulo: 'Só esta', variante: 'danger', onClick: () => executarCancelamento(alvo.id, 'cancelar_agendamento') },
                ]
              : [
                  { rotulo: 'Manter', variante: 'ghost', onClick: () => setAlvoCancelamento(null) },
                  { rotulo: 'Cancelar consulta', variante: 'danger', onClick: () => executarCancelamento(alvo.id, 'cancelar_agendamento') },
                ]
        }
      />
    </div>
  );
}
