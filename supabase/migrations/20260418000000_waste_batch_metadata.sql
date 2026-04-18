create table if not exists waste_batch_metadata (
  batch_id       bigint      primary key,
  user_id        uuid        references auth.users on delete set null,
  description    text        not null default '',
  photo_url      text,
  location_label text        not null default '',
  created_at     timestamptz not null default now()
);

alter table waste_batch_metadata enable row level security;

-- Public can read all metadata (dashboard is public)
create policy "public_read"
  on waste_batch_metadata
  for select
  using (true);

-- Authenticated users can insert their own rows
create policy "auth_insert"
  on waste_batch_metadata
  for insert
  with check (auth.uid() = user_id);
