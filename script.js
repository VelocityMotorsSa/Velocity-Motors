
/* Hero photo carousel — auto-rotates through real inventory shots */
document.addEventListener("DOMContentLoaded", () => {
  const slides = document.querySelectorAll(".hero-carousel-slide");
  if (slides.length < 2) return;
  let current = 0;
  setInterval(() => {
    slides[current].classList.remove("active");
    current = (current + 1) % slides.length;
    slides[current].classList.add("active");
  }, 4500);
});

/* Financing calculator */
document.addEventListener("DOMContentLoaded", () => {
  const priceEl = document.getElementById("calcPrice");
  if (!priceEl) return;
  const downEl = document.getElementById("calcDown");
  const tradeEl = document.getElementById("calcTrade");
  const aprEl = document.getElementById("calcApr");
  const termEl = document.getElementById("calcTerm");
  const resultEl = document.getElementById("calcResult");

  function formatCurrency(n) {
    return "$" + Math.max(0, Math.round(n)).toLocaleString("en-US");
  }

  function calculate() {
    const price = parseFloat(priceEl.value) || 0;
    const down = parseFloat(downEl.value) || 0;
    const trade = parseFloat(tradeEl.value) || 0;
    const apr = parseFloat(aprEl.value) || 0;
    const term = parseInt(termEl.value, 10) || 60;

    const principal = Math.max(0, price - down - trade);
    const monthlyRate = apr / 100 / 12;

    let payment;
    if (monthlyRate === 0) {
      payment = principal / term;
    } else {
      const factor = Math.pow(1 + monthlyRate, term);
      payment = (principal * monthlyRate * factor) / (factor - 1);
    }

    resultEl.textContent = formatCurrency(payment) + "/mo";
  }

  [priceEl, downEl, tradeEl, aprEl, termEl].forEach((el) => {
    el.addEventListener("input", calculate);
    el.addEventListener("change", calculate);
  });

  calculate();
});

/* ===================================================================
   Live inventory rendering
   -------------------------------------------------------------------
   Reads data/inventory.json, which is auto-generated a few times a
   day by a scheduled GitHub Action (scripts/build_inventory.py),
   pulling directly from the real AutoManager WebManager XML feed.
   This renders that data into car-card grids using our own design —
   no AutoManager branding, no iframe, no live per-visit calls to
   their feed (which is rate-limited to 5 requests/day).
   =================================================================== */

