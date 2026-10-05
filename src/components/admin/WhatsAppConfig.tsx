import { useEffect, useState, type FormEvent } from 'react';
import { RotateCcw, Send, TriangleAlert, Wifi, WifiOff } from '../icons';
import type { ConfigWhatsApp, EventoNotificacao } from '../../types';
import type { useConfigWhatsApp } from '../../hooks/useConfigWhatsApp';
import type { useStatusWhatsApp } from '../../hooks/useStatusWhatsApp';
import { configComPadroes, descreverMotivo, enviarMensagemTeste } from '../../lib/notificacoes';
import { hojeISO, somarDias } from '../../lib/date';
import {
  EVENTOS,
  montarMensagem,
  PLACEHOLDERS,
  ROTULO_EVENTO,
  TEMPLATES_PADRAO,
  type Templates,
  templatesEfetivos,
  termosClinicos,
} from '../../../supabase/functions/_shared/whatsapp/templates.ts';
import {
  apenasDigitos,
  formatarTelefoneExibicao,
  mascaraDigitacaoTelefone,
} from '../../../supabase/functions/_shared/whatsapp/telefone.ts';

interface WhatsAppConfigProps {
  whatsapp: ReturnType<typeof useConfigWhatsApp>;
  status: ReturnType<typeof useStatusWhatsApp>;
}

interface Formulario {
  ativo: boolean;
  nome: string;
  telefone: string;
  endereco: string;
  templates: Templates;
}

function formularioDe(config: ConfigWhatsApp | null): Formulario {
  const c = configComPadroes(config);
  return {
    ativo: c.ativo,
    nome: c.nome_profissional ?? '',
    telefone: formatarTelefoneExibicao(c.telefone_contato ?? ''),
    endereco: c.endereco ?? '',
    templates: templatesEfetivos(c.templates),
  };
}

/** Erros do provedor podem ser enormes; o texto completo fica no hover. */
function resumir(texto: string, limite = 70): string {
  return texto.length > limite ? `${texto.slice(0, limite)}…` : texto;
}

/** Placeholders usados no texto que não existem (erro de digitação aparece antes de salvar). */
function placeholdersDesconhecidos(texto: string): string[] {
  const validos = new Set(PLACEHOLDERS.map((p) => p.chave));
  return [...new Set(texto.match(/\{\w+\}/g) ?? [])].filter((p) => !validos.has(p));
}

