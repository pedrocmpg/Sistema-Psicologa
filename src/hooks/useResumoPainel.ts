import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { hojeISO, somarDias } from '../lib/date';

export interface NumerosResumo {
  confirmadasHoje: number;
  pendentes: number;
  confirmadasProximos7Dias: number;
}

/** Números do resumo do painel. Recarrega sempre que `refreshTick` muda (só com sessão ativa). */
export function useResumoPainel(refreshTick: number, ativo: boolean) {
  const [numeros, setNumeros] = useState<NumerosResumo | null>(null);

  useEffect(() => {
    if (!ativo) return;
    let cancelado = false;

    async function carregar() {
      const hoje = hojeISO();
      const limite = somarDias(hoje, 7);

      const [{ data: pendentesRows }, { data: confirmadosRows }] = await Promise.all([
        supabase.from('agendamentos').select('id').eq('status', 'pendente'),
        supabase
          .from('agendamentos')
          .select('id, horarios_disponiveis(data)')
          .eq('status', 'confirmado'),
      ]);

      const confirmados = (confirmadosRows ?? []) as unknown as { horarios_disponiveis: { data: string } | null }[];

      if (cancelado) return;
      setNumeros({
        pendentes: pendentesRows?.length ?? 0,
        confirmadasHoje: confirmados.filter((a) => a.horarios_disponiveis?.data === hoje).length,
        confirmadasProximos7Dias: confirmados.filter(
          (a) =>
            !!a.horarios_disponiveis &&
            a.horarios_disponiveis.data >= hoje &&
            a.horarios_disponiveis.data <= limite
        ).length,
      });
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [refreshTick, ativo]);

  return numeros;
}
