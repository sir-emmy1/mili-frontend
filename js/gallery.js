/* =============================================================
   gallery.js — render gallery grid, tag filters, lazy-load
   images, and an animated lightbox with keyboard + prev/next.
   Data comes from LumenStore.Gallery.list() (Supabase or demo).
   ============================================================= */
(function () {
  const grid = document.getElementById("masonry");
  const filters = document.getElementById("filters");
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightboxImg");
  const lbTitle = document.getElementById("lightboxTitle");
  const lbDesc = document.getElementById("lightboxDesc");
  const lbMeta = document.getElementById("lightboxMeta");

  let items = []; // all gallery items
  let view = []; // currently filtered/visible items
  let activeTag = "all";
  let current = -1; // index into `view` for the lightbox
  let observer = null;

  const money = (n) =>
    n || n === 0
      ? window.LumenCurrency
        ? window.LumenCurrency.format(n)
        : "₦" + Number(n).toLocaleString()
      : "";
  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
      });
    } catch {
      return "";
    }
  };
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  /* ---------- lazy loading via IntersectionObserver ---------- */
  function makeObserver() {
    if (!("IntersectionObserver" in window)) return null;
    return new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.addEventListener(
              "load",
              () => img.classList.add("loaded"),
              { once: true }
            );
            // data-URL images may already be "complete" synchronously
            if (img.complete) img.classList.add("loaded");
            img.removeAttribute("data-src");
          }
          obs.unobserve(img);
        });
      },
      { rootMargin: "200px 0px" }
    );
  }

  /* ---------- hero switcher ---------- */
  const heroSlides = document.querySelectorAll(".gallery-hero__slide");
  function switchHero(tag) {
    heroSlides.forEach((slide) => {
      const match = slide.dataset.hero === tag;
      slide.hidden = !match;
      slide.classList.toggle("is-active", match);
    });
  }

  /* ---------- filter chips ---------- */
  const ALLOWED = [
    { tag: "all",      label: "All work"  },
    { tag: "portrait", label: "Portraits" },
    { tag: "events",   label: "Events"    },
    { tag: "arts",     label: "Arts"      },
  ];

  function buildFilters() {
    // Build chips HTML
    const chipsHTML = ALLOWED
      .map(({ tag, label }) => {
        const pressed = tag === activeTag ? "true" : "false";
        return `<button type="button" class="chip" data-tag="${escapeHtml(tag)}" aria-pressed="${pressed}">${escapeHtml(label)}</button>`;
      })
      .join("");

    // Inject into EVERY slide's filter container
    document.querySelectorAll(".gallery-hero__filters").forEach((container) => {
      container.innerHTML = chipsHTML;
      container.removeAttribute("aria-hidden");
    });

    // Attach click listeners to ALL chips across ALL slides
    document.querySelectorAll(".gallery-hero__filters .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        activeTag = chip.dataset.tag;

        // Sync aria-pressed on every chip in every slide
        document.querySelectorAll(".gallery-hero__filters .chip").forEach((c) =>
          c.setAttribute("aria-pressed", c.dataset.tag === activeTag ? "true" : "false")
        );

        switchHero(activeTag);
        renderTiles();
      });
    });
  }

  /* ---------- tiles ---------- */
  function renderTiles() {
    view =
      activeTag === "all"
        ? items.slice()
        : items.filter((it) => (it.tags || []).includes(activeTag));

    if (observer) observer.disconnect();
    observer = makeObserver();

    if (!view.length) {
      grid.innerHTML = `<p class="text-muted">No work tagged “${escapeHtml(
        activeTag
      )}” yet.</p>`;
      grid.setAttribute("aria-busy", "false");
      return;
    }

    grid.innerHTML = "";
    view.forEach((it, i) => {
      const fig = document.createElement("figure");
      fig.className = "tile";
      fig.setAttribute("tabindex", "0");
      fig.setAttribute("role", "button");
      fig.setAttribute(
        "aria-label",
        `${it.title || "Untitled"}. View full size.`
      );
      // stagger the fade-in
      fig.style.animationDelay = Math.min(i * 45, 400) + "ms";

      const tagLine = (it.tags || []).join(" · ");

      fig.innerHTML = `
        <img class="lazy" alt="${escapeHtml(it.title || "Gallery image")}" ${
        observer
          ? `data-src="${escapeHtml(it.image_url || "")}"`
          : `src="${escapeHtml(it.image_url || "")}"`
      } />
        <figcaption class="tile__overlay">
          <h3>${escapeHtml(it.title || "Untitled")}</h3>
          <p class="meta">${escapeHtml(tagLine)}</p>
        </figcaption>`;

      const open = () => openLightbox(i);
      fig.addEventListener("click", open);
      fig.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
      grid.appendChild(fig);

      const img = fig.querySelector("img");
      if (observer) observer.observe(img);
      else img.classList.add("loaded");
    });
    grid.setAttribute("aria-busy", "false");
  }

  /* ---------- lightbox ---------- */
  function openLightbox(i) {
    current = i;
    paint();
    lb.classList.add("is-open");
    document.body.style.overflow = "hidden";
    lb.querySelector("[data-close]").focus();
  }
  function closeLightbox() {
    lb.classList.remove("is-open");
    document.body.style.overflow = "";
    if (current > -1) {
      const tiles = grid.querySelectorAll(".tile");
      if (tiles[current]) tiles[current].focus();
    }
    current = -1;
  }
  function step(dir) {
    if (!view.length) return;
    current = (current + dir + view.length) % view.length;
    paint();
  }
  function paint() {
    const it = view[current];
    if (!it) return;
    lbImg.src = it.image_url || "";
    lbImg.alt = it.title || "Gallery image";
    lbTitle.textContent = it.title || "Untitled";
    lbDesc.textContent = it.description || "";
    const bits = [];
    if (it.tags && it.tags.length) bits.push(it.tags.join(" · "));
    if (it.created_at) bits.push(fmtDate(it.created_at));
    if (it.price) bits.push("from " + money(it.price));
    lbMeta.textContent = bits.join("   /   ");
  }

  lb.addEventListener("click", (e) => {
    if (e.target === lb || e.target.hasAttribute("data-close")) closeLightbox();
    else if (e.target.hasAttribute("data-prev")) step(-1);
    else if (e.target.hasAttribute("data-next")) step(1);
  });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  // Repaint the lightbox caption when currency changes
  document.addEventListener("currencychange", () => {
    if (lb.classList.contains("is-open") && current > -1) paint();
  });

  /* ---------- boot ---------- */
  (async function init() {
    try {
      items = await window.LumenStore.Gallery.list();
    } catch (e) {
      grid.innerHTML = `<p class="alert alert--error">Couldn't load the gallery. ${escapeHtml(
        e.message
      )}</p>`;
      grid.setAttribute("aria-busy", "false");
      return;
    }
    buildFilters();
    renderTiles();
  })();
})();


/* ============================================================
   Gallery hero carousel — rotates 4 bg images every 5 seconds
   ============================================================ */
(function heroCarousel() {
  const carousels = document.querySelectorAll('.gallery-hero__carousel');
  const INTERVAL = 5000; // 5 seconds per image

  carousels.forEach((carousel) => {
    const slides = carousel.querySelectorAll('.gallery-hero__bg');
    if (!slides.length) return;

    let current = 0;
    slides[current].classList.add('is-active');

    setInterval(() => {
      slides[current].classList.remove('is-active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('is-active');
    }, INTERVAL);
  });
})();