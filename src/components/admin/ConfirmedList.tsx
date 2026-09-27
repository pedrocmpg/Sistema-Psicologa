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

export default function ConfirmedList() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, horarios_disponiveis(data, hora)')
        .eq('status', 'confirmado')
        .order('criado_em', { ascending: false });

      if (!error) setAgendamentos((data as unknown as Agendamento[]) ?? []);
      setCarregando(false);
    }
    carregar();
  }, []);

  return (
    <div className="admin-panel">
      <h2>Consultas confirmadas</h2>
      <p className="admin-panel__hint">Agendamentos já aprovados.</p>

      {carregando && <p className="scheduling__loading">Carregando...</p>}

      {!carregando && agendamentos.length === 0 && (
        <div className="empty-state">Nenhuma consulta confirmada ainda.</div>
      )}

      {!carregando &&
        agendamentos.map((a) => (
          <div className="request-card" key={a.id}>
            <div className="request-card__info">
              <div className="request-card__name">{a.nome_paciente}</div>
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
