/* =============================================================
   main.js — shared site behaviour
   Nav scroll state, hamburger, parallax hero, scroll-reveal,
   toast helper, footer year, WhatsApp links, form validation.
   All progressive-enhancement; site works without JS for content.
   ============================================================= */

/* ---------- Nav ------------------------------------------ */
(function nav() {
  const bar    = document.querySelector('.nav');
  const burger = document.querySelector('.hamburger');
  const links  = document.querySelector('.nav__links');

  if (bar) {
    const onScroll = () =>
      bar.classList.toggle('is-scrolled', window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (!burger || !links) return;

  /* Backdrop injected as a direct body child */
  const backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(backdrop);

  function openMenu() {
    links.classList.add('is-open');
    backdrop.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    links.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  burger.addEventListener('click', () => {
    links.classList.contains('is-open') ? closeMenu() : openMenu();
  });

  backdrop.addEventListener('click', closeMenu);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && links.classList.contains('is-open')) closeMenu();
  });

  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', closeMenu)
  );

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMenu();
  }, { passive: true });
})();

/* ---------- Parallax hero -------------------------------- */
(function parallax() {
  const layers = [...document.querySelectorAll("[data-parallax]")];
  if (!layers.length) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    layers.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax) || 0.2;
      el.style.transform = `translate3d(0, ${y * speed}px, 0)`;
    });
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true }
  );
  update();
})();

/* ---------- Scroll reveal -------------------------------- */
(function reveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(i => i.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );

  /* Observe existing elements */
  function observeAll() {
    document.querySelectorAll('.reveal:not(.is-in)').forEach(el => {
      // Left/right slides need overflow:hidden on their section
      if (el.classList.contains('reveal--left') || el.classList.contains('reveal--right')) {
        const section = el.closest('section');
        if (section) section.style.overflow = 'hidden';
      }
      io.observe(el);
    });
  }

  observeAll();

  /* Watch for cards injected dynamically (packages, gallery tiles) */
  const mo = new MutationObserver(() => observeAll());
  mo.observe(document.body, { childList: true, subtree: true });
})();

/* ---------- Footer year + WhatsApp links ----------------- */
(function chrome() {
  const y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  document.querySelectorAll("[data-whatsapp]").forEach((a) => {
    a.href = window.buildWhatsappLink(a.dataset.whatsapp || "");
    a.target = "_blank";
    a.rel = "noopener";
  });

  document.querySelectorAll("[data-brand-name]").forEach((el) => {
    el.textContent = window.LUMEN_CONFIG.businessName;
  });

  // Nav logo: if a logoUrl is configured, show the image and hide
  // the built-in amber dot mark; otherwise keep the dot as a fallback.
  var logoUrl = window.LUMEN_CONFIG.logoUrl;
  document.querySelectorAll("[data-brand-logo]").forEach((img) => {
    if (logoUrl) {
      img.src = logoUrl;
      img.alt = window.LUMEN_CONFIG.businessName + " logo";
      img.hidden = false;
      var mark = img.parentElement.querySelector(".brand__mark");
      if (mark) mark.hidden = true;
    }
  });
})();

/* ---------- Toast ---------------------------------------- */
window.toast = function (message, kind = "ok", ms = 3600) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  t.className = `toast toast--${kind}`;
  t.textContent = message;
  requestAnimationFrame(() => t.classList.add("is-show"));
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("is-show"), ms);
};

/* ---------- Validation helpers --------------------------- */
window.Validate = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()),
  required: (v) => String(v || "").trim().length > 0,
  minDate: (v, min) => v && new Date(v) >= new Date(min),
  setError(field, msg) {
    const wrap = field.closest(".field");
    if (!wrap) return;
    wrap.classList.toggle("field--error", !!msg);
    const box = wrap.querySelector(".field__error");
    if (box) box.textContent = msg || "";
    if (msg) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  },
};

/* ---------- Generic modal open/close --------------------- */
window.Modal = {
  open(el) {
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const focusable = el.querySelector(
      "button, [href], input, select, textarea"
    );
    focusable && focusable.focus();
  },
  close(el) {
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  },
};
/* Close any open overlay on Escape / backdrop click. */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document
      .querySelectorAll(".modal-backdrop.is-open, .lightbox.is-open")
      .forEach((m) => {
        m.classList.remove("is-open");
        document.body.style.overflow = "";
      });
  }
});

/* ---------- Home hero carousel --------------------------- */
(function homeHeroCarousel() {
  const carousel = document.querySelector('.hero__carousel');
  if (!carousel) return;

  const slides = [...carousel.querySelectorAll('.hero__bg')];
  if (slides.length === 0) return;

  let currentIndex = 0;

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
    });
  }

  function nextSlide() {
    currentIndex = (currentIndex + 1) % slides.length;
    showSlide(currentIndex);
  }

  // Show first slide
  showSlide(0);

  // Auto-rotate every 5 seconds
  setInterval(nextSlide, 5000);
})();