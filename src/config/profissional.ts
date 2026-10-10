/**
 * CONFIGURAÇÃO DO SITE — dados pessoais E textos do cliente, tudo num lugar só.
 *
 * Para entregar o site a outro cliente, edite SOMENTE este arquivo.
 *   1. `profissional` ........ quem é (nome, CRP, telefone, endereço, horário…)
 *   2. `textos` .............. todo o texto do site público, seção por seção
 *
 * Dicas:
 *  - Os textos de `textos` já usam os dados de `profissional` (ex.: `${p.crp}`),
 *    então mudar o CRP lá em cima atualiza o site inteiro.
 *  - `icone: '...'` escolhe o ícone do item. Nomes válidos: ver `src/components/iconesTexto.ts`.
 *  - Este arquivo é importado também pelo vite.config.ts: mantenha-o como dados puros,
 *    sem importar nada do projeto.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. DADOS PESSOAIS
// ─────────────────────────────────────────────────────────────────────────────
export const profissional = {
  nome: 'Daniele Walczak',
  primeiroNome: 'Daniele',
  /** Título exibido junto ao nome (cabeçalho, rodapé, contato). */
  titulo: 'Psicóloga Clínica',
  /** Registro profissional, exatamente como deve aparecer. */
  crp: 'CRP 07/36785',

  cidade: 'Bento Gonçalves',
  /** Cidade + UF, usado no rodapé. */
  cidadeUF: 'Bento Gonçalves, RS',
  endereco: 'R. Dr. José Mário Mônaco, 227, sala 508, Centro, Bento Gonçalves, RS',

  /** Telefone/WhatsApp: formato exibido e formato internacional (só dígitos, com DDI). */
  telefoneExibicao: '(54) 99712-2959',
  telefoneInternacional: '5554997122959',
  mensagemWhatsapp: 'Olá! Gostaria de agendar uma consulta.',

  horarioAtendimento: 'Segunda a sexta, das 9h às 19h30',
  horarioAtendimentoCurto: 'Seg. a sex., 9h–19h30',

  /** Selo de avaliação do Google exibido no topo do site. */
  avaliacaoGoogle: { nota: '5,0', quantidade: 33 },
} as const;

const p = profissional;

