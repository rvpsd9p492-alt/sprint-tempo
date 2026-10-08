/* Supabase-Zugang für die Cloud-Sicherung.
   url und anonKey stehen im Supabase-Dashboard unter Project Settings → API Keys
   (Publishable key oder Legacy anon key). Der Key ist für den Einsatz im Browser gedacht; die Daten schützt die
   Zeilen-Sicherheit (Row Level Security) aus supabase/migrations/.
   Leer = Cloud-Sicherung ausgeschaltet.
   dbLimitMB: Datenbank-Limit des Tarifs für die Speicheranzeige (Free 500, Pro 8192). */
window.LA_CLOUD = {
  url: "https://hdtukcemlnhaoirdxitc.supabase.co",
  anonKey: "sb_publishable_mZEjHvyn3YdOXH5TLJWLwQ_TXnXkWyn",
  dbLimitMB: 500,
};