function formatPrice(n) {
  if (!n || n <= 0) return "Call for Price";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function formatMileage(n) {
  return Math.round(n || 0).toLocaleString("en-US") + " mi";
}

function vehicleTitle(v) {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}

function renderComingSoonCard(v) {
  const isSpanish = document.documentElement.lang === "es";
  const title = vehicleTitle(v);
  const encodedTitle = encodeURIComponent(title);

  return `
    <div class="car-card coming-soon">
      <div class="car-card-img coming-soon-img">
        <span class="car-badge coming-soon-badge">${isSpanish ? "Próximamente" : "Coming Soon"}</span>
        <img src="images/coming-soon-cover.jpg" alt="" class="coming-soon-photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="coming-soon-placeholder" style="display:none">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none" aria-hidden="true">
            <path d="M8 40h48l-5-14a6 6 0 0 0-5.6-4H18.6a6 6 0 0 0-5.6 4L8 40z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
            <circle cx="18" cy="44" r="5" stroke="currentColor" stroke-width="2.5"/>
            <circle cx="46" cy="44" r="5" stroke="currentColor" stroke-width="2.5"/>
            <path d="M4 40v-4h56v4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="coming-soon-caption">${isSpanish ? "Listo para revelar" : "Ready to reveal"}</span>
      </div>
      <div class="car-card-body">
        <h3>${title}</h3>
        <div class="car-meta">
          <span class="odometer">${v.mileage ? formatMileage(v.mileage) : (isSpanish ? "Millaje: pronto" : "Mileage TBD")}</span>
          <span>·</span>
          <span>${v.bodyStyle || ""}</span>
        </div>
        <div class="car-price-row">
          <div class="car-price"><span class="label">${isSpanish ? "Precio de Venta" : "Showroom Price"}</span>${formatPrice(v.price)}</div>
          <a href="schedule-test-drive.html?vehicle=${encodedTitle}" class="btn btn-outline btn-sm">${isSpanish ? "Preguntar" : "Ask About It"}</a>
        </div>
      </div>
    </div>`;
}

function renderCarCard(v, opts) {
  opts = opts || {};
  const isSpanish = document.documentElement.lang === "es";

  if (!v.hasPhotos) {
    return renderComingSoonCard(v);
  }

  const photos = v.photos;
  const detailHref = `vehicle-detail.html?id=${encodeURIComponent(v.id)}`;
  const badge = opts.badgeText
    ? `<span class="car-badge new">${opts.badgeText}</span>`
    : `<span class="car-badge">${v.make}</span>`;

  const slidesHtml = photos
    .map(
      (src, i) =>
        `<img src="${src}" alt="${vehicleTitle(v)}" loading="lazy" class="card-photo-slide${i === 0 ? " active" : ""}">`
    )
    .join("");

  const navHtml =
    photos.length > 1
      ? `<button class="card-photo-nav prev" data-card-nav="prev" aria-label="Previous photo">&#8249;</button>
         <button class="card-photo-nav next" data-card-nav="next" aria-label="Next photo">&#8250;</button>
         <span class="card-photo-counter">1 / ${photos.length}</span>`
      : "";

  return `
    <div class="car-card">
      <div class="car-card-img" data-photo-count="${photos.length}" data-current-photo="0">
        ${badge}
        <a href="${detailHref}" class="card-photo-link">${slidesHtml}</a>
        ${navHtml}
      </div>
      <div class="car-card-body">
        <h3><a href="${detailHref}" style="color:inherit">${vehicleTitle(v)}</a></h3>
        <div class="car-meta">
          <span class="odometer">${formatMileage(v.mileage)}</span>
          <span>·</span>
          <span>${v.bodyStyle || ""}</span>
        </div>
        <div class="car-price-row">
          <div class="car-price"><span class="label">${isSpanish ? "Precio de Venta" : "Showroom Price"}</span>${formatPrice(v.price)}</div>
          <a href="${detailHref}" class="btn btn-outline btn-sm">${isSpanish ? "Detalles" : "Details"}</a>
        </div>
      </div>
    </div>`;
}

async function loadInventoryData() {
  const res = await fetch("data/inventory.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load inventory data");
  return res.json();
}

document.addEventListener("DOMContentLoaded", () => {
  const targets = document.querySelectorAll("[data-inventory-grid]");
  if (targets.length === 0) return;

  loadInventoryData()
    .then((data) => {
      targets.forEach((el) => {
        const limit = parseInt(el.getAttribute("data-inventory-limit") || "0", 10);
        // Show fully-photographed vehicles first; Coming Soon listings
        // (no photos yet from DeskManager) trail at the end of the grid.
        let vehicles = (data.vehicles || [])
          .slice()
          .sort((a, b) => (b.hasPhotos ? 1 : 0) - (a.hasPhotos ? 1 : 0));
        if (limit > 0) vehicles = vehicles.slice(0, limit);

        if (vehicles.length === 0) {
          el.innerHTML = `<p style="padding:30px;color:var(--muted)">No vehicles currently available. Please check back soon.</p>`;
          return;
        }

        el.innerHTML = vehicles
          .map((v, i) => renderCarCard(v, { badgeText: i === 0 ? "New Arrival" : null }))
          .join("");
      });
    })
    .catch((err) => {
      console.error(err);
      targets.forEach((el) => {
        el.innerHTML = `<p style="padding:30px;color:var(--muted)">Inventory is temporarily unavailable. Please call us at 714-835-7522 or check back soon.</p>`;
      });
    });

  // Delegated click handling for per-card photo prev/next (cards are
  // injected dynamically, so we listen on the grid container instead
  // of binding to individual buttons).
  targets.forEach((grid) => {
    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-card-nav]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const imgWrap = btn.closest(".car-card-img");
      const slides = imgWrap.querySelectorAll(".card-photo-slide");
      const count = slides.length;
      let current = parseInt(imgWrap.getAttribute("data-current-photo") || "0", 10);

      current = btn.getAttribute("data-card-nav") === "next"
        ? (current + 1) % count
        : (current - 1 + count) % count;

      slides.forEach((s, i) => s.classList.toggle("active", i === current));
      imgWrap.setAttribute("data-current-photo", String(current));
      const counter = imgWrap.querySelector(".card-photo-counter");
      if (counter) counter.textContent = `${current + 1} / ${count}`;
    });
  });
});

/* ===================================================================
   AutoManager / WebManager Client ID
   -------------------------------------------------------------------
   This is the ONLY place this ID needs to live. Every embedded
   inventory/recently-sold iframe below reads from this constant.
   Confirmed: 017852 is Velocity Motors' WebManager Client ID.
   =================================================================== */
const AUTOMANAGER_CLIENT_ID = "017852";

