-- Wettkampfkalender als Kalender-Abo (Apple-Kalender, Outlook, Google).
-- Jeder Benutzer kann einen geheimen Link erzeugen; die Edge-Function "la-calendar" liefert damit
-- seine Wettkämpfe (la_records, kind 'settings', id 'event:…') als iCalendar-Datei.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.

create table if not exists public.la_calendar_tokens (
  user_id    uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  token      text        not null unique check (length(token) >= 24),
  created_at timestamptz not null default now()
);

alter table public.la_calendar_tokens enable row level security;

drop policy if exists "la_calendar_tokens_select_own" on public.la_calendar_tokens;
drop policy if exists "la_calendar_tokens_insert_own" on public.la_calendar_tokens;
drop policy if exists "la_calendar_tokens_update_own" on public.la_calendar_tokens;
drop policy if exists "la_calendar_tokens_delete_own" on public.la_calendar_tokens;
create policy "la_calendar_tokens_select_own" on public.la_calendar_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "la_calendar_tokens_insert_own" on public.la_calendar_tokens
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "la_calendar_tokens_update_own" on public.la_calendar_tokens
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "la_calendar_tokens_delete_own" on public.la_calendar_tokens
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.la_calendar_tokens from anon;
grant select, insert, update, delete on public.la_calendar_tokens to authenticated;

-- Liefert zum geheimen Link nur die Wettkämpfe dieses Benutzers – sonst nichts.
-- security definer, weil der Kalender ohne Anmeldung abruft; der Link selbst ist der Schlüssel.
create or replace function public.la_calendar_feed(p_token text)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select r.data || jsonb_build_object('id', substr(r.id, 7))
  from public.la_calendar_tokens t
  join public.la_records r on r.user_id = t.user_id
  where length(p_token) >= 24
    and t.token = p_token
    and r.kind = 'settings'
    and r.id like 'event:%'
    and not r.deleted
    and r.data is not null;
$$;

revoke all on function public.la_calendar_feed(text) from public;
-- nur die Edge-Function ruft sie auf (mit dem öffentlichen Schlüssel = Rolle anon)
grant execute on function public.la_calendar_feed(text) to anon;
