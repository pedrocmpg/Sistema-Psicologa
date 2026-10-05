// Evolution API (self-hosted, v2). Docs: https://doc.evolution-api.com
import { type Fetch, ProviderError, requisitarJson, type SaudeProvider, type WhatsAppProvider } from './types.ts';

export interface ConfigEvolution {
  url: string;
  apiKey: string;
  instancia: string;
}

export class EvolutionApiProvider implements WhatsAppProvider {
  readonly nome = 'evolution' as const;
  private readonly base: string;
  private readonly config: ConfigEvolution;
  private readonly fetchImpl: Fetch;

  constructor(config: ConfigEvolution, fetchImpl: Fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.base = config.url.replace(/\/+$/, '');
  }

  private headers() {
    return { 'Content-Type': 'application/json', apikey: this.config.apiKey };
  }

  private rota(caminho: string) {
    return `${this.base}/${caminho}/${encodeURIComponent(this.config.instancia)}`;
  }

  async sendText(phone: string, text: string) {
    const json = (await requisitarJson(this.fetchImpl, this.rota('message/sendText'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ number: phone, text }),
    })) as { key?: { id?: string } };
    return { messageId: json?.key?.id ?? null };
  }

  async numberExists(phone: string) {
    const json = await requisitarJson(this.fetchImpl, this.rota('chat/whatsappNumbers'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ numbers: [phone] }),
    });
    if (!Array.isArray(json)) return null;
    const item = json[0] as { exists?: boolean } | undefined;
    return typeof item?.exists === 'boolean' ? item.exists : null;
  }

  async health(): Promise<SaudeProvider> {
    try {
      const json = (await requisitarJson(this.fetchImpl, this.rota('instance/connectionState'), {
        method: 'GET',
        headers: this.headers(),
      })) as { instance?: { state?: string }; state?: string };
      const estado = json?.instance?.state ?? json?.state ?? 'desconhecido';
      return { conectado: estado === 'open', estado };
    } catch (e) {
      return { conectado: false, estado: e instanceof ProviderError ? e.message : 'erro' };
    }
  }
}
