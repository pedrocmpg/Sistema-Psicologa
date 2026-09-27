import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Agendamento } from '../../types';
import { Calendar, Phone, Mail } from '../icons';
import { formatarDataHora, ordenarPorHorario } from '../../lib/agendamentos';

export default function ConfirmedList() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, horarios_disponiveis(data, hora)')
        .eq('status', 'confirmado');

      if (!error) setAgendamentos(ordenarPorHorario((data as unknown as Agendamento[]) ?? []));
      setCarregando(false);
    }
    carregar();
  }, []);

  const buscaNormalizada = busca.trim().toLowerCase();
  const filtrados = buscaNormalizada
    ? agendamentos.filter((a) => a.nome_paciente.toLowerCase().includes(buscaNormalizada))
    : agendamentos;

  return (
    <div className="admin-panel">
      <h2>Consultas confirmadas</h2>
      <p className="admin-panel__hint">Agendamentos já aprovados, da data mais próxima para a mais distante.</p>

      {!carregando && agendamentos.length > 0 && (
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por nome do paciente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar por nome do paciente"
        />
      )}

      {carregando && <p className="scheduling__loading">Carregando...</p>}

      {!carregando && agendamentos.length === 0 && (
        <div className="empty-state">Nenhuma consulta confirmada ainda.</div>
      )}

      {!carregando && agendamentos.length > 0 && filtrados.length === 0 && (
        <div className="empty-state">Nenhuma consulta confirmada com esse nome.</div>
      )}

      {!carregando &&
        filtrados.map((a) => (
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
