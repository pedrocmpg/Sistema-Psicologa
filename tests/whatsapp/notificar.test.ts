// Integração do fluxo de notificação com o provider "mock" e o Repo em memória.
// Só dados fictícios ("Paciente Teste", +55 54 90000-000X); nenhum provedor real é chamado.
import { beforeEach, describe, expect, it } from 'vitest';
import { criarHandlerAdmin, criarHandlerWebhook, HEADER_SEGREDO } from '../../supabase/functions/_shared/whatsapp/http.ts';
import {
  ATRASO_RETENTATIVA_MS,
  type Deps,
  type PayloadWebhook,
  processarWebhook,
  reenviarNotificacao,
} from '../../supabase/functions/_shared/whatsapp/notificar.ts';
import { MockProvider, type OpcoesMock } from '../../supabase/functions/_shared/whatsapp/providers/mock.ts';
import type { AgendamentoNotificavel } from '../../supabase/functions/_shared/whatsapp/repo.ts';
import { RepoMemoria } from './repo-memoria.ts';

const AGORA = new Date('2026-10-05T18:00:00Z');
const TEL_COMPLETO = '5554900000001';

interface Ambiente {
  repo: RepoMemoria;
  provider: MockProvider;
  deps: Deps;
  esperas: number[];
  logs: string[];
  chamadasProvider: () => number;
}

function montar(opcoes: { mock?: OpcoesMock; dryRun?: boolean } = {}): Ambiente {
  const repo = new RepoMemoria();
  const logs: string[] = [];
  const provider = new MockProvider({ ...opcoes.mock, log: (l) => logs.push(l) });
  const esperas: number[] = [];
  let chamadas = 0;
  const deps: Deps = {
    repo,
    provider: () => {
      chamadas++;
      return provider;
    },
    dryRun: opcoes.dryRun ?? false,
    agora: () => AGORA,
    esperar: async (ms) => {
      esperas.push(ms);
    },
    aleatorio: () => 0.5,
    log: (l) => logs.push(l),
  };
  return { repo, provider, deps, esperas, logs, chamadasProvider: () => chamadas };
}

const insert = (record: AgendamentoNotificavel): PayloadWebhook => ({
  type: 'INSERT',
  table: 'agendamentos',
  schema: 'public',
  record: { ...record },
  old_record: null,
});

const update = (antes: AgendamentoNotificavel, depois: AgendamentoNotificavel): PayloadWebhook => ({
  type: 'UPDATE',
  table: 'agendamentos',
  schema: 'public',
  record: { ...depois },
  old_record: { ...antes },
});

/** Simula uma RPC mudando o status e devolve o payload do webhook correspondente. */
function mudarStatus(repo: RepoMemoria, id: string, mudancas: Partial<AgendamentoNotificavel>) {
  const antes = repo.agendamentos.get(id)!;
  const depois = repo.salvar({ id, ...mudancas });
  return update({ ...antes }, depois);
}

/** Série semanal de N ocorrências (como criar_agendamento_manual com p_semanas = N). */
function criarSerie(repo: RepoMemoria, n: number, recorrenciaId = 'serie-1') {
  const linhas: AgendamentoNotificavel[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 9, 13 + i * 7));
    linhas.push(
      repo.salvar({
        id: `occ${i}`,
        status: 'confirmado',
        recorrencia_id: recorrenciaId,
        data: d.toISOString().slice(0, 10),
      })
    );
  }
  return linhas;
}

