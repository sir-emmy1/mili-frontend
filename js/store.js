/* =============================================================
   store.js — single data-access layer for the whole site.

   Every page talks to this module, never to Supabase directly.
   When credentials exist (window.sb set) it uses Supabase;
   otherwise it uses a seeded localStorage store so the site is
   fully functional in DEMO MODE with zero setup.
   ============================================================= */

(function () {
  const LIVE = () => !!window.sb;
  const cfg = window.LUMEN_CONFIG;

  /* ---------- Demo storage helpers ------------------------- */
  const DEMO_KEY = "lumen_demo_v1";
  const uid = () =>
    (crypto.randomUUID && crypto.randomUUID()) ||
    "id-" + Math.random().toString(36).slice(2) + Date.now();
  const nowIso = () => new Date().toISOString();

  function seed() {
    const today = new Date();
    const plus = (d) => {
      const x = new Date(today);
      x.setDate(x.getDate() + d);
      return x.toISOString();
    };
    return {
      gallery: [
        {
          id: uid(),
          title: "Golden Hour, Coastline",
          description:
            "Editorial shoot along the northern cliffs at last light.",
          image_url: img("#c98a3a", "#241a10", "coast"),
          tags: ["portrait", "outdoor"],
          price: 480,
          created_at: plus(-40),
        },
        {
          id: uid(),
          title: "Studio Monochrome",
          description: "High-key black & white studio portraiture.",
          image_url: img("#d8d8d8", "#1a1a1a", "mono"),
          tags: ["portrait", "studio"],
          price: 350,
          created_at: plus(-28),
        },
        {
          id: uid(),
          title: "The Vows",
          description: "Ceremony coverage for an intimate garden wedding.",
          image_url: img("#b7c4b1", "#1c231a", "vows"),
          tags: ["wedding", "event"],
          price: 1200,
          created_at: plus(-20),
        },
        {
          id: uid(),
          title: "Concrete & Glass",
          description: "Architectural series for a downtown developer.",
          image_url: img("#9aa7b3", "#141a20", "arch"),
          tags: ["architecture", "commercial"],
          price: 640,
          created_at: plus(-14),
        },
        {
          id: uid(),
          title: "Market Mornings",
          description: "Documentary set from the Saturday market.",
          image_url: img("#d0a95f", "#231c10", "market"),
          tags: ["documentary", "outdoor"],
          price: 300,
          created_at: plus(-9),
        },
        {
          id: uid(),
          title: "Product: Ceramics",
          description: "Tabletop product photography for a ceramics studio.",
          image_url: img("#cbb79b", "#20190f", "ceramics"),
          tags: ["commercial", "studio"],
          price: 420,
          created_at: plus(-3),
        },
      ],
      packages: [
        {
          id: "portrait",
          name: "Portraiture",
          price: 150000,
          description:
            "A focused personal portrait session — individuals, couples, or families. Available light or studio.",
          features: [
            "1.5-hour session, one location",
            "1 outfit / concept",
            "30 hand-edited high-res images",
            "Online gallery for 3 months",
            "Personal print license",
          ],
          sort: 1,
        },
        {
          id: "events",
          name: "Events",
          price: 300000,
          description:
            "Full-day event coverage — corporate, social, or cultural gatherings documented authentically.",
          features: [
            "Up to 6-hour coverage",
            "Unlimited locations within venue",
            "150 hand-edited high-res images",
            "Online gallery for 12 months",
            "Commercial usage license",
            "Delivered within 2 weeks",
          ],
          sort: 2,
        },
        {
          id: "arts",
          name: "Arts",
          price: 500000,
          description:
            "Creative editorial and artistic shoots — fashion, fine art, campaigns, and brand identity.",
          features: [
            "Full-day production (up to 8 hours)",
            "Pre-shoot concept planning call",
            "Multiple concepts / looks",
            "200+ hand-edited high-res images",
            "Full commercial license",
            "Online gallery — lifetime access",
            "BTS documentation",
          ],
          sort: 3,
        },
      ],
      bookings: [
        {
          id: uid(),
          client_name: "Chidi Okonkwo",
          client_email: "chidi@example.com",
          package_id: "portrait",
          custom_details:
            "Personal branding portraits, one location, Lagos Island.",
          date_time: plus(7),
          status: "confirmed",
          reminder_offset_type: "days",
          reminder_offset_value: 3,
          notified_dashboard: true,
          created_at: plus(-3),
        },
        {
          id: uid(),
          client_name: "Lagos Arts Festival",
          client_email: "info@lagosfest.example",
          package_id: "events",
          custom_details: "Full-day cultural event coverage, multiple venues.",
          date_time: plus(21),
          status: "pending",
          reminder_offset_type: "days",
          reminder_offset_value: 3,
          notified_dashboard: true,
          created_at: plus(-1),
        },
      ],
      todos: [
        {
          id: uid(),
          title: "Cull & edit coastline set",
          description: "Deliver 25 finals by Friday.",
          related_booking_id: null,
          status: "pending",
          due_date: plus(2),
          created_at: plus(-1),
        },
        {
          id: uid(),
          title: "Send Bello contract",
          description: "Include second-shooter addendum.",
          related_booking_id: null,
          status: "pending",
          due_date: plus(4),
          created_at: plus(-1),
        },
        {
          id: uid(),
          title: "Back up October cards",
          description: "",
          related_booking_id: null,
          status: "completed",
          due_date: plus(-3),
          created_at: plus(-8),
        },
      ],
      notifications: [
        {
          id: uid(),
          type: "booking",
          message: "New booking request from The Bello Wedding.",
          related_id: null,
          read: false,
          created_at: plus(-2),
        },
        {
          id: uid(),
          type: "reminder",
          message: "Amara Okafor shoot is in 2 days.",
          related_id: null,
          read: false,
          created_at: plus(-1),
        },
      ],
      settings: {
        id: "global",
        reminder_offset_type: "days",
        reminder_offset_value: 3,
      },
      calendarNotes: [],
    };
  }

  /* Tiny inline SVG placeholder so the demo has real imagery. */
  function img(a, b, label) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='1500'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/>
      </linearGradient></defs>
      <rect width='1200' height='1500' fill='url(#g)'/>
      <g fill='none' stroke='rgba(255,255,255,.35)' stroke-width='2'>
        <circle cx='600' cy='750' r='230'/><circle cx='600' cy='750' r='150'/>
        <line x1='600' y1='430' x2='600' y2='300'/><line x1='600' y1='1070' x2='600' y2='1200'/>
        <line x1='280' y1='750' x2='150' y2='750'/><line x1='920' y1='750' x2='1050' y2='750'/>
      </g>
      <text x='60' y='120' fill='rgba(255,255,255,.7)' font-family='monospace' font-size='34'> BIE PHOTOGRAPH · ${label}</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function demoRead() {
    let d = localStorage.getItem(DEMO_KEY);
    if (!d) {
      const s = seed();
      localStorage.setItem(DEMO_KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(d);
  }
  function demoWrite(d) {
    localStorage.setItem(DEMO_KEY, JSON.stringify(d));
  }

  /* ---------- Auth (demo uses a fixed credential) ---------- */
  const DEMO_ADMIN = {
    email: "admin@lumenstudio.example",
    password: "lumen123",
  };

  const Auth = {
    async signIn(email, password) {
      if (LIVE()) {
        const { data, error } = await window.sb.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        return data.user;
      }
      if (
        email.trim().toLowerCase() === DEMO_ADMIN.email &&
        password === DEMO_ADMIN.password
      ) {
        localStorage.setItem("lumen_demo_session", "1");
        return { email: DEMO_ADMIN.email, id: "demo-admin" };
      }
      throw new Error("Invalid email or password.");
    },
    async signOut() {
      if (LIVE()) return void (await window.sb.auth.signOut());
      localStorage.removeItem("lumen_demo_session");
    },
    async currentUser() {
      if (LIVE()) {
        const { data } = await window.sb.auth.getUser();
        return data.user || null;
      }
      return localStorage.getItem("lumen_demo_session")
        ? { email: DEMO_ADMIN.email, id: "demo-admin" }
        : null;
    },
    demoCredential: DEMO_ADMIN,
  };

  /* ---------- Image upload -------------------------------- */
  async function uploadImage(file) {
    if (!file) return null;

    // Prefer Cloudinary when configured. This avoids hitting Supabase storage limits
    // while still storing the image URL in the app's DB records.
    if (window.isCloudinaryConfigured && window.isCloudinaryConfigured()) {
      return window.uploadToCloudinary(file);
    }

    if (LIVE()) {
      const path = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await window.sb.storage
        .from(cfg.storageBucket)
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = window.sb.storage
        .from(cfg.storageBucket)
        .getPublicUrl(path);
      return data.publicUrl;
    }
    // Demo: read as data URL.
    return await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  async function deleteRemoteImageIfNeeded(imageUrl) {
    if (!imageUrl || typeof imageUrl !== "string") return;
    if (!imageUrl.includes("cloudinary.com")) return;

    try {
      const response = await fetch("/api/delete-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        console.warn(
          "[Lumen] delete-image backend rejected request:",
          payload.error || response.statusText,
        );
      }
    } catch (error) {
      console.warn("[Lumen] delete-image backend unavailable:", error.message);
    }
  }

  /* ---------- Gallery ------------------------------------- */
  const Gallery = {
    async list() {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("gallery_items")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      }
      return demoRead().gallery.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
    },
    async create(item, file) {
      const image_url = file ? await uploadImage(file) : item.image_url || null;
      const row = { ...item, image_url };
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("gallery_items")
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const d = demoRead();
      const rec = { id: uid(), created_at: nowIso(), ...row };
      d.gallery.push(rec);
      demoWrite(d);
      return rec;
    },
    async update(id, patch, file) {
      let previousImageUrl = null;
      let nextImageUrl = null;

      if (file) {
        if (LIVE()) {
          const { data: current } = await window.sb
            .from("gallery_items")
            .select("image_url")
            .eq("id", id)
            .single();
          previousImageUrl = current?.image_url || null;
        } else {
          const d = demoRead();
          const item = d.gallery.find((g) => g.id === id);
          previousImageUrl = item?.image_url || null;
        }

        nextImageUrl = await uploadImage(file);
        patch = { ...patch, image_url: nextImageUrl };
      }

      if (LIVE()) {
        const { data, error } = await window.sb
          .from("gallery_items")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;

        if (previousImageUrl && previousImageUrl !== nextImageUrl) {
          await deleteRemoteImageIfNeeded(previousImageUrl);
        }

        return data;
      }

      const d = demoRead();
      const i = d.gallery.findIndex((g) => g.id === id);
      if (i > -1) {
        if (previousImageUrl && previousImageUrl !== nextImageUrl) {
          await deleteRemoteImageIfNeeded(previousImageUrl);
        }
        d.gallery[i] = { ...d.gallery[i], ...patch };
      }
      demoWrite(d);
      return d.gallery[i];
    },
    async remove(id) {
      if (LIVE()) {
        const { data: previous, error: readErr } = await window.sb
          .from("gallery_items")
          .select("image_url")
          .eq("id", id)
          .single();
        if (readErr) throw readErr;

        const { error } = await window.sb
          .from("gallery_items")
          .delete()
          .eq("id", id);
        if (error) throw error;

        await deleteRemoteImageIfNeeded(previous?.image_url);
        return;
      }

      const d = demoRead();
      const removed = d.gallery.find((g) => g.id === id);
      d.gallery = d.gallery.filter((g) => g.id !== id);
      demoWrite(d);
      if (removed?.image_url) {
        await deleteRemoteImageIfNeeded(removed.image_url);
      }
    },
  };

  /* ---------- Packages ------------------------------------ */
  const Packages = {
    async list() {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("packages")
          .select("*")
          .order("sort", { ascending: true });
        if (error) throw error;
        return data;
      }
      return demoRead().packages.sort((a, b) => a.sort - b.sort);
    },
    async update(id, patch) {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("packages")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const d = demoRead();
      const i = d.packages.findIndex((p) => p.id === id);
      if (i > -1) d.packages[i] = { ...d.packages[i], ...patch };
      demoWrite(d);
      return d.packages[i];
    },
  };

  /* ---------- Bookings ------------------------------------ */
  const Bookings = {
    async create(b) {
      const row = {
        client_name: b.client_name,
        client_email: b.client_email,
        package_id: b.package_id || null,
        custom_details: b.custom_details || null,
        date_time: b.date_time,
        status: "pending",
        reminder_offset_type: b.reminder_offset_type || "days",
        reminder_offset_value: b.reminder_offset_value ?? 3,
        notified_dashboard: true,
      };

      /* ── Availability guard ─────────────────────────────────
         Reject if a pending or confirmed booking already exists
         on the same calendar day (any time that day).          */
      const chosenDay = new Date(b.date_time).toISOString().slice(0, 10);
      const existing = await Bookings.list();
      const conflict = existing.find((bk) => {
        if (bk.status === "cancelled" || bk.status === "completed")
          return false;
        return new Date(bk.date_time).toISOString().slice(0, 10) === chosenDay;
      });
      if (conflict) {
        const label = new Date(conflict.date_time).toLocaleDateString(
          undefined,
          {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          },
        );
        throw new Error(
          `Sorry, ${label} is already booked. Please choose a different date.`,
        );
      }
      /* ─────────────────────────────────────────────────────── */

      let created;
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("bookings")
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        created = data;
        await Notifications.create({
          type: "booking",
          message: `New booking request from ${row.client_name}.`,
          related_id: created.id,
        });
        // Fire confirmation email (edge function). Non-fatal.
        try {
          await window.sb.functions.invoke("send-email", {
            body: {
              kind: "booking_confirmation",
              to: row.client_email,
              name: row.client_name,
              date_time: row.date_time,
            },
          });
        } catch (e) {
          console.warn("[Lumen] email function not reachable:", e.message);
        }
      } else {
        const d = demoRead();
        created = { id: uid(), created_at: nowIso(), ...row };
        d.bookings.push(created);
        d.notifications.unshift({
          id: uid(),
          type: "booking",
          message: `New booking request from ${row.client_name}.`,
          related_id: created.id,
          read: false,
          created_at: nowIso(),
        });
        demoWrite(d);
        console.info(
          "[Lumen demo] Confirmation email would be sent to",
          row.client_email,
        );
      }
      return created;
    },
    async list() {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("bookings")
          .select("*")
          .order("date_time", { ascending: true });
        if (error) throw error;
        return data;
      }
      return demoRead().bookings.sort(
        (a, b) => new Date(a.date_time) - new Date(b.date_time),
      );
    },
    async update(id, patch) {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("bookings")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const d = demoRead();
      const i = d.bookings.findIndex((x) => x.id === id);
      if (i > -1) d.bookings[i] = { ...d.bookings[i], ...patch };
      demoWrite(d);
      return d.bookings[i];
    },
    async remove(id) {
      if (LIVE()) {
        const { error } = await window.sb
          .from("bookings")
          .delete()
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const d = demoRead();
      d.bookings = d.bookings.filter((x) => x.id !== id);
      demoWrite(d);
    },
  };

  /* ---------- Todos --------------------------------------- */
  const Todos = {
    async list() {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("todos")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      }
      return demoRead().todos.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
    },
    async create(t) {
      const row = {
        title: t.title,
        description: t.description || "",
        related_booking_id: t.related_booking_id || null,
        status: "pending",
        due_date: t.due_date || null,
      };
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("todos")
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const d = demoRead();
      const rec = { id: uid(), created_at: nowIso(), ...row };
      d.todos.unshift(rec);
      demoWrite(d);
      return rec;
    },
    async update(id, patch) {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("todos")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const d = demoRead();
      const i = d.todos.findIndex((x) => x.id === id);
      if (i > -1) d.todos[i] = { ...d.todos[i], ...patch };
      demoWrite(d);
      return d.todos[i];
    },
    async remove(id) {
      if (LIVE()) {
        const { error } = await window.sb.from("todos").delete().eq("id", id);
        if (error) throw error;
        return;
      }
      const d = demoRead();
      d.todos = d.todos.filter((x) => x.id !== id);
      demoWrite(d);
    },
  };

  /* ---------- Notifications ------------------------------- */
  const Notifications = {
    async list() {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      }
      return demoRead().notifications.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
    },
    async create(n) {
      const row = {
        type: n.type,
        message: n.message,
        related_id: n.related_id || null,
        read: false,
      };
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("notifications")
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const d = demoRead();
      const rec = { id: uid(), created_at: nowIso(), ...row };
      d.notifications.unshift(rec);
      demoWrite(d);
      return rec;
    },
    async markRead(id) {
      if (LIVE()) {
        const { error } = await window.sb
          .from("notifications")
          .update({ read: true })
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const d = demoRead();
      const i = d.notifications.findIndex((x) => x.id === id);
      if (i > -1) d.notifications[i].read = true;
      demoWrite(d);
    },
    async remove(id) {
      if (LIVE()) {
        const { error } = await window.sb
          .from("notifications")
          .delete()
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const d = demoRead();
      d.notifications = d.notifications.filter((x) => x.id !== id);
      demoWrite(d);
    },
  };

  /* ---------- Settings (reminder lead time) --------------- */
  const Settings = {
    async get() {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("settings")
          .select("*")
          .eq("id", "global")
          .single();
        if (error) throw error;
        return data;
      }
      return demoRead().settings;
    },
    async update(patch) {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("settings")
          .update(patch)
          .eq("id", "global")
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const d = demoRead();
      d.settings = { ...d.settings, ...patch };
      demoWrite(d);
      return d.settings;
    },
  };

  /* ---------- Calendar Notes ------------------------------ */
  // Keyed by date string "YYYY-MM-DD". Each note: { id, date, text, created_at }
  const CalendarNotes = {
    async list() {
      if (LIVE()) {
        const { data, error } = await window.sb
          .from("calendar_notes")
          .select("*")
          .order("date", { ascending: true });
        if (error) throw error;
        return data;
      }
      return demoRead().calendarNotes || [];
    },
    async forDate(dateKey) {
      const all = await CalendarNotes.list();
      return all.filter((n) => n.date === dateKey);
    },
    async upsert(dateKey, text) {
      // One note per date — update if exists, create if not.
      const existing = (await CalendarNotes.forDate(dateKey))[0];
      if (LIVE()) {
        if (existing) {
          const { data, error } = await window.sb
            .from("calendar_notes")
            .update({ text })
            .eq("id", existing.id)
            .select();
          if (error) throw error;
          return data?.[0];
        }
        const { data, error } = await window.sb
          .from("calendar_notes")
          .insert({ date: dateKey, text })
          .select();
        if (error) throw error;
        return data?.[0];
      }
      const d = demoRead();
      if (!d.calendarNotes) d.calendarNotes = [];
      if (existing) {
        const i = d.calendarNotes.findIndex((n) => n.id === existing.id);
        d.calendarNotes[i] = { ...d.calendarNotes[i], text };
        demoWrite(d);
        return d.calendarNotes[i];
      }
      const rec = { id: uid(), date: dateKey, text, created_at: nowIso() };
      d.calendarNotes.push(rec);
      demoWrite(d);
      return rec;
    },
    async remove(dateKey) {
      const existing = (await CalendarNotes.forDate(dateKey))[0];
      if (!existing) return;
      if (LIVE()) {
        const { error } = await window.sb
          .from("calendar_notes")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }
      const d = demoRead();
      d.calendarNotes = (d.calendarNotes || []).filter(
        (n) => n.date !== dateKey,
      );
      demoWrite(d);
    },
  };

  /* Reset demo data (handy button in admin). */
  function resetDemo() {
    localStorage.removeItem(DEMO_KEY);
  }

  window.LumenStore = {
    LIVE,
    Auth,
    Gallery,
    Packages,
    Bookings,
    Todos,
    Notifications,
    Settings,
    CalendarNotes,
    uploadImage,
    resetDemo,
  };
})();