// ─────────────────────────────────────────────────────────────────────────────
// 2. TEXTOS DO SITE PÚBLICO
// ─────────────────────────────────────────────────────────────────────────────
export const textos = {
  /** Aba do navegador e descrição para buscadores (lidos pelo vite.config.ts). */
  pagina: {
    titulo: `${p.nome} | ${p.titulo} — ${p.cidadeUF}`,
    descricao: `Psicóloga ${p.nome} (${p.crp}) — psicoterapia individual, de casal e infantil em ${p.cidadeUF}. Abordagem cognitivo-comportamental (TCC).`,
  },

  cabecalho: {
    subtitulo: `${p.titulo} · ${p.crp}`,
    menu: [
      { rotulo: 'Sobre', destino: '#sobre' },
      { rotulo: 'Especialidades', destino: '#especialidades' },
      { rotulo: 'Contato', destino: '#contato' },
    ],
    botaoAgendar: 'Agendar horário',
    botaoAgendarCurto: 'Agendar',
    abrirMenu: 'Abrir menu',
    fecharMenu: 'Fechar menu',
  },

  hero: {
    chamada: 'Psicoterapia individual, de casal e infantil',
    tituloAntes: 'Um espaço tranquilo para você se ouvir com mais ',
    tituloDestaque: 'clareza',
    tituloDepois: '.',
    texto: `Atendimento psicológico com abordagem cognitivo-comportamental, em ${p.cidade}. Um processo conduzido no seu ritmo, com escuta cuidadosa e embasamento técnico.`,
    botaoPrincipal: 'Agendar horário',
    botaoSecundario: 'Conhecer a abordagem',
    selo: {
      nota: p.avaliacaoGoogle.nota,
      complemento: `de avaliação no Google (${p.avaliacaoGoogle.quantidade} avaliações)`,
    },
  },

  sobre: {
    chamada: 'Sobre o atendimento',
    titulo: 'Um cuidado próximo, técnico e sem julgamentos.',
    texto:
      'Cada pessoa chega com uma história diferente. O trabalho aqui é construir, junto, um espaço seguro para entender o que está sendo vivido — no tempo de cada um.',
    pontos: [
      {
        icone: 'Compass',
        titulo: 'Abordagem cognitivo-comportamental (TCC)',
        texto:
          'Terapia estruturada, com objetivos claros e técnicas baseadas em evidências para lidar com pensamentos, emoções e comportamentos.',
      },
      {
        icone: 'Users',
        titulo: 'Adultos, crianças e casais',
        texto:
          'Atendimento individual para adultos e crianças, além de psicoterapia de casal, com linguagem e recursos adequados a cada fase da vida.',
      },
      {
        icone: 'GraduationCap',
        titulo: 'Formação e atualização contínua',
        texto: `Psicóloga clínica (${p.crp}), com formação em Terapia Cognitivo-Comportamental e atualização constante na área.`,
      },
    ],
    /** Cartão de dados ao lado dos pontos. */
    ficha: [
      { icone: 'UserRound', rotulo: 'Profissional', valor: p.nome },
      { icone: 'BadgeCheck', rotulo: 'Registro', valor: p.crp },
      { icone: 'Building', rotulo: 'Atendimento', valor: 'Presencial' },
      { icone: 'Users', rotulo: 'Público', valor: 'Adulto, infantil e casal' },
      { icone: 'Clock', rotulo: 'Horário', valor: p.horarioAtendimentoCurto },
    ],
  },

  especialidades: {
    chamada: 'Áreas de atuação',
    titulo: 'Especialidades',
    itens: [
      {
        icone: 'MessageCircle',
        titulo: 'Terapia Cognitivo-Comportamental',
        texto:
          'Processo estruturado que ajuda a identificar padrões de pensamento e desenvolver estratégias mais saudáveis no dia a dia.',
      },
      {
        icone: 'HeartHandshake',
        titulo: 'Terapia de casal',
        texto: 'Espaço para casais trabalharem comunicação, conflitos e reconexão, com condução neutra e acolhedora.',
      },
      {
        icone: 'Leaf',
        titulo: 'Transtornos de ansiedade',
        texto:
          'Acompanhamento para quem convive com ansiedade excessiva, preocupação constante ou crises, com técnicas da TCC.',
      },
      {
        icone: 'Compass',
        titulo: 'Orientação vocacional',
        texto:
          'Apoio na escolha profissional ou em momentos de transição de carreira, unindo autoconhecimento e informação.',
      },
    ],
  },

  agendamento: {
    chamada: 'Agendamento online',
    titulo: 'Escolha um horário disponível',
    texto:
      'Selecione um dia e horário livre na agenda. Seu pedido será enviado para análise — a confirmação é feita pela psicóloga pelo telefone ou WhatsApp informado.',
    escolha: {
      intro: 'Prefere conversar antes? Me chame no WhatsApp. Já sabe o que precisa? Agende direto abaixo.',
      whatsappTitulo: 'Falar direto comigo',
      whatsappTexto: 'Tire dúvidas ou combine os detalhes pelo WhatsApp.',
      agendarTitulo: 'Agendar meu horário',
      agendarTexto: 'Veja os horários livres e escolha o seu, agora mesmo.',
    },
    calendario: {
      titulo: 'Horários livres',
      umDia: 'dia disponível',
      variosDias: 'dias disponíveis',
      hoje: 'Hoje',
      amanha: 'Amanhã',
      carregando: 'Carregando horários disponíveis',
      diasAnteriores: 'Ver dias anteriores',
      maisDias: 'Ver mais dias',
      erroCarregar: 'Não foi possível carregar os horários disponíveis. Tente novamente em instantes.',
      semHorariosAntes: 'No momento não há horários disponíveis. Entre em contato pelo',
      semHorariosLink: `WhatsApp ${p.telefoneExibicao}`,
      semHorariosDepois: 'para verificar a agenda.',
    },
    formulario: {
      titulo: 'Seus dados',
      trocar: 'trocar',
      horaPrefixo: 'às',
      nomeRotulo: 'Nome completo',
      nomePlaceholder: 'Seu nome completo',
      telefoneRotulo: 'Telefone (WhatsApp)',
      telefonePlaceholder: '(54) 99999-9999',
      telefoneErro: 'Informe um celular com DDD, ex.: (54) 99999-9999.',
      emailRotulo: 'E-mail',
      emailPlaceholder: 'voce@email.com',
      privacidade: 'Usamos seus dados apenas para confirmar sua consulta. Não compartilhamos com terceiros.',
      consentimento:
        'Concordo em ser contatado(a) pela psicóloga por telefone, WhatsApp ou e-mail para confirmação do meu horário.',
      consentimentoErro: 'É necessário concordar em ser contatado(a) para enviar o pedido.',
      botaoEnviar: 'Enviar pedido de agendamento',
      botaoEnviando: 'Enviando...',
      erroHorarioOcupado: 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.',
      erroEnvio: 'Não foi possível enviar seu pedido agora. Tente novamente.',
    },
    sucesso: {
      titulo: 'Seu pedido foi enviado!',
      texto: 'A psicóloga vai confirmar em breve pelo telefone ou WhatsApp informado.',
      botao: 'Escolher outro horário',
    },
    placeholder: {
      titulo: 'Escolha um horário',
      texto: 'Selecione um dia e horário ao lado para preencher seus dados.',
    },
  },

  contato: {
    chamada: 'Contato',
    titulo: 'Onde e como encontrar o consultório',
    enderecoRotulo: 'Endereço',
    telefoneRotulo: 'Telefone / WhatsApp',
    horarioRotulo: 'Horário de atendimento',
    botaoWhatsapp: 'Conversar pelo WhatsApp',
    assinatura: `${p.nome} — ${p.titulo} — ${p.crp}`,
    mapaTitulo: 'Localização do consultório',
  },

  rodape: {
    assinatura: `${p.nome} — ${p.titulo} — ${p.crp}`,
    local: p.cidadeUF,
    acessoAdmin: 'Acesso administrativo',
  },

  admin: {
    subtituloMarca: 'Painel de agendamentos',
    loginSubtitulo: `Acesso restrito à psicóloga ${p.nome}.`,
  },
} as const;
