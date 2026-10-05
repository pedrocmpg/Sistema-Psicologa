// Núcleo da notificação por WhatsApp: decide o evento, registra em `notificacoes` e envia.
// Regra de ouro: nada aqui lança para fora. Falha de envio vira status "falhou" na tabela; o
// agendamento já foi gravado (o webhook só roda depois do commit) e não é afetado.

import type { WhatsAppProvider } from './providers/types.ts';
import { ProviderError } from './providers/types.ts';
import {
  type AgendamentoNotificavel,
  type AtualizacaoNotificacao,
  MOTIVO_PROCESSANDO,
  type Notificacao,
  type Repo,
  type StatusNotificacao,
} from './repo.ts';
import { mascararTelefone, normalizarTelefone } from './telefone.ts';
import {
  type DadosMensagem,
  type EventoNotificacao,
  montarMensagem,
  primeiroNome,
  templatesEfetivos,
  termosClinicos,
} from './templates.ts';

export const LIMITE_POR_HORA = 20;
export const ATRASO_RETENTATIVA_MS = 60_000;
/** Envio "processando" há mais que isso é considerado travado e pode ser reenviado. */
export const TRAVADO_APOS_MS = 5 * 60_000;

export interface Deps {
  repo: Repo;
  /** Criado sob demanda: lança `provedor_nao_configurado` se faltar env. */
  provider: () => WhatsAppProvider;
  dryRun: boolean;
  agora?: () => Date;
  esperar?: (ms: number) => Promise<void>;
  aleatorio?: () => number;
  log?: (linha: string) => void;
  limitePorHora?: number;
}

// ---------------------------------------------------------------------------
// Detecção do evento a partir do payload do Database Webhook
// ---------------------------------------------------------------------------

export interface PayloadWebhook {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
}

export interface EventoDetectado {
  evento: EventoNotificacao;
  agendamentoId: string;
  /** Só em eventos de série (é o que garante uma mensagem por série). */
  recorrenciaId: string | null;
}

export function detectarEvento(payload: PayloadWebhook): EventoDetectado | null {
  if (payload?.table !== 'agendamentos' || !payload.record) return null;
  const novo = payload.record;
  const id = typeof novo.id === 'string' ? novo.id : null;
  if (!id) return null;

  const status = novo.status;
  const recorrenciaId = typeof novo.recorrencia_id === 'string' ? novo.recorrencia_id : null;

  if (payload.type === 'UPDATE') {
    if (payload.old_record?.status === status) return null;
  } else if (payload.type === 'INSERT') {
    // Só agendamento que já nasce confirmado (manual ou ocorrência de série); pedido do site nasce pendente.
    if (status !== 'confirmado') return null;
  } else {
    return null;
  }

  switch (status) {
    case 'confirmado':
      return recorrenciaId
        ? { evento: 'confirmado_serie', agendamentoId: id, recorrenciaId }
        : { evento: 'confirmado', agendamentoId: id, recorrenciaId: null };
    case 'recusado':
      return { evento: 'recusado', agendamentoId: id, recorrenciaId: null };
    case 'cancelado':
      return recorrenciaId && novo.cancelado_em_serie === true
        ? { evento: 'cancelado_serie', agendamentoId: id, recorrenciaId }
        : { evento: 'cancelado', agendamentoId: id, recorrenciaId: null };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Processamento
// ---------------------------------------------------------------------------

export type Resultado =
  | { acao: 'nenhuma'; motivo: string }
  | { acao: 'duplicado' }
  | { acao: 'registrado'; notificacaoId: string; status: StatusNotificacao; motivo: string | null }
  | { acao: 'erro'; motivo: string };

function contexto(deps: Deps) {
  return {
    agora: deps.agora ?? (() => new Date()),
    esperar: deps.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))),
    aleatorio: deps.aleatorio ?? Math.random,
    log: deps.log ?? ((linha: string) => console.log(linha)),
    limite: deps.limitePorHora ?? LIMITE_POR_HORA,
  };
}

function mensagemDeErro(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e);
  return texto.replace(/\d{8,}/g, '[número]').slice(0, 300);
}

/** Webhook -> evento -> notificação. Nunca lança. */
export async function processarWebhook(payload: PayloadWebhook, deps: Deps): Promise<Resultado> {
  const evento = detectarEvento(payload);
  if (!evento) return { acao: 'nenhuma', motivo: 'sem_evento' };
  return processarEvento(evento, deps);
}

