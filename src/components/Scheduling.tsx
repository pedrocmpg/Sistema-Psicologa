import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { HorarioDisponivel } from '../types';
import Reveal from './Reveal';
import { ChevronLeft, ChevronRight, MessageCircle, Calendar } from './icons';
import { whatsappHref } from '../lib/whatsapp';

function formatarHora(hora: string) {
  return hora.slice(0, 5);
}

function formatarDiaSemana(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d).replace('.', '');
}

function formatarDataCurta(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d).replace('.', '');
}

interface DiaAgrupado {
  data: string;
  horarios: HorarioDisponivel[];
}

export default function Scheduling() {
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [selecionado, setSelecionado] = useState<HorarioDisponivel | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [consentimento, setConsentimento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const diasContainerRef = useRef<HTMLDivElement>(null);
  // Começam visíveis por padrão (otimista) — é corrigido assim que dá pra medir o container.
  // Prefere mostrar a mais a esconder: se a medição falhar por algum motivo, a seta continua
  // visível (clicar nela sem ter pra onde rolar não faz mal nenhum) em vez de sumir de vez.
  const [podeRolarEsquerda, setPodeRolarEsquerda] = useState(true);
  const [podeRolarDireita, setPodeRolarDireita] = useState(true);

  async function carregarHorarios() {
    setCarregando(true);
    setErroCarregamento(null);
    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(
      hoje.getDate()
    ).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('horarios_disponiveis')
      .select('*')
      .eq('status', 'disponivel')
      .gte('data', hojeStr)
      .order('data', { ascending: true })
      .order('hora', { ascending: true });

    if (error) {
      setErroCarregamento('Não foi possível carregar os horários disponíveis. Tente novamente em instantes.');
    } else {
      setHorarios(data ?? []);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregarHorarios();
  }, []);

  const dias: DiaAgrupado[] = [];
  for (const h of horarios) {
    const grupo = dias.find((d) => d.data === h.data);
    if (grupo) {
      grupo.horarios.push(h);
    } else {
      dias.push({ data: h.data, horarios: [h] });
    }
  }

  function atualizarSetas() {
    const el = diasContainerRef.current;
    if (!el) return;
    setPodeRolarEsquerda(el.scrollLeft > 4);
    setPodeRolarDireita(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  useEffect(() => {
    // requestAnimationFrame garante que o layout já assentou antes de medir scrollWidth/clientWidth
    const id = requestAnimationFrame(atualizarSetas);
    window.addEventListener('resize', atualizarSetas);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', atualizarSetas);
    };
  }, [dias.length]);

  function rolar(direcao: 1 | -1) {
    diasContainerRef.current?.scrollBy({ left: direcao * 280, behavior: 'smooth' });
  }

  function selecionarSlot(h: HorarioDisponivel) {
    setSelecionado(h);
    setErroEnvio(null);
    setSucesso(false);
  }

  async function enviarPedido(e: FormEvent) {
    e.preventDefault();
    if (!selecionado) return;
    if (!consentimento) {
      setErroEnvio('É necessário concordar em ser contatado(a) para enviar o pedido.');
      return;
    }

    setEnviando(true);
    setErroEnvio(null);

    const { error } = await supabase.rpc('solicitar_agendamento', {
      p_horario_id: selecionado.id,
      p_nome_paciente: nome,
      p_telefone: telefone,
      p_email: email,
    });

    setEnviando(false);

    if (error) {
      setErroEnvio(
        error.message.includes('não está mais disponível')
          ? 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.'
          : 'Não foi possível enviar seu pedido agora. Tente novamente.'
      );
      carregarHorarios();
      setSelecionado(null);
      return;
    }

    setHorarios((prev) => prev.filter((h) => h.id !== selecionado.id));
    setSucesso(true);
    setNome('');
    setTelefone('');
    setEmail('');
    setConsentimento(false);
  }

  return (
    <section id="agendamento" className="section scheduling">
      <div className="container">
        <Reveal>
          <div className="section-eyebrow">Agendamento online</div>
          <h2 className="section-heading">Escolha um horário disponível</h2>
          <p className="section-subheading">
            Selecione um dia e horário livre na agenda. Seu pedido será enviado para análise — a
            confirmação é feita pela psicóloga pelo telefone ou WhatsApp informado.
          </p>
        </Reveal>

        <Reveal>
          <div className="contact-choice">
            <p className="contact-choice__intro">
              Prefere conversar antes? Me chame no WhatsApp. Já sabe o que precisa? Agende direto
              abaixo.
            </p>
            <div className="contact-choice__options">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-choice__card"
              >
                <span className="contact-choice__icon" aria-hidden="true">
                  <MessageCircle size={22} strokeWidth={2} />
                </span>
                <span className="contact-choice__title">Falar direto comigo</span>
                <span className="contact-choice__desc">Tire dúvidas ou combine os detalhes pelo WhatsApp.</span>
              </a>

              <a href="#calendario-horarios" className="contact-choice__card">
                <span className="contact-choice__icon" aria-hidden="true">
                  <Calendar size={22} strokeWidth={2} />
                </span>
                <span className="contact-choice__title">Agendar meu horário</span>
                <span className="contact-choice__desc">Veja os horários livres e escolha o seu, agora mesmo.</span>
              </a>
            </div>
          </div>
        </Reveal>

        <div className="scheduling__layout" id="calendario-horarios">
          <Reveal>
            {carregando && <p className="scheduling__loading">Carregando horários disponíveis...</p>}

            {!carregando && erroCarregamento && <div className="alert alert-error">{erroCarregamento}</div>}

            {!carregando && !erroCarregamento && dias.length === 0 && (
              <div className="scheduling__empty">
                No momento não há horários disponíveis. Entre em contato pelo WhatsApp (54) 99712-2959
                para verificar a agenda.
              </div>
            )}

            {!carregando && dias.length > 0 && (
              <div className="scheduling__days-wrapper">
                <button
                  type="button"
                  className="scheduling__scroll-btn scheduling__scroll-btn--left"
                  onClick={() => rolar(-1)}
                  disabled={!podeRolarEsquerda}
                  aria-label="Ver dias anteriores"
                >
                  <ChevronLeft size={20} strokeWidth={2.5} />
                </button>

                <div className="scheduling__days" ref={diasContainerRef} onScroll={atualizarSetas}>
                  {dias.map((dia) => (
                    <div className="day-card" key={dia.data}>
                      <div className="day-card__date">{formatarDataCurta(dia.data)}</div>
                      <div className="day-card__weekday">{formatarDiaSemana(dia.data)}</div>
                      <div className="day-card__slots">
                        {dia.horarios.map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            className={`slot-btn ${selecionado?.id === h.id ? 'is-selected' : ''}`}
                            onClick={() => selecionarSlot(h)}
                          >
                            {formatarHora(h.hora)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="scheduling__scroll-btn scheduling__scroll-btn--right"
                  onClick={() => rolar(1)}
                  disabled={!podeRolarDireita}
                  aria-label="Ver mais dias"
                >
                  <ChevronRight size={20} strokeWidth={2.5} />
                </button>
              </div>
            )}
          </Reveal>

          {selecionado && !sucesso && (
            <Reveal>
              <form className="booking-panel" onSubmit={enviarPedido}>
                <div className="booking-panel__slot">
                  <span>
                    {formatarDataCurta(selecionado.data)} ({formatarDiaSemana(selecionado.data)}) às{' '}
                    {formatarHora(selecionado.hora)}
                  </span>
                  <button type="button" onClick={() => setSelecionado(null)}>
                    trocar
                  </button>
                </div>

                {erroEnvio && <div className="form-error">{erroEnvio}</div>}

                <div className="field">
                  <label htmlFor="nome">Nome completo</label>
                  <input
                    id="nome"
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="field">
                  <label htmlFor="telefone">Telefone (WhatsApp)</label>
                  <input
                    id="telefone"
                    type="tel"
                    required
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(54) 99999-9999"
                  />
                </div>

                <div className="field">
                  <label htmlFor="email">E-mail</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                  />
                </div>

                <div className="privacy-note">
                  Usamos seus dados apenas para confirmar sua consulta. Não compartilhamos com
                  terceiros.
                </div>

                <label className="field-checkbox">
                  <input
                    type="checkbox"
                    checked={consentimento}
                    onChange={(e) => setConsentimento(e.target.checked)}
                  />
                  Concordo em ser contatado(a) pela psicóloga pelos dados informados acima.
                </label>

                <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
                  {enviando ? 'Enviando...' : 'Enviar pedido de agendamento'}
                </button>
              </form>
            </Reveal>
          )}

          {sucesso && (
            <Reveal>
              <div className="form-success">
                <strong>Seu pedido foi enviado!</strong>
                A psicóloga vai confirmar em breve pelo telefone ou WhatsApp informado.
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
