// Z-API (serviço pago). Docs: https://developer.z-api.io
import { type Fetch, ProviderError, requisitarJson, type SaudeProvider, type WhatsAppProvider } from './types.ts';

export interface ConfigZApi {
  instanciaId: string;
  token: string;
  clientToken: string;
}

export class ZApiProvider implements WhatsAppProvider {
  readonly nome = 'zapi' as const;
  private readonly base: string;
  private readonly config: ConfigZApi;
  private readonly fetchImpl: Fetch;

  constructor(config: ConfigZApi, fetchImpl: Fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.base = `https://api.z-api.io/instances/${encodeURIComponent(config.instanciaId)}/token/${encodeURIComponent(config.token)}`;
  }

  private headers() {
    return { 'Content-Type': 'application/json', 'Client-Token': this.config.clientToken };
  }

  async sendText(phone: string, text: string) {
    const json = (await requisitarJson(this.fetchImpl, `${this.base}/send-text`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ phone, message: text }),
    })) as { messageId?: string; zaapId?: string; id?: string };
    return { messageId: json?.messageId ?? json?.zaapId ?? json?.id ?? null };
  }

  async numberExists(phone: string) {
    const json = (await requisitarJson(this.fetchImpl, `${this.base}/phone-exists/${phone}`, {
      method: 'GET',
      headers: this.headers(),
    })) as { exists?: boolean };
    return typeof json?.exists === 'boolean' ? json.exists : null;
  }

  async health(): Promise<SaudeProvider> {
    try {
      const json = (await requisitarJson(this.fetchImpl, `${this.base}/status`, {
        method: 'GET',
        headers: this.headers(),
      })) as { connected?: boolean; error?: string };
      const conectado = json?.connected === true;
      return { conectado, estado: conectado ? 'connected' : (json?.error ?? 'disconnected') };
    } catch (e) {
      return { conectado: false, estado: e instanceof ProviderError ? e.message : 'erro' };
    }
  }
}
