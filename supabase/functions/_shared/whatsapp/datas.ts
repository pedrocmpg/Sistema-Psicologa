// Datas das mensagens, sempre em America/Sao_Paulo e em português.
// `data` (YYYY-MM-DD) e `hora` (HH:MM[:SS]) vêm do banco como horário de parede, sem fuso. A Edge
// Function roda em UTC, então nunca usamos o fuso da máquina: montamos o instante ao meio-dia UTC
// (mesmo dia civil em São Paulo) e formatamos com timeZone explícito.

export const FUSO = 'America/Sao_Paulo';

function instanteDoDia(data: string): Date {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 12));
}

/** "terça-feira" */
export function diaDaSemana(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: FUSO }).format(instanteDoDia(data));
}

/** "14/10" */
export function dataCurta(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO }).format(
    instanteDoDia(data)
  );
}

/** "terça-feira, 14/10" */
export function dataPorExtenso(data: string): string {
  return `${diaDaSemana(data)}, ${dataCurta(data)}`;
}

/** "14h" ou "14h30" */
export function horaFalada(hora: string): string {
  const [h, m] = hora.split(':');
  const horas = String(Number(h));
  return m && m !== '00' ? `${horas}h${m}` : `${horas}h`;
}

/** "toda terça-feira" / "todo sábado" — concorda com o gênero do dia. */
export function diaFixoSemanal(data: string): string {
  const dia = diaDaSemana(data);
  return dia === 'sábado' || dia === 'domingo' ? `todo ${dia}` : `toda ${dia}`;
}

/** Instante (timestamptz) para exibir no painel: "05/10 às 15h40". */
export function instanteCurto(iso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: FUSO,
  }).formatToParts(new Date(iso));
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? '';
  return `${p('day')}/${p('month')} às ${p('hour')}h${p('minute')}`;
}
