-- Sistema de agendamento — Psicóloga Daniele Walczak
-- Migration 3: agendamento manual (criado pela psicóloga) e recorrência semanal.

-- =========================================================
-- Alterações de schema
-- =========================================================

-- Agendamento manual não coleta e-mail (só nome, telefone, data, horário).
alter table public.agendamentos
  alter column email drop not null;

-- Agrupa as ocorrências de uma mesma série semanal. Nula = agendamento avulso (comportamento
-- de sempre). Preenchida = todas as ocorrências dessa recorrência compartilham o mesmo uuid.
alter table public.agendamentos
  add column if not exists recorrencia_id uuid;

create index if not exists idx_agendamentos_recorrencia_id
  on public.agendamentos (recorrencia_id)
  where recorrencia_id is not null;

-- =========================================================
-- Função auxiliar (não exposta via API — sem grant para anon/authenticated):
-- gera ocorrências semanais de p_semana_inicial a p_semana_final (inclusive), a partir de
-- p_data_base + N*7 dias, reaproveitando horario "disponivel" existente, criando um novo
-- quando não existe, e pulando quando o horário já está ocupado por outra coisa.
-- =========================================================
create or replace function public._gerar_ocorrencias_recorrentes(
  p_data_base date,
  p_hora time,
  p_nome_paciente text,
  p_telefone text,
  p_email text,
  p_recorrencia_id uuid,
  p_semana_inicial int,
  p_semana_final int
)
returns table(criadas int, puladas int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horario_id uuid;
  v_status text;
  v_data_atual date;
  v_criadas int := 0;
  v_puladas int := 0;
  v_semana int;
begin
  for v_semana in p_semana_inicial..p_semana_final loop
    v_data_atual := p_data_base + (v_semana * 7);
    v_horario_id := null;
    v_status := null;

    select id, status into v_horario_id, v_status
    from public.horarios_disponiveis
    where data = v_data_atual and hora = p_hora
    for update;

    if v_horario_id is null then
      insert into public.horarios_disponiveis (data, hora, status)
      values (v_data_atual, p_hora, 'confirmado')
      returning id into v_horario_id;
    elsif v_status = 'disponivel' then
      update public.horarios_disponiveis set status = 'confirmado' where id = v_horario_id;
    else
      -- horário já ocupado (reservado/confirmado por outra coisa) — pula essa ocorrência,
      -- sem derrubar a série inteira.
      v_puladas := v_puladas + 1;
      continue;
    end if;

    insert into public.agendamentos (horario_id, nome_paciente, telefone, email, status, recorrencia_id)
    values (v_horario_id, p_nome_paciente, p_telefone, p_email, 'confirmado', p_recorrencia_id);

    v_criadas := v_criadas + 1;
  end loop;

  return query select v_criadas, v_puladas;
end;
$$;

-- =========================================================
-- Função: criar_agendamento_manual
-- Só a psicóloga autenticada. Para consultas marcadas por telefone/WhatsApp, fora do site.
-- Entra direto como "confirmado" (não passa por pendente — foi ela quem criou).
-- p_semanas = 1 (padrão): só essa ocorrência. p_semanas > 1: recorrência semanal.
-- =========================================================
create or replace function public.criar_agendamento_manual(
  p_nome_paciente text,
  p_telefone text,
  p_data date,
  p_hora time,
  p_semanas int default 1
)
returns table(agendamento_id uuid, ocorrencias_criadas int, ocorrencias_puladas int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horario_id uuid;
  v_status text;
  v_recorrencia_id uuid;
  v_primeiro_id uuid;
  v_resto record;
begin
  if auth.uid() is null then
    raise exception 'Não autorizado';
  end if;
  if length(trim(p_nome_paciente)) = 0 then
    raise exception 'Nome é obrigatório';
  end if;
  if length(trim(p_telefone)) = 0 then
    raise exception 'Telefone é obrigatório';
  end if;
  if p_semanas < 1 or p_semanas > 52 then
    raise exception 'Número de semanas inválido';
  end if;

  select id, status into v_horario_id, v_status
  from public.horarios_disponiveis
  where data = p_data and hora = p_hora
  for update;

  if v_horario_id is not null and v_status <> 'disponivel' then
    raise exception 'Já existe uma consulta nesse horário';
  end if;

  if v_horario_id is null then
    insert into public.horarios_disponiveis (data, hora, status)
    values (p_data, p_hora, 'confirmado')
    returning id into v_horario_id;
  else
    update public.horarios_disponiveis set status = 'confirmado' where id = v_horario_id;
  end if;

  v_recorrencia_id := case when p_semanas > 1 then gen_random_uuid() else null end;

  insert into public.agendamentos (horario_id, nome_paciente, telefone, email, status, recorrencia_id)
  values (v_horario_id, trim(p_nome_paciente), trim(p_telefone), null, 'confirmado', v_recorrencia_id)
  returning id into v_primeiro_id;

  if p_semanas > 1 then
    select * into v_resto
    from public._gerar_ocorrencias_recorrentes(
      p_data, p_hora, trim(p_nome_paciente), trim(p_telefone), null, v_recorrencia_id, 1, p_semanas - 1
    );
    return query select v_primeiro_id, 1 + v_resto.criadas, v_resto.puladas;
  else
    return query select v_primeiro_id, 1, 0;
  end if;
end;
$$;

grant execute on function public.criar_agendamento_manual(text, text, date, time, int) to authenticated;

-- =========================================================
-- Função: confirmar_agendamento_recorrente
-- Como confirmar_agendamento, mas com a opção de repetir semanalmente a partir dali.
-- p_semanas = 1: comportamento idêntico a confirmar_agendamento (sem recorrência).
-- =========================================================
create or replace function public.confirmar_agendamento_recorrente(
  p_agendamento_id uuid,
  p_semanas int default 1
)
returns table(ocorrencias_criadas int, ocorrencias_puladas int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horario_id uuid;
  v_data date;
  v_hora time;
  v_nome text;
  v_telefone text;
  v_email text;
  v_recorrencia_id uuid;
  v_resto record;
begin
  if auth.uid() is null then
    raise exception 'Não autorizado';
  end if;
  if p_semanas < 1 or p_semanas > 52 then
    raise exception 'Número de semanas inválido';
  end if;

  select a.horario_id, a.nome_paciente, a.telefone, a.email, h.data, h.hora
  into v_horario_id, v_nome, v_telefone, v_email, v_data, v_hora
  from public.agendamentos a
  join public.horarios_disponiveis h on h.id = a.horario_id
  where a.id = p_agendamento_id;

  if v_horario_id is null then
    raise exception 'Agendamento não encontrado';
  end if;

  v_recorrencia_id := case when p_semanas > 1 then gen_random_uuid() else null end;

  update public.agendamentos
  set status = 'confirmado', recorrencia_id = v_recorrencia_id
  where id = p_agendamento_id;

  update public.horarios_disponiveis
  set status = 'confirmado'
  where id = v_horario_id;

  if p_semanas > 1 then
    select * into v_resto
    from public._gerar_ocorrencias_recorrentes(
      v_data, v_hora, v_nome, v_telefone, v_email, v_recorrencia_id, 1, p_semanas - 1
    );
    return query select 1 + v_resto.criadas, v_resto.puladas;
  else
    return query select 1, 0;
  end if;
end;
$$;

grant execute on function public.confirmar_agendamento_recorrente(uuid, int) to authenticated;

-- =========================================================
-- Função: cancelar_serie_recorrente
-- Cancela a ocorrência informada E todas as futuras da mesma série (recorrencia_id),
-- devolvendo os horários correspondentes para "disponivel". Ocorrências passadas da mesma
-- série não são mexidas.
-- =========================================================
create or replace function public.cancelar_serie_recorrente(p_agendamento_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recorrencia_id uuid;
  v_data_referencia date;
  v_canceladas int := 0;
  v_ocorrencia record;
begin
  if auth.uid() is null then
    raise exception 'Não autorizado';
  end if;

  select a.recorrencia_id, h.data
  into v_recorrencia_id, v_data_referencia
  from public.agendamentos a
  join public.horarios_disponiveis h on h.id = a.horario_id
  where a.id = p_agendamento_id;

  if v_recorrencia_id is null then
    raise exception 'Este agendamento não faz parte de uma série recorrente';
  end if;

  for v_ocorrencia in
    select a.id as agendamento_id, a.horario_id
    from public.agendamentos a
    join public.horarios_disponiveis h on h.id = a.horario_id
    where a.recorrencia_id = v_recorrencia_id
      and a.status = 'confirmado'
      and h.data >= v_data_referencia
  loop
    update public.agendamentos set status = 'cancelado' where id = v_ocorrencia.agendamento_id;
    update public.horarios_disponiveis set status = 'disponivel' where id = v_ocorrencia.horario_id;
    v_canceladas := v_canceladas + 1;
  end loop;

  return v_canceladas;
end;
$$;

grant execute on function public.cancelar_serie_recorrente(uuid) to authenticated;
