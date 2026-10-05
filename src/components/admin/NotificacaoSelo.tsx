import { useState } from 'react';
import { MessageCircle, RotateCw } from '../icons';
import { instanteCurto } from '../../../supabase/functions/_shared/whatsapp/datas.ts';
import {
  descreverMotivo,
  linkEnvioManual,
  MOTIVO_PROCESSANDO,
  notificacaoDe,
  podeReenviar,
  reenviarNotificacao,
} from '../../lib/notificacoes';
import type { Agendamento, ConfigWhatsApp, Notificacao } from '../../types';

interface NotificacaoSeloProps {
  agendamento: Agendamento;
  /** Todas as linhas da lista (para montar a mensagem de série no envio manual). */
  lista: Agendamento[];
  notificacoes: Notificacao[];
  config: ConfigWhatsApp | null;
  /** Chamado depois de um reenvio, para a lista acompanhar o novo status. */
  onReenviado: () => void;
}

const SELO = {
  enviado: { simbolo: '✓', rotulo: 'WhatsApp enviado' },
  falhou: { simbolo: '⚠', rotulo: 'WhatsApp falhou' },
  ignorado: { simbolo: '–', rotulo: 'WhatsApp não enviado' },
  pendente: { simbolo: '…', rotulo: 'WhatsApp pendente' },
} as const;

function dica(n: Notificacao): string {
  const partes = [descreverMotivo(n.motivo)];
  if (n.status === 'enviado' && n.enviado_em) partes.push(`Enviado em ${instanteCurto(n.enviado_em)}`);
  if (n.tentativas > 1) partes.push(`${n.tentativas} tentativas`);
  return partes.filter(Boolean).join(' · ');
}

/** Status da mensagem automática + Reenviar + Enviar manualmente (plano B pelo wa.me). */
export default function NotificacaoSelo({ agendamento, lista, notificacoes, config, onReenviado }: NotificacaoSeloProps) {
  const [reenviando, setReenviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const n = notificacaoDe(notificacoes, agendamento);
  const link = linkEnvioManual(agendamento, lista, config);
  if (!n && !link) return null;

  async function reenviar() {
    if (!n) return;
    setErro(null);
    setReenviando(true);
    try {
      const r = await reenviarNotificacao(n.id);
      if (r.status === 'falhou') setErro('Não foi desta vez. Use "Enviar manualmente".');
    } catch {
      setErro('Serviço de WhatsApp indisponível. Use "Enviar manualmente".');
    }
    setReenviando(false);
    onReenviado();
  }

  const emAndamento = n?.motivo === MOTIVO_PROCESSANDO || reenviando;
  const selo = n ? SELO[n.status] : null;
  const textoDica = n ? dica(n) : '';

  return (
    <div className="notif">
      {n && selo && (
        <span
          className={`notif__selo notif__selo--${n.status}`}
          title={textoDica || selo.rotulo}
          aria-label={textoDica ? `${selo.rotulo}: ${textoDica}` : selo.rotulo}
        >
          <span aria-hidden="true">{emAndamento ? '…' : selo.simbolo}</span>
          {emAndamento ? 'Enviando WhatsApp' : selo.rotulo}
        </span>
      )}

      {podeReenviar(n) && !reenviando && (
        <button type="button" className="notif__acao" onClick={reenviar}>
          <RotateCw size={13} strokeWidth={2.2} aria-hidden="true" /> Reenviar
        </button>
      )}

      {link && (
        <a className="notif__acao" href={link} target="_blank" rel="noopener noreferrer" title="Abre o seu WhatsApp com a mensagem pronta">
          <MessageCircle size={13} strokeWidth={2.2} aria-hidden="true" /> Enviar manualmente
        </a>
      )}

      {erro && (
        <span className="notif__erro" role="alert">
          {erro}
        </span>
      )}
    </div>
  );
}
