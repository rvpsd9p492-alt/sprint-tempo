-- Schnelleingabe von Ergebnissen (z. B. Kurzbefehl auf der Apple Watch).
-- Jeder Benutzer kann einen geheimen Watch-Link erzeugen (getrennt vom Kalender-Link, weil er schreiben darf);
-- die Edge-Function "la-result" legt damit ein handgestopptes Ergebnis an.
-- Das Skript kann gefahrlos mehrfach ausgeführt werden.

create table if not exists public.la_entry_tokens (
  user_id    uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  token      text        not null unique check (length(token) >= 24),
  created_at timestamptz not null default now()
);

alter table public.la_entry_tokens enable row level security;
revoke all on public.la_entry_tokens from anon;

drop policy if exists "la_entry_tokens_select_own" on public.la_entry_tokens;
drop policy if exists "la_entry_tokens_insert_own" on public.la_entry_tokens;
drop policy if exists "la_entry_tokens_update_own" on public.la_entry_tokens;
drop policy if exists "la_entry_tokens_delete_own" on public.la_entry_tokens;
create policy "la_entry_tokens_select_own" on public.la_entry_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "la_entry_tokens_insert_own" on public.la_entry_tokens
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "la_entry_tokens_update_own" on public.la_entry_tokens
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "la_entry_tokens_delete_own" on public.la_entry_tokens
  for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.la_entry_tokens to authenticated;

-- Legt zum Watch-Link ein Ergebnis an und liefert eine kurze Rückmeldung für die Uhr.
-- Strecke: 50, 60, 80, 100, 150, 200, 250 (m); Zeit: "12,34", "12.3" oder "1:02,5".
create or replace function public.la_quick_result(p_token text, p_dist text, p_time text, p_venue text default null, p_athlete text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid; v_dist int; v_t text; v_val numeric; v_dec int; v_mark text;
  v_ath text; v_name text; v_n int; v_id text; v_now timestamptz := now(); v_date date;
begin
  if p_token is null or length(p_token) < 24 then return 'Fehler: Link ungültig.'; end if;
  select user_id into v_user from public.la_entry_tokens where token = p_token;
  if v_user is null then return 'Fehler: Link ungültig.'; end if;

  v_dist := nullif(regexp_replace(coalesce(p_dist, ''), '[^0-9]', '', 'g'), '')::int;
  if v_dist is null or v_dist not in (50, 60, 80, 100, 150, 200, 250) then return 'Fehler: Strecke nicht erlaubt.'; end if;

  v_t := replace(trim(coalesce(p_time, '')), ',', '.');
  if v_t ~ '^\d{1,2}:\d{1,2}(\.\d{1,2})?$' then
    v_val := split_part(v_t, ':', 1)::numeric * 60 + split_part(v_t, ':', 2)::numeric;
  elsif v_t ~ '^\d{1,3}(\.\d{1,2})?$' then
    v_val := v_t::numeric;
  else
    return 'Fehler: Zeit nicht lesbar (z. B. 12,34).';
  end if;
  if v_val < 4 or v_val > 120 then return 'Fehler: Zeit unplausibel.'; end if;
  v_dec := greatest(1, coalesce(length(substring(v_t from '\.(\d+)$')), 1));
  v_mark := replace(to_char(v_val, 'FM990.' || repeat('0', v_dec)), '.', ',');
  if v_val >= 60 then
    v_mark := floor(v_val / 60)::int || ':' || lpad(replace(to_char(v_val - floor(v_val / 60) * 60, 'FM90.' || repeat('0', v_dec)), '.', ','), 3 + v_dec, '0');
  end if;

  -- Athlet: per Name, sonst der einzige Athlet, sonst ohne Zuordnung
  if coalesce(trim(p_athlete), '') <> '' then
    select id, data->>'name' into v_ath, v_name from public.la_records
      where user_id = v_user and kind = 'athlete' and not deleted and lower(data->>'name') = lower(trim(p_athlete)) limit 1;
  else
    select count(*) into v_n from public.la_records where user_id = v_user and kind = 'athlete' and not deleted;
    if v_n = 1 then
      select id, data->>'name' into v_ath, v_name from public.la_records where user_id = v_user and kind = 'athlete' and not deleted;
    end if;
  end if;

  v_date := (v_now at time zone 'Europe/Berlin')::date;
  v_id := 'r' || replace(gen_random_uuid()::text, '-', '');
  insert into public.la_records (user_id, kind, id, data, updated_at) values (v_user, 'result', v_id, jsonb_build_object(
    'id', v_id, 'athleteId', v_ath, 'date', to_char(v_date, 'YYYY-MM-DD'), 'discipline', v_dist || ' m', 'kind', 't',
    'venue', case when lower(coalesce(p_venue, '')) in ('halle', 'indoor', 'h') then 'indoor' else 'outdoor' end,
    'mark', v_mark, 'value', round(v_val, 2), 'wind', null, 'hand', true, 'meet', '', 'champ', '', 'intl', false,
    'place', null, 'comment', 'Apple Watch', 'createdAt', v_now, 'updatedAt', v_now), v_now);

  return 'Gespeichert: ' || v_dist || ' m in ' || v_mark || ' s' || coalesce(' (' || v_name || ')', ' (ohne Athlet)');
end;
$$;

revoke all on function public.la_quick_result(text, text, text, text, text) from public;
revoke execute on function public.la_quick_result(text, text, text, text, text) from authenticated;
-- nur die Edge-Function ruft sie auf (mit dem öffentlichen Schlüssel = Rolle anon)
grant execute on function public.la_quick_result(text, text, text, text, text) to anon;
