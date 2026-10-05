// Contrato comum dos provedores de WhatsApp (padrão adapter).

export type NomeProvider = 'evolution' | 'zapi' | 'mock';

export interface SaudeProvider {
  conectado: boolean;
  /** Estado como o provedor descreve (ex.: "open", "close", "connected"). */
  estado: string;
}

export interface WhatsAppProvider {
  readonly nome: NomeProvider;
  /** `phone` já normalizado (55 + DDD + 9 + 8 dígitos). */
  sendText(phone: string, text: string): Promise<{ messageId: string | null }>;
  /** true/false se o provedor souber dizer; null quando não suporta a consulta. */
  numberExists(phone: string): Promise<boolean | null>;
  health(): Promise<SaudeProvider>;
}

/** Erro do provedor. `retentavel` só para rede/timeout (é o único caso com retentativa automática). */
export class ProviderError extends Error {
  readonly retentavel: boolean;
  readonly status?: number;

  constructor(mensagem: string, opcoes: { retentavel: boolean; status?: number }) {
    super(mensagem);
    this.name = 'ProviderError';
    this.retentavel = opcoes.retentavel;
    this.status = opcoes.status;
  }
}

export type Fetch = typeof fetch;

/** Tira sequências longas de dígitos (telefones ecoados pelo provedor) de mensagens de erro. */
export function limparErro(texto: string, limite = 200): string {
  return texto.replace(/\d{8,}/g, '[número]').slice(0, limite);
}

/** fetch com timeout; converte falha de rede/timeout/HTTP em ProviderError e devolve o JSON. */
export async function requisitarJson(
  fetchImpl: Fetch,
  url: string,
  init: RequestInit,
  timeoutMs = 15_000
): Promise<unknown> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), timeoutMs);
  let resposta: Response;
  try {
    resposta = await fetchImpl(url, { ...init, signal: controle.signal });
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'AbortError';
    throw new ProviderError(timeout ? 'timeout' : `erro de rede: ${limparErro(String(e))}`, { retentavel: true });
  } finally {
    clearTimeout(timer);
  }

  const corpo = await resposta.text().catch(() => '');
  if (!resposta.ok) {
    throw new ProviderError(`HTTP ${resposta.status}: ${limparErro(corpo)}`, {
      retentavel: false,
      status: resposta.status,
    });
  }
  try {
    return corpo ? JSON.parse(corpo) : {};
  } catch {
    throw new ProviderError(`resposta inválida: ${limparErro(corpo)}`, { retentavel: false });
  }
}
