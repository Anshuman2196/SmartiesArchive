create or replace function public.save_reading_progress(
  p_work_id uuid,
  p_chapter_id uuid,
  p_progress real
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_position integer;
  previous_position integer;
  previous_state public.publication_state;
begin
  if current_user_id is null or p_progress is null or p_progress < 0 or p_progress > 1 then
    return false;
  end if;

  -- Serialize updates for this reader and story so concurrent pagehide and
  -- scroll flushes cannot move the saved chapter back to an earlier position.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':' || p_work_id::text, 0)
  );

  select c.position into target_position
  from public.chapters as c
  where c.id = p_chapter_id
    and c.work_id = p_work_id
    and c.state = 'published';

  if target_position is null then
    return false;
  end if;

  select c.position, c.state
  into previous_position, previous_state
  from public.reading_progress as rp
  join public.chapters as c
    on c.id = rp.chapter_id
   and c.work_id = rp.work_id
  where rp.user_id = current_user_id
    and rp.work_id = p_work_id
  for update of rp;

  if found and previous_state = 'published' and previous_position > target_position then
    update public.reading_progress
    set updated_at = pg_catalog.now()
    where user_id = current_user_id
      and work_id = p_work_id;
    return true;
  end if;

  insert into public.reading_progress (user_id, work_id, chapter_id, progress, updated_at)
  values (current_user_id, p_work_id, p_chapter_id, p_progress, pg_catalog.now())
  on conflict (user_id, work_id) do update
  set chapter_id = excluded.chapter_id,
      progress = excluded.progress,
      updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.save_reading_progress(uuid, uuid, real) from public, anon;
grant execute on function public.save_reading_progress(uuid, uuid, real) to authenticated;