describe('eventos simples', () => {
  let amb: Ambiente;
  beforeEach(() => {
    amb = montar();
  });

  it('confirmado: registra e envia a mensagem certa, com atraso de 1–3 s', async () => {
    amb.repo.salvar({ id: 'a1' });
    const r = await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);

    expect(r).toMatchObject({ acao: 'registrado', status: 'enviado' });
    expect(amb.repo.notificacoes).toHaveLength(1);
    expect(amb.repo.notificacoes[0]).toMatchObject({
      agendamento_id: 'a1',
      evento: 'confirmado',
      status: 'enviado',
      tentativas: 1,
      provider_message_id: 'mock-1',
    });
    expect(amb.provider.enviados).toEqual([
      {
        phone: TEL_COMPLETO,
        text:
          'Olá, Paciente! Seu horário com Profissional Exemplo está confirmado para terça-feira, 13/10, às 14h. ' +
          'Para remarcar ou cancelar, fale com (54) 90000-0009.',
      },
    ]);
    expect(amb.esperas).toHaveLength(1);
    expect(amb.esperas[0]).toBeGreaterThanOrEqual(1000);
    expect(amb.esperas[0]).toBeLessThanOrEqual(3000);
  });

  it('recusado', async () => {
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'recusado' }), amb.deps);
    expect(amb.repo.notificacoes[0]).toMatchObject({ evento: 'recusado', status: 'enviado' });
    expect(amb.provider.enviados[0].text).toContain('Não foi possível confirmar o horário solicitado');
  });

  it('cancelado', async () => {
    amb.repo.salvar({ id: 'a1', status: 'confirmado' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'cancelado' }), amb.deps);
    expect(amb.repo.notificacoes[0]).toMatchObject({ evento: 'cancelado', status: 'enviado' });
    expect(amb.provider.enviados[0].text).toContain('em terça-feira, 13/10, às 14h, foi cancelado');
  });

  it('INSERT já confirmado (agendamento manual) notifica; pedido do site (pendente) não', async () => {
    await processarWebhook(insert(amb.repo.salvar({ id: 'manual', status: 'confirmado' })), amb.deps);
    await processarWebhook(insert(amb.repo.salvar({ id: 'site', status: 'pendente' })), amb.deps);
    expect(amb.repo.notificacoes.map((n) => [n.agendamento_id, n.evento])).toEqual([['manual', 'confirmado']]);
  });

  it('UPDATE sem mudança de status não gera nada', async () => {
    amb.repo.salvar({ id: 'a1', status: 'confirmado' });
    const r = await processarWebhook(mudarStatus(amb.repo, 'a1', { notificar_whatsapp: false }), amb.deps);
    expect(r).toEqual({ acao: 'nenhuma', motivo: 'sem_evento' });
    expect(amb.repo.notificacoes).toHaveLength(0);
  });

  it('payload de outra tabela é ignorado', async () => {
    const r = await processarWebhook({ type: 'INSERT', table: 'horarios_disponiveis', record: { id: 'h1' } }, amb.deps);
    expect(r).toEqual({ acao: 'nenhuma', motivo: 'sem_evento' });
  });
});

describe('quando NÃO enviar', () => {
  it('notificar_whatsapp = false: ignorado, sem envio', async () => {
    const amb = montar();
    amb.repo.salvar({ id: 'a1', notificar_whatsapp: false });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'ignorado', motivo: 'notificacao_desmarcada' });
    expect(amb.provider.enviados).toHaveLength(0);
  });

  it('WhatsApp desativado no painel: ignorado', async () => {
    const amb = montar();
    amb.repo.config.ativo = false;
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'ignorado', motivo: 'whatsapp_desativado' });
    expect(amb.chamadasProvider()).toBe(0);
  });

  it('configuração sem telefone de contato: ignorado', async () => {
    const amb = montar();
    amb.repo.config.telefone_contato = '';
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'ignorado', motivo: 'configuracao_incompleta' });
  });

  it.each([
    ['fixo', '(54) 3000-0001'],
    ['curto', '90000-0001'],
    ['sem o nono dígito', '(54) 8000-0001'],
  ])('telefone %s: ignorado como telefone_invalido', async (_caso, telefone) => {
    const amb = montar();
    amb.repo.salvar({ id: 'a1', telefone });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'ignorado', motivo: 'telefone_invalido' });
    expect(amb.provider.enviados).toHaveLength(0);
  });

  it('número sem WhatsApp: ignorado como sem_whatsapp', async () => {
    const amb = montar({ mock: { existe: false } });
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'ignorado', motivo: 'sem_whatsapp' });
    expect(amb.provider.enviados).toHaveLength(0);
  });

  it('template editado com termo clínico: ignorado, nada sai', async () => {
    const amb = montar();
    amb.repo.config.templates = { confirmado: 'Olá, {nome}! Sua sessão de terapia está confirmada para {data}.' };
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'ignorado', motivo: 'termo_clinico' });
    expect(amb.provider.enviados).toHaveLength(0);
  });

  it('limite de 20 envios por hora: fica pendente (limite_horario)', async () => {
    const amb = montar();
    amb.repo.semearEnvios(20, new Date(AGORA.getTime() - 30 * 60_000));
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.repo.notificacoes.at(-1)).toMatchObject({ evento: 'confirmado', status: 'pendente', motivo: 'limite_horario' });
    expect(amb.provider.enviados).toHaveLength(0);
  });

  it('envios de mais de 1 hora atrás não contam para o limite', async () => {
    const amb = montar();
    amb.repo.semearEnvios(20, new Date(AGORA.getTime() - 61 * 60_000));
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.repo.notificacoes.at(-1)).toMatchObject({ status: 'enviado' });
  });
});

