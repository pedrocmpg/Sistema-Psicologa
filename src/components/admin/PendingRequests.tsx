import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Agendamento } from '../../types';
import { Calendar, Phone, Mail } from '../icons';

function formatarDataHora(data?: string, hora?: string) {
  if (!data || !hora) return '—';
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  const dataFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  return `${dataFmt} às ${hora.slice(0, 5)}`;
}

export default function PendingRequests() {
  const [pedidos, setPedidos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*, horarios_disponiveis(data, hora)')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: true });

    if (!error) setPedidos((data as unknown as Agendamento[]) ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function confirmar(id: string) {
    setErro(null);
    setProcessando(id);
    const { error } = await supabase.rpc('confirmar_agendamento', { p_agendamento_id: id });
    setProcessando(null);
    if (error) {
      setErro('Não foi possível confirmar o pedido.');
      return;
    }
    carregar();
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
  }

  return (
    <div className="admin-panel">
      <h2>Pedidos pendentes</h2>
      <p className="admin-panel__hint">
        Confirme ou recuse os pedidos de agendamento enviados pelos pacientes. Ao confirmar, o
        horário fica reservado; ao recusar, ele volta a ficar disponível.
      </p>

      {erro && <div className="alert alert-error">{erro}</div>}

      {carregando && <p className="scheduling__loading">Carregando pedidos...</p>}

      {!carregando && pedidos.length === 0 && (
        <div className="empty-state">Nenhum pedido pendente no momento.</div>
      )}

      {!carregando &&
        pedidos.map((p) => (
          <div className="request-card" key={p.id}>
            <div className="request-card__info">
              <div className="request-card__name">{p.nome_paciente}</div>
              <div className="request-card__meta">
                <span>
                  <Calendar size={14} strokeWidth={2} aria-hidden="true" />{' '}
                  {formatarDataHora(p.horarios_disponiveis?.data, p.horarios_disponiveis?.hora)}
                </span>
                <span>
                  <Phone size={14} strokeWidth={2} aria-hidden="true" /> {p.telefone}
                </span>
                <span>
                  <Mail size={14} strokeWidth={2} aria-hidden="true" /> {p.email}
                </span>
              </div>
            </div>
            <div className="request-card__actions">
              <button
                className="btn btn-primary btn-sm"
                disabled={processando === p.id}
                onClick={() => confirmar(p.id)}
              >
                Confirmar
              </button>
              <button
                className="btn btn-danger btn-sm"
                disabled={processando === p.id}
                onClick={() => recusar(p.id)}
              >
                Recusar
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
