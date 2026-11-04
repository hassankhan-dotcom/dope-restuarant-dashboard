import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, limit, onSnapshot, Timestamp, serverTimestamp, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getMessaging, getToken, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

const app = initializeApp(self.FIREBASE_CONFIG);
const auth = getAuth(app);
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = getFirestore(app);
}

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-US");
const moneyShort = (n) => (n >= 1e6 ? "Rs. " + (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : money(n));
function fitText(el, min = 11) {
  el.style.fontSize = "";
  let fs = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth + 0.5 && fs > min) { fs -= 0.5; el.style.fontSize = fs + "px"; }
}

// Pakistan time is a fixed UTC+5 (no DST), so a simple offset is enough.
const PK = 5 * 3600 * 1000;
const pkDate = (d) => new Date(d.getTime() + PK);
const dayKey = (d) => pkDate(d).toISOString().slice(0, 10);
const keyAgo = (n) => dayKey(new Date(Date.now() - n * 864e5));
const hourOf = (d) => pkDate(d).getUTCHours();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function fmtTime(d) {
  const p = pkDate(d); let h = p.getUTCHours(); const m = String(p.getUTCMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${m} ${ap}`;
}
function fmtDayShort(key) { const [y, m, d] = key.split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; }
function fmtLong(d) { const p = pkDate(d); return `${DAYS[p.getUTCDay()]}, ${p.getUTCDate()} ${MONTHS[p.getUTCMonth()]} ${p.getUTCFullYear()}`; }
function fmtShortDate(d) { const p = pkDate(d); return `${DAYS[p.getUTCDay()]}, ${p.getUTCDate()} ${MONTHS[p.getUTCMonth()]}`; }
const phoneShow = (p) => { p = String(p || ""); return p ? (p.startsWith("+") ? p : "+" + p) : "—"; };
const phoneDigits = (p) => String(p || "").replace(/\D/g, "");
const initials = (n) => (String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();

const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  chev: '<path d="M9 18l6-6-6-6"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  trend: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  wa: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.2A8.5 8.5 0 1 1 21 11.5z"/><path d="M9 8.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-.8.7a4 4 0 0 1-1.9-1.9l.7-.8-1-2z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l8 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M18.5 8.5a5 5 0 0 1 0 7"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'
};
const ic = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
const LOGO = '<img src="logo-a.png?v=2" alt="Avalon.pk" decoding="async">';            // the "A" mark
const WORDMARK = '<img src="logo-word.png?v=2" alt="Avalon.pk" decoding="async">';     // full Avalon.pk logo
function paintIcons(root = document) {
  $$("[data-icon]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = ic(el.dataset.icon); });
  $$("[data-logo]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = LOGO; });
  $$("[data-wordmark]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = WORDMARK; });
}
$("#splashLogo").innerHTML = LOGO;
paintIcons();

let toastTimer;
function toast(msg, cls = "", ms = 3500) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast show " + cls;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = "toast"), ms);
}
let audioCtx;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      const t0 = audioCtx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      o.start(t0); o.stop(t0 + 0.16);
    });
  } catch (e) { /* sound is optional */ }
}
document.addEventListener("click", () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) {} }, { once: true });

/* ---------- state ---------- */
const state = {
  user: null, rid: null, restaurant: null, orders: [], totalOrders: null,
  tab: "home", status: "All", date: "today", customDate: null, q: "", limit: 40,
  chart: "today", chartSel: null, sheetId: null, loaded: false,
  custs: [], custLoaded: false, custSort: "recent", custQ: "", mkSeg: null, mkOffer: "", mkOff: new Set()
};
let unsubOrders = null, unsubCusts = null;
const STATUSES = ["Pending", "Preparing", "Ready", "Out for Delivery", "Completed"];
const sKey = (s) => String(s).replace(/\s+/g, "");
const isPickup = (o) => /pick|take/i.test(o.orderType || "");
const statusLabel = (o) => (o.status === "Completed" ? (isPickup(o) ? "Completed" : "Delivered") : o.status);
const pill = (o) => `<span class="pill s-${sKey(o.status)}">${esc(statusLabel(o))}</span>`;
const orderLabel = (o) => (o.orderNumber != null ? `#ORD-${o.orderNumber}` : `#${o.id.slice(0, 5).toUpperCase()}`);

function norm(id, d) {
  const dt = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate() : new Date();
  const items = Array.isArray(d.items) ? d.items.map((i) => {
    const pr = i && i.price != null && i.price !== "" && !isNaN(Number(i.price)) ? Number(i.price) : null;
    return { name: String((i && (i.name || i.item)) || "Item"), qty: Number(i && i.qty) || 1, price: pr };
  }) : [];
  return { ...d, id, status: STATUSES.includes(d.status) ? d.status : "Pending", _dt: dt, _key: dayKey(dt), _items: items };
}
const itemsSummary = (o) => (o._items.length ? o._items.map((i) => `${i.qty}x ${i.name}`).join(" · ") : (o.itemsText || "—"));

/* ---------- auth ---------- */
const show = (id) => {
  ["splash", "loginView", "problemView", "appView"].forEach((v) => $("#" + v).classList.toggle("hidden", v !== id));
};

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#loginBtn"), err = $("#loginError");
  err.classList.add("hidden"); btn.disabled = true; btn.textContent = "Logging in...";
  try {
    await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value);
  } catch (ex) {
    const code = ex && ex.code || "";
    err.textContent = /invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)
      ? "Incorrect email or password." : /too-many/.test(code) ? "Too many attempts. Please try again in a little while."
      : /network/.test(code) ? "Please check your internet connection." : "Unable to log in (" + code + ")";
    err.classList.remove("hidden");
  }
  btn.disabled = false; btn.textContent = "Login";
});
const doLogout = async () => { stopOrders(); await signOut(auth); };
$("#logoutBtn").addEventListener("click", doLogout);
$("#problemLogout").addEventListener("click", doLogout);

