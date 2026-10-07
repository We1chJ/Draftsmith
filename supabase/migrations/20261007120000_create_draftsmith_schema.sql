-- Draftsmith: LinkedIn content system.
-- Lives entirely in its own schema; touches nothing in public, dydit, or auth (beyond FKs to auth.users).
-- Access model: server-only. The schema is NOT granted to anon/authenticated, so it is
-- unreachable from the browser even if someone adds it to the API's exposed schemas.
-- Server code connects as postgres/service_role (both bypass RLS) and must filter by user_id.

create schema draftsmith;

revoke all on schema draftsmith from public, anon, authenticated;
grant usage on schema draftsmith to service_role;
alter default privileges in schema draftsmith grant all on tables to service_role;
alter default privileges in schema draftsmith grant all on sequences to service_role;
alter default privileges in schema draftsmith grant execute on functions to service_role;
alter default privileges in schema draftsmith revoke execute on functions from public;

-- Enums ---------------------------------------------------------------------

create type draftsmith.idea_status as enum ('new', 'drafted', 'used', 'archived');
create type draftsmith.post_status as enum ('draft', 'approved', 'scheduled', 'publishing', 'published', 'failed');
create type draftsmith.publish_outcome as enum ('success', 'failed', 'retrying');

-- Shared trigger: updated_at -------------------------------------------------

create function draftsmith.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- profiles (spec: users) -----------------------------------------------------
-- One row per writer, keyed to Supabase Auth. Email lives in auth.users.

create table draftsmith.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  name               text,
  timezone           text not null default 'UTC',
  default_post_times time[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_updated_at before update on draftsmith.profiles
  for each row execute function draftsmith.set_updated_at();

-- linkedin_accounts ----------------------------------------------------------
-- access_token is encrypted by the app (AES-256-GCM) before insert; never plaintext here.

create table draftsmith.linkedin_accounts (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users (id) on delete cascade,
  author_urn             text not null,
  access_token_encrypted text not null,
  expires_at             timestamptz not null,
  connected_at           timestamptz not null default now()
);

-- styles ---------------------------------------------------------------------

create table draftsmith.styles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null,
  description        text,
  tone_rules         text,
  structure_template text,
  min_length         int check (min_length >= 0),
  max_length         int check (max_length <= 3000),
  banned_words       text[] not null default '{}',
  emoji_policy       text,
  cta_style          text,
  is_default         boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, name),
  check (min_length is null or max_length is null or min_length <= max_length)
);

-- At most one default style per user.
create unique index styles_one_default_per_user on draftsmith.styles (user_id) where is_default;

create trigger styles_updated_at before update on draftsmith.styles
  for each row execute function draftsmith.set_updated_at();

-- ideas ----------------------------------------------------------------------

create table draftsmith.ideas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  text       text not null,
  source     text,
  tags       text[] not null default '{}',
  status     draftsmith.idea_status not null default 'new',
  created_at timestamptz not null default now()
);

create index ideas_user_status on draftsmith.ideas (user_id, status, created_at desc);
create index ideas_tags on draftsmith.ideas using gin (tags);

-- posts ----------------------------------------------------------------------
-- Current text only; no edit history (out of scope).

create table draftsmith.posts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  idea_id          uuid references draftsmith.ideas (id) on delete set null,
  style_id         uuid references draftsmith.styles (id) on delete set null,
  text             text not null default '' check (char_length(text) <= 3000),
  status           draftsmith.post_status not null default 'draft',
  scheduled_at     timestamptz,
  published_at     timestamptz,
  linkedin_post_id text unique,
  locked_at        timestamptz,
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_at is not null),
  check (status <> 'publishing' or locked_at is not null)
);

create index posts_user_status on draftsmith.posts (user_id, status);
-- The scheduler's lookup: due scheduled posts.
create index posts_due on draftsmith.posts (scheduled_at) where status = 'scheduled';
create index posts_user_calendar on draftsmith.posts (user_id, coalesce(published_at, scheduled_at));

create trigger posts_updated_at before update on draftsmith.posts
  for each row execute function draftsmith.set_updated_at();

-- A published post never changes and is never deleted (keeps the publish record intact, N1).
create function draftsmith.protect_published_post() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'published' then
    raise exception 'post % is published and cannot be modified or deleted', old.id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger posts_protect_published before update or delete on draftsmith.posts
  for each row execute function draftsmith.protect_published_post();

-- publish_log ----------------------------------------------------------------
-- One row per publish attempt, success or failure.

create table draftsmith.publish_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  post_id       uuid not null references draftsmith.posts (id) on delete cascade,
  attempted_at  timestamptz not null default now(),
  outcome       draftsmith.publish_outcome not null,
  http_status   int,
  error_message text
);

create index publish_log_user_day on draftsmith.publish_log (user_id, attempted_at desc);
create index publish_log_post on draftsmith.publish_log (post_id);

-- RLS: on everywhere, no policies => deny-all for anon/authenticated.
-- postgres and service_role bypass RLS; server code scopes by user_id.

alter table draftsmith.profiles          enable row level security;
alter table draftsmith.linkedin_accounts enable row level security;
alter table draftsmith.styles            enable row level security;
alter table draftsmith.ideas             enable row level security;
alter table draftsmith.posts             enable row level security;
alter table draftsmith.publish_log       enable row level security;

grant all on all tables in schema draftsmith to service_role;
revoke execute on all functions in schema draftsmith from public;
