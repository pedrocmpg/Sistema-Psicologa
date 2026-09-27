import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { hojeISO, somarDias } from '../../lib/date';

interface Numeros {
  confirmadasHoje: number;
  pendentes: number;
  confirmadasProximos7Dias: number;
}

export default function ResumoPainel() {
  const [numeros, setNumeros] = useState<Numeros | null>(null);

  useEffect(() => {
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
  }, []);

  return (
    <div className="resumo-painel">
      <div className="resumo-card">
        <span className="resumo-card__numero">{numeros ? numeros.confirmadasHoje : '—'}</span>
        <span className="resumo-card__label">Consultas confirmadas hoje</span>
      </div>
      <div className="resumo-card">
        <span className="resumo-card__numero">{numeros ? numeros.pendentes : '—'}</span>
        <span className="resumo-card__label">Pedidos pendentes</span>
      </div>
      <div className="resumo-card">
        <span className="resumo-card__numero">{numeros ? numeros.confirmadasProximos7Dias : '—'}</span>
        <span className="resumo-card__label">Confirmadas nos próximos 7 dias</span>
      </div>
    </div>
  );
}
