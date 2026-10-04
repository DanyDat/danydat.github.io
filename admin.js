let data = null;
const pending = {}; // path -> {b64, preview} waiting to be committed
const $ = (id) => document.getElementById(id);
const ext = (s) => (s.split("?")[0].split(".").pop() || "").toLowerCase();
const isVideo = (s) => ["mp4", "webm", "mov"].includes(ext(s));
const isImage = (s) => ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(ext(s));
const status = (m) => ($("status").textContent = m);

// ---------- settings ----------
$("token").value = localStorage.getItem("gh_token") || "";
$("repo").value = localStorage.getItem("gh_repo") || $("repo").value;
$("branch").value = localStorage.getItem("gh_branch") || $("branch").value;
$("saveToken").onclick = () => {
  localStorage.setItem("gh_token", $("token").value.trim());
  localStorage.setItem("gh_repo", $("repo").value.trim());
  localStorage.setItem("gh_branch", $("branch").value.trim());
  status("Đã lưu token trong trình duyệt.");
};

// ---------- load ----------
async function load() {
  const res = await fetch("data.json?t=" + Date.now());
  data = await res.json();
  $("siteName").value = data.site.name;
  $("siteName").oninput = () => (data.site.name = $("siteName").value);
  $("tagline").value = data.site.tagline;
  $("tagline").oninput = () => (data.site.tagline = $("tagline").value);
  render();
  status("Đã tải. Chỉnh sửa rồi bấm 'Lưu lên GitHub'.");
}

// ---------- files ----------
function toBase64(file) {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(r.result.split(",")[1]);
    r.onerror = fail;
    r.readAsDataURL(file);
  });
}
async function queueFile(file) {
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-");
  const path = "media/" + Date.now() + "-" + safe;
  pending[path] = { b64: await toBase64(file), preview: URL.createObjectURL(file) };
  return path;
}
const previewSrc = (src) => (pending[src] ? pending[src].preview : src);

// ---------- small helpers ----------
function btn(label, cls, fn) {
  const b = document.createElement("button");
  b.textContent = label; b.className = cls; b.onclick = fn;
  return b;
}
function input(value, placeholder, size, onChange) {
  const i = document.createElement("input");
  i.value = value || ""; i.placeholder = placeholder || ""; if (size) i.size = size;
  i.oninput = () => onChange(i.value);
  return i;
}
function label(text) {
  const s = document.createElement("span");
  s.className = "hint"; s.textContent = text;
  return s;
}
function moveArr(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  render();
}
function slug(s) {
  return (s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) || "page";
}

// ---------- media editor (used by works sections and content pages) ----------
let dragSrc = null;
function mediaEditor(items) {
  const box = document.createElement("div");

  const add = document.createElement("div");
  add.className = "row";
  const file = document.createElement("input");
  file.type = "file"; file.multiple = true; file.accept = "image/*,video/*,application/pdf";
  file.onchange = async () => {
    for (const f of file.files) items.push({ src: await queueFile(f), caption: "" });
    render();
  };
  const url = document.createElement("input");
  url.size = 28; url.placeholder = "...hoặc dán đường dẫn";
  add.append(label("Thêm ảnh / video / PDF:"), file, url, btn("Thêm link", "sec", () => {
    if (url.value.trim()) { items.push({ src: url.value.trim(), caption: "" }); render(); }
  }));
  box.appendChild(add);

  const grid = document.createElement("div");
  grid.className = "grid";
  items.forEach((item, ii) => grid.appendChild(itemEl(items, ii)));
  box.appendChild(grid);
  return box;
}

function itemEl(items, ii) {
  const item = items[ii];
  const e = document.createElement("div");
  e.className = "it";
  e.draggable = true;
  let m;
  if (isVideo(item.src)) {
    m = document.createElement("video"); m.src = previewSrc(item.src); m.muted = true; m.loop = true; m.autoplay = true;
  } else if (isImage(item.src)) {
    m = document.createElement("img"); m.src = previewSrc(item.src);
  } else {
    m = document.createElement("div"); m.className = "ph"; m.textContent = ext(item.src).toUpperCase() || "FILE";
  }
  e.appendChild(m);
  e.appendChild(input(item.caption, "Chú thích", 0, (v) => (item.caption = v)));
  const b = document.createElement("div");
  b.className = "btns";
  b.append(
    btn("←", "sec", () => moveArr(items, ii, -1)),
    btn("→", "sec", () => moveArr(items, ii, 1)),
    btn("✕", "danger", () => { items.splice(ii, 1); render(); })
  );
  e.appendChild(b);

  e.ondragstart = () => { dragSrc = { items, ii }; e.classList.add("dragging"); };
  e.ondragend = () => e.classList.remove("dragging");
  e.ondragover = (ev) => { ev.preventDefault(); e.classList.add("drag-over"); };
  e.ondragleave = () => e.classList.remove("drag-over");
  e.ondrop = (ev) => {
    ev.preventDefault();
    if (!dragSrc) return;
    const [moved] = dragSrc.items.splice(dragSrc.ii, 1);
    items.splice(ii, 0, moved);
    dragSrc = null;
    render();
  };
  return e;
}

// ---------- page editors ----------
function reelEditor(pg, body) {
  const r1 = document.createElement("div"); r1.className = "row";
  r1.append(label("Tiêu đề:"), input(pg.title, "", 30, (v) => (pg.title = v)));
  body.appendChild(r1);

  const mk = (name, key, accept) => {
    const row = document.createElement("div"); row.className = "row";
    const path = input(pg[key], "", 34, (v) => (pg[key] = v));
    const f = document.createElement("input");
    f.type = "file"; f.accept = accept;
    f.onchange = async () => {
      if (!f.files[0]) return;
      pg[key] = await queueFile(f.files[0]);
      path.value = pg[key];
      status(name + " đã chọn, nhớ bấm 'Lưu lên GitHub'.");
    };
    row.append(label(name + ":"), path, f);
    body.appendChild(row);
  };
  mk("Video reel (có tiếng)", "video", "video/*");
  mk("Ảnh bìa", "poster", "image/*");
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Người xem bấm play để nghe tiếng. Nên dùng mp4 (H.264) dưới ~50MB.";
  body.appendChild(hint);
}

