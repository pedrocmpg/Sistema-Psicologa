// Repo real (supabase-js com a service role, que ignora RLS). Só roda no Deno — os testes usam
// um Repo em memória com as mesmas regras de unique.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  type AgendamentoNotificavel,
  type AtualizacaoNotificacao,
  type ConfigWhatsApp,
  MOTIVO_PROCESSANDO,
  type Notificacao,
  type Repo,
  type ResumoSerie,
} from './whatsapp/repo.ts';

type Horario = { data: string; hora: string } | null;

export class SupabaseRepo implements Repo {
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  async getConfig(): Promise<ConfigWhatsApp | null> {
    const { data, error } = await this.db
      .from('configuracoes_whatsapp')
      .select('ativo, nome_profissional, telefone_contato, endereco, templates')
      .maybeSingle();
    if (error) throw new Error(`config: ${error.message}`);
    return data as ConfigWhatsApp | null;
  }

  async getAgendamento(id: string): Promise<AgendamentoNotificavel | null> {
    const { data, error } = await this.db
      .from('agendamentos')
      .select(
        'id, nome_paciente, telefone, status, recorrencia_id, notificar_whatsapp, cancelado_em_serie, horarios_disponiveis(data, hora)'
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`agendamento: ${error.message}`);
    if (!data) return null;
    const { horarios_disponiveis, ...resto } = data as typeof data & { horarios_disponiveis: Horario };
    return { ...resto, data: horarios_disponiveis?.data ?? null, hora: horarios_disponiveis?.hora ?? null } as AgendamentoNotificavel;
  }

  async resumoSerie(recorrenciaId: string, evento: 'confirmado_serie' | 'cancelado_serie'): Promise<ResumoSerie | null> {
    const { data, error } = await this.db
      .from('agendamentos')
      .select('status, cancelado_em_serie, horarios_disponiveis(data, hora)')
      .eq('recorrencia_id', recorrenciaId);
    if (error) throw new Error(`serie: ${error.message}`);

    const linhas = ((data ?? []) as { status: string; cancelado_em_serie: boolean; horarios_disponiveis: Horario }[])
      .filter((l) => (evento === 'confirmado_serie' ? l.status === 'confirmado' : l.status === 'cancelado' && l.cancelado_em_serie))
      .map((l) => l.horarios_disponiveis)
      .filter((h): h is NonNullable<Horario> => !!h)
      .sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));

    if (linhas.length === 0) return null;
    return { primeiraData: linhas[0].data, hora: linhas[0].hora, ocorrencias: linhas.length };
  }

  async inserirNotificacao(nova: Pick<Notificacao, 'agendamento_id' | 'recorrencia_id' | 'evento'>) {
    const { data, error } = await this.db
      .from('notificacoes')
      .insert({ ...nova, status: 'pendente', motivo: MOTIVO_PROCESSANDO })
      .select()
      .single();
    if (error?.code === '23505') return { ok: false as const, motivo: 'duplicado' as const };
    if (error) throw new Error(`inserir notificacao: ${error.message}`);
    return { ok: true as const, notificacao: data as Notificacao };
  }

  async atualizarNotificacao(id: string, mudancas: AtualizacaoNotificacao) {
    const { error } = await this.db
      .from('notificacoes')
      .update({ ...mudancas, atualizado_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(`atualizar notificacao: ${error.message}`);
  }

  async getNotificacao(id: string): Promise<Notificacao | null> {
    const { data, error } = await this.db.from('notificacoes').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`notificacao: ${error.message}`);
    return data as Notificacao | null;
  }

  async assumirParaReenvio(id: string, travadaDesde: Date): Promise<Notificacao | null> {
    // UPDATE ... WHERE ... RETURNING: atômico, então dois cliques em "Reenviar" não enviam duas vezes.
    const { data, error } = await this.db
      .from('notificacoes')
      .update({ status: 'pendente', motivo: MOTIVO_PROCESSANDO, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['falhou', 'pendente'])
      .or(`motivo.is.null,motivo.neq.${MOTIVO_PROCESSANDO},atualizado_em.lt."${travadaDesde.toISOString()}"`)
      .select()
      .maybeSingle();
    if (error) throw new Error(`assumir notificacao: ${error.message}`);
    return data as Notificacao | null;
  }

  async contarEnviosDesde(desde: Date): Promise<number> {
    const { count, error } = await this.db
      .from('notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'enviado')
      .gte('enviado_em', desde.toISOString());
    if (error) throw new Error(`contar envios: ${error.message}`);
    return count ?? 0;
  }
}
