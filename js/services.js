/* =============================================================
   services.js — render package cards + modal detail view.
   Cards scale on hover (CSS); click opens a spring-like modal.
   Prices are displayed in the currency selected via LumenCurrency.
   ============================================================= */
(function () {
  const grid = document.getElementById("packages");
  const modal = document.getElementById("pkgModal");
  let packages = [];

  async function render() {
    try {
      packages = await window.LumenStore.Packages.list();
    } catch (e) {
      grid.innerHTML = `<p class="alert alert--error">Couldn't load packages. ${e.message}</p>`;
      grid.setAttribute("aria-busy", "false");
      return;
    }
    grid.innerHTML = "";
    packages.forEach((p, i) => {
      const featured = /professional/i.test(p.name);
      const card = document.createElement("article");
      card.className = "pkg reveal" + (featured ? " pkg--featured" : "");
      card.dataset.delay = String(i + 1);
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${p.name} package. View details.`);
      const feats = (p.features || [])
        .slice(0, 4)
        .map((f) => `<li>${escapeHtml(f)}</li>`)
        .join("");
      card.innerHTML = `
        ${featured ? '<span class="pkg__tag">Most booked</span>' : ""}
        <h3 class="pkg__name">${escapeHtml(p.name)}</h3>
        <p class="text-muted" style="margin-top:.6rem">${escapeHtml(p.description).slice(0, 96)}${p.description.length > 96 ? "…" : ""}</p>
        <ul class="pkg__list">${feats}</ul>
        <div class="pkg__cta-row"><span class="btn btn--ghost btn--block">View details</span></div>`;
      const open = () => openModal(p);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
      grid.appendChild(card);
    });
    grid.setAttribute("aria-busy", "false");
    // MutationObserver in main.js picks up new .reveal nodes automatically
  }

  function openModal(p) {
    document.getElementById("pkgModalTag").textContent = p.name + " package";
    document.getElementById("pkgModalTitle").textContent = p.name;
    document.getElementById("pkgModalDesc").textContent = p.description;
    document.getElementById("pkgModalFeatures").innerHTML = (p.features || [])
      .map((f) => `<li>${escapeHtml(f)}</li>`)
      .join("");
    document.getElementById("pkgModalBook").href =
      "contact.html?package=" + encodeURIComponent(p.id);
    const wa = modal.querySelector("[data-whatsapp]");
    wa.href = window.buildWhatsappLink(
      `Hi BIE PHOTOGRAPH! I'm interested in the ${p.name} package. Could you share a quote based on my requirements?`
    );
    window.Modal.open(modal);
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.hasAttribute("data-close"))
      window.Modal.close(modal);
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  render();
})();