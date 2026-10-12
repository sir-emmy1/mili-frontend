/* =============================================================
  BIE PHOTOGRAPHY — site configuration
   Edit these values to make the site your own. No build step.
   ============================================================= */

window.LUMEN_CONFIG = {
  /* Brand ---------------------------------------------------- */
  businessName: "BIE Photography",
  tagline: "Human essence, framed in a picture",

  /* Logo shown at the top-left of the nav bar.
     Drop your own image in the assets/ folder and point this at
     it (SVG, PNG, or JPG all work). Leave BLANK to fall back to
     the built-in amber dot mark.                               */
  logoUrl: "assets/logof.png",
  email: "Kiosh.7111@gmail.com",
  phoneDisplay: "+234 805 511 0178",

  /* WhatsApp — digits only, incl. country code, no + or spaces.
     Used by the “Custom package” CTA to open a chat.          */
  whatsappNumber: "2348055110178",
  whatsappPrefill:
    "Hi Bamiyo! I'd like to book a photography session.",

  /* Supabase ------------------------------------------------
     IMPORTANT: Only use the ANON KEY here, never the service role key!
     The anon key is safe to expose publicly.
     Leave BOTH blank to run in DEMO MODE.                    */
  supabaseUrl: "YOUR_SUPABASE_URL_HERE",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY_HERE",

  /* Storage bucket used for gallery uploads (see schema.sql). */
  storageBucket: "gallery",

  /* SEO defaults -------------------------------------------- */
  siteUrl: "https://Biephotography.example",
  ogImage: "assets/og-cover.svg",
};

/* True only when real Supabase credentials are present. */
window.isSupabaseConfigured = function () {
  const c = window.LUMEN_CONFIG;
  return Boolean(c.supabaseUrl && c.supabaseAnonKey);
};

/* Build a WhatsApp deep link with an optional custom message. */
window.buildWhatsappLink = function (message) {
  const c = window.LUMEN_CONFIG;
  const text = encodeURIComponent(message || c.whatsappPrefill);
  return `https://wa.me/${c.whatsappNumber}?text=${text}`;
};