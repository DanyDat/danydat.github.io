const ext = (s) => (s.split("?")[0].split(".").pop() || "").toLowerCase();
const isVideo = (s) => ["mp4", "webm", "mov"].includes(ext(s));
const isImage = (s) => ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(ext(s));
const isPdf = (s) => ext(s) === "pdf";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

// Media element. mode: "tile" (autoplay muted preview) or "full" (controls + sound)
function mediaEl(item, mode) {
  if (isVideo(item.src)) {
    const v = document.createElement("video");
    v.src = item.src;
    v.playsInline = true;
    if (mode === "tile") { v.muted = true; v.loop = true; v.autoplay = true; }
    else { v.controls = true; }
    return v;
  }
  if (isPdf(item.src)) {
    const f = document.createElement("iframe");
    f.src = item.src;
    f.className = "pdf";
    f.title = item.caption || "PDF";
    return f;
  }
  if (isImage(item.src)) {
    const img = document.createElement("img");
    img.src = item.src;
    img.alt = item.caption || "";
    img.loading = "lazy";
    return img;
  }
  const a = el("a", "file", item.caption || item.src.split("/").pop());
  a.href = item.src;
  a.target = "_blank";
  return a;
}

function openLightbox(item) {
  const lb = document.getElementById("lightbox");
  lb.innerHTML = "";
  lb.appendChild(mediaEl(item, "full"));
  lb.hidden = false;
}

function figure(item, mode, clickable) {
  const fig = el("figure", "item " + mode);
  fig.appendChild(mediaEl(item, mode));
  if (item.caption && !isPdf(item.src)) fig.appendChild(el("figcaption", "", item.caption));
  if (clickable && (isImage(item.src) || isVideo(item.src))) {
    fig.classList.add("zoom");
    fig.onclick = () => openLightbox(item);
  }
  return fig;
}

function renderReel(pg, sec) {
  sec.appendChild(el("h2", "", pg.title));
  const wrap = el("div", "player");
  if (pg.video) {
    const v = document.createElement("video");
    v.src = pg.video;
    v.controls = true;       // play / pause / volume / fullscreen
    v.preload = "metadata";
    v.playsInline = true;
    if (pg.poster) v.poster = pg.poster;
    wrap.appendChild(v);
  } else if (pg.poster) {
    const img = document.createElement("img");
    img.src = pg.poster;
    wrap.appendChild(img);
  }
  sec.appendChild(wrap);
}

function renderWorks(pg, sec) {
  sec.appendChild(el("h2", "", pg.title));
  let lastYear = null;
  pg.sections.forEach((s) => {
    if (s.year && s.year !== lastYear) {
      sec.appendChild(el("div", "year", s.year));
      lastYear = s.year;
    }
    if (s.title) sec.appendChild(el("div", "sec-title", s.title));
    const grid = el("div", "grid");
    s.items.forEach((it) => grid.appendChild(figure(it, "tile", true)));
    sec.appendChild(grid);
  });
}

function renderContent(pg, sec) {
  sec.classList.add("text-block");
  sec.appendChild(el("h2", "", pg.title));
  if (pg.text) sec.appendChild(el("p", "body", pg.text));
  const box = el("div", "media-list");
  (pg.media || []).forEach((it) => box.appendChild(figure(it, "full", true)));
  sec.appendChild(box);
}

async function init() {
  const res = await fetch("data.json?t=" + Date.now());
  const data = await res.json();

  document.title = data.site.name + " - Portfolio";
  document.getElementById("brand").textContent = data.site.name;

  const menu = document.getElementById("menu");
  const main = document.getElementById("top");
  data.pages.forEach((pg) => {
    const a = el("a", "", pg.label);
    a.href = "#" + pg.id;
    menu.appendChild(a);

    const sec = el("section", "page");
    sec.id = pg.id;
    if (pg.type === "reel") renderReel(pg, sec);
    else if (pg.type === "works") renderWorks(pg, sec);
    else renderContent(pg, sec);
    main.appendChild(sec);
  });

  document.getElementById("lightbox").onclick = (e) => {
    if (e.target.tagName === "VIDEO") return; // keep controls usable
    e.currentTarget.hidden = true;
    e.currentTarget.innerHTML = "";
  };
}

init();
