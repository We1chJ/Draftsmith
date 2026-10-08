-- Published posts are immutable: once status = 'published', nothing about the post changes.
-- Posts linked to LinkedIn can't be deleted either (N1). The draft -> published transition
-- itself (which sets published_at, linkedin_post_id) is still allowed because old.status differs.

create or replace function draftsmith.protect_published_post() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'published' and old.linkedin_post_id is not null then
      raise exception 'post % was published to LinkedIn and cannot be deleted', old.id;
    end if;
    return old;
  end if;
  if old.status = 'published' then
    raise exception 'post % is published and cannot be modified', old.id;
  end if;
  return new;
end;
$$;
