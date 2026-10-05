import { profissional } from '../config/profissional';
import type { Agendamento, ConfigWhatsApp, EventoNotificacao, Notificacao } from '../types';
import { supabase } from './supabase';
import { whatsappComTexto } from './whatsapp';
// Só os módulos puros do núcleo (nada de provider/env): os secrets ficam na Edge Function.
import { montarMensagem, templatesEfetivos } from '../../supabase/functions/_shared/whatsapp/templates.ts';

export const MOTIVO_PROCESSANDO = 'processando';

/** Texto amigável para o motivo gravado pela Edge Function. */
const MOTIVOS: Record<string, string> = {
  processando: 'Enviando agora…',
  whatsapp_desativado: 'Envio automático desativado em Configurações',
  configuracao_incompleta: 'Configuração do WhatsApp incompleta (nome ou telefone de contato)',
  notificacao_desmarcada: '"Enviar confirmação por WhatsApp" estava desmarcado',
  telefone_invalido: 'Telefone não é um celular válido com DDD',
  sem_whatsapp: 'Este número não tem WhatsApp',
  termo_clinico: 'Mensagem bloqueada: o modelo tem termo clínico',
  limite_horario: 'Limite de 20 envios por hora atingido — use Reenviar mais tarde',
  sem_horario: 'Agendamento sem data/horário',
  dry_run: 'Modo de teste (dry-run): registrado, mas nada foi enviado',
  agendamento_nao_encontrado: 'Agendamento não encontrado',
};

export function descreverMotivo(motivo: string | null): string {
  if (!motivo) return '';
  return MOTIVOS[motivo] ?? motivo;
}

/** Evento que corresponde ao status atual do agendamento (null para pendente). */
export function eventoDoAgendamento(a: Agendamento): EventoNotificacao | null {
  switch (a.status) {
    case 'confirmado':
      return a.recorrencia_id ? 'confirmado_serie' : 'confirmado';
    case 'recusado':
      return 'recusado';
    case 'cancelado':
      return a.recorrencia_id && a.cancelado_em_serie ? 'cancelado_serie' : 'cancelado';
    default:
      return null;
  }
}

/** A notificação que vale para este card: a do evento atual, direto ou pela série. */
export function notificacaoDe(lista: Notificacao[], a: Agendamento): Notificacao | undefined {
  const evento = eventoDoAgendamento(a);
  if (!evento) return undefined;
  if (evento === 'confirmado_serie' || evento === 'cancelado_serie') {
    return lista.find((n) => n.evento === evento && n.recorrencia_id === a.recorrencia_id);
  }
  return lista.find((n) => n.evento === evento && n.agendamento_id === a.id);
}

/** Pode reenviar: falhou ou pendente, e não está no meio de um envio. */
export function podeReenviar(n: Notificacao | undefined): boolean {
  return !!n && (n.status === 'falhou' || n.status === 'pendente') && n.motivo !== MOTIVO_PROCESSANDO;
}

/** Configuração com os dados de src/config/profissional.ts no que ainda não foi preenchido. */
export function configComPadroes(config: ConfigWhatsApp | null): ConfigWhatsApp {
  return {
    ativo: config?.ativo ?? false,
    nome_profissional: config?.nome_profissional || profissional.nome,
    telefone_contato: config?.telefone_contato || profissional.telefoneInternacional,
    // null = nunca configurado (usa o endereço do site); '' = configurado sem endereço.
    endereco: config?.endereco ?? profissional.endereco,
    templates: config?.templates ?? {},
  };
}

/** Primeira data e quantidade de ocorrências da série, a partir das linhas já carregadas na tela. */
function resumoSerieLocal(lista: Agendamento[], a: Agendamento, evento: EventoNotificacao) {
  const daSerie = lista
    .filter((x) => x.recorrencia_id === a.recorrencia_id && x.horarios_disponiveis)
    .filter((x) => (evento === 'cancelado_serie' ? x.status === 'cancelado' && x.cancelado_em_serie : x.status === 'confirmado'))
    .sort((x, y) => x.horarios_disponiveis!.data.localeCompare(y.horarios_disponiveis!.data));
  return daSerie.length ? { primeira: daSerie[0], ocorrencias: daSerie.length } : null;
}

/**
 * Plano B que sempre funciona: link wa.me com a mensagem já preenchida, enviado pelo WhatsApp
 * da própria psicóloga. Null quando não há mensagem para o status (pedido pendente).
 */
export function linkEnvioManual(a: Agendamento, lista: Agendamento[], config: ConfigWhatsApp | null): string | null {
  const evento = eventoDoAgendamento(a);
  const horario = a.horarios_disponiveis;
  if (!evento || !horario) return null;

  const cfg = configComPadroes(config);
  let data = horario.data;
  let hora = horario.hora;
  let semanas: number | undefined;
  if (evento === 'confirmado_serie' || evento === 'cancelado_serie') {
    const resumo = resumoSerieLocal(lista, a, evento);
    if (resumo) {
      data = resumo.primeira.horarios_disponiveis!.data;
      hora = resumo.primeira.horarios_disponiveis!.hora;
      semanas = resumo.ocorrencias;
    }
  }

  const texto = montarMensagem(evento, templatesEfetivos(cfg.templates), {
    nomePaciente: a.nome_paciente,
    profissional: cfg.nome_profissional ?? '',
    telefoneContato: cfg.telefone_contato ?? '',
    endereco: cfg.endereco,
    data,
    hora,
    semanas,
  });
  return whatsappComTexto(a.telefone, texto);
}

export async function carregarNotificacoes(): Promise<Notificacao[]> {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('id, agendamento_id, recorrencia_id, evento, status, motivo, tentativas, criado_em, enviado_em, atualizado_em')
    .order('criado_em', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data as Notificacao[]) ?? [];
}

export type RespostaAdmin = { ok?: boolean; status?: string; motivo?: string | null; acao?: string; dryRun?: boolean };

async function chamarAdmin<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('whatsapp-admin', { body: corpo });
  if (error) throw error;
  return data as T;
}

export const reenviarNotificacao = (id: string) => chamarAdmin<RespostaAdmin>({ acao: 'reenviar', notificacao_id: id });
export const enviarMensagemTeste = () => chamarAdmin<RespostaAdmin>({ acao: 'teste' });

export interface SaudeWhatsApp {
  provider: string;
  dryRun: boolean;
  conectado: boolean;
  estado: string;
}
export const consultarSaude = () => chamarAdmin<SaudeWhatsApp>({ acao: 'health' });
