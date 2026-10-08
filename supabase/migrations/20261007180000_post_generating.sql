-- Drafts are written in the background after an idea is submitted.
-- generating = true while the model is writing; error holds the reason if it failed.
alter table draftsmith.posts add column generating boolean not null default false;
