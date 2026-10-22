create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.user_action_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('reader_progress', 'image_upload', 'pdf_upload', 'chapter_create', 'review_write')),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, action, window_start)
);

alter table private.user_action_rate_limits enable row level security;
create policy "Users manage only their own action limits"
  on private.user_action_rate_limits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table private.user_action_rate_limits from public, anon;
grant select, insert, update, delete on table private.user_action_rate_limits to authenticated;

create or replace function public.consume_user_action_rate_limit(p_action text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_window_start timestamptz := pg_catalog.date_trunc('hour', pg_catalog.now());
  v_request_count integer;
  v_max_requests integer;
begin
  if current_user_id is null then
    return false;
  end if;

  v_max_requests := case p_action
    when 'reader_progress' then 3600
    when 'image_upload' then 150
    when 'pdf_upload' then 10
    when 'chapter_create' then 30
    when 'review_write' then 50
    else null
  end;
  if v_max_requests is null then
    return false;
  end if;

  delete from private.user_action_rate_limits
  where user_id = current_user_id
    and window_start < pg_catalog.now() - interval '48 hours';

  insert into private.user_action_rate_limits (user_id, action, window_start, request_count)
  values (current_user_id, p_action, v_window_start, 1)
  on conflict (user_id, action, window_start) do update
    set request_count = private.user_action_rate_limits.request_count + 1
  returning request_count into v_request_count;

  return v_request_count <= v_max_requests;
end;
$$;

revoke all on function public.consume_user_action_rate_limit(text) from public, anon;
grant execute on function public.consume_user_action_rate_limit(text) to authenticated;
