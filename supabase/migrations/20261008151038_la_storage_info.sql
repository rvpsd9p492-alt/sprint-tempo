-- Speicherbelegung für die Anzeige in der App (Datensicherung → Cloud).
-- Läuft mit den Rechten des angemeldeten Benutzers (security invoker):
-- eigene Datensätze über die Zeilen-Sicherheit, dazu die Gesamtgröße der Datenbank.
create or replace function public.la_storage_info()
returns json
language sql
stable
security invoker
set search_path = ''
as $$
  select json_build_object(
    'own_bytes', coalesce((select sum(pg_column_size(r.*))::bigint from public.la_records r where r.user_id = (select auth.uid())), 0),
    'own_rows',  (select count(*) from public.la_records r where r.user_id = (select auth.uid()) and not r.deleted),
    'db_bytes',  pg_database_size(current_database())
  );
$$;

revoke all on function public.la_storage_info() from public, anon;
grant execute on function public.la_storage_info() to authenticated;
