import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, updateDoc, collection, query, where, orderBy, onSnapshot, Timestamp, serverTimestamp
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

// Pakistan ka time zone fixed UTC+5 hai (DST nahi), is liye simple offset kaafi hai.
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
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'
};
const ic = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
const LOGO = '<svg viewBox="0 0 64 64"><path fill="#E8321F" d="M32 5 L61 59 H46.500 L32 31 L17.500 59 H3 Z"/></svg>';
function paintIcons(root = document) {
  $$("[data-icon]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = ic(el.dataset.icon); });
  $$("[data-logo]", root).forEach((el) => { if (!el.firstChild) el.innerHTML = LOGO; });
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
  } catch (e) { /* sound optional */ }
}
document.addEventListener("click", () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) {} }, { once: true });

/* ---------- state ---------- */
const state = {
  user: null, rid: null, restaurant: null, orders: [],
  tab: "home", status: "All", date: "today", customDate: null, q: "", limit: 40,
  chart: "today", sheetId: null, loaded: false
};
let unsubOrders = null;
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
      ? "Email ya password galat hai." : /too-many/.test(code) ? "Bohot koshishen ho gayi, thori der baad try karein."
      : /network/.test(code) ? "Internet check karein." : "Login nahi ho saka (" + code + ")";
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
    $("#problemText").textContent = "Is account ka restaurant se link nahi mila. Admin se rabta karein (" + (ex.code || ex.message) + ").";
    show("problemView"); return;
  }
  startApp();
});

/* ---------- app ---------- */
function startApp() {
  show("appView");
  const name = state.restaurant.name || state.rid;
  $("#restName").textContent = name;
  $("#restAvatar").textContent = initials(name).slice(0, 1);
  listenOrders();
  renderAll();
  setupNotificationsQuiet();
}

function stopOrders() { if (unsubOrders) { unsubOrders(); unsubOrders = null; } state.orders = []; state.loaded = false; }

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
    toast("Orders load nahi ho sake: " + (err.code || err.message), "", 6000);
    renderAll();
  });
}

let raf = 0;
function renderAll() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { renderHome(); renderOrders(); renderSettings(); }); }

