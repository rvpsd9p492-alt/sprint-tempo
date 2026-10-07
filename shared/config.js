/* Supabase-Zugang für die Cloud-Sicherung.
   url und anonKey stehen im Supabase-Dashboard unter Project Settings → API.
   Der anon-Key ist für den Einsatz im Browser gedacht; die Daten schützt die
   Zeilen-Sicherheit (Row Level Security) aus supabase/migrations/.
   Leer = Cloud-Sicherung ausgeschaltet. */
window.LA_CLOUD = {
  url: "",
  anonKey: "",
};
