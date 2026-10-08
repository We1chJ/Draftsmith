-- Photos attached to posts. Files live in a private Storage bucket; this table is the index.
-- Only the server (service key) reads or writes the bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('draftsmith-images', 'draftsmith-images', false, 10485760, array['image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do nothing;

create table draftsmith.post_images (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  post_id    uuid not null references draftsmith.posts (id) on delete cascade,
  path       text not null unique,
  mime       text not null,
  bytes      int,
  alt        text,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create index post_images_post on draftsmith.post_images (post_id, position);

alter table draftsmith.post_images enable row level security;
grant all on draftsmith.post_images to service_role;
