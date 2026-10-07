-- Angemeldete Benutzer brauchen nur Lesen, Anlegen und Ändern.
-- Entzieht Supabase-Standardrechte wie DELETE und TRUNCATE (TRUNCATE unterliegt keiner Row Level Security).
revoke all on public.la_records from authenticated;
grant select, insert, update on public.la_records to authenticated;
