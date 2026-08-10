/* Martyrs archive web UI — frontend */
"use strict";

const $ = (s, r) => (r || document).querySelector(s);

const state = {
  cats: [],
  selected: new Set(),
  page: 1,
  more: true,
  lock: false,
  playlist: [],        // queue items {id,title,quality,status,bytes,total,err}
  jobs: [],
  modal: false,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
function fmt(n) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i ? n.toFixed(1) : n) + " " + u[i];
}
let toastTimer;
function toast(m) {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 4000);
}
async function api(path, opts) {
  const r = await fetch(path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "خطأ " + r.status);
  return j;
}

/* ---------------- categories ---------------- */
async function loadCats() {
  const data = await api("/api/meta");
  state.cats = data.categories;
  const saved = JSON.parse(localStorage.getItem("selCats") || "null");
  state.selected = new Set(saved || state.cats.map(c => c.id));
  renderCats();
}
function renderCats() {
  const box = $("#cats");
  box.innerHTML = "";
  for (const c of state.cats) {
    const el = document.createElement("div");
    el.className = "cat" + (state.selected.has(c.id) ? " active" : "");
    const chk = document.createElement("span"); chk.className = "chk";
    const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = c.name;
    const ct = document.createElement("span"); ct.className = "ct"; ct.textContent = c.count;
    el.append(chk, nm, ct);
    el.onclick = () => {
      state.selected.has(c.id) ? state.selected.delete(c.id) : state.selected.add(c.id);
      localStorage.setItem("selCats", JSON.stringify([...state.selected]));
      renderCats();
      reload();
    };
    box.appendChild(el);
  }
  $("#selCount").textContent = state.selected.size;
}

/* ---------------- grid ---------------- */
function browseUrl() {
  const p = new URLSearchParams({ cat: [...state.selected].join(","), page: state.page });
  const q = $("#q").value.trim();
  if (q) p.set("q", q);
  return "/api/browse?" + p;
}
async function reload() {
  if (state.lock) return;
  state.lock = true;
  state.page = 1;
  $("#grid").innerHTML = `<div class="empty">جارِ التحميل…</div>`;
  try {
    const res = await api(browseUrl());
    state.more = res.more;
    renderItems(res.items, true);
    $("#moreBtn").style.display = state.more ? "" : "none";
  } catch (e) {
    $("#grid").innerHTML = `<div class="empty">فشل الجلب: ${esc(e.message)}</div>`;
  }
  state.lock = false;
}
async function loadMore() {
  if (state.lock || !state.more) return;
  state.lock = true;
  state.page++;
  try {
    const r = await api(browseUrl());
    state.more = r.more;
    renderItems(r.items, false);
    if (!state.more) $("#moreBtn").style.display = "none";
  } catch (e) { toast("فشل: " + e.message); }
  state.lock = false;
}
function renderItems(items, reset) {
  const grid = $("#grid");
  if (reset) grid.innerHTML = "";
  if (!items.length) {
    if (reset) {
      const q = $("#q").value.trim();
      grid.innerHTML = `<div class="empty">لا توجد نتائج مطابقة.` +
        (q ? `<div><button class="btn ghost sm empty-cta" id="clearQ">مسح البحث " ${esc(q)} "</button></div>` : "") +
        `</div>`;
      const b = $("#clearQ");
      if (b) b.onclick = () => { $("#q").value = ""; reload(); };
    }
    $("#moreBtn").style.display = "none";
    return;
  }
  items.forEach(v => grid.appendChild(card(v)));
}
function card(v) {
  const el = document.createElement("div");
  el.className = "card";
  const chip = v.status === "done" ? `<span class="chip ok">محُمّل ✓</span>`
             : v.status === "fail" ? `<span class="chip fail">فشل</span>` : "";
  const badge = v.category ? `<span class="chip">${esc(v.category)}</span>` : "";
  el.innerHTML = `
    <div class="thumb">
      ${v.thumb ? `<img loading="lazy" src="${esc(v.thumb)}" onerror="this.style.display='none'">`
                : `<div class="noimg"><svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg></div>`}
      <div class="badges">${badge}${chip}</div>
    </div>
    <div class="body">
      <div class="tit">${esc(v.title)}</div>
      <div class="meta"><span>${esc(v.date || "—")}</span><span>#${v.id}</span></div>
      <div class="ctrl">
        <select data-sel><option value="">جلب الجودات…</option></select>
        <button class="btn ghost sm" data-add>+ إضافة</button>
        <button class="btn sm" data-dl>تحميل</button>
      </div>
    </div>`;
  const sel = $("select", el);
  const addb = $("[data-add]", el);
  const dlb = $("[data-dl]", el);

  if (v.sources && v.sources.length) fillSel(sel, v);
  else sel.addEventListener("focus", async () => {
    if (sel.dataset.ready) return;
    sel.dataset.ready = "1";
    try {
      const p = await api("/api/post/" + v.id);
      if (p && p.sources) fillSel(sel, p);
      else sel.innerHTML = `<option value="">لا مصادر</option>`;
    } catch (e) { sel.innerHTML = `<option value="">فشل الجلب</option>`; }
  });

  addb.onclick = () => addToQueue(v, sel.value || "best", false);
  dlb.onclick = () => {
    addToQueue(v, sel.value || "best", true);
    openModal();
  };
  return el;
}
function fillSel(sel, v) {
  sel.innerHTML = "";
  sel.appendChild(new Option("الأفضل", "best"));
  for (const s of v.sources) {
    if (!s.platform) {
      const sh = s.size_h || fmt(s.size || 0);
      sel.appendChild(new Option(s.label + " — " + sh, s.label));
    }
  }
  if (v.sources.some(s => s.platform)) sel.appendChild(new Option("منصة خارجية (مشغّل)", "embed"));
  sel.dataset.ready = "1";
}

