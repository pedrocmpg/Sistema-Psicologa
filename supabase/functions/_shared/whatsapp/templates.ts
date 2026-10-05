// Templates das mensagens: textos padrão, placeholders e a trava de privacidade.
// REGRA: mensagem de WhatsApp pode ser vista por terceiros no aparelho do paciente, então nunca
// pode ter termo clínico. Usamos "horário"/"atendimento".

import { dataCurta, dataPorExtenso, diaFixoSemanal, horaFalada } from './datas.ts';
import { formatarTelefoneExibicao } from './telefone.ts';

export type EventoNotificacao = 'confirmado' | 'recusado' | 'cancelado' | 'confirmado_serie' | 'cancelado_serie';

export const EVENTOS: EventoNotificacao[] = [
  'confirmado',
  'recusado',
  'cancelado',
  'confirmado_serie',
  'cancelado_serie',
];

export type Templates = Record<EventoNotificacao, string>;

export const TEMPLATES_PADRAO: Templates = {
  confirmado:
    'Olá, {nome}! Seu horário com {profissional} está confirmado para {data}, às {hora}. {endereco} Para remarcar ou cancelar, fale com {telefone_contato}.',
  recusado:
    'Olá, {nome}! Não foi possível confirmar o horário solicitado com {profissional}. Para ver outras opções, fale com {telefone_contato}.',
  cancelado:
    'Olá, {nome}! Seu horário com {profissional} em {data}, às {hora}, foi cancelado. Para reagendar, fale com {telefone_contato}.',
  confirmado_serie:
    'Olá, {nome}! Seus horários com {profissional} estão confirmados: {dia_fixo}, às {hora}, a partir de {data_inicio}, por {semanas}. {endereco} Para remarcar ou cancelar, fale com {telefone_contato}.',
  cancelado_serie:
    'Olá, {nome}! Seus horários de {dia_fixo}, às {hora}, com {profissional}, a partir de {data_inicio}, foram cancelados. Para reagendar, fale com {telefone_contato}.',
};

export const ROTULO_EVENTO: Record<EventoNotificacao, string> = {
  confirmado: 'Horário confirmado',
  recusado: 'Pedido não confirmado',
  cancelado: 'Horário cancelado',
  confirmado_serie: 'Série semanal confirmada',
  cancelado_serie: 'Série semanal cancelada',
};

/** Placeholders disponíveis (para a tela de edição). */
export const PLACEHOLDERS: { chave: string; descricao: string; serie?: boolean }[] = [
  { chave: '{nome}', descricao: 'primeiro nome do paciente' },
  { chave: '{profissional}', descricao: 'seu nome, como configurado' },
  { chave: '{data}', descricao: 'ex.: terça-feira, 14/10' },
  { chave: '{hora}', descricao: 'ex.: 14h ou 14h30' },
  { chave: '{telefone_contato}', descricao: 'seu número principal' },
  { chave: '{endereco}', descricao: '"Endereço: ..." ou nada, se vazio' },
  { chave: '{dia_fixo}', descricao: 'ex.: toda terça-feira', serie: true },
  { chave: '{data_inicio}', descricao: 'primeira data da série, ex.: 14/10', serie: true },
  { chave: '{semanas}', descricao: 'ex.: 8 semanas', serie: true },
];

/** Templates salvos (só as chaves editadas) + padrão para o resto. */
export function templatesEfetivos(salvos: Partial<Record<string, unknown>> | null | undefined): Templates {
  const resultado = { ...TEMPLATES_PADRAO };
  for (const evento of EVENTOS) {
    const valor = salvos?.[evento];
    if (typeof valor === 'string' && valor.trim()) resultado[evento] = valor;
  }
  return resultado;
}

export interface DadosMensagem {
  nomePaciente: string;
  profissional: string;
  telefoneContato: string;
  endereco?: string | null;
  /** YYYY-MM-DD — data do horário (ou a primeira da série). */
  data: string;
  /** HH:MM[:SS] */
  hora: string;
  /** Só em séries: quantas ocorrências. */
  semanas?: number;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

export function variaveisMensagem(d: DadosMensagem): Record<string, string> {
  const endereco = d.endereco?.trim();
  const semanas = d.semanas ?? 1;
  return {
    nome: primeiroNome(d.nomePaciente),
    profissional: d.profissional.trim(),
    data: dataPorExtenso(d.data),
    hora: horaFalada(d.hora),
    telefone_contato: formatarTelefoneExibicao(d.telefoneContato),
    endereco: endereco ? `Endereço: ${endereco.replace(/\.$/, '')}.` : '',
    dia_fixo: diaFixoSemanal(d.data),
    data_inicio: dataCurta(d.data),
    semanas: semanas === 1 ? '1 semana' : `${semanas} semanas`,
  };
}

/** Troca {chave} pelos valores; placeholder desconhecido fica como está (aparece na pré-visualização). */
export function renderizarTemplate(template: string, variaveis: Record<string, string>): string {
  return template
    .replace(/\{(\w+)\}/g, (original, chave: string) => (chave in variaveis ? variaveis[chave] : original))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,!?])/g, '$1')
    .trim();
}

export function montarMensagem(evento: EventoNotificacao, templates: Templates, dados: DadosMensagem): string {
  return renderizarTemplate(templates[evento], variaveisMensagem(dados));
}

// Radicais, comparados sem acento e sem maiúsculas. "psicolog" cobre psicóloga/psicológico:
// revelar a especialidade já expõe o paciente.
const TERMOS_CLINICOS = [
  'terapia',
  'terapeut',
  'psicoterap',
  'psicolog',
  'psiquiatr',
  'psicanal',
  'sessao',
  'sessoes',
  'diagnostic',
  'tratamento',
  'transtorno',
  'ansiedade',
  'depressao',
  'medicac',
  'medicament',
  'saude mental',
  'clinic',
];

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Termos clínicos encontrados no texto (vazio = ok). */
export function termosClinicos(texto: string): string[] {
  const normalizado = semAcento(texto);
  return TERMOS_CLINICOS.filter((termo) => normalizado.includes(termo));
}
