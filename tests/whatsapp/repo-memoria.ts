// Repo em memória para os testes de integração. Impõe as mesmas regras do Postgres que
// importam aqui: unique (agendamento_id, evento) e unique parcial (recorrencia_id, evento).
// Cada método cede o event loop antes de agir, para que webhooks "concorrentes" (Promise.all)
// realmente se intercalem; o check+insert em si é síncrono, como uma operação atômica no banco.
import type {
  AgendamentoNotificavel,
  AtualizacaoNotificacao,
  ConfigWhatsApp,
  Notificacao,
  Repo,
  ResumoSerie,
} from '../../supabase/functions/_shared/whatsapp/repo.ts';
import { MOTIVO_PROCESSANDO } from '../../supabase/functions/_shared/whatsapp/repo.ts';

const ceder = () => new Promise<void>((r) => setTimeout(r, 0));

export class RepoMemoria implements Repo {
  config: ConfigWhatsApp = {
    ativo: true,
    nome_profissional: 'Profissional Exemplo',
    telefone_contato: '+55 54 90000-0009',
    endereco: null,
    templates: {},
  };
  agendamentos = new Map<string, AgendamentoNotificavel>();
  notificacoes: Notificacao[] = [];
  /** Simula banco fora do ar. */
  quebrado = false;
  private seq = 0;

  private async entrar() {
    await ceder();
    if (this.quebrado) throw new Error('conexão recusada (simulado)');
  }

  async getConfig() {
    await this.entrar();
    return { ...this.config };
  }

  async getAgendamento(id: string) {
    await this.entrar();
    const a = this.agendamentos.get(id);
    return a ? { ...a } : null;
  }

  async resumoSerie(recorrenciaId: string, evento: 'confirmado_serie' | 'cancelado_serie'): Promise<ResumoSerie | null> {
    await this.entrar();
    const linhas = [...this.agendamentos.values()]
      .filter((a) => a.recorrencia_id === recorrenciaId)
      .filter((a) => (evento === 'confirmado_serie' ? a.status === 'confirmado' : a.status === 'cancelado' && a.cancelado_em_serie))
      .sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));
    if (!linhas.length) return null;
    return { primeiraData: linhas[0].data!, hora: linhas[0].hora!, ocorrencias: linhas.length };
  }

  async inserirNotificacao(nova: Pick<Notificacao, 'agendamento_id' | 'recorrencia_id' | 'evento'>) {
    await this.entrar();
    const conflito = this.notificacoes.some(
      (n) =>
        (n.agendamento_id === nova.agendamento_id && n.evento === nova.evento) ||
        (nova.recorrencia_id !== null && n.recorrencia_id === nova.recorrencia_id && n.evento === nova.evento)
    );
    if (conflito) return { ok: false as const, motivo: 'duplicado' as const };
    const agora = new Date().toISOString();
    const n: Notificacao = {
      id: `n${++this.seq}`,
      ...nova,
      status: 'pendente',
      motivo: MOTIVO_PROCESSANDO,
      provider_message_id: null,
      tentativas: 0,
      criado_em: agora,
      enviado_em: null,
      atualizado_em: agora,
    };
    this.notificacoes.push(n);
    return { ok: true as const, notificacao: { ...n } };
  }

  async atualizarNotificacao(id: string, mudancas: AtualizacaoNotificacao) {
    await this.entrar();
    const n = this.notificacoes.find((x) => x.id === id);
    if (n) Object.assign(n, mudancas, { atualizado_em: new Date().toISOString() });
  }

  async getNotificacao(id: string) {
    await this.entrar();
    const n = this.notificacoes.find((x) => x.id === id);
    return n ? { ...n } : null;
  }

  async assumirParaReenvio(id: string, travadaDesde: Date) {
    await this.entrar();
    const n = this.notificacoes.find((x) => x.id === id);
    if (!n || (n.status !== 'falhou' && n.status !== 'pendente')) return null;
    if (n.motivo === MOTIVO_PROCESSANDO && new Date(n.atualizado_em) >= travadaDesde) return null;
    Object.assign(n, { status: 'pendente', motivo: MOTIVO_PROCESSANDO, atualizado_em: new Date().toISOString() });
    return { ...n };
  }

  async contarEnviosDesde(desde: Date) {
    await this.entrar();
    return this.notificacoes.filter((n) => n.status === 'enviado' && n.enviado_em && new Date(n.enviado_em) >= desde)
      .length;
  }

  // --- helpers dos testes -------------------------------------------------

  /** Cria/atualiza um agendamento e devolve a linha (como o webhook receberia em `record`). */
  salvar(a: Partial<AgendamentoNotificavel> & { id: string }): AgendamentoNotificavel {
    const atual = this.agendamentos.get(a.id);
    const linha: AgendamentoNotificavel = {
      nome_paciente: 'Paciente Teste',
      telefone: '(54) 90000-0001',
      status: 'pendente',
      recorrencia_id: null,
      notificar_whatsapp: true,
      cancelado_em_serie: false,
      data: '2026-10-13',
      hora: '14:00:00',
      ...atual,
      ...a,
    };
    this.agendamentos.set(a.id, linha);
    return { ...linha };
  }

  /** Simula `count` envios bem-sucedidos recentes (para o limite por hora). */
  semearEnvios(quantidade: number, quando: Date) {
    for (let i = 0; i < quantidade; i++) {
      this.notificacoes.push({
        id: `antigo${i}`,
        agendamento_id: `outro${i}`,
        recorrencia_id: null,
        evento: 'confirmado',
        status: 'enviado',
        motivo: null,
        provider_message_id: 'x',
        tentativas: 1,
        criado_em: quando.toISOString(),
        enviado_em: quando.toISOString(),
        atualizado_em: quando.toISOString(),
      });
    }
  }
}