/* ---------------- modal ---------------- */
let lastFocus = null;
function openModal() {
  state.modal = true;
  lastFocus = document.activeElement;
  $("#ov").classList.add("show");
  $("#dlModal").classList.add("show");
  renderPlaylist();
  const c = $("#dlClose");
  if (c) c.focus();
}
function closeModal() {
  state.modal = false;
  $("#ov").classList.remove("show");
  $("#dlModal").classList.remove("show");
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && state.modal) closeModal();
});

/* ---------------- download center ---------------- */
function addToQueue(v, quality, autoStart) {
  if (!quality) quality = "best";
  const q = state.playlist.find(p => p.id === v.id);
  if (q) {
    if (q.status === "dl" || q.status === "done") { toast("هذا الفيديو قيد التحميل/محُمّل من قبل."); return; }
    q.quality = quality;
  } else {
    state.playlist.push({
      id: v.id, title: v.title || "قصة " + v.id,
      quality, status: "queued", bytes: 0, total: 0, err: "",
    });
  }
  renderPlaylist();
  if (autoStart && !running()) startDownload();
}
function running() {
  return state.playlist.some(p => p.status === "dl");
}
function pct(p) {
  if (!p.total) return p.status === "queued" ? 0 : 100;
  return Math.min(100, Math.round(p.bytes / p.total * 100));
}
function stAr(s) {
  return { queued: "بانتظار", dl: "جارٍ الحتيل", done: "مكتمل", fail: "فشل" }[s] || s;
}
function renderPlaylist() {
  const list = $("#plist");
  const go = running();
  list.innerHTML = "";
  let doneN = 0, dlN = 0, failN = 0, queN = 0, sumDone = 0;
  for (const p of state.playlist) {
    if (p.status === "done") doneN++;
    else if (p.status === "fail") failN++;
    else if (p.status === "dl") { dlN++; sumDone += p.bytes; }
    else queN++;
    const el = document.createElement("div");
    el.className = "plitem";
    const top = document.createElement("div");
    top.className = "pltop";
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = p.title;
    top.appendChild(t);
    const oid = document.createElement("span");
    oid.className = "oid";
    oid.textContent = "#" + p.id + " · " + p.quality;
    top.appendChild(oid);
    if (!go && p.status !== "done") {
      const rm = document.createElement("button");
      rm.className = "rm"; rm.textContent = "✕";
      rm.onclick = () => { state.playlist = state.playlist.filter(x => x !== p); renderPlaylist(); };
      top.appendChild(rm);
    }
    el.appendChild(top);
    if (p.status === "dl" || p.status === "queued") {
      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("div");
      fill.style.width = (p.status === "dl" ? pct(p) : 0) + "%";
      bar.appendChild(fill);
      el.appendChild(bar);
      const f = document.createElement("div");
      f.className = "plf";
      f.innerHTML = `<span class="sp">${stAr(p.status)}</span>` +
        `<span class="sp">${p.status === "dl" ? `${pct(p)}%` : ""} · ${p.status === "dl" ? fmt(p.bytes) + " / " + fmt(p.total) : "بانتظار…"}</span>`;
      el.appendChild(f);
    } else if (p.status === "done") {
      const f = document.createElement("div");
      f.className = "plf done";
      f.textContent = "تم التحميل ✓ (" + fmt(p.bytes) + ")";
      el.appendChild(f);
    } else if (p.status === "fail") {
      const f = document.createElement("div");
      f.className = "plf err";
      f.textContent = "فشل: " + (p.err || "خطأ غير معروف");
      el.appendChild(f);
    }
    list.appendChild(el);
  }
  $("#mcount").textContent = state.playlist.length;
  $("#plCount").textContent = state.playlist.length;
  $("#dlGo").disabled = go || !state.playlist.length ||
    state.playlist.every(p => p.status === "done" || p.status === "fail");
  $("#dlGo").classList.toggle("pulse", !go && queN > 0);
  $("#dlGo").textContent = go ? "جارٍ…" : (queN ? "بدء التحميل (" + queN + ")" : "ابدأ مرة أخرى");

  const text = [];
  if (dlN) text.push(`<b>${dlN}</b> في التحميل`);
  if (queN) text.push(`<b>${queN}</b> بانتظار`);
  if (doneN) text.push(`<b>${doneN}</b> مكتمل`);
  if (failN) text.push(`<b class="x">${failN}</b> فشل`);
  $("#dlSum").innerHTML = text.length
    ? text.join(" · ") + (dlN ? " · " + fmt(sumDone) : "")
    : "بدون عناصر";
}