export async function processarEvento(ev: EventoDetectado, deps: Deps): Promise<Resultado> {
  const { log } = contexto(deps);
  try {
    const ag = await deps.repo.getAgendamento(ev.agendamentoId);
    if (!ag) return { acao: 'nenhuma', motivo: 'agendamento_nao_encontrado' };

    // Insere ANTES de enviar: webhook repetido ou concorrente (ex.: 8 ocorrências da mesma série)
    // bate no unique e para aqui.
    const inserido = await deps.repo.inserirNotificacao({
      agendamento_id: ag.id,
      recorrencia_id: ev.recorrenciaId,
      evento: ev.evento,
    });
    if (!inserido.ok) {
      log(`[whatsapp] evento=${ev.evento} duplicado, ignorando`);
      return { acao: 'duplicado' };
    }
    return await concluirEnvio(inserido.notificacao, ag, deps, { retentar: true });
  } catch (e) {
    log(`[whatsapp] erro ao processar evento=${ev.evento}: ${mensagemDeErro(e)}`);
    return { acao: 'erro', motivo: mensagemDeErro(e) };
  }
}

/** "Reenviar" do painel (falhou/pendente). Sem retentativa automática: a psicóloga está esperando a resposta. */
export async function reenviarNotificacao(notificacaoId: string, deps: Deps): Promise<Resultado> {
  const { agora, log } = contexto(deps);
  try {
    const atual = await deps.repo.getNotificacao(notificacaoId);
    if (!atual) return { acao: 'nenhuma', motivo: 'notificacao_nao_encontrada' };
    if (atual.status !== 'falhou' && atual.status !== 'pendente') {
      return { acao: 'nenhuma', motivo: 'nao_reenviavel' };
    }
    const assumida = await deps.repo.assumirParaReenvio(notificacaoId, new Date(agora().getTime() - TRAVADO_APOS_MS));
    if (!assumida) return { acao: 'nenhuma', motivo: 'envio_em_andamento' };

    const ag = await deps.repo.getAgendamento(assumida.agendamento_id);
    if (!ag) {
      await deps.repo.atualizarNotificacao(assumida.id, { status: 'ignorado', motivo: 'agendamento_nao_encontrado' });
      return { acao: 'registrado', notificacaoId: assumida.id, status: 'ignorado', motivo: 'agendamento_nao_encontrado' };
    }
    return await concluirEnvio(assumida, ag, deps, { retentar: false });
  } catch (e) {
    log(`[whatsapp] erro ao reenviar: ${mensagemDeErro(e)}`);
    return { acao: 'erro', motivo: mensagemDeErro(e) };
  }
}

async function dadosDaMensagem(
  n: Notificacao,
  ag: AgendamentoNotificavel,
  deps: Deps,
  profissional: string,
  telefoneContato: string,
  endereco: string | null
): Promise<DadosMensagem | null> {
  let data = ag.data;
  let hora = ag.hora;
  let semanas: number | undefined;

  if ((n.evento === 'confirmado_serie' || n.evento === 'cancelado_serie') && n.recorrencia_id) {
    const resumo = await deps.repo.resumoSerie(n.recorrencia_id, n.evento);
    if (resumo) {
      data = resumo.primeiraData;
      hora = resumo.hora;
      semanas = resumo.ocorrencias;
    }
  }
  if (!data || !hora) return null;
  return { nomePaciente: ag.nome_paciente, profissional, telefoneContato, endereco, data, hora, semanas };
}