/* tabs */
function showTab(t) {
  state.tab = t;
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + t));
  $$(".bottom button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  window.scrollTo(0, 0);
}
$$(".bottom button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]"); if (g) { showTab(g.dataset.go); }
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
  $("#greetTitle").innerHTML = `${greeting()}${nm ? `, <em>${esc(nm.split(" ")[0])}</em>` : ""}!`;
  $("#todayLabel").textContent = fmtLong(new Date());

  const t = keyAgo(0), y = keyAgo(1);
  const today = state.orders.filter((o) => o._key === t);
  const yest = state.orders.filter((o) => o._key === y).length;
  const del = today.filter((o) => !isPickup(o)).length, pick = today.length - del;
  const done = today.filter((o) => o.status === "Completed").length;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  let delta = `<span class="s">vs. yesterday</span>`;
  if (yest > 0) {
    const c = Math.round(((today.length - yest) / yest) * 100);
    delta = `<div class="s"><span class="${c >= 0 ? "up" : "down"}">${c >= 0 ? "↑" : "↓"} ${Math.abs(c)}%</span> vs. yest.</div>`;
  } else { delta = `<div class="s">Yesterday: ${yest}</div>`; }
  $("#stats").innerHTML = `
    <div class="stat red"><div class="ic">${ic("file")}</div><div class="l">Total Orders</div><div class="n">${today.length}</div>${delta}</div>
    <div class="stat green"><div class="ic">${ic("truck")}</div><div class="l">Delivery</div><div class="n">${del}</div><div class="s">${pct(del, today.length)}% of total</div></div>
    <div class="stat purple"><div class="ic">${ic("bag")}</div><div class="l">Pickup</div><div class="n">${pick}</div><div class="s">${pct(pick, today.length)}% of total</div></div>
    <div class="stat red"><div class="ic">${ic("check")}</div><div class="l">Completed</div><div class="n">${done}</div><div class="s">${pct(done, today.length)}% of total</div></div>`;

  const cnt = (s) => state.orders.filter((o) => o.status === s).length;
  const tile = (s, label, icon, color) => `<button class="tile" data-st="${s}"><span class="ic" style="background:${color}">${ic(icon)}</span><span class="t"><b>${cnt(s)}</b><span>${label}</span></span></button>`;
  $("#statusTiles").innerHTML =
    tile("Pending", "Pending", "clock", "#F5A31A") + tile("Preparing", "Preparing", "utensils", "#2F80ED") +
    tile("Ready", "Ready", "check", "#1AA851") + tile("Out for Delivery", "On the way", "truck", "#8B4DD8");

  const pend = cnt("Pending");
  const bb = $("#bellBadge"); bb.textContent = pend > 99 ? "99+" : pend; bb.classList.toggle("hidden", !pend);
  $("#qaPendingText").textContent = `Pending Orders${pend ? " (" + pend + ")" : ""}`;
  document.title = pend ? `(${pend}) Avalon Owner Panel` : "Avalon Owner Panel";

  const rec = state.orders.slice(0, 5);
  $("#recent").innerHTML = !state.loaded ? `<div class="empty">Loading...</div>` : rec.length ? rec.map(rowHTML).join("") :
    `<div class="empty"><b>Abhi koi order nahi</b>Naya WhatsApp order aate hi yahan nazar aayega.</div>`;
  renderChart();
  renderNotifBanner();
}
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
  state.chart = b.dataset.r; $$("#chartSeg button").forEach((x) => x.classList.toggle("on", x === b)); renderChart();
});
function renderChart() {
  const r = state.chart; let vals = [], labels = [];
  if (r === "today") {
    vals = new Array(24).fill(0); const t = keyAgo(0);
    state.orders.forEach((o) => { if (o._key === t) vals[hourOf(o._dt)]++; });
    labels = ["12am", "6am", "12pm", "6pm", "11pm"];
  } else {
    const n = r === "7" ? 7 : 30; const map = {};
    state.orders.forEach((o) => (map[o._key] = (map[o._key] || 0) + 1));
    const keys = []; for (let i = n - 1; i >= 0; i--) keys.push(keyAgo(i));
    vals = keys.map((k) => map[k] || 0);
    labels = n === 7 ? keys.map((k) => DAYS[new Date(k + "T00:00:00Z").getUTCDay()]) : [fmtDayShort(keys[0]), fmtDayShort(keys[10]), fmtDayShort(keys[20]), fmtDayShort(keys[29])];
  }
  const mx = Math.max(...vals), top = mx <= 4 ? 4 : Math.ceil(mx / 4) * 4;
  const hi = mx > 0 ? vals.indexOf(mx) : -1;
  $("#chart").innerHTML =
    `<div class="y"><span>${top}</span><span>${top / 2}</span><span>0</span></div>` +
    `<div class="plot">${vals.map((v, i) => `<div class="bar${i === hi ? " top" : ""}" style="height:${(v / top) * 100}%" title="${v}"></div>`).join("")}</div>` +
    `<div class="xl">${labels.map((l) => `<span>${l}</span>`).join("")}</div>`;
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
    chip("Out for Delivery", "On the way") + chip("Completed", "Delivered");
  const dchip = (k, l) => `<button class="chip${state.date === k ? " on" : ""}" data-d="${k}">${l}</button>`;
  $("#dateChips").innerHTML = dchip("today", "Today") + dchip("yesterday", "Yesterday") + dchip("7", "Last 7 days") + dchip("all", "All (30 days)") +
    `<label class="chip${state.date === "custom" ? " on" : ""}">${ic("calendar").replace("<svg", '<svg style="width:15px;height:15px"')}${state.date === "custom" && state.customDate ? fmtDayShort(state.customDate) : "Pick date"}<input type="date" id="pickDate" value="${state.customDate || ""}" max="${keyAgo(0)}"></label>`;
  const list = base.filter((o) => state.status === "All" || o.status === state.status);
  const shown = list.slice(0, state.limit);
  $("#orderList").innerHTML = !state.loaded ? `<div class="empty">Loading...</div>` : shown.length ?
    shown.map(rowHTML).join("") + (list.length > shown.length ? `<button class="btn ghost more" id="moreBtn">Aur dikhayein (${list.length - shown.length})</button>` : "") :
    `<div class="empty"><b>Koi order nahi mila</b>Filter ya date badal kar dekhein.</div>`;
}
$("#statusChips").addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; state.status = c.dataset.s; state.limit = 40; renderOrders(); });
$("#dateChips").addEventListener("click", (e) => { const c = e.target.closest("button.chip"); if (!c) return; state.date = c.dataset.d; state.limit = 40; renderOrders(); });
$("#dateChips").addEventListener("change", (e) => { if (e.target.id === "pickDate" && e.target.value) { state.date = "custom"; state.customDate = e.target.value; state.limit = 40; renderOrders(); } });
$("#search").addEventListener("input", (e) => { state.q = e.target.value; state.limit = 40; renderOrders(); });
$("#orderList").addEventListener("click", (e) => { if (e.target.closest("#moreBtn")) { state.limit += 40; renderOrders(); } });

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
  const o = state.orders.find((x) => x.id === state.sheetId);
  const el = $("#sheet");
  if (!o) { el.innerHTML = `<div class="grab"></div><div class="empty">Order nahi mila.</div>`; return; }
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
      <div>${ic("pin")}<b>${pk ? "Restaurant se pickup" : esc(o.address || "Address nahi diya")}</b><small>${pk ? "Pickup" : "Delivery Address"}</small></div>
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
    btn.disabled = false; toast("Status update nahi hua: " + (ex.code || ex.message), "", 5000);
  }
});

