-- One voice per user: free-text instructions on the profile, plus a history of real posts
-- (past_posts) that doubles as the few-shot example set for the writer.

alter table draftsmith.profiles add column voice_instructions text;

create table draftsmith.past_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  text       text not null check (char_length(text) <= 3000),
  posted_on  date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index past_posts_user_date on draftsmith.past_posts (user_id, posted_on desc nulls last, created_at desc);

create trigger past_posts_updated_at before update on draftsmith.past_posts
  for each row execute function draftsmith.set_updated_at();

alter table draftsmith.past_posts enable row level security;
grant all on draftsmith.past_posts to service_role;

-- Superseded by past_posts before it was ever used.
alter table draftsmith.styles drop column example_posts;
