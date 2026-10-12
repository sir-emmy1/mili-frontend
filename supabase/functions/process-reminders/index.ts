// =============================================================
// process-reminders — Supabase Edge Function (Deno)
// -------------------------------------------------------------
// Run on a schedule (e.g. hourly). For every upcoming booking
// whose reminder window has arrived — i.e. now >= (shoot date
// minus the booking's reminder lead time) — it:
//   1) emails the studio a reminder (ADMIN_NOTIFY_EMAIL),
//   2) inserts a dashboard notification (type 'reminder'),
//   3) marks the booking reminder_sent = true so it fires once.
//
// Each booking carries its own reminder_offset_type/value
// (copied from settings at booking time), so changing the
// default later doesn't retroactively move existing reminders.
//
// Deploy:   supabase functions deploy process-reminders
// Schedule: Dashboard → Edge Functions → process-reminders →
//           Cron  ("0 * * * *" = hourly).  Or via pg_cron:
//     select cron.schedule('lumen-reminders','0 * * * *', $$
//       select net.http_post(
//         url:='https://YOUR-PROJECT.supabase.co/functions/v1/process-reminders',
//         headers:='{"Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
//       ); $$);
//
// Uses the SERVICE ROLE key (server-side only) to bypass RLS.
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAIL_FROM =
  Deno.env.get("MAIL_FROM") ?? "BIE PHOTOGRAPH<karla.smith114@gmail.com>";
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "";
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? "";

// Subtract a lead time (days/weeks/months) from a date.
function reminderMoment(shoot: Date, type: string, value: number): Date {
  const d = new Date(shoot);
  const n = Number(value) || 0;
  if (type === "weeks") d.setDate(d.getDate() - n * 7);
  else if (type === "months") d.setMonth(d.getMonth() - n);
  else d.setDate(d.getDate() - n); // days (default)
  return d;
}

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

async function emailStudio(subject: string, text: string) {
  if (!ADMIN_NOTIFY_EMAIL) return;

  if (SENDGRID_API_KEY) {
    const m = MAIL_FROM.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    const from = m ? { name: m[1] || undefined, email: m[2] } : { email: MAIL_FROM };
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ADMIN_NOTIFY_EMAIL }] }],
        from,
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
    if (!res.ok) throw new Error(`SendGrid ${res.status}: ${await res.text()}`);
    return;
  }

  const host = Deno.env.get("SMTP_HOST");
  if (!host) {
    console.warn("No email provider configured; skipping reminder email.");
    return;
  }
  const { SMTPClient } = await import(
    "https://deno.land/x/denomailer@1.6.0/mod.ts"
  );
  const port = Number(Deno.env.get("SMTP_PORT") ?? "587");
  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      tls: port === 465,
      auth: {
        username: Deno.env.get("SMTP_USER") ?? "",
        password: Deno.env.get("SMTP_PASS") ?? "",
      },
    },
  });
  await client.send({ from: MAIL_FROM, to: ADMIN_NOTIFY_EMAIL, subject, content: text });
  await client.close();
}

Deno.serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const now = new Date();
  const processed: string[] = [];

  // Look only at future shoots that haven't been reminded and
  // aren't cancelled.
  const { data: bookings, error } = await sb
    .from("bookings")
    .select("*")
    .eq("reminder_sent", false)
    .neq("status", "cancelled")
    .gte("date_time", now.toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  for (const b of bookings ?? []) {
    const shoot = new Date(b.date_time);
    const fireAt = reminderMoment(
      shoot,
      b.reminder_offset_type,
      b.reminder_offset_value
    );
    if (now < fireAt) continue; // window hasn't opened yet

    const when = fmtDate(b.date_time);
    const msg = `Upcoming shoot: ${b.client_name} on ${when}.`;

    try {
      await emailStudio(`Reminder — ${b.client_name}`, msg);
    } catch (e) {
      console.error("Reminder email failed:", e);
    }

    await sb.from("notifications").insert({
      type: "reminder",
      message: msg,
      related_id: b.id,
      read: false,
    });

    await sb.from("bookings").update({ reminder_sent: true }).eq("id", b.id);
    processed.push(b.id);
  }

  return new Response(
    JSON.stringify({ ok: true, processed: processed.length, ids: processed }),
    { headers: { "Content-Type": "application/json" } }
  );
});