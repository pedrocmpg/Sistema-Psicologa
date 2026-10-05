import type { LucideIcon } from 'lucide-react';
import { Inbox, CalendarCheck, Ban, CalendarDays, Settings } from '../icons';

export type Aba = 'pendentes' | 'confirmados' | 'recusados' | 'agenda' | 'config';

/** `rotuloCurto` aparece na bottom nav do celular, onde 5 itens precisam caber em 320px. */
export const ABAS: { id: Aba; rotulo: string; rotuloCurto?: string; Icon: LucideIcon }[] = [
  { id: 'pendentes', rotulo: 'Pendentes', Icon: Inbox },
  { id: 'confirmados', rotulo: 'Confirmados', Icon: CalendarCheck },
  { id: 'recusados', rotulo: 'Recusados', Icon: Ban },
  { id: 'agenda', rotulo: 'Agenda', Icon: CalendarDays },
  { id: 'config', rotulo: 'Configurações', rotuloCurto: 'Ajustes', Icon: Settings },
];
