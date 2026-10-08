-- One timeline of posts. Published history (imported by hand, or later published by the app)
-- lives in `posts` with status = 'published'. past_posts is folded in and dropped.

alter table draftsmith.posts
  add column title  text,
  add column origin text not null default 'app' check (origin in ('app', 'imported'));

insert into draftsmith.posts (user_id, title, text, status, published_at, origin, created_at, updated_at)
select user_id, title, text, 'published', posted_on::timestamptz, 'imported', created_at, updated_at
from draftsmith.past_posts;

drop table draftsmith.past_posts;

create index posts_user_published on draftsmith.posts (user_id, published_at desc nulls last, created_at desc)
  where status = 'published';

-- Published posts: title and text stay editable (typo fixes, imported history), status is frozen,
-- and anything LinkedIn actually accepted can't be deleted or unlinked (N1).
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
    if new.status <> 'published' then
      raise exception 'post % is published; its status cannot change', old.id;
    end if;
    if old.linkedin_post_id is not null and new.linkedin_post_id is distinct from old.linkedin_post_id then
      raise exception 'post % is linked to LinkedIn; the link cannot change', old.id;
    end if;
  end if;
  return new;
end;
$$;

-- What the writer has noticed: a model-written summary of the author's style across all published posts.
alter table draftsmith.profiles
  add column voice_summary            text,
  add column voice_summary_updated_at timestamptz,
  add column voice_summary_post_count int;
