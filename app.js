const isVideo = (src) => /\.(mp4|webm|mov)(\?|$)/i.test(src);

function mediaEl(item, controls) {
  if (isVideo(item.src)) {
    const v = document.createElement("video");
    v.src = item.src;
    v.muted = true; v.loop = true; v.playsInline = true;
    if (controls) { v.controls = true; v.autoplay = true; }
    else { v.autoplay = true; }
    return v;
  }
  const img = document.createElement("img");
  img.src = item.src;
  img.alt = item.caption || "";
  img.loading = "lazy";
  return img;
}

function openLightbox(item) {
  const lb = document.getElementById("lightbox");
  lb.innerHTML = "";
  lb.appendChild(mediaEl(item, true));
  lb.hidden = false;
}

async function init() {
  const res = await fetch("data.json?t=" + Date.now());
  const data = await res.json();

  document.title = data.site.name + " - Portfolio";
  document.getElementById("brand").textContent = data.site.name;
  document.getElementById("tagline").textContent = data.site.tagline;
  document.getElementById("about-text").textContent = data.site.about;
  document.getElementById("contact-text").textContent = data.site.contact;
  document.getElementById("reelTitle").textContent = data.reel.title;
  document.getElementById("worksTitle").textContent = data.worksTitle;

  const rv = document.getElementById("reelVideo");
  if (data.reel.video) {
    rv.poster = data.reel.poster;
    rv.src = data.reel.video;
  } else {
    rv.remove();
    const hero = document.getElementById("reel");
    hero.style.background = `url("${data.reel.poster}") center/cover no-repeat`;
  }

  const root = document.getElementById("sections");
  let lastYear = null;
  data.sections.forEach((sec) => {
    if (sec.year && sec.year !== lastYear) {
      const y = document.createElement("div");
      y.className = "year";
      y.textContent = sec.year;
      root.appendChild(y);
      lastYear = sec.year;
    }
    if (sec.title) {
      const t = document.createElement("div");
      t.className = "sec-title";
      t.textContent = sec.title;
      root.appendChild(t);
    }
    const grid = document.createElement("div");
    grid.className = "grid";
    sec.items.forEach((item) => {
      const fig = document.createElement("figure");
      fig.className = "item";
      fig.appendChild(mediaEl(item, false));
      if (item.caption) {
        const c = document.createElement("figcaption");
        c.textContent = item.caption;
        fig.appendChild(c);
      }
      fig.onclick = () => openLightbox(item);
      grid.appendChild(fig);
    });
    root.appendChild(grid);
  });

  document.getElementById("lightbox").onclick = (e) => {
    e.currentTarget.hidden = true;
    e.currentTarget.innerHTML = "";
  };
}

init();
