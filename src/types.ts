export type StatusHorario = 'disponivel' | 'reservado' | 'confirmado';
export type StatusAgendamento = 'pendente' | 'confirmado' | 'recusado';

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
  email: string;
  status: StatusAgendamento;
  criado_em: string;
  horarios_disponiveis?: {
    data: string;
    hora: string;
  } | null;
}
