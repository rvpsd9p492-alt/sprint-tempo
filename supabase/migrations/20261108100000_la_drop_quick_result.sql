-- Alte Watch-Schnelleingabe la_quick_result entfernen: ersetzt durch la_quick_result2
-- (Migration 20261020090000), die Edge-Function la-result ruft nur noch diese auf.
-- Die alte Funktion war ohne Anmeldung aufrufbar (SECURITY DEFINER) und damit unnötige Angriffsfläche.
drop function if exists public.la_quick_result(text, text, text, text, text);