onAuthStateChanged(auth, async (user) => {
  if (!user) { stopOrders(); state.user = null; show("loginView"); return; }
  state.user = user;
  try {
    const u = await getDoc(doc(db, "users", user.uid));
    const rid = u.exists() ? u.data().restaurantId : null;
    if (!rid) throw new Error("no-link");
    state.rid = rid; state.userDoc = u.data();
    const r = await getDoc(doc(db, "restaurants", rid));
    state.restaurant = r.exists() ? r.data() : { name: rid };
  } catch (ex) {
    $("#problemText").textContent = "This account is not linked to a restaurant. Please contact your administrator (" + (ex.code || ex.message) + ").";
    show("problemView"); return;
  }
  startApp();
});

/* ---------- app ---------- */
function startApp() {
  show("appView");
  const name = state.restaurant.name || state.rid;
  $("#restName").textContent = name;
  listenOrders();
  refreshTotalCount();
  renderAll();
  setupNotificationsQuiet();
}

function stopOrders() { if (unsubCusts) { unsubCusts(); unsubCusts = null; } state.custs = []; state.custLoaded = false; state.mkSeg = null;
  if (unsubOrders) { unsubOrders(); unsubOrders = null; } state.orders = []; state.loaded = false; state.totalOrders = null; }

// All-time order count (cheap server-side count query; falls back to the loaded orders if it fails).
let countTimer = 0;
function refreshTotalCount(delay = 0) {
  clearTimeout(countTimer);
  countTimer = setTimeout(async () => {
    if (!state.rid) return;
    try {
      const snap = await getCountFromServer(collection(db, "restaurants", state.rid, "orders"));
      state.totalOrders = snap.data().count;
      renderAll();
    } catch (e) { /* keep the fallback */ }
  }, delay);
}

function listenOrders() {
  stopOrders();
  const from = Timestamp.fromDate(new Date(Date.now() - 31 * 864e5));
  const q = query(collection(db, "restaurants", state.rid, "orders"), where("createdAt", ">=", from), orderBy("createdAt", "desc"));
  let first = true;
  unsubOrders = onSnapshot(q, (snap) => {
    state.orders = snap.docs.map((d) => norm(d.id, d.data()));
    state.loaded = true;
    if (!first) {
      snap.docChanges().forEach((c) => {
        if (c.type === "added" && !c.doc.metadata.hasPendingWrites) {
          refreshTotalCount(1200);
          const o = norm(c.doc.id, c.doc.data());
          if (Date.now() - o._dt.getTime() > 180000) return;
          toast(`🔔 New Order ${orderLabel(o)} · ${o.customerName || ""} · ${money(o.total)}`, "new", 6000);
          beep();
        }
      });
    }
    first = false;
    renderAll();
    if (state.sheetId) renderSheet();
  }, (err) => {
    state.loaded = true;
    toast("Could not load orders: " + (err.code || err.message), "", 6000);
    renderAll();
  });
}

let raf = 0;
function renderAll() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { renderHome(); renderOrders(); renderSettings(); }); }

/* tabs */
function showTab(t) {
  state.tab = t;
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + t));
  const navTab = t === "customers" || t === "marketing" ? "home" : t;   // these two open from Home > Quick Actions
  $$(".bottom button").forEach((b) => b.classList.toggle("on", b.dataset.tab === navTab));
  if (t === "customers" || t === "marketing") ensureCustomers();
  window.scrollTo(0, 0);
}
$$(".bottom button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) { if (g.dataset.go === "marketing") state.mkSeg = null; showTab(g.dataset.go); if (g.dataset.go === "marketing") renderMarketing(); if (g.dataset.go === "customers") renderCustomers(); }
});
function goPending() { state.status = "Pending"; state.date = "all"; renderOrders(); showTab("orders"); }
$("#bellBtn").addEventListener("click", goPending);
$("#qaPending").addEventListener("click", goPending);

/* ---------- HOME ---------- */
function greeting() {
  const h = hourOf(new Date());
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : h < 21 ? "Good Evening" : "Good Night";
}
function ownerName() {
  const n = state.userDoc && state.userDoc.name;
  if (n) return n;
  const e = (state.user && state.user.email) || "";
  const p = e.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
  return p ? p.replace(/\b\w/g, (c) => c.toUpperCase()) : "";
}
function renderHome() {
  const nm = ownerName();
  $("#greetTitle").innerHTML = `${greeting()}${nm ? `, <em>${esc(nm.split(" ")[0])}</em>` : ""}! 👋`;
  $("#todayLabel").textContent = fmtShortDate(new Date());

  const t = keyAgo(0), y = keyAgo(1);
  const today = state.orders.filter((o) => o._key === t);
  const yest = state.orders.filter((o) => o._key === y).length;
  const sales = today.reduce((a, o) => a + (Number(o.total) || 0), 0);
  let delta = `Yesterday: ${yest}`;
  if (yest > 0) {
    const c = Math.round(((today.length - yest) / yest) * 100);
    delta = `<span class="${c >= 0 ? "up" : "down"}">${c >= 0 ? "↑" : "↓"} ${Math.abs(c)}%</span> vs. yesterday`;
  }
  const total = state.totalOrders != null ? state.totalOrders : state.orders.length;
  $("#stats").innerHTML = `
    <div class="stat gold"><div class="ic">${ic("file")}</div><div class="l">Total Orders</div><div class="n">${total.toLocaleString("en-US")}</div><div class="s">${state.totalOrders != null ? "All time" : "Last 30 days"}</div></div>
    <div class="stat navy"><div class="ic">${ic("bag")}</div><div class="l">Today's Orders</div><div class="n">${today.length}</div><div class="s">${delta}</div></div>
    <div class="stat green"><div class="ic">${ic("cash")}</div><div class="l">Today's Sales</div><div class="n">${esc(moneyShort(sales))}</div><div class="s">From ${today.length} order${today.length === 1 ? "" : "s"}</div></div>`;
  $$("#stats .n").forEach((el) => fitText(el));

  const cnt = (s) => state.orders.filter((o) => o.status === s).length;
  const tile = (s, label, icon, color) => `<button class="tile" data-st="${s}"><span class="ic" style="background:${color}">${ic(icon)}</span><span class="t"><b>${cnt(s)}</b><span>${label}</span></span></button>`;
  $("#statusTiles").innerHTML =
    tile("Pending", "Pending", "clock", "#F5A31A") + tile("Preparing", "Preparing", "utensils", "#2F80ED") +
    tile("Ready", "Ready", "check", "#1AA851") + tile("Completed", "Completed", "bag", "#8B4DD8");

  const pend = cnt("Pending");
  const bb = $("#bellBadge"); bb.textContent = pend > 99 ? "99+" : pend; bb.classList.toggle("hidden", !pend);
  $("#bellBtn").classList.toggle("ringing", pend > 0);   // the bell keeps ringing while any order is pending
  $("#bellBtn").setAttribute("aria-label", pend ? `${pend} pending order${pend === 1 ? "" : "s"}` : "No pending orders");
  $("#qaPendingText").textContent = `Pending Orders${pend ? " (" + pend + ")" : ""}`;
  document.title = pend ? `(${pend}) Avalon Owner Panel` : "Avalon Owner Panel";

  const rec = state.orders.slice(0, 5);
  $("#recent").innerHTML = !state.loaded ? `<div class="empty">Loading...</div>` : rec.length ? rec.map(rowHTML).join("") :
    `<div class="empty"><b>No orders yet</b>New WhatsApp orders will appear here as soon as they arrive.</div>`;
  renderChart();
  renderNotifBanner();
}
let fitTimer;
window.addEventListener("resize", () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => $$("#stats .n").forEach((el) => fitText(el)), 120); });
document.addEventListener("click", (e) => {
  const t = e.target.closest(".tile"); if (!t) return;
  state.status = t.dataset.st; state.date = "all"; renderOrders(); showTab("orders");
});

