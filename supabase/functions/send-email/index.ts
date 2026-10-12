// =============================================================
// send-email — Supabase Edge Function (Deno)
// -------------------------------------------------------------
// Sends transactional mail via Resend API.
// Invoked from the browser by store.js right after a booking:
//
//   supabase.functions.invoke("send-email", {
//     body: { kind: "booking_confirmation", to, name, date_time }
//   })
//
// It emails BOTH the client (confirmation) and the studio
// (ADMIN_NOTIFY_EMAIL) so the dashboard owner gets a heads-up.
//
// Deploy:  supabase functions deploy send-email --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=re_... MAIL_FROM=... \
//                               ADMIN_NOTIFY_EMAIL=...
// =============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAIL_FROM =
  Deno.env.get("MAIL_FROM") ?? "BIE Photography <onboarding@resend.dev>";
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

// ---- Send email via Resend API ------------------------------
async function sendMail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend API error: ${res.status} - ${error}`);
  }

  return await res.json();
}

// ---- Email templates -----------------------------------------
function clientConfirmation(name: string, when: string) {
  const subject = "Your BIE Photography booking request";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f6f2ea; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="font-family: Georgia, serif; font-weight: 400; font-size: 28px; margin: 0 0 10px;">Thank you, ${name}.</h1>
        <p style="margin: 0; font-size: 16px;">We've received your booking request with <strong>BIE Photography</strong>.</p>
      </div>
      
      <div style="background: #fff3e0; padding: 16px; border-left: 4px solid #e6a338; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-weight: 600;">📅 Preferred date & time</p>
        <p style="margin: 0; font-size: 15px;">${when}</p>
      </div>
      
      <p style="font-size: 15px; line-height: 1.7;">
        We'll confirm availability and be in touch within one business day. 
        If you have any questions in the meantime, feel free to reply to this email.
      </p>
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 13px;">
        <p style="margin: 0;">— BIE Photography, Lagos, Nigeria</p>
        <p style="margin: 5px 0 0;">Portraiture · Events · Arts</p>
      </div>
    </body>
    </html>`;
  return { subject, html };
}

function studioAlert(name: string, email: string, when: string) {
  const subject = `New booking request — ${name}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="font-family: Georgia, serif; font-weight: 400; font-size: 24px;">🎉 New booking request</h2>
      
      <div style="background: #f6f2ea; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px;"><strong>Client:</strong> ${name}</p>
        <p style="margin: 0 0 10px;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #e6a338;">${email}</a></p>
        <p style="margin: 0;"><strong>Requested:</strong> ${when}</p>
      </div>
      
      <p style="font-size: 15px;">
        A new client has submitted a booking request. 
        <a href="https://your-site.com/admin.html" style="color: #e6a338; text-decoration: none; font-weight: 600;">Open the admin dashboard</a> 
        to review and confirm.
      </p>
      
      <div style="margin-top: 30px; padding: 15px; background: #e8f5e9; border-radius: 6px;">
        <p style="margin: 0; font-size: 14px;">💡 <strong>Tip:</strong> Reply to them within 24 hours to keep engagement high!</p>
      </div>
    </body>
    </html>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { kind, to, name, date_time } = await req.json();

    if (kind !== "booking_confirmation") {
      return new Response(
        JSON.stringify({ error: `Unknown kind: ${kind}` }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    if (!to || !name) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'name'." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const when = fmtDate(date_time);

    // 1) Confirmation to the client
    const c = clientConfirmation(name, when);
    await sendMail(to, c.subject, c.html);

    // 2) Alert to the studio admin (best-effort)
    if (ADMIN_NOTIFY_EMAIL) {
      try {
        const a = studioAlert(name, to, when);
        await sendMail(ADMIN_NOTIFY_EMAIL, a.subject, a.html);
      } catch (e) {
        console.error("Studio alert failed:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});