export type StatusHorario = 'disponivel' | 'reservado' | 'confirmado';
export type StatusAgendamento = 'pendente' | 'confirmado' | 'recusado' | 'cancelado';

export interface HorarioDisponivel {
  id: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  status: StatusHorario;
  criado_em: string;
}

export interface Agendamento {
  id: string;
  horario_id: string;
  nome_paciente: string;
  telefone: string;
  email: string | null;
  status: StatusAgendamento;
  criado_em: string;
  recorrencia_id: string | null;
  /** Se o paciente recebe as mensagens automáticas de WhatsApp. */
  notificar_whatsapp: boolean;
  /** Cancelado junto com a série inteira (e não só esta ocorrência). */
  cancelado_em_serie: boolean;
  horarios_disponiveis?: {
    data: string;
    hora: string;
  } | null;
}

export type EventoNotificacao = 'confirmado' | 'recusado' | 'cancelado' | 'confirmado_serie' | 'cancelado_serie';
export type StatusNotificacao = 'pendente' | 'enviado' | 'falhou' | 'ignorado';

export interface Notificacao {
  id: string;
  agendamento_id: string;
  recorrencia_id: string | null;
  evento: EventoNotificacao;
  status: StatusNotificacao;
  motivo: string | null;
  tentativas: number;
  criado_em: string;
  enviado_em: string | null;
  atualizado_em: string;
}

export interface ConfigWhatsApp {
  ativo: boolean;
  nome_profissional: string | null;
  telefone_contato: string | null;
  endereco: string | null;
  templates: Partial<Record<EventoNotificacao, string>>;
}
