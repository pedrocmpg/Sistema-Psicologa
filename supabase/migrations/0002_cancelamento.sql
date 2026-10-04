-- Sistema de agendamento — Psicóloga
-- Migration 2: permite cancelar uma consulta já confirmada.
--
-- "Recusar" (0001) e "Cancelar" são semanticamente diferentes: recusar é decidir não aprovar
-- um pedido pendente; cancelar é desfazer uma consulta que já tinha sido confirmada. Por isso
-- ganham status distintos ('recusado' vs 'cancelado'), mesmo o efeito sobre o horário sendo
-- igual nos dois casos (volta a ficar "disponivel").

alter table public.agendamentos
  drop constraint if exists agendamentos_status_check;

alter table public.agendamentos
  add constraint agendamentos_status_check
  check (status in ('pendente', 'confirmado', 'recusado', 'cancelado'));

-- =========================================================
-- Função: cancelar_agendamento
-- Só a psicóloga autenticada pode chamar, e só em cima de um agendamento hoje "confirmado".
-- Libera o horário de volta para "disponivel" (some da agenda, aparece de novo no site público).
-- =========================================================
create or replace function public.cancelar_agendamento(p_agendamento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horario_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Não autorizado';
  end if;

  select horario_id, status into v_horario_id, v_status
  from public.agendamentos
  where id = p_agendamento_id;

  if v_horario_id is null then
    raise exception 'Agendamento não encontrado';
  end if;

  if v_status <> 'confirmado' then
    raise exception 'Só é possível cancelar uma consulta confirmada';
  end if;

  update public.agendamentos
  set status = 'cancelado'
  where id = p_agendamento_id;

  update public.horarios_disponiveis
  set status = 'disponivel'
  where id = v_horario_id;
end;
$$;

grant execute on function public.cancelar_agendamento(uuid) to authenticated;
