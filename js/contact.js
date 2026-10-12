/* =============================================================
   contact.js — booking form: populate packages, validate,
   submit through the store (creates booking + notification +
   confirmation email), show success/error feedback.
   ============================================================= */
(function () {
  const form = document.getElementById("bookingForm");
  const status = document.getElementById("formStatus");
  const select = document.getElementById("package");
  const btn = document.getElementById("submitBtn");
  const dateInput = document.getElementById("date");
  const V = window.Validate;

  // Populate package options, preselect from ?package=id
  (async function fillPackages() {
    try {
      const pkgs = await window.LumenStore.Packages.list();
      const preset = new URLSearchParams(location.search).get("package");

      function renderOptions() {
        const fmt = window.LumenCurrency ? window.LumenCurrency.format : (n) => "₦" + Number(n).toLocaleString();
        while (select.options.length > 1) select.remove(1);
        pkgs.forEach((p) => {
          const o = document.createElement("option");
          o.value = p.id;
          o.textContent = `${p.name} — ${fmt(p.price)}`;
          if (preset && p.id === preset) o.selected = true;
          select.appendChild(o);
        });
      }

      renderOptions();
      document.addEventListener("currencychange", renderOptions);
    } catch (e) {
      console.warn("Could not load packages:", e.message);
    }
  })();

  /* ── Date availability check ──────────────────────────────
     Fires whenever the client picks a date/time.
     Compares the chosen calendar day against all existing
     pending or confirmed bookings. Blocks same-day requests. */
  async function checkDateAvailability(dateValue) {
    if (!dateValue) return true;

    const chosen = new Date(dateValue);
    const chosenDay = chosen.toISOString().slice(0, 10); // "YYYY-MM-DD"

    try {
      const bookings = await window.LumenStore.Bookings.list();
      const conflict = bookings.find((b) => {
        if (b.status === "cancelled" || b.status === "completed") return false;
        const bDay = new Date(b.date_time).toISOString().slice(0, 10);
        return bDay === chosenDay;
      });

      if (conflict) {
        V.setError(
          dateInput,
          "Sorry, " +
            new Date(conflict.date_time).toLocaleDateString(undefined, {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            }) +
            " is already booked. Please choose a different date."
        );
        return false;
      }
    } catch (e) {
      // If the check fails (network issue), allow submission — server will catch it
      console.warn("[BIE] Availability check failed:", e.message);
    }

    V.setError(dateInput, "");
    return true;
  }

  // Check availability as soon as the user picks a date
  dateInput && dateInput.addEventListener("change", () => {
    checkDateAvailability(dateInput.value);
  });

  function validate() {
    let ok = true;
    const name = form.name;
    const email = form.email;
    const pkg = form.package;
    const date = form.date;

    if (!V.required(name.value)) {
      V.setError(name, "Please tell us your name.");
      ok = false;
    } else V.setError(name, "");

    if (!V.email(email.value)) {
      V.setError(email, "Enter a valid email address.");
      ok = false;
    } else V.setError(email, "");

    if (!V.required(pkg.value)) {
      V.setError(pkg, "Choose a package.");
      ok = false;
    } else V.setError(pkg, "");

    const now = new Date();
    if (!V.required(date.value)) {
      V.setError(date, "Pick a preferred date and time.");
      ok = false;
    } else if (new Date(date.value) < now) {
      V.setError(date, "Please choose a future date.");
      ok = false;
    } else V.setError(date, "");

    return ok;
  }

  // Live-clear errors as the user fixes them
  form.addEventListener("input", (e) => {
    const f = e.target;
    if (f.id === "date") return; // date errors managed by checkDateAvailability
    if (f.closest(".field--error")) V.setError(f, "");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.innerHTML = "";

    if (!validate()) {
      status.innerHTML = `<div class="alert alert--error">Please fix the highlighted fields.</div>`;
      return;
    }

    // Re-run availability check on submit in case date was typed manually
    const available = await checkDateAvailability(form.date.value);
    if (!available) {
      status.innerHTML = `<div class="alert alert--error">That date is already booked. Please choose another day.</div>`;
      return;
    }

    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const settings = await window.LumenStore.Settings.get();
      await window.LumenStore.Bookings.create({
        client_name: form.name.value.trim(),
        client_email: form.email.value.trim(),
        package_id: form.package.value,
        custom_details: form.details.value.trim(),
        date_time: new Date(form.date.value).toISOString(),
        reminder_offset_type: settings.reminder_offset_type,
        reminder_offset_value: settings.reminder_offset_value,
      });
      form.reset();
      status.innerHTML = `<div class="alert alert--ok"><strong>Request received.</strong> MR Bamiyo has been notified . Expect a reply within one business day.</div>`;
      window.toast("Booking request sent.", "ok");
      status.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      // Catch duplicate-date errors thrown from the store layer
      if (err.message && err.message.toLowerCase().includes("booked")) {
        V.setError(dateInput, err.message);
        status.innerHTML = `<div class="alert alert--error">${err.message}</div>`;
      } else {
        status.innerHTML = `<div class="alert alert--error"><strong>Something went wrong.</strong> ${err.message}. Please try again or contact Bamiyo directly.</div>`;
        window.toast("Couldn't send your request.", "error");
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Request booking";
    }
  });
})();