async function concluirEnvio(
  n: Notificacao,
  ag: AgendamentoNotificavel,
  deps: Deps,
  opcoes: { retentar: boolean }
): Promise<Resultado> {
  const { agora, esperar, aleatorio, log, limite } = contexto(deps);
  const telMascarado = mascararTelefone(ag.telefone);

  async function finalizar(status: StatusNotificacao, motivo: string | null, extra: AtualizacaoNotificacao = {}) {
    await deps.repo.atualizarNotificacao(n.id, { status, motivo, ...extra });
    log(`[whatsapp] evento=${n.evento} notificacao=${n.id} tel=${telMascarado} status=${status}${motivo ? ` motivo=${motivo}` : ''}`);
    return { acao: 'registrado' as const, notificacaoId: n.id, status, motivo };
  }

  const config = await deps.repo.getConfig();
  if (!config?.ativo) return finalizar('ignorado', 'whatsapp_desativado');

  const profissional = config.nome_profissional?.trim() ?? '';
  const telefoneContato = config.telefone_contato?.trim() ?? '';
  if (!profissional || !telefoneContato) return finalizar('ignorado', 'configuracao_incompleta');

  if (!ag.notificar_whatsapp) return finalizar('ignorado', 'notificacao_desmarcada');

  const tel = normalizarTelefone(ag.telefone);
  if (!tel.ok) return finalizar('ignorado', 'telefone_invalido');

  const dados = await dadosDaMensagem(n, ag, deps, profissional, telefoneContato, config.endereco);
  if (!dados) return finalizar('ignorado', 'sem_horario');

  const mensagem = montarMensagem(n.evento, templatesEfetivos(config.templates), dados);
  if (termosClinicos(mensagem).length > 0) return finalizar('ignorado', 'termo_clinico');

  const umaHoraAtras = new Date(agora().getTime() - 60 * 60_000);
  if ((await deps.repo.contarEnviosDesde(umaHoraAtras)) >= limite) {
    return finalizar('pendente', 'limite_horario');
  }

  if (deps.dryRun) {
    return finalizar('enviado', 'dry_run', {
      provider_message_id: 'dry-run',
      enviado_em: agora().toISOString(),
      tentativas: n.tentativas + 1,
    });
  }

  let provider: WhatsAppProvider;
  try {
    provider = deps.provider();
  } catch (e) {
    return finalizar('falhou', mensagemDeErro(e));
  }

  // Erro na consulta não bloqueia: só "não tem WhatsApp" confirmado vira ignorado.
  const existe = await provider.numberExists(tel.numero).catch(() => null);
  if (existe === false) return finalizar('ignorado', 'sem_whatsapp');

  // Atraso aleatório de 1 a 3 s (comportamento menos "robótico" para o provedor não-oficial).
  await esperar(1000 + Math.floor(aleatorio() * 2000));

  let tentativas = n.tentativas;
  for (let tentativa = 1; ; tentativa++) {
    tentativas += 1;
    try {
      const { messageId } = await provider.sendText(tel.numero, mensagem);
      return finalizar('enviado', null, {
        provider_message_id: messageId,
        enviado_em: agora().toISOString(),
        tentativas,
      });
    } catch (e) {
      const erro = mensagemDeErro(e);
      const retentavel = e instanceof ProviderError && e.retentavel;
      if (opcoes.retentar && retentavel && tentativa === 1) {
        // Continua "processando" durante a espera, para o Reenviar do painel não enviar em paralelo.
        await deps.repo.atualizarNotificacao(n.id, { status: 'pendente', motivo: MOTIVO_PROCESSANDO, tentativas });
        log(`[whatsapp] evento=${n.evento} notificacao=${n.id} tel=${telMascarado} falha de rede, nova tentativa em 60 s`);
        await esperar(ATRASO_RETENTATIVA_MS);
        continue;
      }
      return finalizar('falhou', erro, { tentativas });
    }
  }
}

// ---------------------------------------------------------------------------
// Ações do painel
// ---------------------------------------------------------------------------

export interface Saude {
  provider: string;
  dryRun: boolean;
  conectado: boolean;
  estado: string;
}

/** Em dry-run não consulta o provedor (nada sai do servidor). */
export async function saudeDoProvider(deps: Deps): Promise<Saude> {
  let provider: WhatsAppProvider;
  try {
    provider = deps.provider();
  } catch (e) {
    return { provider: 'nao_configurado', dryRun: deps.dryRun, conectado: false, estado: mensagemDeErro(e) };
  }
  if (deps.dryRun) return { provider: provider.nome, dryRun: true, conectado: true, estado: 'dry-run' };
  try {
    return { provider: provider.nome, dryRun: false, ...(await provider.health()) };
  } catch (e) {
    return { provider: provider.nome, dryRun: false, conectado: false, estado: mensagemDeErro(e) };
  }
}

/** Mensagem de teste para o telefone_contato da própria profissional (não grava em `notificacoes`). */
export async function enviarTeste(deps: Deps): Promise<{ ok: boolean; motivo?: string; dryRun?: boolean }> {
  const { agora, log, limite } = contexto(deps);
  try {
    const config = await deps.repo.getConfig();
    const profissional = config?.nome_profissional?.trim();
    const tel = normalizarTelefone(config?.telefone_contato ?? '');
    if (!profissional || !tel.ok) return { ok: false, motivo: 'configuracao_incompleta' };

    if ((await deps.repo.contarEnviosDesde(new Date(agora().getTime() - 60 * 60_000))) >= limite) {
      return { ok: false, motivo: 'limite_horario' };
    }

    const texto = `Olá, ${primeiroNome(profissional)}! Esta é uma mensagem de teste do sistema de agendamento. Se ela chegou, o envio automático está funcionando.`;
    if (deps.dryRun) {
      log(`[whatsapp] teste (dry-run) para ${mascararTelefone(tel.numero)}`);
      return { ok: true, dryRun: true };
    }
    await deps.provider().sendText(tel.numero, texto);
    log(`[whatsapp] teste enviado para ${mascararTelefone(tel.numero)}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: mensagemDeErro(e) };
  }
}
