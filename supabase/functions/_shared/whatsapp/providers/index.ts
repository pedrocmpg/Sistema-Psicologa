// Escolhe o provider pela env WHATSAPP_PROVIDER ("evolution" | "zapi" | "mock"; padrão: mock).
import { EvolutionApiProvider } from './evolution.ts';
import { MockProvider } from './mock.ts';
import type { Fetch, NomeProvider, WhatsAppProvider } from './types.ts';
import { ZApiProvider } from './zapi.ts';

export * from './types.ts';
export { EvolutionApiProvider, MockProvider, ZApiProvider };

export type LerEnv = (nome: string) => string | undefined;

export interface AmbienteWhatsApp {
  provider: NomeProvider;
  dryRun: boolean;
}

export function lerAmbiente(env: LerEnv): AmbienteWhatsApp {
  const bruto = (env('WHATSAPP_PROVIDER') ?? '').trim().toLowerCase();
  const provider: NomeProvider = bruto === 'evolution' || bruto === 'zapi' ? bruto : 'mock';
  const dryRun = ['1', 'true', 'sim', 'yes'].includes((env('WHATSAPP_DRY_RUN') ?? '').trim().toLowerCase());
  return { provider, dryRun };
}

function obrigatorias(env: LerEnv, nomes: string[]): Record<string, string> {
  const faltando = nomes.filter((n) => !env(n)?.trim());
  if (faltando.length) throw new Error(`provedor_nao_configurado: faltam ${faltando.join(', ')}`);
  return Object.fromEntries(nomes.map((n) => [n, env(n)!.trim()]));
}

/** Lança `provedor_nao_configurado` se faltar alguma env do provider escolhido. */
export function criarProvider(env: LerEnv, fetchImpl: Fetch = fetch): WhatsAppProvider {
  const { provider } = lerAmbiente(env);
  if (provider === 'evolution') {
    const v = obrigatorias(env, ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE']);
    return new EvolutionApiProvider(
      { url: v.EVOLUTION_API_URL, apiKey: v.EVOLUTION_API_KEY, instancia: v.EVOLUTION_INSTANCE },
      fetchImpl
    );
  }
  if (provider === 'zapi') {
    const v = obrigatorias(env, ['ZAPI_INSTANCE_ID', 'ZAPI_TOKEN', 'ZAPI_CLIENT_TOKEN']);
    return new ZApiProvider(
      { instanciaId: v.ZAPI_INSTANCE_ID, token: v.ZAPI_TOKEN, clientToken: v.ZAPI_CLIENT_TOKEN },
      fetchImpl
    );
  }
  return new MockProvider();
}
