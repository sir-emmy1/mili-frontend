/* =============================================================
   currency.js — real-time currency conversion for client pages.

   Data sources:
     1. Frankfurter API (api.frankfurter.dev) — USD/NGN only
        - Official Central Bank of Nigeria (CBN) rates
        - Most accurate for NGN↔USD conversions
        - Free, no API key required
     
     2. ExchangeRate-API (open.er-api.com/v6/latest/NGN) — All other currencies
        - Free, no API key required
        - NGN as the base currency
        - Updated daily, covers 160+ currencies
        - Provided by https://www.exchangerate-api.com

   Flow:
     1. Fetch live CBN USD rate + other currency rates; cache 1 hour.
     2. window.LumenCurrency.format(ngn) converts and formats
        an NGN amount into the currently selected currency.
     3. A <select> is injected into every .nav__links.
        Changing it fires a "currencychange" CustomEvent so
        services.js / gallery.js re-render prices instantly.
   ============================================================= */

(function () {
  /* ---------- Supported currencies ------------------------- */
  const CURRENCIES = [
    { code: "NGN", symbol: "₦",   name: "Nigerian Naira"    },
    { code: "USD", symbol: "$",   name: "US Dollar"         },
    { code: "EUR", symbol: "€",   name: "Euro"              },
    { code: "GBP", symbol: "£",   name: "British Pound"     },
    { code: "GHS", symbol: "₵",   name: "Ghanaian Cedi"     },      
   
  ];

  const STORAGE_KEY  = "lumen_currency_rates_v3";
  const SELECTED_KEY = "lumen_currency_selected";
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  let rates  = { NGN: 1 };
  let active = localStorage.getItem(SELECTED_KEY) || "NGN";

  /* ---------- Rate fetching -------------------------------- */
  async function fetchRates() {
    // Serve from cache if still fresh
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        rates = cached.rates;
        return;
      }
    } catch (_) {}

    // Hybrid approach:
    // 1. Fetch USD rate from Frankfurter (CBN official rate)
    // 2. Fetch other currencies from open.er-api.com
    // This gives the most accurate NGN↔USD conversion + broad currency support
    
    let usdRate = null;
    
    // Try Frankfurter API for USD/NGN (CBN official rate)
    try {
      const frankfurterUrl = "https://api.frankfurter.dev/v2/rate/USD/NGN?providers=CBN";
      const res = await fetch(frankfurterUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const json = await res.json();
        if (json.rate) {
          // Frankfurter gives USD→NGN, we need NGN→USD
          usdRate = 1 / json.rate;
          console.info("[LumenCurrency] USD rate from CBN —", json.rate, "NGN per USD");
        }
      }
    } catch (err) {
      console.warn("[LumenCurrency] Frankfurter fetch failed —", err.message);
    }

    // Fetch other currencies from open.er-api.com
    // Attribution: https://www.exchangerate-api.com
    const url = "https://open.er-api.com/v6/latest/NGN";

    try {
      const res  = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (json.result !== "success" || !json.rates) throw new Error("Unexpected response");

      rates = json.rates; // already NGN-based, includes NGN: 1
      
      // Override USD with CBN rate if we got it
      if (usdRate) {
        rates.USD = usdRate;
        console.info("[LumenCurrency] Using CBN rate for USD:", usdRate);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), rates }));
      console.info("[LumenCurrency] Rates updated —", json.time_last_update_utc);
    } catch (err) {
      console.warn("[LumenCurrency] Live fetch failed, using fallback rates —", err.message);
      // Fallback rates (CBN rate as of 2026-08-13)
      rates = {
        NGN: 1,
        USD: usdRate || 0.000737, // CBN: 1 USD = ₦1,357.15
        EUR: 0.000641,
        GBP: 0.000550,
        GHS: 0.008563,
        KES: 0.094894,
        ZAR: 0.012096,
        CAD: 0.001012,
        AUD: 0.001051,
        JPY: 0.118633,
      };
    }
  }

  /* ---------- Conversion + formatting ---------------------- */
  function format(ngnAmount) {
    if (ngnAmount == null || ngnAmount === "") return "";
    const rate  = rates[active] ?? 1;
    const value = Number(ngnAmount) * rate;

    try {
      return new Intl.NumberFormat(undefined, {
        style:                 "currency",
        currency:              active,
        minimumFractionDigits: 0,
        maximumFractionDigits: active === "JPY" ? 0 : 2,
      }).format(value);
    } catch (_) {
      const cfg = CURRENCIES.find((c) => c.code === active) || CURRENCIES[0];
      return cfg.symbol + value.toLocaleString(undefined, {
        maximumFractionDigits: active === "JPY" ? 0 : 2,
      });
    }
  }

  /* ---------- Selector widget ------------------------------ */
  function buildSelector() {
    document.querySelectorAll(".nav__links").forEach((ul) => {
      if (ul.querySelector(".currency-picker")) return;

      const li = document.createElement("li");
      li.className = "currency-picker";
      li.setAttribute("aria-label", "Select display currency");

      const select = document.createElement("select");
      select.className = "currency-select";
      select.setAttribute("aria-label", "Currency");
      select.title = "Change display currency";

      CURRENCIES.forEach((c) => {
        const opt = document.createElement("option");
        opt.value       = c.code;
        opt.textContent = `${c.symbol} ${c.code}`;
        opt.title       = c.name;
        if (c.code === active) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener("change", () => {
        active = select.value;
        localStorage.setItem(SELECTED_KEY, active);
        // Sync any other selectors on the page
        document.querySelectorAll(".currency-select").forEach((s) => {
          s.value = active;
        });
        document.dispatchEvent(new CustomEvent("currencychange", {
          detail: { code: active, format },
        }));
      });

      li.appendChild(select);
      const cta = ul.querySelector(".nav__cta");
      ul.insertBefore(li, cta || null);
    });
  }

  /* ---------- Boot ----------------------------------------- */
  async function boot() {
    await fetchRates();
    buildSelector();
    document.dispatchEvent(new CustomEvent("currencychange", {
      detail: { code: active, format },
    }));
  }

  /* ---------- Public API ----------------------------------- */
  window.LumenCurrency = {
    /** Format an NGN amount in the currently selected currency. */
    format,
    /** Active ISO currency code, e.g. "USD". */
    get active() { return active; },
    /** Force a fresh rate fetch (ignores cache). */
    async refresh() {
      localStorage.removeItem(STORAGE_KEY);
      await fetchRates();
      document.dispatchEvent(new CustomEvent("currencychange", {
        detail: { code: active, format },
      }));
    },
    CURRENCIES,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();