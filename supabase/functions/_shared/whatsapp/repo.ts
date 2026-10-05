// Acesso a dados usado pelo núcleo de notificação. A implementação real (supabase-js com service
// role) fica em ../repo-supabase.ts; os testes usam uma em memória que impõe os mesmos uniques.

import type { EventoNotificacao } from './templates.ts';

export type StatusNotificacao = 'pendente' | 'enviado' | 'falhou' | 'ignorado';

/** Envio em andamento (linha assumida pela função). */
export const MOTIVO_PROCESSANDO = 'processando';

export interface ConfigWhatsApp {
  ativo: boolean;
  nome_profissional: string | null;
  telefone_contato: string | null;
  endereco: string | null;
  templates: Record<string, unknown> | null;
}

export interface AgendamentoNotificavel {
  id: string;
  nome_paciente: string;
  telefone: string;
  status: string;
  recorrencia_id: string | null;
  notificar_whatsapp: boolean;
  cancelado_em_serie: boolean;
  /** Do horário vinculado (YYYY-MM-DD / HH:MM:SS). */
  data: string | null;
  hora: string | null;
}

export interface ResumoSerie {
  primeiraData: string;
  hora: string;
  ocorrencias: number;
}

export interface Notificacao {
  id: string;
  agendamento_id: string;
  recorrencia_id: string | null;
  evento: EventoNotificacao;
  status: StatusNotificacao;
  motivo: string | null;
  provider_message_id: string | null;
  tentativas: number;
  criado_em: string;
  enviado_em: string | null;
  atualizado_em: string;
}

export type AtualizacaoNotificacao = Partial<
  Pick<Notificacao, 'status' | 'motivo' | 'provider_message_id' | 'tentativas' | 'enviado_em'>
>;

export interface Repo {
  getConfig(): Promise<ConfigWhatsApp | null>;
  getAgendamento(id: string): Promise<AgendamentoNotificavel | null>;
  /** confirmado_serie: ocorrências confirmadas; cancelado_serie: canceladas em série. */
  resumoSerie(recorrenciaId: string, evento: 'confirmado_serie' | 'cancelado_serie'): Promise<ResumoSerie | null>;
  /** Insere como pendente/processando. Violação de unique => 'duplicado' (não envia). */
  inserirNotificacao(
    nova: Pick<Notificacao, 'agendamento_id' | 'recorrencia_id' | 'evento'>
  ): Promise<{ ok: true; notificacao: Notificacao } | { ok: false; motivo: 'duplicado' }>;
  atualizarNotificacao(id: string, mudancas: AtualizacaoNotificacao): Promise<void>;
  getNotificacao(id: string): Promise<Notificacao | null>;
  /**
   * Assume a linha para um reenvio: só se status for falhou/pendente e ela não estiver
   * 'processando' (a não ser que esteja travada há mais de `travadaDesde`). Null = não assumiu.
   */
  assumirParaReenvio(id: string, travadaDesde: Date): Promise<Notificacao | null>;
  contarEnviosDesde(desde: Date): Promise<number>;
}