function worksEditor(pg, body) {
  const r1 = document.createElement("div"); r1.className = "row";
  r1.append(label("Tiêu đề:"), input(pg.title, "", 30, (v) => (pg.title = v)));
  body.appendChild(r1);
  body.appendChild(btn("+ Thêm cột mốc / năm mới", "sec", () => {
    const y = prompt("Năm / cột mốc mới (ví dụ 2027):", String(new Date().getFullYear() + 1));
    if (y === null) return;
    pg.sections.unshift({ year: y, title: "", items: [] });
    render();
  }));

  pg.sections.forEach((sec, si) => {
    const card = document.createElement("div");
    card.className = "card inner";
    card.style.marginTop = "12px";
    const head = document.createElement("div"); head.className = "row";
    head.append(
      input(sec.year, "Năm", 8, (v) => (sec.year = v)),
      input(sec.title, "Tiêu đề cột mốc (tuỳ chọn)", 36, (v) => (sec.title = v)),
      btn("↑", "sec", () => moveArr(pg.sections, si, -1)),
      btn("↓", "sec", () => moveArr(pg.sections, si, 1)),
      btn("Xoá cột mốc", "danger", () => { if (confirm("Xoá cả cột mốc này?")) { pg.sections.splice(si, 1); render(); } })
    );
    card.append(head, mediaEditor(sec.items));
    body.appendChild(card);
  });
}

function contentEditor(pg, body) {
  const r1 = document.createElement("div"); r1.className = "row";
  r1.append(label("Tiêu đề:"), input(pg.title, "", 30, (v) => (pg.title = v)));
  body.appendChild(r1);
  body.appendChild(label("Nội dung chữ"));
  const ta = document.createElement("textarea");
  ta.value = pg.text || "";
  ta.oninput = () => (pg.text = ta.value);
  body.appendChild(ta);
  pg.media = pg.media || [];
  body.appendChild(mediaEditor(pg.media));
}

function render() {
  const root = $("pages");
  root.innerHTML = "";
  data.pages.forEach((pg, pi) => {
    const card = document.createElement("div");
    card.className = "card";
    const head = document.createElement("div"); head.className = "row";
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = { reel: "Reel", works: "Works", content: "Nội dung" }[pg.type];
    head.append(
      badge,
      label("Tên trên menu:"),
      input(pg.label, "Tên menu", 20, (v) => (pg.label = v)),
      btn("↑", "sec", () => moveArr(data.pages, pi, -1)),
      btn("↓", "sec", () => moveArr(data.pages, pi, 1)),
      btn("Xoá mục", "danger", () => { if (confirm(`Xoá mục "${pg.label}"?`)) { data.pages.splice(pi, 1); render(); } })
    );
    card.appendChild(head);
    const body = document.createElement("div");
    if (pg.type === "reel") reelEditor(pg, body);
    else if (pg.type === "works") worksEditor(pg, body);
    else contentEditor(pg, body);
    card.appendChild(body);
    root.appendChild(card);
  });
}

$("addPage").onclick = () => {
  const name = prompt("Tên mục mới trên menu (ví dụ: Resume):");
  if (!name) return;
  let id = slug(name), n = 2;
  while (data.pages.some((p) => p.id === id)) id = slug(name) + "-" + n++;
  data.pages.push({ id, label: name, type: "content", title: name.toUpperCase(), text: "", media: [] });
  render();
  window.scrollTo(0, document.body.scrollHeight);
};

// ---------- save ----------
$("download").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "data.json";
  a.click();
};
const api = (path) => `https://api.github.com/repos/${$("repo").value.trim()}/contents/${path}`;
const headers = () => ({ Authorization: "Bearer " + $("token").value.trim(), Accept: "application/vnd.github+json" });
async function putFile(path, b64, message) {
  const branch = $("branch").value.trim();
  let sha;
  const cur = await fetch(api(path) + "?ref=" + branch + "&t=" + Date.now(), { headers: headers() });
  if (cur.ok) sha = (await cur.json()).sha;
  const res = await fetch(api(path), {
    method: "PUT", headers: headers(),
    body: JSON.stringify({ message, content: b64, branch, sha }),
  });
  if (!res.ok) throw new Error(path + ": " + (await res.text()));
}
const utf8b64 = (s) => btoa(unescape(encodeURIComponent(s)));

$("save").onclick = async () => {
  if (!$("token").value.trim()) { alert("Hãy dán token GitHub trước."); return; }
  $("save").disabled = true;
  try {
    const used = JSON.stringify(data);
    const paths = Object.keys(pending).filter((p) => used.includes(p));
    for (let i = 0; i < paths.length; i++) {
      status(`Đang tải lên ${i + 1}/${paths.length}: ${paths[i]}`);
      await putFile(paths[i], pending[paths[i]].b64, "Upload " + paths[i]);
    }
    status("Đang lưu data.json...");
    await putFile("data.json", utf8b64(JSON.stringify(data, null, 2) + "\n"), "Update portfolio content");
    paths.forEach((p) => delete pending[p]);
    status("Đã lưu! Trang web sẽ cập nhật sau khoảng 1 phút.");
  } catch (e) {
    status("Lỗi: " + e.message);
    alert("Lưu thất bại:\n" + e.message);
  }
  $("save").disabled = false;
};

load();
