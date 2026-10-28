-- Smart Plant Care Assistant / Verdant
-- Run in Supabase Dashboard -> SQL Editor.
-- This starter schema is intentionally single-collection (no auth ownership yet).

create extension if not exists pgcrypto;

create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  species text not null check (char_length(trim(species)) between 1 and 100),
  location text not null check (char_length(trim(location)) between 1 and 100),
  light text not null default 'indirect'
    check (light in ('low', 'indirect', 'bright', 'direct')),
  water_interval_days integer not null default 7
    check (water_interval_days between 1 and 60),
  last_watered date not null default current_date,
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plants_created_at_idx on public.plants (created_at desc);
create index if not exists plants_name_idx on public.plants (name);
create index if not exists plants_last_watered_idx on public.plants (last_watered);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_plants_updated_at on public.plants;
create trigger set_plants_updated_at
before update on public.plants
for each row execute function public.set_updated_at();

-- The Node backend uses the service-role key, which bypasses RLS.
-- RLS is enabled as a safe default for direct client access. Do not place the
-- service-role key in frontend code. Add authenticated, per-user policies before
-- introducing browser-side Supabase access.
alter table public.plants enable row level security;

-- Optional seed rows for a first demo. Uncomment to add sample plants.
-- insert into public.plants (name, species, location, light, water_interval_days, last_watered, notes)
-- values
-- ('Mona', 'Monstera deliciosa', 'Living room', 'indirect', 7, current_date - 5, 'Keep leaves dust-free.'),
-- ('Olive', 'Ficus elastica', 'Bedroom corner', 'bright', 9, current_date - 11, '');