function rowHTML(o) {
  return `<button class="row" data-id="${esc(o.id)}">
    <span class="wa">${ic("wa")}</span>
    <span class="rmid">
      <span class="a"><b>${esc(orderLabel(o))}</b><span>${fmtTime(o._dt)}</span></span>
      <span class="b" style="display:block">${esc(o.customerName || "Customer")}</span>
      <span class="c" style="display:block">${esc(itemsSummary(o))}</span>
    </span>
    <span class="rend">${pill(o)}<b>${money(o.total)}</b></span>
  </button>`;
}
document.addEventListener("click", (e) => { const r = e.target.closest(".row"); if (r) openSheet(r.dataset.id); });

/* chart */
$("#chartSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  state.chart = b.dataset.r; state.chartSel = null;
  $$("#chartSeg button").forEach((x) => x.classList.toggle("on", x === b)); renderChart();
});
$("#chart").addEventListener("click", (e) => {
  const c = e.target.closest(".col"); if (!c) return;
  const i = Number(c.dataset.i); state.chartSel = state.chartSel === i ? null : i; renderChart();
});
const hourName = (h) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
function renderChart() {
  const r = state.chart; let vals = [], ticks = [], names = [], shorts = [], period = "";
  if (r === "today") {
    vals = new Array(24).fill(0); const t = keyAgo(0);
    state.orders.forEach((o) => { if (o._key === t) vals[hourOf(o._dt)]++; });
    names = shorts = vals.map((_, h) => hourName(h));
    ticks = [[0, "12am"], [6, "6am"], [12, "12pm"], [18, "6pm"], [23, "11pm"]];
    period = "Today";
  } else {
    const n = r === "7" ? 7 : 30; const map = {};
    state.orders.forEach((o) => (map[o._key] = (map[o._key] || 0) + 1));
    const keys = []; for (let i = n - 1; i >= 0; i--) keys.push(keyAgo(i));
    vals = keys.map((k) => map[k] || 0);
    const wd = (k) => DAYS[new Date(k + "T00:00:00Z").getUTCDay()];
    names = keys.map((k) => `${wd(k)}, ${fmtDayShort(k)}`);
    shorts = keys.map(fmtDayShort);
    ticks = n === 7 ? keys.map((k, i) => [i, wd(k)]) : [0, 10, 20, 29].map((i) => [i, fmtDayShort(keys[i])]);
    period = n === 7 ? "Last 7 days" : "Last 30 days";
  }
  const n = vals.length, mx = Math.max(0, ...vals), top = mx <= 4 ? 4 : Math.ceil(mx / 4) * 4;
  const total = vals.reduce((a, b) => a + b, 0), hi = mx > 0 ? vals.indexOf(mx) : -1;
  if (state.chartSel != null && state.chartSel >= n) state.chartSel = null;
  const wrap = $("#chart");

  // Build the structure once per range; afterwards only update heights, so the chart never flickers on live updates.
  const key = r + ":" + n;
  if (wrap.dataset.k !== key) {
    wrap.dataset.k = key;
    wrap.innerHTML =
      `<div class="yax"><span style="top:0"></span><span style="top:50%"></span><span style="top:100%"></span></div>` +
      `<div class="plot"><i class="gl" style="top:0"></i><i class="gl" style="top:50%"></i><i class="gl base" style="bottom:0"></i>` +
      `<div class="cols">${vals.map((_, i) => `<div class="col" data-i="${i}"><div class="bar"></div></div>`).join("")}</div>` +
      `<div class="plot-empty hidden">No orders in this period</div></div>` +
      `<div class="xl">${ticks.map(([i, l]) => (n > 7 && i === n - 1 ? `<span style="left:100%;transform:translateX(-100%)">${l}</span>` : `<span style="left:${((i + 0.5) / n) * 100}%">${l}</span>`)).join("")}</div>`;
    void wrap.offsetHeight; // so the bars grow from 0 with a transition
  }
  const yl = $$(".yax span", wrap); yl[0].textContent = top; yl[1].textContent = top / 2; yl[2].textContent = 0;
  $$(".col", wrap).forEach((c, i) => {
    const bar = c.firstChild;
    c.classList.toggle("sel", state.chartSel === i);
    bar.classList.toggle("zero", vals[i] === 0);
    bar.classList.toggle("peak", i === hi);
    bar.style.height = vals[i] === 0 ? "" : Math.max(4, (vals[i] / top) * 100) + "%";
  });
  $(".plot-empty", wrap).classList.toggle("hidden", total > 0);

  const sel = state.chartSel, plural = (v) => (v === 1 ? "order" : "orders");
  $("#chartRead").innerHTML = sel != null
    ? `<span class="v"><b>${vals[sel]}</b>${plural(vals[sel])}</span><span class="w">${esc(names[sel])}</span>`
    : `<span class="v"><b>${total}</b>${plural(total)}</span><span class="w">${period}${mx > 0 ? ` · Peak ${esc(shorts[hi])} (${mx})` : ""}</span>`;
}

