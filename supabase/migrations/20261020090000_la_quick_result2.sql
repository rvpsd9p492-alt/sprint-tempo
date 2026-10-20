-- Watch-Rückmeldung mit Intensität: la_quick_result2 speichert den Trainingslauf wie la_quick_result und liefert
-- zusätzlich die wirksamen Bestzeiten (60/100/200/400 m wie in der App: beste gültige Zeit der letzten 18 Monate,
-- manuelle Werte bzw. Überschreibungen) und die Sprint-Tempo-Stellschrauben. Die Edge-Function "la-result"
-- berechnet daraus mit demselben Modell wie die App die Intensität in %.
-- la_quick_result bleibt für ältere Aufrufe bestehen. Gefahrlos mehrfach ausführbar.

create or replace function public.la_quick_result2(p_token text, p_dist text, p_time text, p_venue text default null, p_athlete text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid; v_dist int; v_t text; v_val numeric; v_dec int; v_mark text; v_start text;
  v_ath text; v_name text; v_n int; v_id text; v_now timestamptz := now(); v_date date;
  v_manual jsonb; v_pb jsonb := '{}'::jsonb; v_set jsonb; d text; v_auto numeric; v_m numeric; v_over boolean;
begin
  if p_token is null or length(p_token) < 24 then return jsonb_build_object('ok', false, 'msg', 'Fehler: Link ungültig.'); end if;
  select user_id into v_user from public.la_entry_tokens where token = p_token;
  if v_user is null then return jsonb_build_object('ok', false, 'msg', 'Fehler: Link ungültig.'); end if;

  v_dist := nullif(regexp_replace(coalesce(p_dist, ''), '[^0-9]', '', 'g'), '')::int;
  if v_dist is null or v_dist not in (50, 60, 80, 100, 150, 200, 250) then
    return jsonb_build_object('ok', false, 'msg', 'Fehler: Strecke nicht erlaubt.');
  end if;

  v_t := replace(trim(coalesce(p_time, '')), ',', '.');
  if v_t ~ '^\d{1,2}:\d{1,2}(\.\d{1,2})?$' then
    v_val := split_part(v_t, ':', 1)::numeric * 60 + split_part(v_t, ':', 2)::numeric;
  elsif v_t ~ '^\d{1,3}(\.\d{1,2})?$' then
    v_val := v_t::numeric;
  else
    return jsonb_build_object('ok', false, 'msg', 'Fehler: Zeit nicht lesbar (z. B. 12,34).');
  end if;
  if v_val < 4 or v_val > 120 then
    return jsonb_build_object('ok', false, 'msg', 'Fehler: Zeit ' || replace(to_char(v_val, 'FM99990.00'), '.', ',') || ' s unplausibel (erlaubt 4 bis 120 s).');
  end if;
  v_dec := greatest(1, coalesce(length(substring(v_t from '\.(\d+)$')), 1));
  v_mark := replace(to_char(v_val, 'FM990.' || repeat('0', v_dec)), '.', ',');
  if v_val >= 60 then
    v_mark := floor(v_val / 60)::int || ':' || lpad(replace(to_char(v_val - floor(v_val / 60) * 60, 'FM90.' || repeat('0', v_dec)), '.', ','), 3 + v_dec, '0');
  end if;

  v_start := case lower(coalesce(trim(p_venue), ''))
    when 'tief' then 'block' when 'tiefstart' then 'block' when 'block' then 'block'
    when 'fliegend' then 'fly' when 'fly' then 'fly' else 'hoch' end;

  -- Athlet: per Name, sonst der einzige Athlet, sonst ohne Zuordnung
  if coalesce(trim(p_athlete), '') <> '' then
    select id, data->>'name', data->'manual' into v_ath, v_name, v_manual from public.la_records
      where user_id = v_user and kind = 'athlete' and not deleted and lower(data->>'name') = lower(trim(p_athlete)) limit 1;
  else
    select count(*) into v_n from public.la_records where user_id = v_user and kind = 'athlete' and not deleted;
    if v_n = 1 then
      select id, data->>'name', data->'manual' into v_ath, v_name, v_manual from public.la_records
        where user_id = v_user and kind = 'athlete' and not deleted;
    end if;
  end if;

  v_date := (v_now at time zone 'Europe/Berlin')::date;
  v_id := 'w' || replace(gen_random_uuid()::text, '-', '');
  insert into public.la_records (user_id, kind, id, data, updated_at) values (v_user, 'settings', 'run:' || v_id, jsonb_build_object(
    'id', v_id, 'athleteId', v_ath, 'date', to_char(v_date, 'YYYY-MM-DD'), 'dist', v_dist, 'value', round(v_val, 2), 'mark', v_mark,
    'start', v_start, 'timing', 'hand', 'runin', 20, 'source', 'watch', 'note', '', 'createdAt', v_now, 'updatedAt', v_now), v_now);

  -- Wirksame Bestzeiten wie in der App (LA.effectivePBs)
  if v_ath is not null then
    foreach d in array array['60', '100', '200', '400'] loop
      select min((r.data->>'value')::numeric) into v_auto from public.la_records r
        where r.user_id = v_user and r.kind = 'result' and not r.deleted
          and r.data->>'athleteId' = v_ath and r.data->>'discipline' = d || ' m'
          and r.data->>'value' is not null and coalesce((r.data->>'hand')::boolean, false) = false
          and (r.data->>'wind' is null or (r.data->>'wind')::numeric <= 2.0)
          and r.data->>'date' >= to_char(v_date - interval '18 months', 'YYYY-MM-DD');
      v_m := nullif(v_manual->d->>'v', '')::numeric;
      v_over := coalesce((v_manual->d->>'over')::boolean, false);
      if v_m is not null and (v_over or v_auto is null) then v_pb := v_pb || jsonb_build_object(d, v_m);
      elsif v_auto is not null then v_pb := v_pb || jsonb_build_object(d, v_auto);
      end if;
    end loop;
  end if;
  select data into v_set from public.la_records where user_id = v_user and kind = 'settings' and id = 'tempo' and not deleted;

  return jsonb_build_object('ok', true, 'dist', v_dist, 'value', round(v_val, 2), 'mark', v_mark, 'start', v_start,
    'timing', 'hand', 'runin', 20, 'name', v_name, 'pb', v_pb, 'set', coalesce(v_set, '{}'::jsonb),
    'msg', 'Training gespeichert: ' || v_dist || ' m in ' || v_mark || ' s' || coalesce(' (' || v_name || ')', ' (ohne Athlet)'));
end;
$$;

revoke all on function public.la_quick_result2(text, text, text, text, text) from public;
revoke execute on function public.la_quick_result2(text, text, text, text, text) from authenticated;
-- nur die Edge-Function ruft sie auf (mit dem öffentlichen Schlüssel = Rolle anon)
grant execute on function public.la_quick_result2(text, text, text, text, text) to anon;
