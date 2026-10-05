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

function embedUrl(src) {
  let m;
  if ((m = src.match(/instagram\.com\/(reel|p|tv)\/([\w-]+)/))) return `https://www.instagram.com/${m[1]}/${m[2]}/embed`;
  if ((m = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/))) return `https://www.youtube.com/embed/${m[1]}`;
  if ((m = src.match(/vimeo\.com\/(\d+)/))) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

// Media element. mode: "tile" (autoplay muted preview) or "full" (controls + sound)
function mediaEl(item, mode) {
  const emb = embedUrl(item.src);
  if (emb) {
    const f = document.createElement("iframe");
    f.src = emb;
    f.className = "embed";
    f.loading = "lazy";
    f.allowFullscreen = true;
    f.allow = "autoplay; encrypted-media; fullscreen";
    return f;
  }

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
    v.preload = "auto";
    v.playsInline = true;
    v.loop = true;
    if (pg.poster) v.poster = pg.poster;
    wrap.appendChild(v);
    // Browsers only allow autoplay with sound in some cases: try with sound,
    // otherwise start muted (viewer can unmute with the volume button).
    const start = () => {
      v.muted = false;
      v.play().catch(() => {
        v.muted = true;
        v.play().catch(() => {});
      });
    };
    if (v.readyState >= 2) start(); else v.addEventListener("loadeddata", start, { once: true });
    // Once the viewer interacts with the page, turn the sound on automatically.
    const unmute = () => { if (v.muted && !v.dataset.userMuted) v.muted = false; };
    ["click", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, unmute, { once: true }));
    v.addEventListener("volumechange", () => { if (v.muted) v.dataset.userMuted = "1"; });
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
  if (pg.email || (pg.socials && pg.socials.length)) {
    const row = el("div", "socials");
    if (pg.email) {
      // Phones: open the mail app (mailto). Desktop: open Gmail compose in a new tab.
      const mobile = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
      const a = el("a", "social email");
      a.title = "Gửi email: " + pg.email;
      a.setAttribute("aria-label", "Send email");
      if (mobile) {
        a.href = "mailto:" + pg.email;
      } else {
        a.href = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(pg.email);
        a.target = "_blank";
        a.rel = "noopener";
      }
      a.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
      row.appendChild(a);
    }
    (pg.socials || []).forEach((s) => {
      if (!s.url) return;
      const a = el("a", "social");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = s.name || "";
      const img = document.createElement("img");
      img.src = s.icon;
      img.alt = s.name || "social";
      a.appendChild(img);
      row.appendChild(a);
    });
    sec.appendChild(row);
  }
  const box = el("div", "media-list");
  (pg.media || []).forEach((it) => box.appendChild(figure(it, "full", true)));
  sec.appendChild(box);
}

async function init() {
  const res = await fetch("data.json?t=" + Date.now());
  const data = normalize(await res.json());

  document.title = data.site.name + " - Portfolio";
  document.getElementById("brand").textContent = data.site.name;
  if (data.site.favicon) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = data.site.favicon;
  }

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

// Accept the old data format (site.about / reel / sections) and convert it to the pages model.
function normalize(d) {
  if (d.pages) return d;
  return {
    site: { name: d.site.name, tagline: d.site.tagline },
    pages: [
      { id: "reel", label: "Reel", type: "reel", title: d.reel.title, video: d.reel.video, poster: d.reel.poster },
      { id: "works", label: "My works", type: "works", title: d.worksTitle, sections: d.sections },
      { id: "about", label: "About me", type: "content", title: "ABOUT ME", text: d.site.about || "", media: [] },
      { id: "contact", label: "Contact", type: "content", title: "CONTACT", text: d.site.contact || "", media: [] }
    ]
  };
}
