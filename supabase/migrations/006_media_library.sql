-- Migration: 006_media_library.sql
-- Purpose: Create a dedicated media_library table for standalone media uploads
--          with slugified filenames and short branded URLs

create table if not exists public.media_library (
  id          uuid primary key default gen_random_uuid(),
  filename    text not null,
  url         text not null,
  storage_path text not null unique,
  mime_type   text,
  size_bytes  bigint,
  alt_text    text,
  created_at  timestamptz not null default now()
);

comment on table public.media_library is 'Standalone media library items with slugified filenames and short branded URLs';
comment on column public.media_library.filename is 'Slugified basename, e.g. rose-gold-bangle-a41f928c.png';
comment on column public.media_library.url is 'Short branded URL: https://ivyandpearls.co.uk/media/{filename}';
