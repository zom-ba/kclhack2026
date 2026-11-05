begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'ユーザー'
    check (char_length(btrim(display_name)) between 1 and 50),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  bio text check (bio is null or char_length(bio) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[0-9]{4}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.room_memberships (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_memberships_user_id_idx on public.room_memberships(user_id);

create table public.user_records (
  room_id uuid not null,
  user_id uuid not null,
  accumulated_seconds bigint not null default 0 check (accumulated_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id),
  foreign key (room_id, user_id)
    references public.room_memberships(room_id, user_id)
    on delete cascade
);

create index user_records_user_id_idx on public.user_records(user_id);

create table public.timers (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  status text not null default 'idle'
    check (status in ('idle', 'running', 'paused', 'completed')),
  duration_seconds integer not null default 1500 check (duration_seconds > 0),
  remaining_seconds integer not null default 1500
    check (remaining_seconds >= 0 and remaining_seconds <= duration_seconds),
  ends_at timestamptz,
  revision bigint not null default 0 check (revision >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint timers_running_state_check check (
    (status = 'running' and ends_at is not null)
    or (status <> 'running' and ends_at is null)
  ),
  constraint timers_completed_state_check check (
    status <> 'completed' or remaining_seconds = 0
  )
);

create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  user_id uuid not null,
  timer_revision bigint not null check (timer_revision >= 0),
  started_at timestamptz not null default now(),
  scheduled_end_at timestamptz not null,
  ended_at timestamptz,
  credited_seconds bigint not null default 0 check (credited_seconds >= 0),
  close_reason text check (
    close_reason is null
    or close_reason in ('pause', 'completed', 'leave', 'disconnect', 'room_switch', 'reset')
  ),
  created_at timestamptz not null default now(),
  foreign key (room_id, user_id)
    references public.room_memberships(room_id, user_id)
    on delete cascade,
  check (ended_at is null or ended_at >= started_at)
);

create unique index work_sessions_one_active_per_user_room_idx
  on public.work_sessions(room_id, user_id)
  where ended_at is null;

create index work_sessions_active_room_idx
  on public.work_sessions(room_id)
  where ended_at is null;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger user_records_set_updated_at
before update on public.user_records
for each row execute function private.set_updated_at();

create trigger timers_set_updated_at
before update on public.timers
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'ユーザー'), 50)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger everytick_on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (user_id)
select users.id from auth.users as users
on conflict (user_id) do nothing;

create or replace function private.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_memberships
    where room_id = target_room_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.shares_room_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_memberships as mine
    inner join public.room_memberships as theirs on theirs.room_id = mine.room_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target_user_id
  );
$$;

revoke execute on function private.is_room_member(uuid) from public, anon, authenticated;
revoke execute on function private.shares_room_with(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_room_member(uuid) to authenticated;
grant execute on function private.shares_room_with(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_memberships enable row level security;
alter table public.user_records enable row level security;
alter table public.timers enable row level security;
alter table public.work_sessions enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.rooms from anon, authenticated;
revoke all on table public.room_memberships from anon, authenticated;
revoke all on table public.user_records from anon, authenticated;
revoke all on table public.timers from anon, authenticated;
revoke all on table public.work_sessions from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url, bio) on table public.profiles to authenticated;
grant select on table public.rooms to authenticated;
grant select on table public.room_memberships to authenticated;
grant select on table public.user_records to authenticated;
grant select on table public.timers to authenticated;

create policy "users can read their own or shared-room profiles"
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.shares_room_with(user_id))
);

create policy "users can update their own profile"
on public.profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "members can read their rooms"
on public.rooms for select to authenticated
using ((select private.is_room_member(id)));

create policy "members can read room memberships"
on public.room_memberships for select to authenticated
using ((select private.is_room_member(room_id)));

create policy "members can read room records"
on public.user_records for select to authenticated
using ((select private.is_room_member(room_id)));

create policy "members can read room timers"
on public.timers for select to authenticated
using ((select private.is_room_member(room_id)));

create or replace function private.create_room()
returns table (room_id uuid, room_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  generated_room_id uuid;
  generated_room_code text;
  attempts integer := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  loop
    attempts := attempts + 1;
    if attempts > 100 then
      raise exception 'Could not allocate a room code' using errcode = '54000';
    end if;

    generated_room_code := lpad(floor(random() * 10000)::integer::text, 4, '0');
    begin
      insert into public.rooms (room_code, created_by)
      values (generated_room_code, current_user_id)
      returning id into generated_room_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into public.room_memberships (room_id, user_id)
  values (generated_room_id, current_user_id);
  insert into public.user_records (room_id, user_id)
  values (generated_room_id, current_user_id);
  insert into public.timers (room_id) values (generated_room_id);

  return query select generated_room_id, generated_room_code;
end;
$$;

create or replace function private.join_room(target_room_code text)
returns table (room_id uuid, room_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_room_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if target_room_code is null or target_room_code !~ '^[0-9]{4}$' then
    raise exception 'Room code must contain exactly four digits' using errcode = '22023';
  end if;

  select rooms.id into target_room_id
  from public.rooms where rooms.room_code = target_room_code;
  if target_room_id is null then
    raise exception 'Room was not found' using errcode = 'P0002';
  end if;

  insert into public.room_memberships (room_id, user_id)
  values (target_room_id, current_user_id)
  on conflict (room_id, user_id) do nothing;
  insert into public.user_records (room_id, user_id)
  values (target_room_id, current_user_id)
  on conflict (room_id, user_id) do nothing;

  return query select target_room_id, target_room_code;
end;
$$;

create or replace function public.create_room()
returns table (room_id uuid, room_code text)
language sql
security invoker
set search_path = ''
as $$ select * from private.create_room(); $$;

create or replace function public.join_room(target_room_code text)
returns table (room_id uuid, room_code text)
language sql
security invoker
set search_path = ''
as $$ select * from private.join_room(target_room_code); $$;

revoke execute on function private.create_room() from public, anon, authenticated;
revoke execute on function private.join_room(text) from public, anon, authenticated;
revoke execute on function public.create_room() from public, anon, authenticated;
revoke execute on function public.join_room(text) from public, anon, authenticated;
grant execute on function private.create_room() to authenticated;
grant execute on function private.join_room(text) to authenticated;
grant execute on function public.create_room() to authenticated;
grant execute on function public.join_room(text) to authenticated;

alter publication supabase_realtime add table public.timers;

commit;