describe('falhas nunca quebram o fluxo', () => {
  it('erro HTTP do provedor: falhou, sem retentativa, sem exceção', async () => {
    const amb = montar({ mock: { falha: 'http' } });
    amb.repo.salvar({ id: 'a1' });
    const r = await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(r).toMatchObject({ acao: 'registrado', status: 'falhou' });
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'falhou', motivo: 'HTTP 500: simulado', tentativas: 1 });
    expect(amb.esperas).not.toContain(ATRASO_RETENTATIVA_MS);
  });

  it('erro de rede: uma retentativa após 60 s, e dá certo', async () => {
    const amb = montar({ mock: { falha: 'rede', falharVezes: 1 } });
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.esperas).toContain(ATRASO_RETENTATIVA_MS);
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'enviado', tentativas: 2 });
    expect(amb.provider.enviados).toHaveLength(1);
  });

  it('erro de rede persistente: só UMA retentativa, depois falhou', async () => {
    const amb = montar({ mock: { falha: 'rede' } });
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.esperas.filter((ms) => ms === ATRASO_RETENTATIVA_MS)).toHaveLength(1);
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'falhou', tentativas: 2 });
  });

  it('provedor sem configuração: falhou com o motivo, sem exceção', async () => {
    const amb = montar();
    amb.deps.provider = () => {
      throw new Error('provedor_nao_configurado: faltam EVOLUTION_API_URL');
    };
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.repo.notificacoes[0].status).toBe('falhou');
    expect(amb.repo.notificacoes[0].motivo).toMatch(/provedor_nao_configurado/);
  });

  it('banco fora do ar: devolve erro, não lança', async () => {
    const amb = montar();
    amb.repo.salvar({ id: 'a1' });
    const payload = mudarStatus(amb.repo, 'a1', { status: 'confirmado' });
    amb.repo.quebrado = true;
    await expect(processarWebhook(payload, amb.deps)).resolves.toMatchObject({ acao: 'erro' });
  });
});

describe('modo dry-run', () => {
  it('grava tudo como enviado, sem chamar o provedor', async () => {
    const amb = montar({ dryRun: true });
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'enviado', motivo: 'dry_run', provider_message_id: 'dry-run' });
    expect(amb.chamadasProvider()).toBe(0);
    expect(amb.provider.enviados).toHaveLength(0);
  });
});

describe('recorrência', () => {
  it('série de 8 semanas (8 INSERTs concorrentes) gera UMA confirmado_serie', async () => {
    const amb = montar();
    const serie = criarSerie(amb.repo, 8);
    const resultados = await Promise.all(serie.map((linha) => processarWebhook(insert(linha), amb.deps)));

    expect(resultados.filter((r) => r.acao === 'duplicado')).toHaveLength(7);
    expect(amb.repo.notificacoes).toHaveLength(1);
    expect(amb.repo.notificacoes[0]).toMatchObject({ evento: 'confirmado_serie', recorrencia_id: 'serie-1', status: 'enviado' });
    expect(amb.provider.enviados).toHaveLength(1);
    expect(amb.provider.enviados[0].text).toBe(
      'Olá, Paciente! Seus horários com Profissional Exemplo estão confirmados: toda terça-feira, às 14h, ' +
        'a partir de 13/10, por 8 semanas. Para remarcar ou cancelar, fale com (54) 90000-0009.'
    );
  });

  it('confirmar pedido com recorrência (1 UPDATE + 7 INSERTs) também gera uma só', async () => {
    const amb = montar();
    amb.repo.salvar({ id: 'occ0', status: 'pendente' });
    const antes = { ...amb.repo.agendamentos.get('occ0')! };
    const serie = criarSerie(amb.repo, 8);
    const payloads = [update(antes, serie[0]), ...serie.slice(1).map(insert)];
    await Promise.all(payloads.map((p) => processarWebhook(p, amb.deps)));
    expect(amb.repo.notificacoes.map((n) => n.evento)).toEqual(['confirmado_serie']);
    expect(amb.provider.enviados).toHaveLength(1);
  });

  it('cancelar a série inteira gera UMA cancelado_serie', async () => {
    const amb = montar();
    criarSerie(amb.repo, 8);
    const payloads = [...amb.repo.agendamentos.keys()].map((id) =>
      mudarStatus(amb.repo, id, { status: 'cancelado', cancelado_em_serie: true })
    );
    await Promise.all(payloads.map((p) => processarWebhook(p, amb.deps)));

    expect(amb.repo.notificacoes).toHaveLength(1);
    expect(amb.repo.notificacoes[0]).toMatchObject({ evento: 'cancelado_serie', status: 'enviado' });
    expect(amb.provider.enviados[0].text).toBe(
      'Olá, Paciente! Seus horários de toda terça-feira, às 14h, com Profissional Exemplo, a partir de 13/10, ' +
        'foram cancelados. Para reagendar, fale com (54) 90000-0009.'
    );
  });

  it('cancelar só uma ocorrência gera "cancelado" com a data dela (e outra ocorrência gera outro)', async () => {
    const amb = montar();
    criarSerie(amb.repo, 8);
    await processarWebhook(mudarStatus(amb.repo, 'occ2', { status: 'cancelado' }), amb.deps);
    await processarWebhook(mudarStatus(amb.repo, 'occ5', { status: 'cancelado' }), amb.deps);

    expect(amb.repo.notificacoes.map((n) => [n.agendamento_id, n.evento, n.recorrencia_id])).toEqual([
      ['occ2', 'cancelado', null],
      ['occ5', 'cancelado', null],
    ]);
    expect(amb.provider.enviados[0].text).toContain('em terça-feira, 27/10, às 14h, foi cancelado');
    expect(amb.provider.enviados[1].text).toContain('em terça-feira, 17/11, às 14h, foi cancelado');
  });
});

