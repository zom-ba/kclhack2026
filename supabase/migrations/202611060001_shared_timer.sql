begin;

alter table public.work_sessions
  add column if not exists last_heartbeat_at timestamptz not null default now();

create or replace function private.close_room_work_sessions(
  target_room_id uuid,
  target_ended_at timestamptz,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_reason not in ('pause', 'completed', 'leave', 'disconnect', 'room_switch', 'reset') then
    raise exception 'Invalid close reason' using errcode = '22023';
  end if;

  with closed as (
    update public.work_sessions
    set
      ended_at = least(
        greatest(target_ended_at, started_at),
        scheduled_end_at,
        last_heartbeat_at + interval '15 seconds'
      ),
      credited_seconds = floor(extract(epoch from (
        least(
          greatest(target_ended_at, started_at),
          scheduled_end_at,
          last_heartbeat_at + interval '15 seconds'
        ) - started_at
      )))::bigint,
      close_reason = target_reason
    where room_id = target_room_id
      and ended_at is null
    returning room_id, user_id, credited_seconds
  ),
  totals as (
    select room_id, user_id, sum(credited_seconds)::bigint as credited_seconds
    from closed
    group by room_id, user_id
  )
  update public.user_records as records
  set accumulated_seconds = records.accumulated_seconds + totals.credited_seconds
  from totals
  where records.room_id = totals.room_id
    and records.user_id = totals.user_id;
end;
$$;

create or replace function private.close_work_session(
  target_room_id uuid,
  target_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  affected_rows integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if target_reason not in ('leave', 'disconnect', 'room_switch') then
    raise exception 'Invalid close reason' using errcode = '22023';
  end if;

  with closed as (
    update public.work_sessions
    set
      ended_at = least(
        greatest(clock_timestamp(), started_at),
        scheduled_end_at,
        last_heartbeat_at + interval '15 seconds'
      ),
      credited_seconds = floor(extract(epoch from (
        least(
          greatest(clock_timestamp(), started_at),
          scheduled_end_at,
          last_heartbeat_at + interval '15 seconds'
        ) - started_at
      )))::bigint,
      close_reason = target_reason
    where room_id = target_room_id
      and user_id = current_user_id
      and ended_at is null
    returning room_id, user_id, credited_seconds
  ),
  credited as (
    update public.user_records as records
    set accumulated_seconds = records.accumulated_seconds + closed.credited_seconds
    from closed
    where records.room_id = closed.room_id
      and records.user_id = closed.user_id
    returning 1
  )
  select count(*) into affected_rows from credited;

  return affected_rows > 0;
end;
$$;

create or replace function private.control_room_timer(
  target_room_id uuid,
  requested_action text
)
returns public.timers
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_timer public.timers%rowtype;
  current_time timestamptz := clock_timestamp();
  next_remaining integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.room_memberships
    where room_id = target_room_id
      and user_id = current_user_id
  ) then
    raise exception 'Room membership is required' using errcode = '42501';
  end if;

  if requested_action not in ('start', 'pause', 'reset', 'finalize') then
    raise exception 'Invalid timer action' using errcode = '22023';
  end if;

  select *
  into current_timer
  from public.timers
  where room_id = target_room_id
  for update;

  if not found then
    raise exception 'Timer was not found' using errcode = 'P0002';
  end if;

  if current_timer.status = 'running'
     and current_timer.ends_at <= current_time then
    perform private.close_room_work_sessions(
      target_room_id,
      current_timer.ends_at,
      'completed'
    );

    update public.timers
    set
      status = 'completed',
      remaining_seconds = 0,
      ends_at = null,
      revision = revision + 1,
      updated_by = current_user_id
    where room_id = target_room_id
    returning * into current_timer;
  end if;

  if requested_action = 'start' then
    if current_timer.status in ('idle', 'paused')
       and current_timer.remaining_seconds > 0 then
      update public.timers
      set
        status = 'running',
        ends_at = current_time + make_interval(secs => current_timer.remaining_seconds),
        revision = revision + 1,
        updated_by = current_user_id
      where room_id = target_room_id
      returning * into current_timer;
    end if;

  elsif requested_action = 'pause' then
    if current_timer.status = 'running' then
      next_remaining := greatest(
        0,
        ceil(extract(epoch from (current_timer.ends_at - current_time)))::integer
      );

      perform private.close_room_work_sessions(
        target_room_id,
        current_time,
        case when next_remaining = 0 then 'completed' else 'pause' end
      );

      update public.timers
      set
        status = case when next_remaining = 0 then 'completed' else 'paused' end,
        remaining_seconds = next_remaining,
        ends_at = null,
        revision = revision + 1,
        updated_by = current_user_id
      where room_id = target_room_id
      returning * into current_timer;
    end if;

  elsif requested_action = 'reset' then
    perform private.close_room_work_sessions(
      target_room_id,
      current_time,
      'reset'
    );

    update public.timers
    set
      status = 'idle',
      remaining_seconds = duration_seconds,
      ends_at = null,
      revision = revision + 1,
      updated_by = current_user_id
    where room_id = target_room_id
    returning * into current_timer;
  end if;

  return current_timer;
end;
$$;

create or replace function private.start_work_session(target_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_timer public.timers%rowtype;
  active_session_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.room_memberships
    where room_id = target_room_id
      and user_id = current_user_id
  ) then
    raise exception 'Room membership is required' using errcode = '42501';
  end if;

  select *
  into current_timer
  from public.timers
  where room_id = target_room_id
  for share;

  if current_timer.status <> 'running'
     or current_timer.ends_at <= clock_timestamp() then
    return null;
  end if;

  if exists (
    select 1
    from public.work_sessions
    where room_id = target_room_id
      and user_id = current_user_id
      and ended_at is null
      and (
        timer_revision <> current_timer.revision
        or last_heartbeat_at < clock_timestamp() - interval '15 seconds'
      )
  ) then
    perform private.close_work_session(target_room_id, 'disconnect');
  end if;

  insert into public.work_sessions (
    room_id,
    user_id,
    timer_revision,
    scheduled_end_at,
    last_heartbeat_at
  )
  values (
    target_room_id,
    current_user_id,
    current_timer.revision,
    current_timer.ends_at,
    clock_timestamp()
  )
  on conflict (room_id, user_id) where ended_at is null
  do update set last_heartbeat_at = excluded.last_heartbeat_at
  returning id into active_session_id;

  return active_session_id;
end;
$$;

create or replace function private.heartbeat_work_session(target_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  affected_rows integer;
begin
  if current_user_id is null then
    return false;
  end if;

  update public.work_sessions
  set last_heartbeat_at = clock_timestamp()
  where room_id = target_room_id
    and user_id = current_user_id
    and ended_at is null;

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

create or replace function public.control_room_timer(
  target_room_id uuid,
  requested_action text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'timer', to_jsonb(private.control_room_timer(target_room_id, requested_action)),
    'server_now', clock_timestamp()
  );
$$;

create or replace function public.get_room_timer(target_room_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'timer', to_jsonb(timers),
    'server_now', clock_timestamp()
  )
  from public.timers
  where room_id = target_room_id;
$$;

create or replace function public.start_work_session(target_room_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.start_work_session(target_room_id);
$$;

create or replace function public.heartbeat_work_session(target_room_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.heartbeat_work_session(target_room_id);
$$;

create or replace function public.close_work_session(
  target_room_id uuid,
  target_reason text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.close_work_session(target_room_id, target_reason);
$$;

revoke execute on function private.close_room_work_sessions(uuid, timestamptz, text) from public, anon, authenticated;
revoke execute on function private.close_work_session(uuid, text) from public, anon, authenticated;
revoke execute on function private.control_room_timer(uuid, text) from public, anon, authenticated;
revoke execute on function private.start_work_session(uuid) from public, anon, authenticated;
revoke execute on function private.heartbeat_work_session(uuid) from public, anon, authenticated;

revoke execute on function public.control_room_timer(uuid, text) from public, anon, authenticated;
revoke execute on function public.get_room_timer(uuid) from public, anon, authenticated;
revoke execute on function public.start_work_session(uuid) from public, anon, authenticated;
revoke execute on function public.heartbeat_work_session(uuid) from public, anon, authenticated;
revoke execute on function public.close_work_session(uuid, text) from public, anon, authenticated;

grant execute on function private.close_work_session(uuid, text) to authenticated;
grant execute on function private.control_room_timer(uuid, text) to authenticated;
grant execute on function private.start_work_session(uuid) to authenticated;
grant execute on function private.heartbeat_work_session(uuid) to authenticated;

grant execute on function public.control_room_timer(uuid, text) to authenticated;
grant execute on function public.get_room_timer(uuid) to authenticated;
grant execute on function public.start_work_session(uuid) to authenticated;
grant execute on function public.heartbeat_work_session(uuid) to authenticated;
grant execute on function public.close_work_session(uuid, text) to authenticated;

create policy "room members can receive room presence"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'presence'
  and exists (
    select 1
    from public.room_memberships
    where user_id = (select auth.uid())
      and 'room:' || room_id::text = (select realtime.topic())
  )
);

create policy "room members can publish room presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and exists (
    select 1
    from public.room_memberships
    where user_id = (select auth.uid())
      and 'room:' || room_id::text = (select realtime.topic())
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_records'
  ) then
    alter publication supabase_realtime add table public.user_records;
  end if;
end;
$$;

commit;
