import type { Agendamento } from '../types';

export function formatarDataHora(data?: string, hora?: string): string {
  if (!data || !hora) return '—';
  const [ano, mes, dia] = data.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  const dataFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  return `${dataFmt} às ${hora.slice(0, 5)}`;
}

/** Ordena por data/hora do horário vinculado, mais próxima primeiro. Sem horário vinculado vai para o fim. */
export function ordenarPorHorario(lista: Agendamento[]): Agendamento[] {
  return [...lista].sort((a, b) => {
    const chaveA = a.horarios_disponiveis ? `${a.horarios_disponiveis.data}${a.horarios_disponiveis.hora}` : '9999';
    const chaveB = b.horarios_disponiveis ? `${b.horarios_disponiveis.data}${b.horarios_disponiveis.hora}` : '9999';
    return chaveA.localeCompare(chaveB);
  });
}
