import { useCallback, useEffect, useState } from 'react';
import { consultarSaude, type SaudeWhatsApp } from '../lib/notificacoes';

const INTERVALO_MS = 5 * 60_000;

/** Conexão do provedor (health da Edge Function whatsapp-admin), conferida a cada 5 minutos. */
export function useStatusWhatsApp(ativo: boolean) {
  const [saude, setSaude] = useState<SaudeWhatsApp | null>(null);
  const [erro, setErro] = useState(false);
  const [verificando, setVerificando] = useState(false);

  const verificar = useCallback(async () => {
    setVerificando(true);
    try {
      setSaude(await consultarSaude());
      setErro(false);
    } catch {
      setSaude(null);
      setErro(true);
    }
    setVerificando(false);
  }, []);

  useEffect(() => {
    if (!ativo) return;
    verificar();
    const id = window.setInterval(verificar, INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [ativo, verificar]);

  return { saude, erro, verificando, verificar };
}
