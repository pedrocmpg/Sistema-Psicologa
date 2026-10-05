import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { HorarioDisponivel } from '../types';
import Reveal from './Reveal';
import { ChevronLeft, ChevronRight, MessageCircle, Calendar, CalendarDays, ArrowRight, CircleCheck, ShieldCheck } from './icons';
import { whatsappHref } from '../lib/whatsapp';
import { profissional } from '../config/profissional';
import { hojeISO, somarDias } from '../lib/date';
import { mascaraDigitacaoTelefone, validarCelularBR } from '../../supabase/functions/_shared/whatsapp/telefone.ts';

const ERRO_TELEFONE = 'Informe um celular com DDD, ex.: (54) 99999-9999.';

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

function formatarDataLonga(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(d);
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
  const [telefoneTocado, setTelefoneTocado] = useState(false);
  const [email, setEmail] = useState('');
  const [consentimento, setConsentimento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const [podeVoltar, setPodeVoltar] = useState(false);
  const [podeAvancar, setPodeAvancar] = useState(false);

  const diasContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function carregarHorarios() {
    setCarregando(true);
    setErroCarregamento(null);

    const { data, error } = await supabase
      .from('horarios_disponiveis')
      .select('*')
      .eq('status', 'disponivel')
      .gte('data', hojeISO())
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

  const atualizarSetas = useCallback(() => {
    const el = diasContainerRef.current;
    if (!el) return;
    setPodeVoltar(el.scrollLeft > 4);
    setPodeAvancar(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const temDias = dias.length > 0;

  useEffect(() => {
    const el = diasContainerRef.current;
    if (!el) return;
    atualizarSetas();
    el.addEventListener('scroll', atualizarSetas, { passive: true });
    const observer = new ResizeObserver(atualizarSetas);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', atualizarSetas);
      observer.disconnect();
    };
  }, [temDias, carregando, atualizarSetas]);

  // No celular/tablet o formulário aparece abaixo do carrossel: leva a pessoa até ele.
  useEffect(() => {
    if (!selecionado) return;
    if (window.matchMedia('(max-width: 1023px)').matches) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selecionado]);

  function rolar(direcao: 1 | -1) {
    const el = diasContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: direcao * Math.max(el.clientWidth * 0.8, 200), behavior: 'smooth' });
  }

  function selecionarSlot(h: HorarioDisponivel) {
    setSelecionado(h);
    setErroEnvio(null);
    setSucesso(false);
  }

  function escolherOutro() {
    setSucesso(false);
    setSelecionado(null);
    document.getElementById('calendario-horarios')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function enviarPedido(e: FormEvent) {
    e.preventDefault();
    if (!selecionado) return;
    if (!validarCelularBR(telefone)) {
      // O erro aparece embaixo do próprio campo (aria-describedby); aqui só leva o foco até ele.
      setTelefoneTocado(true);
      setErroEnvio(null);
      document.getElementById('telefone')?.focus();
      return;
    }
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
    setTelefoneTocado(false);
    setEmail('');
    setConsentimento(false);
  }

  const hoje = hojeISO();
  const amanha = somarDias(hoje, 1);
  const telefoneInvalido = telefoneTocado && telefone.length > 0 && !validarCelularBR(telefone);

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
                <ArrowRight className="contact-choice__arrow" size={18} strokeWidth={2} aria-hidden="true" />
              </a>

              <a href="#calendario-horarios" className="contact-choice__card">
                <span className="contact-choice__icon" aria-hidden="true">
                  <Calendar size={22} strokeWidth={2} />
                </span>
                <span className="contact-choice__title">Agendar meu horário</span>
                <span className="contact-choice__desc">Veja os horários livres e escolha o seu, agora mesmo.</span>
                <ArrowRight className="contact-choice__arrow" size={18} strokeWidth={2} aria-hidden="true" />
              </a>
            </div>
          </div>
        </Reveal>

        <div
          className={`scheduling__layout ${temDias || sucesso ? 'scheduling__layout--split' : ''}`}
          id="calendario-horarios"
        >
          <div>
            <div className="scheduling__calendar-head">
              <h3 className="scheduling__calendar-title">Horários livres</h3>
              {temDias && !carregando && (
                <span className="scheduling__calendar-hint">
                  {dias.length} {dias.length === 1 ? 'dia disponível' : 'dias disponíveis'}
                </span>
              )}
            </div>

            {carregando && (
              <div className="scheduling__days" aria-busy="true" aria-label="Carregando horários disponíveis">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div className="day-card day-card--skeleton" key={i}>
                    <span className="skeleton" />
                    <span className="skeleton" />
                    <span className="skeleton" />
                  </div>
                ))}
              </div>
            )}

            {!carregando && erroCarregamento && <div className="alert alert-error">{erroCarregamento}</div>}

            {!carregando && !erroCarregamento && !temDias && (
              <div className="scheduling__empty">
                No momento não há horários disponíveis. Entre em contato pelo{' '}
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  WhatsApp {profissional.telefoneExibicao}
                </a>{' '}
                para verificar a agenda.
              </div>
            )}

            {!carregando && temDias && (
              <div
                className={`scheduling__days-wrapper ${podeVoltar ? 'can-left' : ''} ${podeAvancar ? 'can-right' : ''}`}
              >
                {(podeVoltar || podeAvancar) && (
                  <button
                    type="button"
                    className="scheduling__scroll-btn scheduling__scroll-btn--left"
                    onClick={() => rolar(-1)}
                    disabled={!podeVoltar}
                    aria-label="Ver dias anteriores"
                  >
                    <ChevronLeft size={22} strokeWidth={3} />
                  </button>
                )}

                <div className="scheduling__days" ref={diasContainerRef}>
                  {dias.map((dia) => {
                    const temSelecionado = dia.horarios.some((h) => h.id === selecionado?.id);
                    const tag = dia.data === hoje ? 'Hoje' : dia.data === amanha ? 'Amanhã' : null;
                    return (
                      <div
                        className={`day-card ${temSelecionado ? 'has-selected' : ''}`}
                        key={dia.data}
                        role="group"
                        aria-label={formatarDataLonga(dia.data)}
                      >
                        <div className="day-card__head">
                          <div>
                            <div className="day-card__date">{formatarDataCurta(dia.data)}</div>
                            <div className="day-card__weekday">{formatarDiaSemana(dia.data)}</div>
                          </div>
                          {tag && <span className="day-card__tag">{tag}</span>}
                        </div>
                        <div className="day-card__slots">
                          {dia.horarios.map((h) => (
                            <button
                              key={h.id}
                              type="button"
                              className={`slot-btn ${selecionado?.id === h.id ? 'is-selected' : ''}`}
                              aria-pressed={selecionado?.id === h.id}
                              onClick={() => selecionarSlot(h)}
                            >
                              {formatarHora(h.hora)}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(podeVoltar || podeAvancar) && (
                  <button
                    type="button"
                    className="scheduling__scroll-btn scheduling__scroll-btn--right"
                    onClick={() => rolar(1)}
                    disabled={!podeAvancar}
                    aria-label="Ver mais dias"
                  >
                    <ChevronRight size={22} strokeWidth={3} />
                  </button>
                )}
              </div>
            )}
          </div>

          {(temDias || sucesso) && (
            <div className="scheduling__aside">
              {sucesso ? (
                <div className="form-success fade-in" role="status">
                  <div className="form-success__icon" aria-hidden="true">
                    <CircleCheck size={28} strokeWidth={2} />
                  </div>
                  <strong>Seu pedido foi enviado!</strong>
                  <p>A psicóloga vai confirmar em breve pelo telefone ou WhatsApp informado.</p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={escolherOutro}>
                    Escolher outro horário
                  </button>
                </div>
              ) : selecionado ? (
                <form className="booking-panel fade-in" onSubmit={enviarPedido} ref={formRef} key={selecionado.id}>
                  <h3 className="booking-panel__title">Seus dados</h3>

                  <div className="booking-panel__slot">
                    <span className="booking-panel__slot-icon" aria-hidden="true">
                      <CalendarDays size={20} strokeWidth={2} />
                    </span>
                    <span className="booking-panel__slot-text">
                      <strong>{formatarDataLonga(selecionado.data)}</strong>
                      <span>às {formatarHora(selecionado.hora)}</span>
                    </span>
                    <button type="button" className="link-btn" onClick={() => setSelecionado(null)}>
                      trocar
                    </button>
                  </div>

                  {erroEnvio && (
                    <div className="form-error" role="alert">
                      {erroEnvio}
                    </div>
                  )}

                  <div className="field">
                    <label htmlFor="nome">Nome completo</label>
                    <input
                      id="nome"
                      type="text"
                      required
                      autoComplete="name"
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
                      inputMode="tel"
                      required
                      autoComplete="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(mascaraDigitacaoTelefone(e.target.value))}
                      onBlur={() => setTelefoneTocado(true)}
                      placeholder="(54) 99999-9999"
                      aria-invalid={telefoneInvalido || undefined}
                      aria-describedby={telefoneInvalido ? 'telefone-erro' : undefined}
                    />
                    {telefoneInvalido && (
                      <p className="field-error" id="telefone-erro">
                        {ERRO_TELEFONE}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="email">E-mail</label>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@email.com"
                    />
                  </div>

                  <div className="privacy-note">
                    <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
                    <span>
                      Usamos seus dados apenas para confirmar sua consulta. Não compartilhamos com
                      terceiros.
                    </span>
                  </div>

                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={consentimento}
                      onChange={(e) => setConsentimento(e.target.checked)}
                    />
                    Concordo em ser contatado(a) pela psicóloga por telefone, WhatsApp ou e-mail para confirmação do
                    meu horário.
                  </label>

                  <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
                    {enviando ? 'Enviando...' : 'Enviar pedido de agendamento'}
                  </button>
                </form>
              ) : (
                <div className="booking-placeholder">
                  <CalendarDays size={32} strokeWidth={1.6} aria-hidden="true" />
                  <strong>Escolha um horário</strong>
                  Selecione um dia e horário ao lado para preencher seus dados.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