describe('idempotência', () => {
  it('o mesmo webhook duas vezes (em sequência) não duplica', async () => {
    const amb = montar();
    amb.repo.salvar({ id: 'a1' });
    const payload = mudarStatus(amb.repo, 'a1', { status: 'confirmado' });
    await processarWebhook(payload, amb.deps);
    const segundo = await processarWebhook(payload, amb.deps);
    expect(segundo).toEqual({ acao: 'duplicado' });
    expect(amb.provider.enviados).toHaveLength(1);
  });

  it('o mesmo webhook duas vezes (ao mesmo tempo) não duplica', async () => {
    const amb = montar();
    amb.repo.salvar({ id: 'a1' });
    const payload = mudarStatus(amb.repo, 'a1', { status: 'confirmado' });
    await Promise.all([processarWebhook(payload, amb.deps), processarWebhook(payload, amb.deps)]);
    expect(amb.repo.notificacoes).toHaveLength(1);
    expect(amb.provider.enviados).toHaveLength(1);
  });
});

describe('reenviar (painel)', () => {
  it('falhou -> reenviar -> enviado', async () => {
    const amb = montar({ mock: { falha: 'http', falharVezes: 1 } });
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    const id = amb.repo.notificacoes[0].id;
    expect(amb.repo.notificacoes[0].status).toBe('falhou');

    const r = await reenviarNotificacao(id, amb.deps);
    expect(r).toMatchObject({ acao: 'registrado', status: 'enviado' });
    expect(amb.repo.notificacoes[0]).toMatchObject({ status: 'enviado', tentativas: 2, motivo: null });
  });

  it('pendente por limite_horario sai quando o limite libera', async () => {
    const amb = montar();
    amb.repo.semearEnvios(20, new Date(AGORA.getTime() - 30 * 60_000));
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    const pendente = amb.repo.notificacoes.find((n) => n.agendamento_id === 'a1')!;
    expect(pendente.motivo).toBe('limite_horario');

    amb.deps.agora = () => new Date(AGORA.getTime() + 31 * 60_000);
    await reenviarNotificacao(pendente.id, amb.deps);
    expect(amb.repo.notificacoes.find((n) => n.id === pendente.id)).toMatchObject({ status: 'enviado' });
  });

  it('dois cliques simultâneos em Reenviar enviam uma vez só', async () => {
    const amb = montar({ mock: { falha: 'http', falharVezes: 1 } });
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    const id = amb.repo.notificacoes[0].id;
    const [r1, r2] = await Promise.all([reenviarNotificacao(id, amb.deps), reenviarNotificacao(id, amb.deps)]);
    expect([r1, r2]).toContainEqual({ acao: 'nenhuma', motivo: 'envio_em_andamento' });
    expect(amb.provider.enviados).toHaveLength(1);
  });

  it('enviado ou ignorado não pode ser reenviado', async () => {
    const amb = montar();
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    expect(await reenviarNotificacao(amb.repo.notificacoes[0].id, amb.deps)).toEqual({
      acao: 'nenhuma',
      motivo: 'nao_reenviavel',
    });
  });
});

