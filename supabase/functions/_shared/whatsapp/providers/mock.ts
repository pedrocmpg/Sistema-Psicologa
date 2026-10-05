// Provider de desenvolvimento/testes: não fala com ninguém, só registra (mascarado) no log.
import { mascararTelefone } from '../telefone.ts';
import { ProviderError, type SaudeProvider, type WhatsAppProvider } from './types.ts';

export interface OpcoesMock {
  /** Simula falha no envio: 'rede' (retentável) ou 'http' (não retentável). */
  falha?: 'rede' | 'http' | null;
  /** Quantas vezes falhar antes de passar a funcionar (padrão: sempre). */
  falharVezes?: number;
  /** Resposta de numberExists (padrão true). */
  existe?: boolean | null;
  conectado?: boolean;
  log?: (linha: string) => void;
}

export class MockProvider implements WhatsAppProvider {
  readonly nome = 'mock' as const;
  /** Envios "feitos" — só em memória, para os testes conferirem. */
  readonly enviados: { phone: string; text: string }[] = [];
  private falhasRestantes: number;
  private readonly opcoes: OpcoesMock;

  constructor(opcoes: OpcoesMock = {}) {
    this.opcoes = opcoes;
    this.falhasRestantes = opcoes.falharVezes ?? Number.POSITIVE_INFINITY;
  }

  private log(linha: string) {
    (this.opcoes.log ?? console.log)(`[whatsapp:mock] ${linha}`);
  }

  async sendText(phone: string, text: string) {
    if (this.opcoes.falha && this.falhasRestantes > 0) {
      this.falhasRestantes -= 1;
      throw this.opcoes.falha === 'rede'
        ? new ProviderError('erro de rede: simulado', { retentavel: true })
        : new ProviderError('HTTP 500: simulado', { retentavel: false, status: 500 });
    }
    this.enviados.push({ phone, text });
    this.log(`envio simulado para ${mascararTelefone(phone)} (${text.length} caracteres)`);
    return { messageId: `mock-${this.enviados.length}` };
  }

  async numberExists(_phone: string) {
    return this.opcoes.existe === undefined ? true : this.opcoes.existe;
  }

  async health(): Promise<SaudeProvider> {
    const conectado = this.opcoes.conectado ?? true;
    return { conectado, estado: conectado ? 'mock' : 'mock-desconectado' };
  }
}
