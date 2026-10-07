-- Example posts per style: real posts by the author, used as few-shot voice references.
alter table draftsmith.styles
  add column example_posts text[] not null default '{}'
  check (cardinality(example_posts) <= 8);
