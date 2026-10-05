import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ConfigWhatsApp } from '../types';

/** Linha única de configuracoes_whatsapp (só a psicóloga logada lê/escreve, via RLS). */
export function useConfigWhatsApp(ativo: boolean) {
  const [config, setConfig] = useState<ConfigWhatsApp | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    const { data } = await supabase
      .from('configuracoes_whatsapp')
      .select('ativo, nome_profissional, telefone_contato, endereco, templates')
      .maybeSingle();
    setConfig((data as ConfigWhatsApp | null) ?? null);
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (ativo) recarregar();
  }, [ativo, recarregar]);

  const salvar = useCallback(async (mudancas: Partial<ConfigWhatsApp>) => {
    const { data, error } = await supabase
      .from('configuracoes_whatsapp')
      .upsert({ id: true, ...mudancas })
      .select('ativo, nome_profissional, telefone_contato, endereco, templates')
      .single();
    if (error) throw error;
    setConfig(data as ConfigWhatsApp);
  }, []);

  return { config, carregando, recarregar, salvar };
}
