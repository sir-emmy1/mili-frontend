/* =============================================================
  BAMIYO ISELEMA EMINA — site configuration
   Edit these values to make the site your own. No build step.
   ============================================================= */

window.LUMEN_CONFIG = {
  /* Brand ---------------------------------------------------- */
  businessName: "Bamiyo Iselema Emina",
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
  whatsappPrefill: "Hi Bamiyo! I'd like to book a photography session.",

  /* Supabase ------------------------------------------------
     Leave BOTH blank to run in DEMO MODE (localStorage + seed
     data, no account needed). Fill them in to use a real
     Supabase project — everything then reads/writes live.     */
  supabaseUrl: "https://hojptkvockwsrljoxcpw.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvanB0a3ZvY2t3c3Jsam94Y3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMTYxODYsImV4cCI6MjEwMTc5MjE4Nn0.3ar5pfzu1vTkiW9DhnMuuCYx6l48EWj_mM8isjSvlM0",

  /* Cloudinary -----------------------------------------------
     Optional: use Cloudinary free-tier image storage for gallery
     uploads so your images can live outside Supabase storage limits.
     Add the Cloud Name and an unsigned upload preset created in the
     Cloudinary dashboard. No secret key belongs in the browser. */
  cloudinaryCloudName: "gmmizvmx",
  cloudinaryUploadPreset: "Bamiyo-gallery",

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

/* True when Cloudinary is configured for gallery uploads. */
window.isCloudinaryConfigured = function () {
  const c = window.LUMEN_CONFIG;
  return Boolean(c.cloudinaryCloudName && c.cloudinaryUploadPreset);
};

/* Upload a file to Cloudinary using an unsigned preset.
   This is browser-safe because the preset is public and no secret key is used. */
window.uploadToCloudinary = async function (file) {
  const c = window.LUMEN_CONFIG;
  if (!window.isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", c.cloudinaryUploadPreset);
  formData.append("folder", "lumen-studio/gallery");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${c.cloudinaryCloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary upload failed: ${text}`);
  }

  const payload = await response.json();
  return payload.secure_url || payload.url;
};

/* Build a WhatsApp deep link with an optional custom message. */
window.buildWhatsappLink = function (message) {
  const c = window.LUMEN_CONFIG;
  const text = encodeURIComponent(message || c.whatsappPrefill);
  return `https://wa.me/${c.whatsappNumber}?text=${text}`;
};
