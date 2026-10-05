// Handlers HTTP das duas Edge Functions, sem nada de Deno: os index.ts só injetam env, Repo e
// EdgeRuntime.waitUntil. Assim os testes (Node) exercitam exatamente o mesmo código.

import {
  type Deps,
  enviarTeste,
  type PayloadWebhook,
  processarWebhook,
  reenviarNotificacao,
  type Resultado,
  saudeDoProvider,
} from './notificar.ts';

export const HEADER_SEGREDO = 'x-webhook-secret';

/** Comparação em tempo constante (não vaza, pelo tempo de resposta, quantos caracteres batem). */
export function segredoConfere(recebido: string, esperado: string): boolean {
  const a = new TextEncoder().encode(recebido);
  const b = new TextEncoder().encode(esperado);
  let diferenca = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diferenca |= (a[i] ?? 0) ^ b[i];
  return diferenca === 0;
}

function resposta(corpo: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export interface OpcoesWebhook {
  segredo: string | undefined;
  deps: Deps;
  /** Mantém o processamento vivo depois da resposta (EdgeRuntime.waitUntil). */
  emSegundoPlano: (tarefa: Promise<unknown>) => void;
  log?: (linha: string) => void;
}

/**
 * Webhook do banco. Responde 202 na hora (o Database Webhook tem timeout curto) e processa em
 * segundo plano — atraso de 1–3 s e eventual retentativa de 60 s não seguram a conexão.
 */
export function criarHandlerWebhook(opcoes: OpcoesWebhook) {
  const log = opcoes.log ?? ((l: string) => console.log(l));
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return resposta({ erro: 'metodo_nao_permitido' }, 405);

    if (!opcoes.segredo) {
      log('[whatsapp] WEBHOOK_SECRET não configurado: recusando todas as chamadas');
      return resposta({ erro: 'nao_configurado' }, 500);
    }
    if (!segredoConfere(req.headers.get(HEADER_SEGREDO) ?? '', opcoes.segredo)) {
      return resposta({ erro: 'nao_autorizado' }, 401);
    }

    let payload: PayloadWebhook;
    try {
      payload = await req.json();
    } catch {
      return resposta({ erro: 'payload_invalido' }, 400);
    }

    const tarefa = processarWebhook(payload, opcoes.deps).catch((e) => {
      log(`[whatsapp] erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
    });
    opcoes.emSegundoPlano(tarefa);
    return resposta({ recebido: true }, 202);
  };
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export interface OpcoesAdmin {
  /** true se o Authorization for de um usuário logado (a psicóloga). */
  autenticar: (req: Request) => Promise<boolean>;
  deps: Deps;
}

/** Ações do painel: health | teste | reenviar. Exige usuário autenticado. */
export function criarHandlerAdmin(opcoes: OpcoesAdmin) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return resposta({ erro: 'metodo_nao_permitido' }, 405, CORS);
    if (!(await opcoes.autenticar(req).catch(() => false))) {
      return resposta({ erro: 'nao_autorizado' }, 401, CORS);
    }

    let corpo: { acao?: string; notificacao_id?: string };
    try {
      corpo = await req.json();
    } catch {
      return resposta({ erro: 'payload_invalido' }, 400, CORS);
    }

    switch (corpo.acao) {
      case 'health':
        return resposta(await saudeDoProvider(opcoes.deps), 200, CORS);
      case 'teste':
        return resposta(await enviarTeste(opcoes.deps), 200, CORS);
      case 'reenviar': {
        if (!corpo.notificacao_id) return resposta({ erro: 'notificacao_id_obrigatorio' }, 400, CORS);
        const r: Resultado = await reenviarNotificacao(corpo.notificacao_id, opcoes.deps);
        return resposta(r, 200, CORS);
      }
      default:
        return resposta({ erro: 'acao_desconhecida' }, 400, CORS);
    }
  };
}
