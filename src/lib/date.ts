export function paraISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function deISO(s: string): Date {
  const [ano, mes, dia] = s.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

export function hojeISO(): string {
  return paraISO(new Date());
}

export function somarDias(iso: string, dias: number): string {
  const d = deISO(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

/** "Hoje", "Amanhã" ou algo como "quarta-feira, 02 de outubro". */
export function rotuloDia(iso: string): string {
  const hoje = hojeISO();
  if (iso === hoje) return 'Hoje';
  if (iso === somarDias(hoje, 1)) return 'Amanhã';
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(deISO(iso));
}
