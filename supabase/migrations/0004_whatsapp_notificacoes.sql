-- Sistema de agendamento — Psicóloga
-- Migration 4: confirmação automática por WhatsApp.
--
-- O envio acontece numa Edge Function (`notify-whatsapp`), disparada por um Database Webhook em
-- INSERT/UPDATE de `agendamentos` (criado no painel do Supabase — veja o README; não fica aqui
-- porque precisa da URL do projeto e do segredo compartilhado). Esta migration só cria o que a
-- função e o painel precisam: flags no agendamento, o registro de notificações e a configuração.

-- =========================================================
-- agendamentos: flags usadas pela notificação
-- =========================================================

-- Desmarcado pela psicóloga quando o paciente não deve receber mensagem automática.
alter table public.agendamentos
  add column if not exists notificar_whatsapp boolean not null default true;

-- Cancelar a série inteira e cancelar só uma ocorrência da série geram, para o webhook, o mesmo
-- UPDATE (status -> cancelado, com recorrencia_id). Esta flag diferencia os dois casos, para a
-- função mandar UMA mensagem "cancelado_serie" em vez de uma por ocorrência.
alter table public.agendamentos
  add column if not exists cancelado_em_serie boolean not null default false;

-- =========================================================
-- Tabela: notificacoes
-- Uma linha por mensagem (tentada, enviada ou ignorada). A função insere a linha ANTES de enviar;
-- os uniques abaixo fazem o insert falhar em webhooks repetidos/concorrentes, e aí ela não envia.
-- =========================================================
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  recorrencia_id uuid,
  evento text not null
    check (evento in ('confirmado', 'recusado', 'cancelado', 'confirmado_serie', 'cancelado_serie')),
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'falhou', 'ignorado')),
  motivo text,
  provider_message_id text,
  tentativas int not null default 0,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  -- Com motivo = 'processando', marca um envio em andamento: o "Reenviar" do painel só assume a
  -- linha se ela não estiver em andamento (ou se travou há mais de 5 minutos).
  atualizado_em timestamptz not null default now(),
  unique (agendamento_id, evento)
);

comment on table public.notificacoes is
  'Mensagens de WhatsApp por evento de agendamento. Nunca guarda o texto da mensagem.';

-- Uma única mensagem por série (confirmação ou cancelamento da série inteira).
create unique index if not exists uq_notificacoes_recorrencia_evento
  on public.notificacoes (recorrencia_id, evento)
  where recorrencia_id is not null;

-- Limite de envios por hora.
create index if not exists idx_notificacoes_status_enviado_em
  on public.notificacoes (status, enviado_em);

-- =========================================================
-- Tabela: configuracoes_whatsapp (linha única)
-- Os dados da profissional NÃO são gravados aqui pela migration (ficam em
-- src/config/profissional.ts); o painel pré-preenche os campos a partir de lá.
-- templates: só as chaves editadas; chave ausente usa o texto padrão do código.
-- =========================================================
create table if not exists public.configuracoes_whatsapp (
  id boolean primary key default true check (id),
  ativo boolean not null default false,
  nome_profissional text,
  telefone_contato text,
  endereco text,
  templates jsonb not null default '{}'::jsonb
);

insert into public.configuracoes_whatsapp (id) values (true) on conflict (id) do nothing;

-- =========================================================
-- Row Level Security: só a psicóloga autenticada. O público não acessa nenhuma das duas.
-- A Edge Function usa a service role (ignora RLS).
-- =========================================================
alter table public.notificacoes enable row level security;
alter table public.configuracoes_whatsapp enable row level security;

create policy "admin_le_notificacoes"
  on public.notificacoes for select to authenticated using (true);
create policy "admin_insere_notificacoes"
  on public.notificacoes for insert to authenticated with check (true);
create policy "admin_atualiza_notificacoes"
  on public.notificacoes for update to authenticated using (true) with check (true);

create policy "admin_le_configuracoes_whatsapp"
  on public.configuracoes_whatsapp for select to authenticated using (true);
create policy "admin_insere_configuracoes_whatsapp"
  on public.configuracoes_whatsapp for insert to authenticated with check (true);
create policy "admin_atualiza_configuracoes_whatsapp"
  on public.configuracoes_whatsapp for update to authenticated using (true) with check (true);

revoke all on public.notificacoes from anon;
revoke all on public.configuracoes_whatsapp from anon;

-- =========================================================
-- RPCs: passam a receber p_notificar_whatsapp (padrão true, então chamadas antigas continuam
-- valendo). A flag é gravada no MESMO update/insert que muda o status, para o payload do
-- webhook já sair com o valor certo.
-- =========================================================

