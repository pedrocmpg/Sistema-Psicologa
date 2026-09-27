import type { LucideIcon } from 'lucide-react';
import { Inbox, CalendarCheck, Ban, CalendarDays } from '../icons';

export type Aba = 'pendentes' | 'confirmados' | 'recusados' | 'agenda';

export const ABAS: { id: Aba; rotulo: string; Icon: LucideIcon }[] = [
  { id: 'pendentes', rotulo: 'Pendentes', Icon: Inbox },
  { id: 'confirmados', rotulo: 'Confirmados', Icon: CalendarCheck },
  { id: 'recusados', rotulo: 'Recusados', Icon: Ban },
  { id: 'agenda', rotulo: 'Agenda', Icon: CalendarDays },
];