describe('privacidade nos logs', () => {
  it('nunca loga o telefone completo nem o texto da mensagem', async () => {
    const amb = montar({ mock: { falha: 'rede', falharVezes: 1 } });
    amb.repo.salvar({ id: 'a1' });
    await processarWebhook(mudarStatus(amb.repo, 'a1', { status: 'confirmado' }), amb.deps);
    const tudo = amb.logs.join('\n');
    expect(tudo).toContain('+55 54 9****-0001');
    expect(tudo).not.toContain(TEL_COMPLETO);
    expect(tudo).not.toContain('90000-0001');
    expect(tudo).not.toContain('confirmado para');
    expect(tudo).not.toContain('Paciente');
  });
});

describe('handler HTTP do webhook', () => {
  function handler(segredo: string | undefined) {
    const amb = montar();
    const tarefas: Promise<unknown>[] = [];
    const h = criarHandlerWebhook({ segredo, deps: amb.deps, emSegundoPlano: (t) => tarefas.push(t), log: () => {} });
    return { amb, h, tarefas };
  }

  function req(headers: Record<string, string>, corpo: unknown = { type: 'INSERT', table: 'agendamentos', record: {} }) {
    return new Request('http://local/notify-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(corpo),
    });
  }

  it('sem o header do segredo: 401', async () => {
    const { h, tarefas } = handler('segredo-de-teste');
    expect((await h(req({}))).status).toBe(401);
    expect(tarefas).toHaveLength(0);
  });

  it('segredo errado: 401', async () => {
    const { h } = handler('segredo-de-teste');
    expect((await h(req({ [HEADER_SEGREDO]: 'segredo-de-tesTE' }))).status).toBe(401);
    expect((await h(req({ [HEADER_SEGREDO]: 'segredo-de-teste-mais-longo' }))).status).toBe(401);
  });

  it('WEBHOOK_SECRET não configurado: recusa tudo', async () => {
    const { h } = handler(undefined);
    expect((await h(req({ [HEADER_SEGREDO]: '' }))).status).toBe(500);
  });

  it('segredo certo: 202 na hora e processa em segundo plano', async () => {
    const { amb, h, tarefas } = handler('segredo-de-teste');
    amb.repo.salvar({ id: 'a1' });
    const payload = mudarStatus(amb.repo, 'a1', { status: 'confirmado' });
    const resp = await h(req({ [HEADER_SEGREDO]: 'segredo-de-teste' }, payload));
    expect(resp.status).toBe(202);
    await Promise.all(tarefas);
    expect(amb.provider.enviados).toHaveLength(1);
  });

  it('payload inválido: 400', async () => {
    const { h } = handler('s');
    const r = new Request('http://local', { method: 'POST', headers: { [HEADER_SEGREDO]: 's' }, body: '{quebrado' });
    expect((await h(r)).status).toBe(400);
  });
});

describe('handler HTTP do painel', () => {
  function admin(autenticado: boolean, opcoes: { dryRun?: boolean } = {}) {
    const amb = montar(opcoes);
    const h = criarHandlerAdmin({ autenticar: async () => autenticado, deps: amb.deps });
    const chamar = (corpo: unknown) =>
      h(new Request('http://local/whatsapp-admin', { method: 'POST', body: JSON.stringify(corpo) }));
    return { amb, chamar, h };
  }

  it('sem login: 401', async () => {
    expect((await admin(false).chamar({ acao: 'health' })).status).toBe(401);
  });

  it('preflight CORS', async () => {
    const r = await admin(false).h(new Request('http://local', { method: 'OPTIONS' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('health do mock', async () => {
    const r = await admin(true).chamar({ acao: 'health' });
    expect(await r.json()).toEqual({ provider: 'mock', dryRun: false, conectado: true, estado: 'mock' });
  });

  it('teste em dry-run não chama o provedor', async () => {
    const { amb, chamar } = admin(true, { dryRun: true });
    expect(await (await chamar({ acao: 'teste' })).json()).toEqual({ ok: true, dryRun: true });
    expect(amb.provider.enviados).toHaveLength(0);
  });

  it('teste envia para o telefone de contato da profissional', async () => {
    const { amb, chamar } = admin(true);
    expect(await (await chamar({ acao: 'teste' })).json()).toEqual({ ok: true });
    expect(amb.provider.enviados[0].phone).toBe('5554900000009');
  });
});
