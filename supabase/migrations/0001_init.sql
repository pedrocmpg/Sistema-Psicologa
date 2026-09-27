-- Sistema de agendamento — Psicóloga Daniele Walczak
-- Migration inicial: tabelas, RLS e funções de agendamento

create extension if not exists "pgcrypto";

-- =========================================================
-- Tabela: horarios_disponiveis
-- Horários que a psicóloga cadastra como disponíveis para agendamento.
-- =========================================================
create table if not exists public.horarios_disponiveis (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  hora time not null,
  status text not null default 'disponivel'
    check (status in ('disponivel', 'reservado', 'confirmado')),
  criado_em timestamptz not null default now(),
  unique (data, hora)
);

comment on table public.horarios_disponiveis is
  'Horários de atendimento cadastrados pela psicóloga. Status controla a visibilidade pública.';

-- =========================================================
-- Tabela: agendamentos
-- Pedidos de agendamento feitos pelos pacientes.
-- =========================================================
create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  horario_id uuid not null references public.horarios_disponiveis(id) on delete cascade,
  nome_paciente text not null,
  telefone text not null,
  email text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'confirmado', 'recusado')),
  criado_em timestamptz not null default now()
);

comment on table public.agendamentos is
  'Pedidos de agendamento. Dados de contato do paciente só são visíveis para o usuário autenticado (a psicóloga).';

create index if not exists idx_agendamentos_horario_id on public.agendamentos (horario_id);
create index if not exists idx_agendamentos_status on public.agendamentos (status);
create index if not exists idx_horarios_status_data on public.horarios_disponiveis (status, data, hora);

-- =========================================================
-- Row Level Security
-- =========================================================
alter table public.horarios_disponiveis enable row level security;
alter table public.agendamentos enable row level security;

-- horarios_disponiveis: qualquer pessoa (anon) pode ler apenas os horários "disponivel"
create policy "publico_le_horarios_disponiveis"
  on public.horarios_disponiveis
  for select
  to anon, authenticated
  using (status = 'disponivel');

-- horarios_disponiveis: a psicóloga autenticada pode ler todos (inclui reservado/confirmado, para gerenciar a agenda)
create policy "admin_le_todos_horarios"
  on public.horarios_disponiveis
  for select
  to authenticated
  using (true);

-- horarios_disponiveis: só a psicóloga autenticada pode inserir/atualizar/remover horários
create policy "admin_insere_horarios"
  on public.horarios_disponiveis
  for insert
  to authenticated
  with check (true);

create policy "admin_atualiza_horarios"
  on public.horarios_disponiveis
  for update
  to authenticated
  using (true)
  with check (true);

create policy "admin_remove_horarios"
  on public.horarios_disponiveis
  for delete
  to authenticated
  using (true);

-- agendamentos: nenhuma leitura direta pelo público (dados de contato do paciente ficam protegidos)
-- A criação de pedidos é feita exclusivamente pela função solicitar_agendamento() (security definer) abaixo,
-- não há policy de INSERT para "anon" — inserts diretos na tabela são negados por padrão.

create policy "admin_le_agendamentos"
  on public.agendamentos
  for select
  to authenticated
  using (true);

create policy "admin_atualiza_agendamentos"
  on public.agendamentos
  for update
  to authenticated
  using (true)
  with check (true);

-- =========================================================
-- Função: solicitar_agendamento
-- Executada pelo público (anon) para criar um pedido de agendamento.
-- SECURITY DEFINER porque precisa, de forma atômica:
--   1) conferir que o horário ainda está "disponivel" (evita corrida entre dois pacientes)
--   2) marcar o horário como "reservado" (some da lista pública)
--   3) criar o registro em agendamentos com status "pendente"
-- =========================================================
create or replace function public.solicitar_agendamento(
  p_horario_id uuid,
  p_nome_paciente text,
  p_telefone text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_novo_id uuid;
begin
  if length(trim(p_nome_paciente)) = 0 then
    raise exception 'Nome é obrigatório';
  end if;
  if length(trim(p_telefone)) = 0 then
    raise exception 'Telefone é obrigatório';
  end if;
  if length(trim(p_email)) = 0 then
    raise exception 'E-mail é obrigatório';
  end if;

  -- trava a linha do horário para evitar duas pessoas reservando ao mesmo tempo
  select status into v_status
  from public.horarios_disponiveis
  where id = p_horario_id
  for update;

  if v_status is null then
    raise exception 'Horário não encontrado';
  end if;

  if v_status <> 'disponivel' then
    raise exception 'Este horário não está mais disponível';
  end if;

  update public.horarios_disponiveis
  set status = 'reservado'
  where id = p_horario_id;

  insert into public.agendamentos (horario_id, nome_paciente, telefone, email, status)
  values (p_horario_id, trim(p_nome_paciente), trim(p_telefone), trim(p_email), 'pendente')
  returning id into v_novo_id;

  return v_novo_id;
end;
$$;

grant execute on function public.solicitar_agendamento(uuid, text, text, text) to anon, authenticated;

-- =========================================================
-- Função: confirmar_agendamento
-- Só a psicóloga autenticada pode chamar. Confirma o pedido e "trava" o horário como confirmado.
-- =========================================================
create or replace function public.confirmar_agendamento(p_agendamento_id uuid)
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
  set status = 'confirmado'
  where id = p_agendamento_id;

  update public.horarios_disponiveis
  set status = 'confirmado'
  where id = v_horario_id;
end;
$$;

grant execute on function public.confirmar_agendamento(uuid) to authenticated;

-- =========================================================
-- Função: recusar_agendamento
-- Só a psicóloga autenticada pode chamar. Recusa o pedido e libera o horário de volta como disponível.
-- =========================================================
create or replace function public.recusar_agendamento(p_agendamento_id uuid)
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
  set status = 'recusado'
  where id = p_agendamento_id;

  update public.horarios_disponiveis
  set status = 'disponivel'
  where id = v_horario_id;
end;
$$;

grant execute on function public.recusar_agendamento(uuid) to authenticated;