/* ---------- ORDERS ---------- */
function dateFilter(o) {
  const d = state.date;
  if (d === "all") return true;
  if (d === "today") return o._key === keyAgo(0);
  if (d === "yesterday") return o._key === keyAgo(1);
  if (d === "7") { return o._key >= keyAgo(6); }
  if (d === "custom") return o._key === state.customDate;
  return true;
}
function renderOrders() {
  const q = state.q.trim().toLowerCase();
  const base = state.orders.filter(dateFilter).filter((o) => !q ||
    (orderLabel(o) + " " + (o.customerName || "") + " " + (o.customerPhone || "") + " " + itemsSummary(o)).toLowerCase().includes(q));
  const count = (s) => (s === "All" ? base.length : base.filter((o) => o.status === s).length);
  const chip = (s, label) => `<button class="chip${state.status === s ? " on" : ""}" data-s="${s}">${label}<i>${count(s)}</i></button>`;
  $("#statusChips").innerHTML = chip("All", "All") + chip("Pending", "Pending") + chip("Preparing", "Preparing") + chip("Ready", "Ready") +
    chip("Out for Delivery", "On the way") + chip("Completed", "Completed");
  const dchip = (k, l) => `<button class="chip${state.date === k ? " on" : ""}" data-d="${k}">${l}</button>`;
  $("#dateChips").innerHTML = dchip("today", "Today") + dchip("yesterday", "Yesterday") + dchip("7", "Last 7 days") + dchip("all", "All (30 days)") +
    `<label class="chip${state.date === "custom" ? " on" : ""}">${ic("calendar").replace("<svg", '<svg style="width:15px;height:15px"')}${state.date === "custom" && state.customDate ? fmtDayShort(state.customDate) : "Pick date"}<input type="date" id="pickDate" value="${state.customDate || ""}" max="${keyAgo(0)}"></label>`;
  const list = base.filter((o) => state.status === "All" || o.status === state.status);
  const shown = list.slice(0, state.limit);
  $("#orderList").innerHTML = !state.loaded ? `<div class="empty">Loading...</div>` : shown.length ?
    shown.map(rowHTML).join("") + (list.length > shown.length ? `<button class="btn ghost more" id="moreBtn">Show more (${list.length - shown.length})</button>` : "") :
    `<div class="empty"><b>No orders found</b>Try changing the filter or the date.</div>`;
}
$("#statusChips").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; state.status = c.dataset.s; state.limit = 40; renderOrders(); });
$("#dateChips").addEventListener("click", (e) => { const c = e.target.closest("button.chip"); if (!c) return; state.date = c.dataset.d; state.limit = 40; renderOrders(); });
$("#dateChips").addEventListener("change", (e) => { if (e.target.id === "pickDate" && e.target.value) { state.date = "custom"; state.customDate = e.target.value; state.limit = 40; renderOrders(); } });
$("#search").addEventListener("input", (e) => { state.q = e.target.value; state.limit = 40; renderOrders(); });
$("#orderList").addEventListener("click", (e) => { if (e.target.closest("#moreBtn")) { state.limit += 40; renderOrders(); } });


