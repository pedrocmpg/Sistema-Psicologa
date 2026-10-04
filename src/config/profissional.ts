/**
 * DADOS DA PROFISSIONAL — único lugar com informações pessoais do cliente.
 *
 * Para entregar o site a outro cliente, edite SOMENTE este arquivo.
 * Nenhum outro arquivo de código deve conter nome, CRP, telefone, endereço etc.
 * (O index.html também lê daqui, via plugin em vite.config.ts.)
 *
 * Este arquivo é importado também pelo vite.config.ts: mantenha-o como dados puros,
 * sem importar nada do projeto.
 */
export const profissional = {
  nome: 'Daniele Walczak',
  primeiroNome: 'Daniele',
  /** Título exibido junto ao nome (cabeçalho, rodapé, contato). */
  titulo: 'Psicóloga Clínica',
  /** Forma curta do título (metadescrição). */
  tituloCurto: 'Psicóloga',
  /** Registro profissional, exatamente como deve aparecer. */
  crp: 'CRP 07/36785',

  cidade: 'Bento Gonçalves',
  /** Cidade + UF, usado no rodapé e no título da página. */
  cidadeUF: 'Bento Gonçalves, RS',
  endereco: 'R. Dr. José Mário Mônaco, 227, sala 508, Centro, Bento Gonçalves, RS',

  /** Telefone/WhatsApp em formato exibido e em formato internacional (só dígitos, com DDI). */
  telefoneExibicao: '(54) 99712-2959',
  telefoneInternacional: '5554997122959',
  mensagemWhatsapp: 'Olá! Gostaria de agendar uma consulta.',

  horarioAtendimento: 'Segunda a sexta, das 9h às 19h30',
  horarioAtendimentoCurto: 'Seg. a sex., 9h–19h30',

  /** Selo de avaliação do Google exibido no topo do site. */
  avaliacaoGoogle: { nota: '5,0', quantidade: 33 },

  /** Metadescrição do site (SEO). */
  descricaoSite:
    'psicoterapia individual, de casal e infantil em Bento Gonçalves, RS. Abordagem cognitivo-comportamental (TCC).',
} as const;
