import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { HorarioDisponivel } from '../types';
import Reveal from './Reveal';
import { ChevronLeft, ChevronRight, MessageCircle, Calendar, CalendarDays, ArrowRight, CircleCheck, ShieldCheck } from './icons';
import { whatsappHref } from '../lib/whatsapp';
import { textos } from '../config/profissional';
import { hojeISO, somarDias } from '../lib/date';
import { mascaraDigitacaoTelefone, validarCelularBR } from '../../supabase/functions/_shared/whatsapp/telefone.ts';

const t = textos.agendamento;

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
      setErroCarregamento(t.calendario.erroCarregar);
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
      setErroEnvio(t.formulario.consentimentoErro);
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
          ? t.formulario.erroHorarioOcupado
          : t.formulario.erroEnvio
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
          <div className="section-eyebrow">{t.chamada}</div>
          <h2 className="section-heading">{t.titulo}</h2>
          <p className="section-subheading">{t.texto}</p>
        </Reveal>

        <Reveal>
          <div className="contact-choice">
            <p className="contact-choice__intro">{t.escolha.intro}</p>
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
                <span className="contact-choice__title">{t.escolha.whatsappTitulo}</span>
                <span className="contact-choice__desc">{t.escolha.whatsappTexto}</span>
                <ArrowRight className="contact-choice__arrow" size={18} strokeWidth={2} aria-hidden="true" />
              </a>

              <a href="#calendario-horarios" className="contact-choice__card">
                <span className="contact-choice__icon" aria-hidden="true">
                  <Calendar size={22} strokeWidth={2} />
                </span>
                <span className="contact-choice__title">{t.escolha.agendarTitulo}</span>
                <span className="contact-choice__desc">{t.escolha.agendarTexto}</span>
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
              <h3 className="scheduling__calendar-title">{t.calendario.titulo}</h3>
              {temDias && !carregando && (
                <span className="scheduling__calendar-hint">
                  {dias.length} {dias.length === 1 ? t.calendario.umDia : t.calendario.variosDias}
                </span>
              )}
            </div>

            {carregando && (
              <div className="scheduling__days" aria-busy="true" aria-label={t.calendario.carregando}>
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
                {t.calendario.semHorariosAntes}{' '}
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  {t.calendario.semHorariosLink}
                </a>{' '}
                {t.calendario.semHorariosDepois}
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
                    aria-label={t.calendario.diasAnteriores}
                  >
                    <ChevronLeft size={22} strokeWidth={3} />
                  </button>
                )}

                <div className="scheduling__days" ref={diasContainerRef}>
                  {dias.map((dia) => {
                    const temSelecionado = dia.horarios.some((h) => h.id === selecionado?.id);
                    const tag = dia.data === hoje ? t.calendario.hoje : dia.data === amanha ? t.calendario.amanha : null;
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
                    aria-label={t.calendario.maisDias}
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
                  <strong>{t.sucesso.titulo}</strong>
                  <p>{t.sucesso.texto}</p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={escolherOutro}>
                    {t.sucesso.botao}
                  </button>
                </div>
              ) : selecionado ? (
                <form className="booking-panel fade-in" onSubmit={enviarPedido} ref={formRef} key={selecionado.id}>
                  <h3 className="booking-panel__title">{t.formulario.titulo}</h3>

                  <div className="booking-panel__slot">
                    <span className="booking-panel__slot-icon" aria-hidden="true">
                      <CalendarDays size={20} strokeWidth={2} />
                    </span>
                    <span className="booking-panel__slot-text">
                      <strong>{formatarDataLonga(selecionado.data)}</strong>
                      <span>
                        {t.formulario.horaPrefixo} {formatarHora(selecionado.hora)}
                      </span>
                    </span>
                    <button type="button" className="link-btn" onClick={() => setSelecionado(null)}>
                      {t.formulario.trocar}
                    </button>
                  </div>

                  {erroEnvio && (
                    <div className="form-error" role="alert">
                      {erroEnvio}
                    </div>
                  )}

                  <div className="field">
                    <label htmlFor="nome">{t.formulario.nomeRotulo}</label>
                    <input
                      id="nome"
                      type="text"
                      required
                      autoComplete="name"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder={t.formulario.nomePlaceholder}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="telefone">{t.formulario.telefoneRotulo}</label>
                    <input
                      id="telefone"
                      type="tel"
                      inputMode="tel"
                      required
                      autoComplete="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(mascaraDigitacaoTelefone(e.target.value))}
                      onBlur={() => setTelefoneTocado(true)}
                      placeholder={t.formulario.telefonePlaceholder}
                      aria-invalid={telefoneInvalido || undefined}
                      aria-describedby={telefoneInvalido ? 'telefone-erro' : undefined}
                    />
                    {telefoneInvalido && (
                      <p className="field-error" id="telefone-erro">
                        {t.formulario.telefoneErro}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="email">{t.formulario.emailRotulo}</label>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.formulario.emailPlaceholder}
                    />
                  </div>

                  <div className="privacy-note">
                    <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
                    <span>{t.formulario.privacidade}</span>
                  </div>

                  <label className="field-checkbox">
                    <input
                      type="checkbox"
                      checked={consentimento}
                      onChange={(e) => setConsentimento(e.target.checked)}
                    />
                    {t.formulario.consentimento}
                  </label>

                  <button type="submit" className="btn btn-primary btn-block" disabled={enviando}>
                    {enviando ? t.formulario.botaoEnviando : t.formulario.botaoEnviar}
                  </button>
                </form>
              ) : (
                <div className="booking-placeholder">
                  <CalendarDays size={32} strokeWidth={1.6} aria-hidden="true" />
                  <strong>{t.placeholder.titulo}</strong>
                  {t.placeholder.texto}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