/* ---------- CUSTOMERS ---------- */
const toDate = (v) => { if (!v) return null; if (v.toDate) return v.toDate(); if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v); const d = new Date(v); return isNaN(d) ? null : d; };
const daysSince = (d) => (d ? Math.round((Date.parse(keyAgo(0)) - Date.parse(dayKey(d))) / 864e5) : null);
function normCust(id, d) {
  const last = toDate(d.lastOrderAt);
  return { id, phone: String(d.phone || id), name: String(d.name || "").trim(), address: String(d.address || ""), orders: Number(d.totalOrders) || 0,
    spent: Number(d.totalSpent) || 0, last, days: daysSince(last), optOut: d.marketingOptOut === true, followAt: toDate(d.lastFollowUpAt) };
}
const custName = (c) => c.name || phoneShow(c.phone);
const custInit = (c) => (c.name ? initials(c.name) : "#");
const agoText = (n) => (n == null ? "No order date" : n <= 0 ? "Today" : n === 1 ? "Yesterday" : `${n} days ago`);
function ensureCustomers() {
  if (unsubCusts || !state.rid) return;
  const q = query(collection(db, "restaurants", state.rid, "customers"), limit(1000));
  unsubCusts = onSnapshot(q, (snap) => {
    state.custs = snap.docs.map((d) => normCust(d.id, d.data()));
    state.custLoaded = true; renderCustomers(); renderMarketing();
  }, (err) => {
    state.custLoaded = true; toast("Could not load customers: " + (err.code || err.message), "", 6000); renderCustomers(); renderMarketing();
  });
}
function renderCustomers() {
  const sorts = [["recent", "Recent"], ["spent", "Most spent"], ["orders", "Most orders"]];
  $("#custSort").innerHTML = sorts.map(([k, l]) => `<button class="chip${state.custSort === k ? " on" : ""}" data-k="${k}">${l}</button>`).join("");
  const q = state.custQ.trim().toLowerCase(), qd = phoneDigits(q);
  let list = state.custs.filter((c) => !q || c.name.toLowerCase().includes(q) || (qd && phoneDigits(c.phone).includes(qd)));
  const by = { recent: (a, b) => (b.last || 0) - (a.last || 0), spent: (a, b) => b.spent - a.spent, orders: (a, b) => b.orders - a.orders }[state.custSort];
  list = [...list].sort(by);
  $("#custCount").textContent = state.custLoaded ? `${list.length} customer${list.length === 1 ? "" : "s"}${q ? " found" : ""}` : "Loading...";
  $("#custList").innerHTML = !state.custLoaded ? `<div class="empty">Loading...</div>` : list.length ? list.slice(0, 300).map((c) =>
    `<button class="crow" data-c="${esc(c.id)}"><span class="avatar">${esc(custInit(c))}</span>
      <span class="mid"><b>${esc(custName(c))}</b><span>${esc(phoneShow(c.phone))}</span><span>${c.orders} order${c.orders === 1 ? "" : "s"} · ${esc(agoText(c.days))}</span></span>
      <span class="end"><b>${money(c.spent)}</b><small>Total spent</small></span></button>`).join("") +
    (list.length > 300 ? `<p class="mk-note center">Showing the first 300. Use search to find others.</p>` : "") :
    `<div class="empty"><b>${q ? "No customers found" : "No customers yet"}</b>${q ? "Try a different name or number." : "Customers appear here after their first WhatsApp order."}</div>`;
}
$("#custSearch").addEventListener("input", (e) => { state.custQ = e.target.value; renderCustomers(); });
$("#custSort").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; state.custSort = b.dataset.k; renderCustomers(); });
$("#custList").addEventListener("click", (e) => {
  const r = e.target.closest(".crow"); if (!r) return;
  const c = state.custs.find((x) => x.id === r.dataset.c); if (!c) return;
  openRawSheet("x:cust", `
    <div class="grab"></div>
    <div class="sheet-top"><button class="x" id="sheetX" aria-label="Close">${ic("x")}</button><b>Customer Details</b></div>
    <div class="cust"><div class="avatar">${esc(custInit(c))}</div><div><b>${esc(custName(c))}</b><span>${esc(phoneShow(c.phone))}</span></div></div>
    <div class="t3">
      <div>${ic("bag")}<b>${c.orders}</b><small>Total Orders</small></div>
      <div>${ic("file")}<b>${money(c.spent)}</b><small>Total Spent</small></div>
      <div>${ic("clock")}<b>${esc(agoText(c.days))}</b><small>Last Order</small></div>
    </div>
    <div class="it">${ic("pin").replace("<svg", '<svg style="width:18px;height:18px;color:var(--gold-dark);flex:none"')}<span class="nm">${esc(c.address || "No address saved")}</span></div>
    ${c.optOut ? `<p class="mk-note">This customer opted out of marketing messages.</p>` : ""}
    <a class="btn ghost waBtn" target="_blank" rel="noopener" href="https://wa.me/${phoneDigits(c.phone)}">${ic("wa")} Contact Customer</a>`);
});
function openRawSheet(id, html) {
  state.sheetId = id; $("#sheet").innerHTML = html;
  $("#sheet").classList.add("open"); $("#scrim").classList.add("on"); $("#sheet").scrollTop = 0;
  history.pushState({ sheet: 1 }, "");
}

/* ---------- MARKETING ---------- */
const SEGMENTS = [
  { k: "s1", label: "7–14 days", min: 7, max: 14, sub: "Haven't ordered for 1–2 weeks" },
  { k: "s2", label: "15–29 days", min: 15, max: 29, sub: "Haven't ordered for 2–4 weeks" },
  { k: "s3", label: "30+ days", min: 30, max: Infinity, sub: "Haven't ordered for a month or more" }
];
const cooldownLeft = (c) => { const cd = self.FOLLOWUP_COOLDOWN_DAYS || 7; const d = c.followAt ? daysSince(c.followAt) : null; return d != null && d < cd ? cd - d : 0; };
const segCusts = (seg) => state.custs.filter((c) => !c.optOut && c.days != null && c.days >= seg.min && c.days <= seg.max && phoneDigits(c.phone))
  .sort((a, b) => b.days - a.days);
const eligible = (c) => cooldownLeft(c) === 0;

