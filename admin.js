let data = null;
const pending = {}; // path -> base64 content waiting to be committed
const $ = (id) => document.getElementById(id);
const isVideo = (s) => /\.(mp4|webm|mov)(\?|$)/i.test(s);
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
  bindGeneral();
  render();
  status("Đã tải. Kéo thả để đổi thứ tự, sau đó bấm 'Lưu lên GitHub'.");
}

function bindGeneral() {
  const map = {
    siteName: ["site", "name"], tagline: ["site", "tagline"], about: ["site", "about"], contact: ["site", "contact"],
    reelTitle: ["reel", "title"], reelVideo: ["reel", "video"], reelPoster: ["reel", "poster"],
  };
  Object.entries(map).forEach(([id, [a, b]]) => {
    $(id).value = data[a][b];
    $(id).oninput = () => (data[a][b] = $(id).value);
  });
  $("worksTitle").value = data.worksTitle;
  $("worksTitle").oninput = () => (data.worksTitle = $("worksTitle").value);
  $("reelFile").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const path = await queueFile(f);
    data.reel.video = path;
    $("reelVideo").value = path;
  };
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

// ---------- render ----------
function render() {
  const root = $("sections");
  root.innerHTML = "";
  data.sections.forEach((sec, si) => {
    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "row";
    head.innerHTML = `<input class="y" size="8" placeholder="Năm"> <input class="t" size="36" placeholder="Tiêu đề cột mốc (tuỳ chọn)">`;
    head.querySelector(".y").value = sec.year;
    head.querySelector(".y").oninput = (e) => (sec.year = e.target.value);
    head.querySelector(".t").value = sec.title;
    head.querySelector(".t").oninput = (e) => (sec.title = e.target.value);
    head.append(
      btn("↑", "sec", () => moveArr(data.sections, si, -1)),
      btn("↓", "sec", () => moveArr(data.sections, si, 1)),
      btn("Xoá cột mốc", "danger", () => { if (confirm("Xoá cả cột mốc này?")) { data.sections.splice(si, 1); render(); } })
    );
    card.appendChild(head);

    const add = document.createElement("div");
    add.className = "row";
    const file = document.createElement("input");
    file.type = "file"; file.multiple = true; file.accept = "image/*,video/*";
    file.onchange = async () => {
      for (const f of file.files) sec.items.push({ src: await queueFile(f), caption: "" });
      render();
    };
    const url = document.createElement("input");
    url.size = 30; url.placeholder = "...hoặc dán đường dẫn ảnh/video";
    add.append(file, url, btn("Thêm link", "sec", () => {
      if (url.value.trim()) { sec.items.push({ src: url.value.trim(), caption: "" }); render(); }
    }));
    card.appendChild(add);

    const grid = document.createElement("div");
    grid.className = "grid";
    sec.items.forEach((item, ii) => grid.appendChild(itemEl(sec, ii)));
    card.appendChild(grid);
    root.appendChild(card);
  });
}

function btn(label, cls, fn) {
  const b = document.createElement("button");
  b.textContent = label; b.className = cls; b.onclick = fn;
  return b;
}
function moveArr(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  render();
}

let dragSrc = null;
function itemEl(sec, ii) {
  const item = sec.items[ii];
  const el = document.createElement("div");
  el.className = "it";
  el.draggable = true;
  const m = document.createElement(isVideo(item.src) ? "video" : "img");
  m.src = previewSrc(item.src);
  if (m.tagName === "VIDEO") { m.muted = true; m.loop = true; m.autoplay = true; }
  el.appendChild(m);
  const cap = document.createElement("input");
  cap.placeholder = "Chú thích";
  cap.value = item.caption || "";
  cap.oninput = () => (item.caption = cap.value);
  el.appendChild(cap);
  const b = document.createElement("div");
  b.className = "btns";
  b.append(
    btn("←", "sec", () => moveArr(sec.items, ii, -1)),
    btn("→", "sec", () => moveArr(sec.items, ii, 1)),
    btn("✕", "danger", () => { sec.items.splice(ii, 1); render(); })
  );
  el.appendChild(b);

  el.ondragstart = () => { dragSrc = { sec, ii }; el.classList.add("dragging"); };
  el.ondragend = () => el.classList.remove("dragging");
  el.ondragover = (e) => { e.preventDefault(); el.classList.add("drag-over"); };
  el.ondragleave = () => el.classList.remove("drag-over");
  el.ondrop = (e) => {
    e.preventDefault();
    if (!dragSrc) return;
    const [moved] = dragSrc.sec.items.splice(dragSrc.ii, 1);
    // works across different milestones too
    sec.items.splice(ii, 0, moved);
    dragSrc = null;
    render();
  };
  return el;
}

$("addSection").onclick = () => {
  const y = prompt("Năm / cột mốc mới (ví dụ 2027):", String(new Date().getFullYear() + 1));
  if (y === null) return;
  data.sections.unshift({ year: y, title: "", items: [] });
  render();
};

// ---------- save ----------
$("download").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "data.json";
  a.click();
};

function api(path) {
  return `https://api.github.com/repos/${$("repo").value.trim()}/contents/${path}`;
}
function headers() {
  return { Authorization: "Bearer " + $("token").value.trim(), Accept: "application/vnd.github+json" };
}
async function putFile(path, b64, message) {
  const branch = $("branch").value.trim();
  let sha;
  const cur = await fetch(api(path) + "?ref=" + branch + "&t=" + Date.now(), { headers: headers() });
  if (cur.ok) sha = (await cur.json()).sha;
  const res = await fetch(api(path), {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ message, content: b64, branch, sha }),
  });
  if (!res.ok) throw new Error(path + ": " + (await res.text()));
}
const utf8b64 = (s) => btoa(unescape(encodeURIComponent(s)));

$("save").onclick = async () => {
  if (!$("token").value.trim()) { alert("Hãy dán token GitHub trước."); return; }
  $("save").disabled = true;
  try {
    const paths = Object.keys(pending);
    // only upload files that are still referenced
    const used = JSON.stringify(data);
    for (let i = 0; i < paths.length; i++) {
      if (!used.includes(paths[i])) continue;
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