/* success screen */
function showSuccess(o, label) {
  const s = $("#success"), id = o.id;
  const dots = ["#E8321F", "#1AA851", "#2F80ED", "#F5A31A", "#8B4DD8"].flatMap((c, i) => [0, 1].map((k) => `<i class="dot" style="background:${c};left:${12 + i * 18 + k * 7}%;top:${10 + ((i * 7 + k * 11) % 14)}%;transform:rotate(${i * 40 + k * 25}deg)"></i>`)).join("");
  s.innerHTML = `${dots}<div class="ok">${ic("check")}</div>
    <h2><span>Order ${esc(orderLabel(o))}</span><span>Marked as ${esc(label)}</span></h2>
    <p>${label === "Preparing" ? "Kitchen ko bata diya gaya hai." : "Status update ho gaya."}</p>
    <button class="btn primary" id="sView">View Order Details</button>
    <button class="btn ghost" id="sBack">Back to Orders</button>`;
  s.classList.remove("hidden");
  $("#sView").onclick = () => { s.classList.add("hidden"); };
  $("#sBack").onclick = () => { s.classList.add("hidden"); closeSheet(); showTab("orders"); };
  hideSheetKeepHistory(id);
}
function hideSheetKeepHistory(id) { /* sheet khuli rehti hai taake "View Order Details" wapas wohi order dikhaye */ state.sheetId = id; renderSheet(); }

/* ---------- NOTIFICATIONS ---------- */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
function notifState() {
  if (isIOS && !isStandalone) return "ios-install";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return Notification.permission; // default | granted | denied
}
async function registerToken(interactive) {
  if (!(await isSupported())) throw new Error("Is browser me notifications support nahi.");
  const reg = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: self.VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error("Token nahi mila.");
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
    if (p !== "granted") { toast("Notification allow nahi hui.", "", 4000); renderSettings(); renderNotifBanner(); return; }
    await registerToken(true);
    toast("✅ Notifications on ho gayi hain.");
  } catch (ex) { toast("Notification on nahi hui: " + (ex.code || ex.message), "", 6000); }
  renderSettings(); renderNotifBanner();
}
function renderNotifBanner() {
  const st = notifState(), b = $("#notifBanner");
  if (st === "granted" || st === "denied" || st === "unsupported") { b.classList.add("hidden"); return; }
  b.classList.remove("hidden");
  b.innerHTML = `<span style="font-size:20px">🔔</span><p>${st === "ios-install" ? "iPhone pe notification ke liye app ko Home Screen pe add karein." : "Naye order ki notification chahiye? Abhi on karein."}</p><button id="nbBtn">${st === "ios-install" ? "Kaise?" : "Enable"}</button>`;
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
  if (st === "granted") inner = `<p class="note">✅ Is device pe notifications on hain. Naya order aate hi "🔔 New Order Received" aayegi.</p><button class="btn ghost" id="nRefresh">Is device ko dobara register karein</button>`;
  else if (st === "denied") inner = `<p class="note">❌ Notifications block hain. Browser/phone ki settings me is app ke liye Notifications "Allow" karein, phir app dobara kholein.</p>`;
  else if (st === "ios-install") inner = `<p class="note">iPhone pe notification tabhi aati hai jab app Home Screen pe install ho:</p>
      <ol class="steps"><li>Is page ko <b>Safari</b> me kholein.</li><li>Neeche <b>Share</b> button dabayein.</li><li><b>Add to Home Screen</b> chunein.</li><li>Home Screen wale <b>Avalon</b> icon se app kholein, phir yahan "Enable" dabayein.</li></ol>`;
  else if (st === "unsupported") inner = `<p class="note">Is browser me push notifications support nahi. Chrome (Android/Mac) ya Safari (iPhone 16.4+, Home Screen app) use karein.</p>`;
  else inner = `<p class="note">Naye WhatsApp order ki alert is phone pe lene ke liye on karein.</p><button class="btn primary" id="nEnable">${ic("bell")} Enable Notifications</button>`;
  $("#notifCard").innerHTML = `<div class="card-h"><span class="ic-red">${ic("bell")}</span><h3>Order Notifications</h3></div>${inner}`;
  const en = $("#nEnable"); if (en) en.onclick = enableNotifications;
  const rf = $("#nRefresh"); if (rf) rf.onclick = async () => { try { await registerToken(true); toast("Device register ho gaya."); } catch (e) { toast("Error: " + (e.code || e.message), "", 5000); } };
  const ic2 = $("#installCard");
  if (deferredInstall && !isStandalone) {
    ic2.classList.remove("hidden");
    ic2.innerHTML = `<div class="card-h"><span class="ic-orange">${ic("download")}</span><h3>Install App</h3></div><p class="note">App ko phone pe install karein taake icon se seedha khule.</p><button class="btn primary" id="installBtn">Install</button>`;
    $("#installBtn").onclick = async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; renderSettings(); };
  } else ic2.classList.add("hidden");
}

paintIcons();
