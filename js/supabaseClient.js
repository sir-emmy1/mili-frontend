/* =============================================================
   Supabase client bootstrap.
   The UMD build is loaded from CDN in each HTML page and exposes
   a global `supabase` object with createClient().
   In demo mode this stays null and store.js falls back to
   localStorage seed data.
   ============================================================= */

window.sb = null;

(function initSupabase() {
  if (!window.isSupabaseConfigured()) {
    console.info(
      "[Lumen] Running in DEMO MODE — using local seed data. " +
        "Add Supabase credentials in js/config.js to go live."
    );
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    console.error(
      "[Lumen] Supabase JS library not loaded. Check the CDN <script> tag."
    );
    return;
  }
  const c = window.LUMEN_CONFIG;
  window.sb = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
})();