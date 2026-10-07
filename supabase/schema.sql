-- Leichtathletik-App: Cloud-Sicherung
-- Einmal im Supabase-Dashboard unter "SQL Editor" ausführen (New query → einfügen → Run).
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.

-- Ein Datensatz je Athlet, Ergebnis bzw. Einstellung, getrennt nach Benutzer.
create table if not exists public.la_records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('athlete', 'result', 'settings')),
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null,                -- Zeitpunkt der Änderung auf dem Gerät: neuere Änderung gewinnt
  server_at  timestamptz not null default now(),  -- Zeitpunkt auf dem Server: "was ist neu seit …"
  primary key (user_id, kind, id)
);

create index if not exists la_records_user_server_at on public.la_records (user_id, server_at);

-- Zeilenweise Zugriffsrechte: jeder Benutzer sieht und ändert nur seine eigenen Daten.
alter table public.la_records enable row level security;

drop policy if exists "la_records_select_own" on public.la_records;
drop policy if exists "la_records_insert_own" on public.la_records;
drop policy if exists "la_records_update_own" on public.la_records;
create policy "la_records_select_own" on public.la_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "la_records_insert_own" on public.la_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "la_records_update_own" on public.la_records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.la_records from anon;
grant select, insert, update on public.la_records to authenticated;

-- Ältere Änderungen überschreiben nie neuere (z. B. ein Gerät, das lange offline war).
create or replace function public.la_records_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.server_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists la_records_touch on public.la_records;
create trigger la_records_touch
  before insert or update on public.la_records
  for each row execute function public.la_records_touch();
