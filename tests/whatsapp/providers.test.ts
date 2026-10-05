// Adapters com um fetch falso: confere endpoints/headers sem nenhuma chamada real.
import { describe, expect, it } from 'vitest';
import {
  criarProvider,
  EvolutionApiProvider,
  lerAmbiente,
  MockProvider,
  ProviderError,
  ZApiProvider,
} from '../../supabase/functions/_shared/whatsapp/providers/index.ts';

interface Chamada {
  url: string;
  init: RequestInit;
}

function fetchFalso(respostas: (url: string) => Response | Error) {
  const chamadas: Chamada[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init: init ?? {} });
    const r = respostas(String(url));
    if (r instanceof Error) throw r;
    return r;
  }) as typeof fetch;
  return { impl, chamadas };
}

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const TEL = '5554900000001';

describe('EvolutionApiProvider', () => {
  const config = { url: 'https://evo.exemplo.test/', apiKey: 'chave-falsa', instancia: 'consultorio' };

  it('envia texto no endpoint certo com a apikey', async () => {
    const f = fetchFalso(() => json({ key: { id: 'MSG1' } }));
    const p = new EvolutionApiProvider(config, f.impl);
    expect(await p.sendText(TEL, 'oi')).toEqual({ messageId: 'MSG1' });
    expect(f.chamadas[0].url).toBe('https://evo.exemplo.test/message/sendText/consultorio');
    expect((f.chamadas[0].init.headers as Record<string, string>).apikey).toBe('chave-falsa');
    expect(JSON.parse(String(f.chamadas[0].init.body))).toEqual({ number: TEL, text: 'oi' });
  });

  it('numberExists e health', async () => {
    const f = fetchFalso((url) =>
      url.includes('whatsappNumbers') ? json([{ exists: false, number: TEL }]) : json({ instance: { state: 'close' } })
    );
    const p = new EvolutionApiProvider(config, f.impl);
    expect(await p.numberExists(TEL)).toBe(false);
    expect(await p.health()).toEqual({ conectado: false, estado: 'close' });
  });

  it('erro de rede é retentável; HTTP não é; corpo do erro não vaza o telefone', async () => {
    const rede = new EvolutionApiProvider(config, fetchFalso(() => new TypeError('fetch failed')).impl);
    await expect(rede.sendText(TEL, 'oi')).rejects.toMatchObject({ retentavel: true });

    const http = new EvolutionApiProvider(config, fetchFalso(() => json({ erro: `numero ${TEL} invalido` }, 400)).impl);
    const erro = await http.sendText(TEL, 'oi').catch((e) => e);
    expect(erro).toBeInstanceOf(ProviderError);
    expect(erro.retentavel).toBe(false);
    expect(erro.message).not.toContain(TEL);
  });
});

describe('ZApiProvider', () => {
  const config = { instanciaId: 'INST', token: 'TOK', clientToken: 'CLI' };

  it('envia texto com Client-Token', async () => {
    const f = fetchFalso(() => json({ messageId: 'Z1' }));
    const p = new ZApiProvider(config, f.impl);
    expect(await p.sendText(TEL, 'oi')).toEqual({ messageId: 'Z1' });
    expect(f.chamadas[0].url).toBe('https://api.z-api.io/instances/INST/token/TOK/send-text');
    expect((f.chamadas[0].init.headers as Record<string, string>)['Client-Token']).toBe('CLI');
    expect(JSON.parse(String(f.chamadas[0].init.body))).toEqual({ phone: TEL, message: 'oi' });
  });

  it('phone-exists e status', async () => {
    const f = fetchFalso((url) => (url.includes('phone-exists') ? json({ exists: true }) : json({ connected: true })));
    const p = new ZApiProvider(config, f.impl);
    expect(await p.numberExists(TEL)).toBe(true);
    expect(await p.health()).toEqual({ conectado: true, estado: 'connected' });
  });
});

describe('escolha do provider por env', () => {
  const env = (vars: Record<string, string>) => (nome: string) => vars[nome];

  it('padrão é mock, sem dry-run', () => {
    expect(lerAmbiente(env({}))).toEqual({ provider: 'mock', dryRun: false });
    expect(criarProvider(env({}))).toBeInstanceOf(MockProvider);
  });

  it('dry-run aceita true/1', () => {
    expect(lerAmbiente(env({ WHATSAPP_DRY_RUN: 'true' })).dryRun).toBe(true);
    expect(lerAmbiente(env({ WHATSAPP_DRY_RUN: '1' })).dryRun).toBe(true);
  });

  it('evolution/zapi exigem as envs', () => {
    expect(() => criarProvider(env({ WHATSAPP_PROVIDER: 'evolution' }))).toThrow(/EVOLUTION_API_URL/);
    expect(() => criarProvider(env({ WHATSAPP_PROVIDER: 'zapi', ZAPI_TOKEN: 'x' }))).toThrow(/ZAPI_INSTANCE_ID/);
    expect(
      criarProvider(env({ WHATSAPP_PROVIDER: 'zapi', ZAPI_INSTANCE_ID: 'a', ZAPI_TOKEN: 'b', ZAPI_CLIENT_TOKEN: 'c' }))
    ).toBeInstanceOf(ZApiProvider);
  });
});