function renderMarketing() {
  const body = $("#mkBody"); if (!body) return;
  const seg = SEGMENTS.find((s) => s.k === state.mkSeg);
  if (!seg) {
    body.innerHTML = `<div class="page-title"><button class="x back" data-go="home" aria-label="Back"><span data-icon="back"></span></button><div><h2>Marketing</h2><p>Bring back customers who stopped ordering</p></div></div>` +
      (!state.custLoaded ? `<div class="empty">Loading...</div>` : SEGMENTS.map((s) => {
        const n = segCusts(s).length;
        return `<button class="mk-seg ${s.k}" data-seg="${s.k}"><span class="dotc">${n}</span><span class="mid"><b>${s.label}</b><span>${s.sub}</span></span><span class="chev">${ic("chev")}</span></button>`;
      }).join("") + `<p class="mk-note">Each customer appears in only one group, based on the date of their last order. Customers who opted out are never included.</p>`);
    paintIcons(body); return;
  }
  // compose screen (built once; the list below updates in place so typing is never interrupted)
  body.innerHTML = `
    <div class="page-title"><button class="x back" id="mkBack" aria-label="Back">${ic("back")}</button><div><h2>${seg.label}</h2><p>${seg.sub}</p></div></div>
    <button class="btn primary" id="mkSendAll" type="button">${ic("wa")}<span id="mkSendTxt">Send FollowUp to All Customers</span></button>
    <div class="card" style="margin-top:14px">
      <div class="field-l"><span>Your offer / deal</span><small id="mkCount">0/200</small></div>
      <textarea id="mkOffer" maxlength="200" placeholder="e.g. Get 15% off your next order today!"></textarea>
      <p class="mk-note" style="margin:8px 0 0">Sent as an approved WhatsApp marketing template. Line breaks are not allowed.</p>
    </div>
    <div class="card cost" id="mkCost"></div>
    <div class="sel-bar"><label><input type="checkbox" id="mkAll"> Select all</label><span id="mkSelTxt"></span></div>
    <div id="mkList"></div>`;
  $("#mkOffer").value = state.mkOffer; $("#mkCount").textContent = `${state.mkOffer.length}/200`;
  renderComposeList();
}
function selectedCusts() { const seg = SEGMENTS.find((s) => s.k === state.mkSeg); return seg ? segCusts(seg).filter((c) => eligible(c) && !state.mkOff.has(c.phone)) : []; }
function renderComposeList() {
  const seg = SEGMENTS.find((s) => s.k === state.mkSeg); if (!seg || !$("#mkList")) return;
  const all = segCusts(seg), sel = selectedCusts();
  $("#mkList").innerHTML = all.length ? all.map((c) => {
    const cd = cooldownLeft(c), on = cd === 0 && !state.mkOff.has(c.phone);
    return `<label class="crow${cd ? " off" : ""}"><input type="checkbox" data-p="${esc(c.phone)}" ${on ? "checked" : ""} ${cd ? "disabled" : ""}>
      <span class="avatar">${esc(custInit(c))}</span>
      <span class="mid"><b>${esc(custName(c))}</b><span>${esc(phoneShow(c.phone))}</span><span>${cd ? `Contacted recently (wait ${cd} more day${cd === 1 ? "" : "s"})` : `${c.orders} order${c.orders === 1 ? "" : "s"} · ${esc(agoText(c.days))}`}</span></span>
      <span class="end"><b>${money(c.spent)}</b><small>Total spent</small></span></label>`;
  }).join("") : `<div class="empty"><b>No customers in this group</b>Nobody is in this range right now.</div>`;
  const elig = all.filter(eligible).length;
  $("#mkAll").checked = sel.length > 0 && sel.length === elig; $("#mkAll").disabled = !elig;
  $("#mkSelTxt").textContent = `${sel.length} of ${all.length} selected`;
  $("#mkSendTxt").textContent = `Send FollowUp to All Customers (${sel.length})`;
  $("#mkSendAll").disabled = !sel.length;
  const rate = Number(self.FOLLOWUP_RATE_PKR) > 0 ? Number(self.FOLLOWUP_RATE_PKR) : null;
  $("#mkCost").innerHTML = rate
    ? `<span class="ic-red">${ic("cash")}</span><span class="big">${money(Math.round(sel.length * rate * 100) / 100)}</span><span class="txt"><b>Estimated Meta cost</b>${sel.length} message${sel.length === 1 ? "" : "s"} × Rs. ${rate}. This is an estimate; Meta sets the final charge.</span>`
    : `<span class="ic-red">${ic("cash")}</span><span class="txt"><b>Estimated Meta cost: rate not set</b>Add the price per marketing message (FOLLOWUP_RATE_PKR) in firebase-config.js to see the total here.</span>`;
}
$("#mkBody").addEventListener("click", (e) => {
  const sg = e.target.closest("[data-seg]"); if (sg) { state.mkSeg = sg.dataset.seg; state.mkOff = new Set(); renderMarketing(); window.scrollTo(0, 0); return; }
  if (e.target.closest("#mkBack")) { state.mkSeg = null; renderMarketing(); window.scrollTo(0, 0); return; }
  if (e.target.closest("#mkSendAll")) startFollowUp();
});
$("#mkBody").addEventListener("input", (e) => {
  if (e.target.id !== "mkOffer") return;
  const v = e.target.value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ");
  if (v !== e.target.value) e.target.value = v;
  state.mkOffer = v; $("#mkCount").textContent = `${v.length}/200`;
});
$("#mkBody").addEventListener("change", (e) => {
  const seg = SEGMENTS.find((s) => s.k === state.mkSeg); if (!seg) return;
  if (e.target.id === "mkAll") {
    segCusts(seg).filter(eligible).forEach((c) => (e.target.checked ? state.mkOff.delete(c.phone) : state.mkOff.add(c.phone)));
  } else if (e.target.dataset.p) {
    e.target.checked ? state.mkOff.delete(e.target.dataset.p) : state.mkOff.add(e.target.dataset.p);
  } else return;
  renderComposeList();
});
function startFollowUp() {
  const offer = state.mkOffer.trim(), sel = selectedCusts();
  if (!sel.length) return toast("Select at least one customer.");
  if (offer.length < 5) { toast("Please write your offer first."); $("#mkOffer").focus(); return; }
  if (!self.FOLLOWUP_WEBHOOK_URL) { toast("Sending is not connected yet. The WhatsApp template and n8n workflow still need to be set up.", "", 5500); return; }
  const rate = Number(self.FOLLOWUP_RATE_PKR) > 0 ? Number(self.FOLLOWUP_RATE_PKR) : null;
  openRawSheet("x:confirm", `
    <div class="grab"></div>
    <div class="sheet-top"><button class="x" id="sheetX" aria-label="Close">${ic("x")}</button><b>Confirm FollowUp</b></div>
    <div class="sum" style="margin-top:0">
      <div class="cf-line"><span>Customers</span><b>${sel.length}</b></div>
      <div class="cf-line"><span>Estimated cost</span><b>${rate ? money(Math.round(sel.length * rate * 100) / 100) : "Rate not set"}</b></div>
    </div>
    <div class="field-l"><span>Your offer</span></div><div class="cf-offer">${esc(offer)}</div>
    <button class="btn primary" id="cfOk" type="button">${ic("wa")} Send Now</button>
    <button class="btn ghost" id="cfNo" type="button">Cancel</button>`);
}
$("#sheet").addEventListener("click", async (e) => {
  if (e.target.closest("#cfNo")) return closeSheet();
  const ok = e.target.closest("#cfOk"); if (!ok) return;
  const sel = selectedCusts(), offer = state.mkOffer.trim(); ok.disabled = true; ok.textContent = "Sending...";
  try {
    const token = await state.user.getIdToken();
    const r = await fetch(self.FOLLOWUP_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: state.rid, offer, segment: state.mkSeg, customers: sel.map((c) => ({ phone: phoneDigits(c.phone), name: c.name })), idToken: token }) });
    if (!r.ok) throw new Error("Server replied " + r.status);
    closeSheet(); state.mkOffer = ""; state.mkOff = new Set(); state.mkSeg = null; renderMarketing();
    toast(`✅ FollowUp started for ${sel.length} customer${sel.length === 1 ? "" : "s"}.`, "", 5000);
  } catch (ex) { ok.disabled = false; ok.innerHTML = `${ic("wa")} Send Now`; toast("Could not send: " + (ex.message || ex), "", 6000); }
});

