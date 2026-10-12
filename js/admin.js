/* =============================================================
   admin.js — dashboard controller.
   Handles: auth gate, panel routing, KPIs, bookings table,
   calendar, gallery CRUD w/ drag-drop upload, package price
   editing, todos (add/toggle/filter/delete), notifications,
   reminder settings, and reminder pop-ups.
   All data flows through window.LumenStore.
   ============================================================= */
(function () {
  const S = window.LumenStore;
  const V = window.Validate;
  const $ = (id) => document.getElementById(id);
  const money = (n) => (n || n === 0 ? "₦" + Number(n).toLocaleString() : "—");
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fmtDT = (iso) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso || "";
    }
  };

  const API_BASE = (() => {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3000";
    }
    return window.location.origin;
  })();

  // in-memory caches
  let packages = [];
  let bookings = [];
  let todoFilter = "all";
  let calCursor = new Date();

  /* ================= AUTH GATE ================= */
  async function boot() {
    console.log("[Admin] Boot starting...");
    console.log("[Admin] LumenStore available?", typeof S !== "undefined");
    try {
      const user = await S.Auth.currentUser();
      console.log("[Admin] Current user:", user);

      if (user) {
        // Check user role
        const role = await getUserRole();
        console.log("[Admin] User role:", role);

        if (role === "student") {
          // Redirect students to student.html
          alert("Students should use the student calendar view.");
          window.location.href = "student.html";
          return;
        }

        if (role !== "admin") {
          // No role set - show error
          alert(
            "Your account does not have admin access. Contact the administrator to set your role.",
          );
          await S.Auth.signOut();
          showLogin();
          return;
        }

        showDashboard();
      } else {
        showLogin();
      }
    } catch (err) {
      console.error("[Admin] Boot error:", err);
      alert("Admin initialization failed. Check console for details.");
    }
  }

  async function getUserRole() {
    if (!window.sb) return null;
    try {
      const {
        data: { user },
      } = await window.sb.auth.getUser();
      const role =
        user?.user_metadata?.role ||
        user?.app_metadata?.role ||
        user?.role ||
        null;
      return role ? String(role).toLowerCase() : null;
    } catch (err) {
      console.error("[Admin] Error getting user role:", err);
      return null;
    }
  }

  function showLogin() {
    console.log("[Admin] Showing login view");
    $("dashView").hidden = true;
    $("loginView").hidden = false;
    if (!S.LIVE()) {
      const c = S.Auth.demoCredential;
      const hint = $("demoHint");
      hint.hidden = false;
      hint.innerHTML = `<strong>Demo mode.</strong> Sign in with<br>${esc(
        c.email,
      )} / ${esc(c.password)}`;
    }
  }

  function showDashboard() {
    console.log("[Admin] Showing dashboard");
    $("loginView").hidden = true;
    $("dashView").hidden = false;
    $("modeBadge").textContent = S.LIVE()
      ? "● Live (Supabase)"
      : "● Demo mode (local data)";

    /* ── Greeting ───────────────────────────────────────── */
    const greetEl = $("adminGreeting");
    if (greetEl) {
      const hr = new Date().getHours();
      const period = hr < 12 ? "Morning" : hr < 17 ? "Afternoon" : "Evening";
      const icon = hr < 12 ? "🌤️" : hr < 17 ? "☀️" : "🌙";
      greetEl.innerHTML =
        `<span class="admin-greeting__icon" aria-hidden="true">${icon}</span>` +
        `Good ${period}, <em>Mr Bamiyo</em>`;
    }

    console.log("[Admin] Calling refreshAll...");
    refreshAll();
  }

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("adminEmail");
    const pass = $("adminPass");
    const status = $("loginStatus");
    status.innerHTML = "";
    let ok = true;
    if (!V.email(email.value)) {
      V.setError(email, "Enter a valid email.");
      ok = false;
    } else V.setError(email, "");
    if (!V.required(pass.value)) {
      V.setError(pass, "Enter your password.");
      ok = false;
    } else V.setError(pass, "");
    if (!ok) return;

    const btn = $("loginBtn");
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      await S.Auth.signIn(email.value.trim(), pass.value);

      // Check role immediately after sign in
      const role = await getUserRole();

      if (role === "student") {
        // Sign them out and redirect to student login
        await S.Auth.signOut();
        alert(
          "This dashboard is for administrators only. Please use the student calendar page.",
        );
        window.location.href = "student.html";
        return;
      }

      if (role !== "admin") {
        status.innerHTML = `<div class="alert alert--error">Your account does not have admin access. Contact the administrator.</div>`;
        await S.Auth.signOut();
        btn.disabled = false;
        btn.textContent = "Sign in";
        return;
      }

      // Only admins get here
      showDashboard();
    } catch (err) {
      status.innerHTML = `<div class="alert alert--error">${esc(
        err.message,
      )}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    await S.Auth.signOut();
    location.reload();
  });

  /* ================= MOBILE ADMIN MENU ================= */
  const adminSide = document.querySelector(".admin-side");
  const adminToggle = document.querySelector(".admin-menu-toggle");
  const adminBackdrop = document.querySelector(".admin-backdrop");

  function openAdminMenu() {
    if (!adminSide || !adminToggle || !adminBackdrop) return;
    adminSide.classList.add("is-open");
    adminBackdrop.classList.add("is-open");
    adminToggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeAdminMenu() {
    if (!adminSide || !adminToggle || !adminBackdrop) return;
    adminSide.classList.remove("is-open");
    adminBackdrop.classList.remove("is-open");
    adminToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  if (adminToggle && adminSide && adminBackdrop) {
    adminToggle.addEventListener("click", () => {
      const isOpen = adminSide.classList.contains("is-open");
      isOpen ? closeAdminMenu() : openAdminMenu();
    });

    adminBackdrop.addEventListener("click", closeAdminMenu);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAdminMenu();
    });

    window.addEventListener(
      "resize",
      () => {
        if (window.innerWidth > 900) closeAdminMenu();
      },
      { passive: true },
    );
  }

  document.querySelectorAll(".admin-nav-btn[data-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.panel;
      document
        .querySelectorAll(".admin-nav-btn[data-panel]")
        .forEach((b) => b.classList.toggle("is-active", b === btn));
      document.querySelectorAll(".panel").forEach((p) => {
        const on = p.id === "panel-" + name;
        p.classList.toggle("is-active", on);
        p.hidden = !on;
      });
      if (window.innerWidth <= 900) closeAdminMenu();
      if (name === "calendar") renderCalendar();
    });
  });

  /* ================= REFRESH EVERYTHING ================= */
  async function refreshAll() {
    packages = await S.Packages.list();
    await Promise.all([
      renderOverview(),
      renderBookings(),
      renderGallery(),
      renderPackages(),
      renderTodos(),
      renderNotifications(),
      renderUsers(),
      loadSettings(),
    ]);
    // renderCalendar depends on the bookings array being populated first
    await renderCalendar();
    checkReminders();
  }

  async function fetchUsersFromApi() {
    const response = await fetch(`${API_BASE}/api/users`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Unable to fetch users.");
    }
    const payload = await response.json();
    return payload.users || [];
  }

  async function updateUserRoleOnApi(userId, role) {
    const response = await fetch(`${API_BASE}/api/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Unable to update role.");
    }
    return payload.user;
  }

  async function renderUsers() {
    const host = $("usersList");
    if (!host) return;

    try {
      const users = await fetchUsersFromApi();
      if (!users.length) {
        host.innerHTML = `<p class="text-muted">No users found.</p>`;
        return;
      }

      host.innerHTML = users
        .map((user) => {
          const role = String(user.role || "user").toLowerCase();
          return `
            <div class="card" style="margin-bottom:.8rem">
              <div class="flex wrap-gap" style="justify-content:space-between;align-items:center;gap:.8rem">
                <div>
                  <p style="font-weight:600;margin:0">${esc(user.email || "Unknown user")}</p>
                  <p class="text-muted" style="margin:.25rem 0 0;font-size:.78rem">${esc(user.id || "")}</p>
                </div>
                <div style="min-width:170px">
                  <label class="sr-only" for="role-${esc(user.id || "")}">Role for ${esc(user.email || "user")}</label>
                  <select data-user-role-select data-user-id="${esc(user.id || "")}" data-current-role="${esc(role)}" style="width:100%">
                    <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
                    <option value="student" ${role === "student" ? "selected" : ""}>Student</option>
                    <option value="user" ${role === "user" ? "selected" : ""}>User</option>
                  </select>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      host.querySelectorAll("[data-user-role-select]").forEach((select) => {
        select.addEventListener("change", async (event) => {
          const target = event.target;
          const userId = target.dataset.userId;
          const nextRole = target.value;
          const previousRole = target.dataset.currentRole;

          try {
            target.disabled = true;
            await updateUserRoleOnApi(userId, nextRole);
            target.dataset.currentRole = nextRole;
            if (window.toast) {
              window.toast(`Role updated to ${nextRole}.`, "ok");
            }
          } catch (error) {
            target.value = previousRole;
            if (window.toast) {
              window.toast(error.message || "Role update failed.", "error");
            } else {
              alert(error.message || "Role update failed.");
            }
          } finally {
            target.disabled = false;
          }
        });
      });
    } catch (error) {
      host.innerHTML = `<div class="alert alert--error">${esc(error.message || "Unable to load users.")}</div>`;
    }
  }

  const pkgName = (id) => {
    const p = packages.find((x) => x.id === id);
    return p ? p.name : "—";
  };

  /* ================= OVERVIEW ================= */
  async function renderOverview() {
    bookings = await S.Bookings.list();
    const todos = await S.Todos.list();
    const notifs = await S.Notifications.list();
    const now = new Date();
    const upcoming = bookings.filter((b) => new Date(b.date_time) >= now);
    const pendingTodos = todos.filter((t) => t.status !== "completed");
    const unread = notifs.filter((n) => !n.read);

    $("kpis").innerHTML = [
      ["Upcoming shoots", upcoming.length],
      ["Total bookings", bookings.length],
      ["Open to-dos", pendingTodos.length],
      ["Unread alerts", unread.length],
    ]
      .map(
        ([label, n]) =>
          `<div class="kpi"><b>${n}</b><span>${label}</span></div>`,
      )
      .join("");

    // nav badges
    setBadge("navBookings", upcoming.length);
    setBadge("navTodos", pendingTodos.length);
    setBadge("navNotifs", unread.length);

    $("ovUpcoming").innerHTML =
      upcoming.slice(0, 5).map(bookingRow).join("") ||
      `<p class="text-muted">No upcoming shoots.</p>`;
    $("ovNotifs").innerHTML =
      notifs.slice(0, 5).map(notifRow).join("") ||
      `<p class="text-muted">No notifications.</p>`;
  }

  function setBadge(id, n) {
    const el = $(id);
    if (!el) return;
    el.textContent = n;
    el.hidden = !n;
  }

  const bookingRow = (b) =>
    `<div class="todo" style="border-color:var(--line)">
      <div style="flex:1">
        <div class="todo__title">${esc(b.client_name)}</div>
        <div class="todo__meta">${esc(pkgName(b.package_id))} · ${fmtDT(
          b.date_time,
        )}</div>
      </div>
      <span class="pill pill--${esc(b.status)}">${esc(b.status)}</span>
    </div>`;

  const notifRow = (n) =>
    `<div class="notif ${n.read ? "" : "is-unread"}">
      <span class="notif__dot"></span>
      <div><span class="notif__type">${esc(n.type)}</span>
      <div>${esc(n.message)}</div></div>
    </div>`;

  /* ================= BOOKINGS ================= */
  async function renderBookings() {
    bookings = await S.Bookings.list();
    const body = $("bookingsBody");
    if (!bookings.length) {
      body.innerHTML = `<tr><td colspan="5" class="text-muted">No bookings yet.</td></tr>`;
      return;
    }
    body.innerHTML = bookings
      .map(
        (b) => `<tr>
          <td><strong>${esc(b.client_name)}</strong><br><span class="mono" style="font-size:.72rem;color:var(--faint)">${esc(
            b.client_email,
          )}</span></td>
          <td>${esc(pkgName(b.package_id))}</td>
          <td>${fmtDT(b.date_time)}</td>
          <td><span class="pill pill--${esc(b.status)}">${esc(
            b.status,
          )}</span></td>
          <td class="row-actions">
            <select class="icon-btn" data-booking-status="${esc(b.id)}" aria-label="Change status">
              ${["pending", "confirmed", "completed", "cancelled"]
                .map(
                  (s) =>
                    `<option value="${s}"${
                      s === b.status ? " selected" : ""
                    }>${s}</option>`,
                )
                .join("")}
            </select>
            <button class="icon-btn icon-btn--danger" data-booking-del="${esc(b.id)}" aria-label="Delete booking">Delete</button>
          </td>
        </tr>`,
      )
      .join("");

    body.querySelectorAll("[data-booking-status]").forEach((sel) => {
      sel.addEventListener("change", async () => {
        await S.Bookings.update(sel.dataset.bookingStatus, {
          status: sel.value,
        });
        window.toast("Booking updated.", "ok");
        renderBookings();
        renderOverview();
      });
    });

    body.querySelectorAll("[data-booking-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this booking? This cannot be undone.")) return;
        await S.Bookings.remove(btn.dataset.bookingDel);
        window.toast("Booking deleted.", "ok");
        renderBookings();
        renderOverview();
      });
    });
  }

  /* ================= CALENDAR ================= */
  // dateKey format used for notes: "YYYY-MM-DD" (zero-padded, unambiguous)
  const calDateKey = (y, m, day) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  async function renderCalendar() {
    const grid = $("calGrid");
    const y = calCursor.getFullYear();
    const m = calCursor.getMonth();
    $("calLabel").textContent = calCursor.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const first = new Date(y, m, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // bucket bookings by date key
    const byDay = {};
    bookings.forEach((b) => {
      const d = new Date(b.date_time);
      const key = calDateKey(d.getFullYear(), d.getMonth(), d.getDate());
      (byDay[key] = byDay[key] || []).push(b);
    });

    // fetch all notes — wrapped in try/catch so a missing DB table
    // (e.g. calendar_notes not yet created) never kills the render
    let allNotes = [];
    try {
      allNotes = await S.CalendarNotes.list();
    } catch (e) {
      console.warn("[Lumen] CalendarNotes unavailable:", e.message);
    }
    const notesByDay = {};
    allNotes.forEach((n) => {
      notesByDay[n.date] = n.text;
    });

    let html = dow.map((d) => `<div class="cal-dow">${d}</div>`).join("");
    for (let i = 0; i < startDow; i++)
      html += `<div class="cal-cell is-muted"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const key = calDateKey(y, m, day);
      const isToday =
        today.getFullYear() === y &&
        today.getMonth() === m &&
        today.getDate() === day;
      const events = (byDay[key] || [])
        .map(
          (b) =>
            `<div class="cal-event" title="${esc(b.client_name)} — ${fmtDT(
              b.date_time,
            )}">${esc(b.client_name)}</div>`,
        )
        .join("");
      const noteSnippet = notesByDay[key]
        ? `<div class="cal-note" title="${esc(notesByDay[key])}">📝 ${esc(
            notesByDay[key].length > 28
              ? notesByDay[key].slice(0, 28) + "…"
              : notesByDay[key],
          )}</div>`
        : "";
      html += `<div class="cal-cell${isToday ? " is-today" : ""}${notesByDay[key] ? " has-note" : ""}"
        data-cal-key="${esc(key)}" data-cal-day="${day}" tabindex="0"
        title="Double-click to add a note">
        <span class="date">${day}</span>${events}${noteSnippet}</div>`;
    }
    grid.innerHTML = html;

    // double-click (and double-Enter for keyboard) to open note modal
    grid.querySelectorAll(".cal-cell[data-cal-key]").forEach((cell) => {
      cell.addEventListener("dblclick", () =>
        openNoteModal(cell.dataset.calKey, y, m, Number(cell.dataset.calDay)),
      );
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          if (cell._lastEnter && Date.now() - cell._lastEnter < 500) {
            openNoteModal(
              cell.dataset.calKey,
              y,
              m,
              Number(cell.dataset.calDay),
            );
          }
          cell._lastEnter = Date.now();
        }
      });
    });
  }

  $("calPrev").addEventListener("click", () => {
    calCursor.setMonth(calCursor.getMonth() - 1);
    renderCalendar();
  });
  $("calNext").addEventListener("click", () => {
    calCursor.setMonth(calCursor.getMonth() + 1);
    renderCalendar();
  });

  /* ================= CALENDAR NOTE MODAL ================= */
  const noteModal = $("calNoteModal");
  let activeNoteKey = null;

  async function openNoteModal(dateKey, y, m, day) {
    activeNoteKey = dateKey;
    let existing = null;
    try {
      const notes = await S.CalendarNotes.forDate(dateKey);
      existing = notes[0] || null;
    } catch (e) {
      console.warn("[Lumen] CalendarNotes.forDate failed:", e.message);
    }
    const label = new Date(y, m, day).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    $("cnDate").textContent = label;
    $("cnText").value = existing ? existing.text : "";
    $("cnStatus").innerHTML = "";
    $("cnDeleteBtn").style.display = existing ? "" : "none";
    window.Modal.open(noteModal);
    $("cnText").focus();
  }

  noteModal.addEventListener("click", (e) => {
    if (e.target === noteModal || e.target.hasAttribute("data-close"))
      window.Modal.close(noteModal);
  });

  $("calNoteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("cnText").value.trim();
    if (!text) {
      $("cnStatus").innerHTML =
        `<div class="alert alert--error">Write something or use Delete to remove the note.</div>`;
      return;
    }
    const btn = $("cnSubmit");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      await S.CalendarNotes.upsert(activeNoteKey, text);
      window.Modal.close(noteModal);
      window.toast("Note saved.", "ok");
      renderCalendar();
    } catch (err) {
      $("cnStatus").innerHTML =
        `<div class="alert alert--error">${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Save note";
    }
  });

  $("cnDeleteBtn").addEventListener("click", async () => {
    if (!confirm("Remove this note?")) return;
    await S.CalendarNotes.remove(activeNoteKey);
    window.Modal.close(noteModal);
    window.toast("Note removed.", "ok");
    renderCalendar();
  });

  /* ================= GALLERY CRUD ================= */
  async function renderGallery() {
    const items = await S.Gallery.list();
    const body = $("galleryBody");
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="6" class="text-muted">No images yet. Add your first.</td></tr>`;
      return;
    }
    body.innerHTML = items
      .map(
        (it) => `<tr>
          <td><img class="thumb" src="${esc(it.image_url || "")}" alt="" /></td>
          <td><strong>${esc(it.title || "Untitled")}</strong></td>
          <td class="mono" style="font-size:.72rem;color:var(--faint)">${esc(
            (it.tags || []).join(", "),
          )}</td>
          <td>${money(it.price)}</td>
          <td class="mono" style="font-size:.72rem;color:var(--faint)">${
            it.created_at ? new Date(it.created_at).toLocaleDateString() : ""
          }</td>
          <td class="row-actions">
            <button class="icon-btn" data-edit="${esc(it.id)}">Edit</button>
            <button class="icon-btn icon-btn--danger" data-del="${esc(
              it.id,
            )}">Delete</button>
          </td>
        </tr>`,
      )
      .join("");

    body
      .querySelectorAll("[data-edit]")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          openGalleryModal(items.find((x) => x.id === btn.dataset.edit)),
        ),
      );
    body.querySelectorAll("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this image?")) return;
        await S.Gallery.remove(btn.dataset.del);
        window.toast("Image deleted.", "ok");
        renderGallery();
        renderOverview();
      }),
    );
  }

  // ----- gallery modal + dropzone -----
  const gModal = $("galleryModal");
  let pendingFile = null;

  $("addImageBtn").addEventListener("click", () => openGalleryModal(null));

  function openGalleryModal(item) {
    pendingFile = null;
    $("gmId").value = item ? item.id : "";
    $("gmTitle").textContent = item ? "Edit image" : "Add image";
    $("gmName").value = item ? item.title || "" : "";
    $("gmDesc").value = item ? item.description || "" : "";
    $("gmTags").value = item ? (item.tags || []).join(", ") : "";
    $("gmPrice").value = item && item.price != null ? item.price : "";
    $("gmPreviewWrap").innerHTML =
      item && item.image_url
        ? `<img class="preview" src="${esc(item.image_url)}" alt="" />`
        : "";
    $("gmDropText").textContent = item
      ? "Drop a new image to replace, or keep the current one"
      : "Drop an image here, or click to choose";
    $("gmStatus").innerHTML = "";
    V.setError($("gmName"), "");
    window.Modal.open(gModal);
  }

  gModal.addEventListener("click", (e) => {
    if (e.target === gModal || e.target.hasAttribute("data-close"))
      window.Modal.close(gModal);
  });

  const drop = $("gmDrop");
  const fileInput = $("gmFile");
  drop.addEventListener("click", () => fileInput.click());
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  ["dragover", "dragenter"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("is-drag");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("is-drag");
    }),
  );
  drop.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) setPending(f);
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) setPending(fileInput.files[0]);
  });
  function setPending(f) {
    if (!/^image\//.test(f.type)) {
      window.toast("Please choose an image file.", "error");
      return;
    }
    pendingFile = f;
    const r = new FileReader();
    r.onload = () =>
      ($("gmPreviewWrap").innerHTML =
        `<img class="preview" src="${r.result}" alt="" />`);
    r.readAsDataURL(f);
  }

  $("galleryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("gmName");
    if (!V.required(name.value)) {
      V.setError(name, "Give the image a title.");
      return;
    }
    V.setError(name, "");
    const id = $("gmId").value;
    if (!id && !pendingFile) {
      $("gmStatus").innerHTML =
        `<div class="alert alert--error">Please choose an image to upload.</div>`;
      return;
    }
    const btn = $("gmSubmit");
    btn.disabled = true;
    btn.textContent = "Saving…";
    const patch = {
      title: name.value.trim(),
      description: $("gmDesc").value.trim(),
      tags: $("gmTags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      price: $("gmPrice").value ? Number($("gmPrice").value) : null,
    };
    try {
      if (id) await S.Gallery.update(id, patch, pendingFile || undefined);
      else await S.Gallery.create(patch, pendingFile);
      window.Modal.close(gModal);
      window.toast("Image saved.", "ok");
      renderGallery();
      renderOverview();
    } catch (err) {
      $("gmStatus").innerHTML = `<div class="alert alert--error">${esc(
        err.message,
      )}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Save image";
    }
  });

  /* ================= PACKAGES ================= */
  async function renderPackages() {
    packages = await S.Packages.list();
    $("packagesList").innerHTML = packages
      .map(
        (p) => `<div class="card">
          <p class="eyebrow">${esc(p.name)}</p>
          <p class="text-muted" style="font-size:.85rem;margin:.5rem 0 1rem">${esc(
            p.description || "",
          ).slice(0, 90)}…</p>
          <form data-pkg="${esc(p.id)}" class="flex wrap-gap" style="gap:.5rem;align-items:flex-end">
            <div class="field" style="margin:0">
              <label>Price ($)</label>
              <input type="number" min="0" value="${Number(
                p.price,
              )}" style="width:130px" />
            </div>
            <button type="submit" class="btn btn--accent btn--sm">Update</button>
          </form>
        </div>`,
      )
      .join("");

    $("packagesList")
      .querySelectorAll("form[data-pkg]")
      .forEach((form) => {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const price = Number(form.querySelector("input").value);
          await S.Packages.update(form.dataset.pkg, { price });
          window.toast("Price updated.", "ok");
          renderPackages();
        });
      });
  }

  /* ================= TODOS ================= */
  $("todoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("todoTitle").value.trim();
    if (!title) return;
    await S.Todos.create({ title, due_date: $("todoDue").value || null });
    $("todoTitle").value = "";
    $("todoDue").value = "";
    window.toast("Task added.", "ok");
    renderTodos();
    renderOverview();
  });

  document.querySelectorAll("[data-todo-filter]").forEach((chip) =>
    chip.addEventListener("click", () => {
      todoFilter = chip.dataset.todoFilter;
      document
        .querySelectorAll("[data-todo-filter]")
        .forEach((c) =>
          c.setAttribute(
            "aria-pressed",
            c.dataset.todoFilter === todoFilter ? "true" : "false",
          ),
        );
      renderTodos();
    }),
  );

  async function renderTodos() {
    let todos = await S.Todos.list();
    if (todoFilter !== "all")
      todos = todos.filter((t) =>
        todoFilter === "completed"
          ? t.status === "completed"
          : t.status !== "completed",
      );
    const list = $("todosList");
    if (!todos.length) {
      list.innerHTML = `<p class="text-muted">Nothing here.</p>`;
      return;
    }
    list.innerHTML = todos
      .map((t) => {
        const done = t.status === "completed";
        return `<div class="todo ${done ? "is-done" : ""}">
          <button class="todo__check" data-toggle="${esc(
            t.id,
          )}" aria-label="Toggle complete" aria-pressed="${done}">✓</button>
          <div style="flex:1">
            <div class="todo__title">${esc(t.title)}</div>
            <div class="todo__meta">${
              t.due_date
                ? "Due " + new Date(t.due_date).toLocaleDateString()
                : "No due date"
            }${t.description ? " · " + esc(t.description) : ""}</div>
          </div>
          <button class="icon-btn icon-btn--danger" data-todo-del="${esc(
            t.id,
          )}">Delete</button>
        </div>`;
      })
      .join("");

    list.querySelectorAll("[data-toggle]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const todos2 = await S.Todos.list();
        const t = todos2.find((x) => x.id === btn.dataset.toggle);
        await S.Todos.update(btn.dataset.toggle, {
          status: t.status === "completed" ? "pending" : "completed",
        });
        renderTodos();
        renderOverview();
      }),
    );
    list.querySelectorAll("[data-todo-del]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await S.Todos.remove(btn.dataset.todoDel);
        window.toast("Task removed.", "ok");
        renderTodos();
        renderOverview();
      }),
    );
  }

  /* ================= NOTIFICATIONS ================= */
  async function renderNotifications() {
    const notifs = await S.Notifications.list();
    const list = $("notifsList");
    if (!notifs.length) {
      list.innerHTML = `<p class="text-muted">No notifications.</p>`;
      return;
    }
    list.innerHTML = notifs
      .map(
        (n) => `<div class="notif ${n.read ? "" : "is-unread"}">
          <span class="notif__dot"></span>
          <div style="flex:1">
            <span class="notif__type">${esc(n.type)} · ${
              n.created_at ? new Date(n.created_at).toLocaleDateString() : ""
            }</span>
            <div>${esc(n.message)}</div>
          </div>
          <div class="row-actions">
            ${
              n.read
                ? ""
                : `<button class="icon-btn" data-read="${esc(
                    n.id,
                  )}">Mark read</button>`
            }
            <button class="icon-btn icon-btn--danger" data-notif-del="${esc(n.id)}" aria-label="Delete notification">Delete</button>
          </div>
        </div>`,
      )
      .join("");

    list.querySelectorAll("[data-read]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await S.Notifications.markRead(btn.dataset.read);
        renderNotifications();
        renderOverview();
      }),
    );

    list.querySelectorAll("[data-notif-del]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await S.Notifications.remove(btn.dataset.notifDel);
        window.toast("Notification deleted.", "ok");
        renderNotifications();
        renderOverview();
      }),
    );
  }

  $("markAllRead").addEventListener("click", async () => {
    const notifs = await S.Notifications.list();
    await Promise.all(
      notifs.filter((n) => !n.read).map((n) => S.Notifications.markRead(n.id)),
    );
    window.toast("All caught up.", "ok");
    renderNotifications();
    renderOverview();
  });

  /* ================= SETTINGS ================= */
  async function loadSettings() {
    const s = await S.Settings.get();
    $("remValue").value = s.reminder_offset_value;
    $("remType").value = s.reminder_offset_type;
  }

  $("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = Number($("remValue").value);
    if (!val || val < 1) {
      $("settingsStatus").innerHTML =
        `<div class="alert alert--error">Enter a valid lead time.</div>`;
      return;
    }
    await S.Settings.update({
      reminder_offset_value: val,
      reminder_offset_type: $("remType").value,
    });
    $("settingsStatus").innerHTML =
      `<div class="alert alert--ok">Reminder lead time saved.</div>`;
    window.toast("Settings saved.", "ok");
  });

  $("resetDemoBtn")?.addEventListener("click", () => {
    if (!confirm("Reset demo data to the original sample set?")) return;
    S.resetDemo();
    location.reload();
  });

  /* ================= REMINDER POP-UPS ================= */
  // Client-side simulation of the reminder engine: when a shoot
  // falls within the configured lead time, surface a pop-up.
  // (In production, the process-reminders edge function also emails.)
  async function checkReminders() {
    const s = await S.Settings.get();
    const list = await S.Bookings.list();
    const now = new Date();
    const ms = leadMs(s.reminder_offset_type, s.reminder_offset_value);
    const due = list.find((b) => {
      const t = new Date(b.date_time) - now;
      return (
        b.status !== "cancelled" && b.status !== "completed" && t > 0 && t <= ms
      );
    });
    if (due) showReminder(due, s);
  }

  function leadMs(type, value) {
    const day = 86400000;
    const mult = type === "weeks" ? 7 : type === "months" ? 30 : 1;
    return value * mult * day;
  }

  function showReminder(b, s) {
    $("reminderText").innerHTML = `<strong>${esc(
      b.client_name,
    )}</strong>'s shoot is coming up on ${fmtDT(
      b.date_time,
    )}.<br><span class="mono" style="font-size:.72rem;color:var(--faint)">Lead time: ${
      s.reminder_offset_value
    } ${esc(s.reminder_offset_type)}</span>`;
    const pop = $("reminderPop");
    pop.classList.add("is-show");
  }
  document
    .querySelector("#reminderPop [data-dismiss]")
    .addEventListener("click", () =>
      $("reminderPop").classList.remove("is-show"),
    );

  /* ================= GO ================= */
  boot();
})();
