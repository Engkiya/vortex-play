/* =========================================================
   STATION 09 — Frontend Controller & API Integration
   ========================================================= */

const WHATSAPP_ADMIN = "628582030543";

const TIERS = {
  reguler: { label: "Reguler (PS5 Slim)", rate: 20000, unit: "jam" },
  pro:     { label: "Pro OLED (PS5 Pro)", rate: 35000, unit: "jam" },
  vip:     { label: "Ruang VIP Privat", rate: 85000, unit: "jam" },
  home:    { label: "Sewa Bawa Pulang", rate: 150000, unit: "hari" },
};

const STICK_PRICE = 15000;

const GAMES = [
  { title: "EA Sports FC 26", genre: "Sports", players: "1–4 Pemain", image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=640&q=80" },
  { title: "Black Myth: Wukong", genre: "Action", players: "1 Pemain", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=640&q=80" },
  { title: "Tekken 8", genre: "Fighting", players: "1–2 Pemain", image: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=640&q=80" },
  { title: "Gran Turismo 7", genre: "Racing", players: "1–2 Pemain", image: "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=640&q=80" },
  { title: "Marvel's Spider-Man 2", genre: "Action", players: "1 Pemain", image: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&w=640&q=80" },
  { title: "NBA 2K26", genre: "Sports", players: "1–4 Pemain", image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=640&q=80" },
  { title: "It Takes Two", genre: "Co-op", players: "2 Pemain Co-op", image: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=640&q=80" },
  { title: "Elden Ring", genre: "Action", players: "1 Pemain", image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=640&q=80" },
];

let unitsData = [];
let currentUnitFilter = "all";
let currentGenre = "all";
let promoState = { code: null, percent: 0 };

const formatRp = (val) => "Rp " + Number(val || 0).toLocaleString("id-ID");

function toast(text, variant = "neutral") {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  const accent = variant === "error" ? "border-red-500/50" : variant === "success" ? "border-emerald-500/50" : "border-subtle";
  el.className = `surface-card border ${accent} px-4 py-3 rounded-xl text-xs font-medium shadow-lg`;
  el.textContent = text;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.25s ease";
    setTimeout(() => el.remove(), 250);
  }, 3000);
}

/* --- 1. Theme Switch --- */
function setupTheme() {
  const html = document.documentElement;
  const sun = document.getElementById("icon-sun");
  const moon = document.getElementById("icon-moon");
  const saved = localStorage.getItem("station09_theme") || "dark";

  const setMode = (mode) => {
    const isDark = mode === "dark";
    html.classList.toggle("dark", isDark);
    sun.classList.toggle("hidden", !isDark);
    moon.classList.toggle("hidden", isDark);
    localStorage.setItem("station09_theme", mode);
  };

  setMode(saved);
  document.getElementById("theme-toggle").addEventListener("click", () => {
    setMode(html.classList.contains("dark") ? "light" : "dark");
  });
}

/* --- 2. Live Units API --- */
async function fetchUnits() {
  const badge = document.getElementById("hero-live-badge");
  const grid = document.getElementById("units-grid");

  try {
    const res = await fetch("/api/units");
    const data = await res.json();
    unitsData = data.units || [];
    badge.textContent = `${data.available} dari ${data.total} unit tersedia sekarang`;
    renderUnits();
    syncUnitDropdown();
  } catch {
    badge.textContent = "Status server tidak terhubung";
    grid.innerHTML = `<div class="col-span-full py-10 text-center text-sm text-muted">Gagal mengambil data unit. Pastikan <code>python app.py</code> berjalan.</div>`;
  }
}

function renderUnits() {
  const grid = document.getElementById("units-grid");
  const list = currentUnitFilter === "all"
    ? unitsData
    : unitsData.filter((u) => u.tier === currentUnitFilter);

  const statusConfig = {
    available: { text: "Tersedia", dot: "bg-emerald-500", cls: "text-emerald-500" },
    occupied:  { text: "Dipakai", dot: "bg-zinc-400", cls: "text-muted" },
    reserved:  { text: "Dipesan", dot: "bg-amber-500", cls: "text-amber-500" },
  };

  grid.innerHTML = list.map((u) => {
    const st = statusConfig[u.status] || statusConfig.occupied;
    const isFree = u.status === "available";
    return `
      <div class="surface-card border border-subtle rounded-2xl p-5 flex flex-col justify-between ${isFree ? "unit-card-free" : "opacity-60"}"
           ${isFree ? `onclick="pickUnit('${u.tier}', '${u.code}')"` : ""}>
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="font-mono text-xs font-semibold">${u.code}</span>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium ${st.cls}">
              <span class="w-1.5 h-1.5 rounded-full ${st.dot}"></span>
              ${st.text}
            </span>
          </div>
          <h3 class="font-semibold text-base">${u.name}</h3>
          <p class="text-xs text-muted mt-1">${u.display_spec}</p>
          <p class="text-xs text-muted mt-0.5">${u.gear_spec}</p>
        </div>
        <div class="mt-4 pt-3 border-t border-subtle flex items-center justify-between">
          <span class="font-mono text-sm font-semibold tabular-nums">${formatRp(u.rate)}<span class="text-xs font-normal text-muted">/jam</span></span>
          <span class="text-xs font-semibold ${isFree ? "text-cobalt" : "text-muted"}">${isFree ? "Pilih →" : "Penuh"}</span>
        </div>
      </div>
    `;
  }).join("");
}

window.pickUnit = function (tier, code) {
  document.getElementById("input-tier").value = tier;
  syncUnitDropdown(code);
  recalcSummary();
  document.getElementById("booking").scrollIntoView({ behavior: "smooth" });
  toast(`Unit ${code} dipilih.`);
};

function syncUnitDropdown(selectedCode = null) {
  const tier = document.getElementById("input-tier").value;
  const select = document.getElementById("input-unit");

  if (tier === "home") {
    select.innerHTML = `<option value="ANTAR-RUMAH">Diantar Kurir ke Alamat Anda</option>`;
    return;
  }

  const freeUnits = unitsData.filter((u) => u.tier === tier && u.status === "available");
  let html = `<option value="AUTO">Otomatis (Unit Kosong Terbaik)</option>`;
  freeUnits.forEach((u) => {
    html += `<option value="${u.code}">${u.code} — ${u.name}</option>`;
  });
  select.innerHTML = html;

  if (selectedCode && freeUnits.some((u) => u.code === selectedCode)) {
    select.value = selectedCode;
  }
}

/* --- 3. Game Catalog --- */
function renderGames() {
  const grid = document.getElementById("games-grid");
  const q = (document.getElementById("game-search").value || "").toLowerCase().trim();

  const filtered = GAMES.filter((g) => {
    const okGenre = currentGenre === "all" || g.genre === currentGenre;
    const okQuery = g.title.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q);
    return okGenre && okQuery;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="col-span-full py-10 text-center text-sm text-muted">Judul game tidak ditemukan.</div>`;
    return;
  }

  grid.innerHTML = filtered.map((g) => `
    <article class="surface-card border border-subtle rounded-2xl overflow-hidden group">
      <div class="aspect-[16/10] overflow-hidden surface-subtle">
        <img src="${g.image}" alt="${g.title}" loading="lazy"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div class="p-4">
        <div class="flex items-center justify-between text-[11px] font-mono text-muted">
          <span>${g.genre}</span>
          <span>${g.players}</span>
        </div>
        <h3 class="font-semibold text-sm mt-1.5">${g.title}</h3>
      </div>
    </article>
  `).join("");
}

/* --- 4. Price Calculator & Promo --- */
function recalcSummary() {
  const tierKey = document.getElementById("input-tier").value;
  const duration = Math.max(1, parseInt(document.getElementById("input-duration").value || "1", 10));
  const sticks = parseInt(document.getElementById("input-sticks").value || "0", 10);

  const t = TIERS[tierKey];
  document.getElementById("duration-unit").textContent = t.unit === "jam" ? "Jam" : "Hari";

  const base = t.rate * duration;
  const sticksFee = sticks * STICK_PRICE;
  const subtotal = base + sticksFee;
  const discount = Math.round(subtotal * (promoState.percent / 100));
  const total = subtotal - discount;

  document.getElementById("sum-tier").textContent = `${t.label} (${duration} ${t.unit})`;
  document.getElementById("sum-base").textContent = formatRp(base);
  document.getElementById("sum-sticks").textContent = formatRp(sticksFee);

  const discRow = document.getElementById("sum-discount-row");
  if (discount > 0) {
    discRow.classList.remove("hidden");
    discRow.classList.add("flex");
    document.getElementById("sum-discount").textContent = `-${formatRp(discount)} (${promoState.percent}%)`;
  } else {
    discRow.classList.add("hidden");
    discRow.classList.remove("flex");
  }

  document.getElementById("sum-total").textContent = formatRp(total);
}

async function applyPromo() {
  const code = document.getElementById("input-promo").value.trim().toUpperCase();
  const msg = document.getElementById("promo-msg");

  if (!code) {
    promoState = { code: null, percent: 0 };
    msg.textContent = "";
    recalcSummary();
    return;
  }

  try {
    const res = await fetch("/api/promo/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();

    if (res.ok && data.valid) {
      promoState = { code: data.code, percent: data.discount_percent };
      msg.className = "text-xs mt-1.5 text-emerald-500";
      msg.textContent = `${data.label} diterapkan.`;
      toast(`Promo ${data.code} aktif.`, "success");
    } else {
      promoState = { code: null, percent: 0 };
      msg.className = "text-xs mt-1.5 text-red-500";
      msg.textContent = data.message || "Kode promo tidak valid.";
    }
    recalcSummary();
  } catch {
    toast("Gagal mengecek kode promo.", "error");
  }
}

/* --- 5. Submit Booking --- */
async function submitBooking(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-booking");
  const prev = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = "Menyimpan reservasi...";

  const payload = {
    customer_name: document.getElementById("input-name").value.trim(),
    customer_phone: document.getElementById("input-phone").value.trim(),
    tier: document.getElementById("input-tier").value,
    unit_code: document.getElementById("input-unit").value,
    booking_date: document.getElementById("input-date").value,
    start_time: document.getElementById("input-time").value,
    duration: parseInt(document.getElementById("input-duration").value, 10),
    extra_sticks: parseInt(document.getElementById("input-sticks").value, 10),
    promo_code: promoState.code || "",
  };

  try {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      toast(data.message || "Reservasi gagal.", "error");
      return;
    }

    openTicketModal(data.booking);
    fetchUnits();
    toast(`Reservasi ${data.booking.booking_code} berhasil.`, "success");
  } catch {
    toast("Koneksi ke server terputus.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = prev;
    lucide.createIcons();
  }
}

function openTicketModal(b) {
  const modal = document.getElementById("ticket-modal");
  document.getElementById("ticket-code").textContent = b.booking_code;
  document.getElementById("ticket-name").textContent = b.customer_name;
  document.getElementById("ticket-detail").textContent = `${b.tier_name} (${b.unit_code})`;
  document.getElementById("ticket-schedule").textContent = `${b.booking_date} • ${b.start_time} (${b.duration} ${b.duration_unit})`;
  document.getElementById("ticket-total").textContent = formatRp(b.total_price);

  const msg = encodeURIComponent(
    `Halo STATION 09, saya ingin konfirmasi booking:\n` +
    `Kode: ${b.booking_code}\n` +
    `Nama: ${b.customer_name}\n` +
    `Paket: ${b.tier_name} (${b.unit_code})\n` +
    `Jadwal: ${b.booking_date} jam ${b.start_time} (${b.duration} ${b.duration_unit})\n` +
    `Total: ${formatRp(b.total_price)}`
  );
  document.getElementById("ticket-wa-btn").href = `https://wa.me/${WHATSAPP_ADMIN}?text=${msg}`;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

/* --- 6. Booking Code Lookup --- */
async function handleLookup(e) {
  e.preventDefault();
  const code = document.getElementById("lookup-input").value.trim().toUpperCase();
  const out = document.getElementById("lookup-result");
  out.innerHTML = `<p class="text-xs text-muted">Mencari data...</p>`;

  try {
    const res = await fetch(`/api/bookings/${encodeURIComponent(code)}`);
    const data = await res.json();

    if (!res.ok || !data.found) {
      out.innerHTML = `<div class="p-3.5 rounded-xl surface-subtle border border-subtle text-xs text-red-500">${data.message}</div>`;
      return;
    }

    const b = data.booking;
    out.innerHTML = `
      <div class="p-4 rounded-xl surface-subtle border border-subtle space-y-2 text-xs">
        <div class="flex justify-between items-center pb-2 border-b border-subtle">
          <span class="font-mono font-bold text-sm">${b.booking_code}</span>
          <span class="text-emerald-500 font-semibold">${b.status}</span>
        </div>
        <div class="flex justify-between"><span class="text-muted">Nama</span><span class="font-medium">${b.customer_name}</span></div>
        <div class="flex justify-between"><span class="text-muted">Paket</span><span class="font-medium">${b.tier_name}</span></div>
        <div class="flex justify-between"><span class="text-muted">Unit</span><span class="font-mono">${b.unit_code}</span></div>
        <div class="flex justify-between"><span class="text-muted">Jadwal</span><span class="font-mono">${b.booking_date} • ${b.start_time} (${b.duration} ${b.duration_unit})</span></div>
        <div class="flex justify-between pt-2 border-t border-subtle"><span class="font-semibold">Total</span><span class="font-mono font-bold">${formatRp(b.total_price)}</span></div>
      </div>
    `;
  } catch {
    out.innerHTML = `<p class="text-xs text-red-500">Gagal menghubungi server.</p>`;
  }
}

/* --- 7. Init --- */
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  setupTheme();

  // Default tanggal hari ini
  const today = new Date().toISOString().split("T")[0];
  const dateEl = document.getElementById("input-date");
  dateEl.value = today;
  dateEl.min = today;

  // Mobile menu
  const mobileMenu = document.getElementById("mobile-menu");
  document.getElementById("mobile-menu-btn").addEventListener("click", () => {
    mobileMenu.classList.toggle("hidden");
  });
  mobileMenu.querySelectorAll("a, button").forEach((el) => {
    el.addEventListener("click", () => mobileMenu.classList.add("hidden"));
  });

  // Unit Filters
  document.querySelectorAll("#unit-filters [data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#unit-filters .pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentUnitFilter = btn.dataset.filter;
      renderUnits();
    });
  });
  document.getElementById("refresh-units-btn").addEventListener("click", () => {
    fetchUnits();
    toast("Status unit diperbarui.");
  });

  // Pricing CTA
  document.querySelectorAll("[data-choose-tier]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("input-tier").value = btn.dataset.chooseTier;
      syncUnitDropdown();
      recalcSummary();
      document.getElementById("booking").scrollIntoView({ behavior: "smooth" });
    });
  });

  // Game Filters
  document.querySelectorAll("#game-filters [data-genre]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#game-filters .pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentGenre = btn.dataset.genre;
      renderGames();
    });
  });
  document.getElementById("game-search").addEventListener("input", renderGames);

  // Booking reactive form
  document.getElementById("input-tier").addEventListener("change", () => {
    syncUnitDropdown();
    recalcSummary();
  });
  document.getElementById("input-duration").addEventListener("input", recalcSummary);
  document.getElementById("input-sticks").addEventListener("change", recalcSummary);
  document.getElementById("btn-apply-promo").addEventListener("click", applyPromo);
  document.getElementById("booking-form").addEventListener("submit", submitBooking);

  // Ticket Modal
  const ticketModal = document.getElementById("ticket-modal");
  document.getElementById("close-ticket-btn").addEventListener("click", () => {
    ticketModal.classList.add("hidden");
    ticketModal.classList.remove("flex");
  });
  document.getElementById("copy-ticket-btn").addEventListener("click", () => {
    const code = document.getElementById("ticket-code").textContent;
    navigator.clipboard.writeText(code);
    toast(`Kode ${code} disalin.`, "success");
  });

  // Lookup Modal
  const lookupModal = document.getElementById("lookup-modal");
  const openLookup = () => {
    lookupModal.classList.remove("hidden");
    lookupModal.classList.add("flex");
    document.getElementById("lookup-input").focus();
  };
  document.getElementById("open-lookup-btn").addEventListener("click", openLookup);
  document.getElementById("mobile-lookup-btn").addEventListener("click", openLookup);
  document.getElementById("close-lookup-btn").addEventListener("click", () => {
    lookupModal.classList.add("hidden");
    lookupModal.classList.remove("flex");
  });
  document.getElementById("lookup-form").addEventListener("submit", handleLookup);

  // FAQ Accordion
  document.querySelectorAll(".faq-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.nextElementSibling;
      const icon = btn.querySelector("svg");
      panel.classList.toggle("hidden");
      if (icon) icon.classList.toggle("rotate-45");
    });
  });

  fetchUnits();
  renderGames();
  recalcSummary();
});