/* ---------- ORDER SHEET ---------- */
function nextStatus(o) {
  const flow = isPickup(o) ? ["Pending", "Preparing", "Ready", "Completed"] : ["Pending", "Preparing", "Ready", "Out for Delivery", "Completed"];
  const i = flow.indexOf(o.status); return i >= 0 ? flow[i + 1] || null : null;
}
const BTN = {
  "Preparing": ["Mark as Preparing", "utensils", "Preparing"], "Ready": ["Mark as Ready", "check", "Ready"],
  "Out for Delivery": ["Out for Delivery", "truck", "Out for Delivery"]
};
function btnFor(o, next) {
  if (next === "Completed") return isPickup(o) ? ["Mark as Completed", "check", "Completed"] : ["Mark as Delivered", "check", "Delivered"];
  return BTN[next];
}
function renderSheet() {
  if (String(state.sheetId || "").startsWith("x:")) return;   // customer / confirm sheets render themselves
  const o = state.orders.find((x) => x.id === state.sheetId);
  const el = $("#sheet");
  if (!o) { el.innerHTML = `<div class="grab"></div><div class="empty">Order not found.</div>`; return; }
  const pk = isPickup(o);
  const priced = o._items.length && o._items.every((i) => i.price != null);
  const sub = priced ? o._items.reduce((s, i) => s + i.price * i.qty, 0) : null;
  const extra = priced && o.total > sub ? o.total - sub : 0;
  const nx = nextStatus(o), b = nx ? btnFor(o, nx) : null;
  const itemsHTML = o._items.length ? o._items.map((i) => `<div class="it"><span class="q">${i.qty}×</span><span class="nm">${esc(i.name)}</span>${i.price != null ? `<span class="pr">${money(i.price * i.qty)}</span>` : ""}</div>`).join("")
    : `<div class="it"><span class="nm">${esc(o.itemsText || "—")}</span></div>`;
  const when = o._key === keyAgo(0) ? fmtTime(o._dt) : `${fmtDayShort(o._key)}, ${fmtTime(o._dt)}`;
  el.innerHTML = `
    <div class="grab"></div>
    <div class="sheet-top"><button class="x" id="sheetX" aria-label="Close">${ic("x")}</button><b>${esc(orderLabel(o))}</b></div>
    <div class="banner-t ${pk ? "pick" : "del"}">${ic(pk ? "bag" : "truck")}${pk ? "Pickup" : "Delivery"}</div>
    <div class="cust"><div class="avatar">${esc(initials(o.customerName))}</div><div><b>${esc(o.customerName || "Customer")}</b><span>${esc(phoneShow(o.customerPhone))}</span></div>${pill(o)}</div>
    <div class="t3">
      <div>${ic("clock")}<b>${esc(when)}</b><small>Order Time</small></div>
      <div>${ic("pin")}<b>${pk ? "Pickup from restaurant" : esc(o.address || "No address provided")}</b><small>${pk ? "Pickup" : "Delivery Address"}</small></div>
      <div>${ic("file")}<b>${money(o.total)}</b><small>${esc(o.paymentMethod || "Total Bill")}</small></div>
    </div>
    <h3>Items (${o._items.length || 1})</h3>
    ${itemsHTML}
    <div class="sum">
      ${priced ? `<div><span>Subtotal</span><span>${money(sub)}</span></div>` : ""}
      ${extra ? `<div><span>Delivery / Other Charges</span><span>${money(extra)}</span></div>` : ""}
      <div class="tot"><span>Total</span><span>${money(o.total)}</span></div>
      ${o.paymentMethod ? `<div><span>Payment</span><span>${esc(o.paymentMethod)}</span></div>` : ""}
    </div>
    ${b ? `<button class="btn primary" id="advBtn" data-next="${esc(nx)}">${ic(b[1])} ${b[0]}</button>` : ""}
    ${o.customerPhone ? `<a class="btn ghost waBtn" target="_blank" rel="noopener" href="https://wa.me/${phoneDigits(o.customerPhone)}">${ic("wa")} Contact Customer</a>` : ""}`;
}
function openSheet(id) {
  state.sheetId = id; renderSheet();
  $("#sheet").classList.add("open"); $("#scrim").classList.add("on"); $("#sheet").scrollTop = 0;
  history.pushState({ sheet: 1 }, "");
}
function hideSheet() { state.sheetId = null; $("#sheet").classList.remove("open"); $("#scrim").classList.remove("on"); }
function closeSheet() { if (!state.sheetId) return; if (history.state && history.state.sheet) history.back(); else hideSheet(); }
window.addEventListener("popstate", hideSheet);
$("#scrim").addEventListener("click", closeSheet);
$("#sheet").addEventListener("click", async (e) => {
  if (e.target.closest("#sheetX")) return closeSheet();
  const btn = e.target.closest("#advBtn"); if (!btn) return;
  const o = state.orders.find((x) => x.id === state.sheetId); if (!o) return;
  const next = btn.dataset.next; btn.disabled = true;
  try {
    await updateDoc(doc(db, "restaurants", state.rid, "orders", o.id), { status: next, updatedAt: serverTimestamp() });
    const label = next === "Completed" ? (isPickup(o) ? "Completed" : "Delivered") : next;
    showSuccess(o, label);
  } catch (ex) {
    btn.disabled = false; toast("Could not update the status: " + (ex.code || ex.message), "", 5000);
  }
});