/* ---------------- downloads ---------------- */
async function startDownload() {
  const items = state.playlist.filter(p => p.status !== "done" && p.status !== "dl");
  if (!items.length) return;
  const quality = $("#globalQ").value;
  try {
    const { job_id } = await api("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality, items: items.map(p => ({ id: p.id, quality: p.quality })) }),
    });
    toast("بدأ التحميل... " + job_id);
    pollJob(job_id);
  } catch (e) { toast("فشل البدء: " + e.message); }
}
async function pollJob(job_id) {
  if (!state.jobs.includes(job_id)) state.jobs.push(job_id);
  while (state.jobs.includes(job_id)) {
    const st = await api("/api/queue/" + job_id).catch(() => null);
    if (!st) { state.jobs = state.jobs.filter(j => j !== job_id); break; }
    for (const r of st.items) {
      const p = state.playlist.find(x => x.id === r.id);
      if (p) { p.status = r.status; p.bytes = r.bytes; p.total = r.total; p.err = r.error || ""; }
    }
    renderPlaylist();
    if (st.done) {
      state.jobs = state.jobs.filter(j => j !== job_id);
      renderPlaylist();
      toast("اكتمل تحميل القائمة.");
      reload();
      return;
    }
    await sleep(1500);
  }
}

/* ---------------- ui toggles ---------------- */
function toggleMenu() {
  document.querySelector("aside").classList.toggle("open");
}

/* ---------------- init ---------------- */
(async function init() {
  $("#dlClose").onclick = closeModal;
  $("#ov").onclick = closeModal;
  $("#plOpen").onclick = openModal;
  $("#dlGo").onclick = startDownload;
  $("#dlClear").onclick = () => {
    state.playlist = state.playlist.filter(p => p.status !== "done" && p.status !== "fail");
    renderPlaylist();
  };
  $("#menuBtn").onclick = toggleMenu;
  $("#menuBtn2").onclick = toggleMenu;
  $("#moreBtn").onclick = loadMore;
  $("#globalQ").value = localStorage.getItem("mq") || "best";
  $("#globalQ").onchange = e => localStorage.setItem("mq", e.target.value);
  let deb;
  $("#q").addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(reload, 350); });
  $("#allCats").onclick = () => {
    state.selected = new Set(state.cats.map(c => c.id));
    localStorage.setItem("selCats", JSON.stringify([...state.selected]));
    renderCats(); reload();
  };
  $("#clearCats").onclick = () => {
    state.selected.clear();
    localStorage.setItem("selCats", "[]");
    renderCats(); reload();
  };
  try {
    await loadCats();
    await reload();
  } catch (e) {
    $("#grid").innerHTML = `<div class="empty">تعذّر التحميل: ${esc(e.message)}</div>`;
  }
})();