export default function WhatsAppConfig({ whatsapp, status }: WhatsAppConfigProps) {
  const { config, carregando, salvar } = whatsapp;
  const [form, setForm] = useState<Formulario>(() => formularioDe(config));
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [testando, setTestando] = useState(false);

  // Quando a configuração chega do banco (ou muda depois de salvar), o formulário acompanha.
  useEffect(() => {
    if (!alterado) setForm(formularioDe(config));
  }, [config, alterado]);

  function mudar(mudancas: Partial<Formulario>) {
    setForm((f) => ({ ...f, ...mudancas }));
    setAlterado(true);
    setAviso(null);
  }

  function mudarTemplate(evento: EventoNotificacao, texto: string) {
    mudar({ templates: { ...form.templates, [evento]: texto } });
  }

  const exemplo = {
    nomePaciente: 'Paciente Teste',
    profissional: form.nome || 'Seu nome',
    telefoneContato: form.telefone,
    endereco: form.endereco,
    data: somarDias(hojeISO(), 7),
    hora: '14:00',
    semanas: 8,
  };

  const problemasClinicos = [
    ...termosClinicos(form.nome),
    ...termosClinicos(form.endereco),
    ...EVENTOS.flatMap((e) => termosClinicos(form.templates[e])),
  ];

  async function aoSalvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    const telefoneDigitos = apenasDigitos(form.telefone);
    if (form.ativo && (!form.nome.trim() || telefoneDigitos.length < 10)) {
      setErro('Para ativar, preencha seu nome e o telefone de contato (com DDD).');
      return;
    }
    if (problemasClinicos.length > 0) {
      setErro(`Remova os termos clínicos antes de salvar: ${[...new Set(problemasClinicos)].join(', ')}.`);
      return;
    }

    // Só guarda os modelos editados; o resto continua usando o texto padrão do sistema.
    const templates: Partial<Templates> = {};
    for (const evento of EVENTOS) {
      const texto = form.templates[evento].trim();
      if (texto && texto !== TEMPLATES_PADRAO[evento]) templates[evento] = texto;
    }

    setSalvando(true);
    try {
      await salvar({
        ativo: form.ativo,
        nome_profissional: form.nome.trim(),
        telefone_contato: form.telefone.trim(),
        endereco: form.endereco.trim(),
        templates,
      });
      setAlterado(false);
      setAviso('Configurações salvas.');
    } catch {
      setErro('Não foi possível salvar. Tente novamente.');
    }
    setSalvando(false);
  }

  async function aoTestar() {
    setErro(null);
    setAviso(null);
    setTestando(true);
    try {
      const r = await enviarMensagemTeste();
      if (r.ok) {
        setAviso(
          r.dryRun
            ? 'Teste registrado em modo dry-run: nada foi enviado de verdade.'
            : `Mensagem de teste enviada para ${form.telefone}. Confira no seu WhatsApp.`
        );
      } else {
        setErro(`O teste não foi enviado: ${descreverMotivo(r.motivo ?? null) || 'erro desconhecido'}.`);
      }
    } catch {
      setErro('O serviço de WhatsApp não respondeu. Verifique se a Edge Function está publicada.');
    }
    setTestando(false);
  }

  const { saude, erro: erroSaude, verificando, verificar } = status;

  return (
    <div className="admin-panel whatsapp-config">
      <h2>Configurações › WhatsApp</h2>
      <p className="admin-panel__hint">
        Mensagem automática para o paciente quando um horário é confirmado, recusado ou cancelado. Só
        mensagens ligadas a uma ação sua; o sistema não responde mensagens.
      </p>

      <div className="alert alert-warning whatsapp-config__aviso" role="note">
        <TriangleAlert size={18} strokeWidth={2} aria-hidden="true" />
        <span>
          Use um número <strong>DEDICADO</strong> à automação. Não use o número pessoal/principal. Se o
          WhatsApp bloquear o número, o atendimento não é afetado.
        </span>
      </div>

      <section className="whatsapp-config__conexao" aria-live="polite">
        <div className="whatsapp-config__conexao-info">
          {saude ? (
            <span className={`status-pill ${saude.conectado ? 'status-pill--ok' : 'status-pill--erro'}`}>
              {saude.conectado ? (
                <Wifi size={14} strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <WifiOff size={14} strokeWidth={2.2} aria-hidden="true" />
              )}
              {saude.conectado ? 'Conectado' : 'Desconectado'}
            </span>
          ) : (
            <span className="status-pill">{erroSaude ? 'Serviço indisponível' : 'Verificando…'}</span>
          )}
          <span className="whatsapp-config__provedor" title={saude?.estado}>
            {saude && `Provedor: ${saude.provider}`}
            {saude && !saude.conectado && saude.estado && ` (${resumir(saude.estado)})`}
            {saude?.dryRun && ' · modo de teste (dry-run): nada é enviado'}
            {saude?.provider === 'mock' && !saude.dryRun && ' · simulação: nada é enviado'}
            {erroSaude && 'A Edge Function whatsapp-admin não respondeu.'}
          </span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={verificar} disabled={verificando}>
          {verificando ? 'Verificando…' : 'Verificar conexão'}
        </button>
      </section>

      {carregando ? null : (
        <form onSubmit={aoSalvar} className="whatsapp-config__form">
          {erro && <div className="alert alert-error">{erro}</div>}
          {aviso && <div className="alert alert-success">{aviso}</div>}

          <label className="field-checkbox whatsapp-config__ativo">
            <input type="checkbox" checked={form.ativo} onChange={(e) => mudar({ ativo: e.target.checked })} />
            <span>
              <strong>Envio automático {form.ativo ? 'ativado' : 'desativado'}</strong>
              <br />
              Quando desativado, nada é enviado (os eventos ficam registrados como "não enviado").
            </span>
          </label>

          <div className="batch-form__row">
            <div className="field">
              <label htmlFor="wa-nome">Seu nome (como aparece na mensagem)</label>
              <input id="wa-nome" type="text" value={form.nome} onChange={(e) => mudar({ nome: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="wa-telefone">Telefone de contato (seu número principal)</label>
              <input
                id="wa-telefone"
                type="tel"
                inputMode="tel"
                value={form.telefone}
                onChange={(e) => mudar({ telefone: mascaraDigitacaoTelefone(e.target.value) })}
                placeholder="(54) 99999-9999"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="wa-endereco">Endereço (opcional — vai na mensagem de confirmação)</label>
            <input
              id="wa-endereco"
              type="text"
              value={form.endereco}
              onChange={(e) => mudar({ endereco: e.target.value })}
              placeholder="Deixe vazio para não incluir"
            />
          </div>

          <h3 className="whatsapp-config__subtitulo">Modelos das mensagens</h3>
          <p className="admin-panel__hint">
            Nunca use termos clínicos (terapia, sessão, diagnóstico...): a mensagem pode ser vista por outras
            pessoas no celular do paciente. Prefira "horário" ou "atendimento".
          </p>
          <ul className="whatsapp-config__placeholders">
            {PLACEHOLDERS.map((p) => (
              <li key={p.chave}>
                <code>{p.chave}</code> {p.descricao}
                {p.serie && ' (séries)'}
              </li>
            ))}
          </ul>

          {EVENTOS.map((evento) => {
            const texto = form.templates[evento];
            const clinicos = termosClinicos(texto);
            const desconhecidos = placeholdersDesconhecidos(texto);
            return (
              <div className="template-editor" key={evento}>
                <div className="template-editor__head">
                  <label htmlFor={`tpl-${evento}`}>{ROTULO_EVENTO[evento]}</label>
                  {texto !== TEMPLATES_PADRAO[evento] && (
                    <button
                      type="button"
                      className="notif__acao"
                      onClick={() => mudarTemplate(evento, TEMPLATES_PADRAO[evento])}
                    >
                      <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" /> Restaurar padrão
                    </button>
                  )}
                </div>
                <div className="field template-editor__field">
                  <textarea
                    id={`tpl-${evento}`}
                    rows={3}
                    value={texto}
                    onChange={(e) => mudarTemplate(evento, e.target.value)}
                  />
                </div>
                {clinicos.length > 0 && (
                  <p className="template-editor__erro">Termo clínico não permitido: {clinicos.join(', ')}</p>
                )}
                {desconhecidos.length > 0 && (
                  <p className="template-editor__erro">Campo desconhecido: {desconhecidos.join(', ')}</p>
                )}
                <p className="template-editor__preview" aria-label="Pré-visualização">
                  {montarMensagem(evento, form.templates, exemplo)}
                </p>
              </div>
            );
          })}

          <div className="whatsapp-config__acoes">
            <button type="submit" className="btn btn-primary" disabled={salvando || !alterado}>
              {salvando ? 'Salvando...' : 'Salvar configurações'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={aoTestar}
              disabled={testando || alterado}
              title={alterado ? 'Salve antes de testar' : 'Envia para o seu telefone de contato'}
            >
              <Send size={16} strokeWidth={2} aria-hidden="true" />
              {testando ? 'Enviando...' : 'Enviar mensagem de teste'}
            </button>
          </div>
          <p className="batch-form__field-hint">
            O teste vai para o seu telefone de contato, a partir do número da automação.
            {alterado && ' Salve antes de testar.'}
          </p>
        </form>
      )}
    </div>
  );
}
