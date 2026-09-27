import { deISO, paraISO } from './date';

export interface SlotGerado {
  data: string;
  hora: string;
}

interface GerarHorariosLoteParams {
  diasSemana: number[]; // 0 (domingo) a 6 (sábado), como Date#getDay()
  dataInicial: string; // ISO, inclusive
  dataFinal: string; // ISO, inclusive
  horaInicio: string; // HH:MM
  horaFim: string; // HH:MM (exclusivo — não gera um horário exatamente igual à hora final)
  intervaloMinutos: number;
}

/** Gera todos os pares {data, hora} dentro do período, nos dias da semana e faixa de horário escolhidos. */
export function gerarHorariosLote(params: GerarHorariosLoteParams): SlotGerado[] {
  const { diasSemana, dataInicial, dataFinal, horaInicio, horaFim, intervaloMinutos } = params;
  const resultado: SlotGerado[] = [];

  const [horaIniH, horaIniM] = horaInicio.split(':').map(Number);
  const [horaFimH, horaFimM] = horaFim.split(':').map(Number);
  const minutosInicio = horaIniH * 60 + horaIniM;
  const minutosFim = horaFimH * 60 + horaFimM;

  const cursor = deISO(dataInicial);
  const fim = deISO(dataFinal);

  while (cursor <= fim) {
    if (diasSemana.includes(cursor.getDay())) {
      for (let m = minutosInicio; m < minutosFim; m += intervaloMinutos) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        resultado.push({ data: paraISO(cursor), hora: `${hh}:${mm}` });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return resultado;
}
