-- Aplicar una sola vez desde Supabase SQL Editor. No usa migrations.
create table if not exists public.chat_messages (
  id uuid primary key,
  room_id text not null,
  sender_identity text not null,
  sender_name text not null check (char_length(sender_name) between 1 and 32),
  body text not null check (char_length(body) between 1 and 1000),
  sent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_sent_at_idx
  on public.chat_messages (room_id, sent_at);

alter table public.chat_messages enable row level security;

-- No hay policies: las apps cliente no acceden a esta tabla. El backend usa
-- la secret key para guardar y recuperar el historial por su API autenticada.

-- Imágenes del pizarrón compartido. El backend sube los archivos y las URLs
-- resultantes se distribuyen a participantes conectados por LiveKit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('board-assets', 'board-assets', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