/* success screen */
function showSuccess(o, label) {
  const s = $("#success"), id = o.id;
  const dots = ["#C99A2E", "#1AA851", "#1B2745", "#EBC862", "#8B4DD8"].flatMap((c, i) => [0, 1].map((k) => `<i class="dot" style="background:${c};left:${12 + i * 18 + k * 7}%;top:${10 + ((i * 7 + k * 11) % 14)}%;transform:rotate(${i * 40 + k * 25}deg)"></i>`)).join("");
  s.innerHTML = `${dots}<div class="ok">${ic("check")}</div>
    <h2><span>Order ${esc(orderLabel(o))}</span><span>Marked as ${esc(label)}</span></h2>
    <p>${label === "Preparing" ? "The kitchen has been notified." : "The status has been updated."}</p>
    <button class="btn primary" id="sView">View Order Details</button>
    <button class="btn ghost" id="sBack">Back to Orders</button>`;
  s.classList.remove("hidden");
  $("#sView").onclick = () => { s.classList.add("hidden"); };
  $("#sBack").onclick = () => { s.classList.add("hidden"); closeSheet(); showTab("orders"); };
  hideSheetKeepHistory(id);
}
function hideSheetKeepHistory(id) { /* the sheet stays open so "View Order Details" returns to the same order */ state.sheetId = id; renderSheet(); }

/* ---------- NOTIFICATIONS ---------- */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
function notifState() {
  if (isIOS && !isStandalone) return "ios-install";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return Notification.permission; // default | granted | denied
}
async function registerToken(interactive) {
  if (!(await isSupported())) throw new Error("Notifications are not supported in this browser.");
  const reg = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: self.VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error("Could not get a notification token.");
  const last = Number(localStorage.getItem("fcmSavedAt") || 0);
  if (localStorage.getItem("fcmToken") !== token || Date.now() - last > 864e5 || interactive) {
    await setDoc(doc(db, "restaurants", state.rid, "devices", token), {
      token, uid: state.user.uid, platform: isIOS ? "ios" : /android/i.test(navigator.userAgent) ? "android" : "web",
      standalone: isStandalone, userAgent: navigator.userAgent.slice(0, 180), updatedAt: serverTimestamp()
    }, { merge: true });
    localStorage.setItem("fcmToken", token); localStorage.setItem("fcmSavedAt", String(Date.now()));
  }
  return token;
}
async function setupNotificationsQuiet() {
  if (notifState() === "granted") { try { await registerToken(false); } catch (e) { console.warn("FCM", e); } }
}
async function enableNotifications() {
  const st = notifState();
  if (st === "ios-install" || st === "unsupported") { showTab("settings"); return; }
  try {
    const p = await Notification.requestPermission();
    if (p !== "granted") { toast("Notification permission was not granted.", "", 4000); renderSettings(); renderNotifBanner(); return; }
    await registerToken(true);
    toast("✅ Notifications are on.");
  } catch (ex) { toast("Could not turn on notifications: " + (ex.code || ex.message), "", 6000); }
  renderSettings(); renderNotifBanner();
}
function renderNotifBanner() {
  const st = notifState(), b = $("#notifBanner");
  if (st === "granted" || st === "denied" || st === "unsupported") { b.classList.add("hidden"); return; }
  b.classList.remove("hidden");
  b.innerHTML = `<span style="font-size:20px">🔔</span><p>${st === "ios-install" ? "To receive notifications on iPhone, add this app to your Home Screen." : "Want an alert for every new order? Turn on notifications."}</p><button id="nbBtn">${st === "ios-install" ? "How?" : "Enable"}</button>`;
  $("#nbBtn").onclick = enableNotifications;
}

/* ---------- SETTINGS ---------- */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; renderSettings(); });
function renderSettings() {
  if (!state.user) return;
  $("#accountCard").innerHTML = `<div class="card-h"><h3>Account</h3></div>
    <div class="kv"><span>Restaurant</span><span>${esc(state.restaurant && state.restaurant.name || state.rid)}</span></div>
    <div class="kv"><span>Email</span><span>${esc(state.user.email)}</span></div>`;
  const st = notifState(); let inner = "";
  if (st === "granted") inner = `<p class="note">✅ Notifications are on for this device. You will get a "🔔 New Order Received" alert as soon as an order arrives.</p><button class="btn ghost" id="nRefresh">Re-register this device</button>`;
  else if (st === "denied") inner = `<p class="note">❌ Notifications are blocked. Allow notifications for this app in your browser or phone settings, then reopen the app.</p>`;
  else if (st === "ios-install") inner = `<p class="note">On iPhone, notifications only work once the app is installed on the Home Screen:</p>
      <ol class="steps"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button at the bottom.</li><li>Choose <b>Add to Home Screen</b>.</li><li>Open the app from the <b>Avalon</b> icon on your Home Screen, then tap "Enable" here.</li></ol>`;
  else if (st === "unsupported") inner = `<p class="note">This browser does not support push notifications. Please use Chrome (Android/Mac) or Safari (iPhone with iOS 16.4+, installed on the Home Screen).</p>`;
  else inner = `<p class="note">Turn on alerts to get new WhatsApp orders on this phone.</p><button class="btn primary" id="nEnable">${ic("bell")} Enable Notifications</button>`;
  $("#notifCard").innerHTML = `<div class="card-h"><span class="ic-red">${ic("bell")}</span><h3>Order Notifications</h3></div>${inner}`;
  const en = $("#nEnable"); if (en) en.onclick = enableNotifications;
  const rf = $("#nRefresh"); if (rf) rf.onclick = async () => { try { await registerToken(true); toast("Device registered."); } catch (e) { toast("Error: " + (e.code || e.message), "", 5000); } };
  const ic2 = $("#installCard");
  if (deferredInstall && !isStandalone) {
    ic2.classList.remove("hidden");
    ic2.innerHTML = `<div class="card-h"><span class="ic-orange">${ic("download")}</span><h3>Install App</h3></div><p class="note">Install the app on your phone so it opens straight from its icon.</p><button class="btn primary" id="installBtn">Install</button>`;
    $("#installBtn").onclick = async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; renderSettings(); };
  } else ic2.classList.add("hidden");
}

paintIcons();
