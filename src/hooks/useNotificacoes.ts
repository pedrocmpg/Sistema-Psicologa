import { useCallback, useEffect, useRef, useState } from 'react';
import { carregarNotificacoes, MOTIVO_PROCESSANDO } from '../lib/notificacoes';
import type { Notificacao } from '../types';

const INTERVALO_MS = 3000;
const MAX_TENTATIVAS = 10;

/**
 * Notificações de WhatsApp para os selos dos cards. O envio é assíncrono (webhook + atraso de
 * 1–3 s), então logo depois de uma ação a linha ainda não existe ou está "processando":
 * `acompanhar()` recarrega algumas vezes até assentar.
 */
export function useNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const vivo = useRef(true);

  const recarregar = useCallback(async () => {
    try {
      const lista = await carregarNotificacoes();
      if (vivo.current) setNotificacoes(lista);
      return lista;
    } catch {
      return null; // sem selo é melhor que quebrar a lista de agendamentos
    }
  }, []);

  const acompanhar = useCallback(() => {
    window.clearTimeout(timer.current);
    let rodadas = 0;
    const passo = async () => {
      rodadas++;
      const lista = await recarregar();
      const emAndamento = lista?.some((n) => n.motivo === MOTIVO_PROCESSANDO);
      // As primeiras rodadas sempre rodam: a notificação pode nem ter sido criada ainda.
      if (vivo.current && rodadas < MAX_TENTATIVAS && (emAndamento || rodadas < 3)) {
        timer.current = window.setTimeout(passo, INTERVALO_MS);
      }
    };
    passo();
  }, [recarregar]);

  useEffect(() => {
    vivo.current = true;
    recarregar();
    return () => {
      vivo.current = false;
      window.clearTimeout(timer.current);
    };
  }, [recarregar]);

  return { notificacoes, recarregar, acompanhar };
}