document.addEventListener("DOMContentLoaded", () => {
  const base = `https://clients.automanager.com/${AUTOMANAGER_CLIENT_ID}`;
  const params = new URLSearchParams(location.search);
  const makeFilter = params.get("make");

  // Wire up embedded iframes (inventory grid, recently-sold grid, etc.)
  document.querySelectorAll("iframe[data-am-page]").forEach((frame) => {
    const page = frame.getAttribute("data-am-page");
    // Make filtering is the one confirmed-working AutoManager URL filter.
    // Price/mileage/body-type filters are not documented by AutoManager
    // and are not applied here to avoid silently breaking the embed.
    if (page === "view-inventory" && makeFilter) {
      const slug = makeFilter.toLowerCase().replace(/\s+/g, "-");
      frame.src = `${base}/${page}/${slug}?make=${encodeURIComponent(makeFilter)}&Framed=1`;
    } else {
      frame.src = `${base}/${page}/?Framed=1`;
    }
  });

  // Wire up "view it directly" fallback links (open the real AutoManager
  // page in a new tab, in case the iframe is blocked or doesn't fit)
  document.querySelectorAll("[data-am-link]").forEach((link) => {
    const page = link.getAttribute("data-am-link");
    if (page === "view-inventory" && makeFilter) {
      const slug = makeFilter.toLowerCase().replace(/\s+/g, "-");
      link.href = `${base}/${page}/${slug}?make=${encodeURIComponent(makeFilter)}`;
    } else {
      link.href = `${base}/${page}/`;
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".search-card");
  if (!form) return;
  const button = form.querySelector(".btn-secondary");
  if (button) {
    button.addEventListener("click", (e) => {
      const selects = [...form.querySelectorAll("select")];
      const params = new URLSearchParams({
        make: selects[0]?.value || "",
        type: selects[1]?.value || "",
        price: selects[2]?.value || "",
        miles: selects[3]?.value || ""
      });
      window.location.href = "inventory.html?" + params.toString();
    });
  }
});

/* ===================================================================
   Formspree endpoint for lead forms (Vehicle Request, Sell Your Car,
   Credit Application)
   -------------------------------------------------------------------
   This is the ONLY place this needs to live. Confirmed live and
   delivering to velocitymotors714@gmail.com.
   =================================================================== */
const FORMSPREE_ENDPOINT = "https://formspree.io/f/mkjnbvkz";

document.addEventListener("DOMContentLoaded", () => {
  const isSpanish = () => document.documentElement.lang === "es";

  document.querySelectorAll("[data-lead-form]").forEach((form) => {
    const status = form.querySelector(".form-status");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (status) {
        status.textContent = isSpanish() ? "Enviando..." : "Sending...";
        status.classList.remove("success", "error");
      }

      try {
        const response = await fetch(FORMSPREE_ENDPOINT, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" }
        });

        if (response.ok) {
          form.reset();
          if (status) {
            status.textContent = isSpanish()
              ? "¡Gracias! Te contactaremos pronto."
              : "Thanks! We'll be in touch soon.";
            status.classList.add("success");
          }
        } else {
          throw new Error("Submission failed");
        }
      } catch (err) {
        if (status) {
          status.textContent = isSpanish()
            ? "Hubo un problema. Llámanos al 714-835-7522."
            : "Something went wrong. Please call us at 714-835-7522.";
          status.classList.add("error");
        }
      }
    });
  });
});

/* Prefill the "Vehicle" field on the test-drive form when arriving
   from a Coming Soon card (e.g. schedule-test-drive.html?vehicle=...) */
document.addEventListener("DOMContentLoaded", () => {
  const vehicleField = document.querySelector('[name="vehicle"]');
  if (!vehicleField) return;
  const params = new URLSearchParams(location.search);
  const vehicle = params.get("vehicle");
  if (vehicle) vehicleField.value = vehicle;
});

/* EN/ES language toggle — persists across pages via localStorage */
document.addEventListener("DOMContentLoaded", () => {
  const nodes = document.querySelectorAll("[data-en]");
  const toggle = document.getElementById("langToggle");

  function applyLang(lang) {
    document.documentElement.lang = lang;
    nodes.forEach((el) => {
      const text = el.getAttribute("data-" + lang);
      if (text !== null) el.innerHTML = text;
    });
    if (toggle) toggle.textContent = lang === "en" ? "Español" : "English";
    localStorage.setItem("vm_lang", lang);
  }

  const saved = localStorage.getItem("vm_lang") || "en";
  applyLang(saved);

  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = document.documentElement.lang === "es" ? "es" : "en";
      applyLang(current === "en" ? "es" : "en");
    });
  }
});