drop function if exists public.confirmar_agendamento(uuid);
create or replace function public.confirmar_agendamento(
  p_agendamento_id uuid,
  p_notificar_whatsapp boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horario_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autorizado';
  end if;

  select horario_id into v_horario_id
  from public.agendamentos
  where id = p_agendamento_id;

  if v_horario_id is null then
    raise exception 'Agendamento não encontrado';
  end if;

  update public.agendamentos
  set status = 'confirmado', notificar_whatsapp = coalesce(p_notificar_whatsapp, true)
  where id = p_agendamento_id;

  update public.horarios_disponiveis
  set status = 'confirmado'
  where id = v_horario_id;
end;
$$;

grant execute on function public.confirmar_agendamento(uuid, boolean) to authenticated;

drop function if exists public.recusar_agendamento(uuid);
create or replace function public.recusar_agendamento(
  p_agendamento_id uuid,
  p_notificar_whatsapp boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_horario_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autorizado';
  end if;

  select horario_id into v_horario_id
  from public.agendamentos
  where id = p_agendamento_id;

  if v_horario_id is null then
    raise exception 'Agendamento não encontrado';
  end if;

  update public.agendamentos
  set status = 'recusado', notificar_whatsapp = coalesce(p_notificar_whatsapp, true)
  where id = p_agendamento_id;

  update public.horarios_disponiveis
  set status = 'disponivel'
  where id = v_horario_id;
end;
$$;

grant execute on function public.recusar_agendamento(uuid, boolean) to authenticated;

drop function if exists public._gerar_ocorrencias_recorrentes(date, time, text, text, text, uuid, int, int);
create or replace function public._gerar_ocorrencias_recorrentes(
  p_data_base date,
  p_hora time,
  p_nome_paciente text,
  p_telefone text,
  p_email text,
  p_recorrencia_id uuid,
  p_semana_inicial int,
  p_semana_final int,
  p_notificar_whatsapp boolean default true
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
      v_puladas := v_puladas + 1;
      continue;
    end if;

    insert into public.agendamentos
      (horario_id, nome_paciente, telefone, email, status, recorrencia_id, notificar_whatsapp)
    values
      (v_horario_id, p_nome_paciente, p_telefone, p_email, 'confirmado', p_recorrencia_id,
       coalesce(p_notificar_whatsapp, true));

    v_criadas := v_criadas + 1;
  end loop;

  return query select v_criadas, v_puladas;
end;
$$;

-- Função auxiliar, só chamada pelas RPCs abaixo. O Postgres dá EXECUTE a PUBLIC por padrão e o
-- Supabase ainda concede a anon/authenticated em funções novas do schema public; sem este revoke
-- ela ficaria exposta via /rpc (e é SECURITY DEFINER, criaria consultas confirmadas sem login).
revoke execute on function public._gerar_ocorrencias_recorrentes(date, time, text, text, text, uuid, int, int, boolean)
  from public, anon, authenticated;

drop function if exists public.criar_agendamento_manual(text, text, date, time, int);
create or replace function public.criar_agendamento_manual(
  p_nome_paciente text,
  p_telefone text,
  p_data date,
  p_hora time,
  p_semanas int default 1,
  p_notificar_whatsapp boolean default true
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
  v_notificar boolean := coalesce(p_notificar_whatsapp, true);
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

  insert into public.agendamentos
    (horario_id, nome_paciente, telefone, email, status, recorrencia_id, notificar_whatsapp)
  values
    (v_horario_id, trim(p_nome_paciente), trim(p_telefone), null, 'confirmado', v_recorrencia_id, v_notificar)
  returning id into v_primeiro_id;

  if p_semanas > 1 then
    select * into v_resto
    from public._gerar_ocorrencias_recorrentes(
      p_data, p_hora, trim(p_nome_paciente), trim(p_telefone), null, v_recorrencia_id, 1, p_semanas - 1, v_notificar
    );
    return query select v_primeiro_id, 1 + v_resto.criadas, v_resto.puladas;
  else
    return query select v_primeiro_id, 1, 0;
  end if;
end;
$$;

grant execute on function public.criar_agendamento_manual(text, text, date, time, int, boolean) to authenticated;

drop function if exists public.confirmar_agendamento_recorrente(uuid, int);
create or replace function public.confirmar_agendamento_recorrente(
  p_agendamento_id uuid,
  p_semanas int default 1,
  p_notificar_whatsapp boolean default true
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
  v_notificar boolean := coalesce(p_notificar_whatsapp, true);
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
  set status = 'confirmado', recorrencia_id = v_recorrencia_id, notificar_whatsapp = v_notificar
  where id = p_agendamento_id;

  update public.horarios_disponiveis
  set status = 'confirmado'
  where id = v_horario_id;

  if p_semanas > 1 then
    select * into v_resto
    from public._gerar_ocorrencias_recorrentes(
      v_data, v_hora, v_nome, v_telefone, v_email, v_recorrencia_id, 1, p_semanas - 1, v_notificar
    );
    return query select 1 + v_resto.criadas, v_resto.puladas;
  else
    return query select 1, 0;
  end if;
end;
$$;

grant execute on function public.confirmar_agendamento_recorrente(uuid, int, boolean) to authenticated;

-- =========================================================
-- cancelar_serie_recorrente: igual à 0003, mas marca cancelado_em_serie no mesmo UPDATE.
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
    update public.agendamentos
    set status = 'cancelado', cancelado_em_serie = true
    where id = v_ocorrencia.agendamento_id;
    update public.horarios_disponiveis set status = 'disponivel' where id = v_ocorrencia.horario_id;
    v_canceladas := v_canceladas + 1;
  end loop;

  return v_canceladas;
end;
$$;
