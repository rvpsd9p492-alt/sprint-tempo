/* Darstellung (System / Hell / Dunkel) – im <head> geladen, damit vor dem ersten Anzeigen nichts aufblitzt.
   Gespeichert je Gerät (nicht in der Cloud). */
(function () {
  "use strict";
  const KEY = "laTheme";
  const get = () => { try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch (e) { return "system"; } };
  function apply(mode) {
    const root = document.documentElement;
    if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode); else root.removeAttribute("data-theme");
    const dark = mode === "dark" || (mode === "system" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    // Statusleiste/Browserleiste passend einfärben
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.removeAttribute("media"); m.setAttribute("content", dark ? "#0E1824" : "#E9EEF2"); });
  }
  function set(mode) {
    try { if (mode === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch (e) {}
    apply(get());
  }
  apply(get());
  document.addEventListener("DOMContentLoaded", () => apply(get()));
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => apply(get()));
  window.LA_THEME = { get, set };
})();
