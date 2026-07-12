const nav = document.querySelector('.site-nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}
const pieces = document.querySelectorAll('.piece');
if (pieces.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  pieces.forEach((p) => io.observe(p));
}

const tabs = document.querySelectorAll('.tab');
const galleries = document.querySelectorAll('[data-gallery]');
if (tabs.length) {
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const cat = tab.dataset.cat;
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      galleries.forEach((g) => {
        g.hidden = g.dataset.gallery !== cat;
      });
    });
  });
}

// Lightbox: click a piece's image to view it larger, with prev/next
// for pieces that have multiple photos.
(function () {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const lightboxImg = lightbox.querySelector('.lightbox-img');
  const btnClose = lightbox.querySelector('.lightbox-close');
  const btnPrev = lightbox.querySelector('.lightbox-prev');
  const btnNext = lightbox.querySelector('.lightbox-next');

  let currentList = [];
  let currentIndex = 0;
  let currentGroup = null;

  function show(index) {
    currentIndex = (index + currentList.length) % currentList.length;
    lightboxImg.src = currentList[currentIndex].src;
    lightboxImg.alt = currentList[currentIndex].alt || '';
    const multiple = currentList.length > 1;
    btnPrev.hidden = !multiple;
    btnNext.hidden = !multiple;

    if (currentGroup) {
      const thumbs = currentGroup.querySelectorAll('.thumb');
      const main = currentGroup.querySelector('.piece-main');
      if (thumbs[currentIndex]) {
        main.src = currentList[currentIndex].src;
        thumbs.forEach((t) => t.classList.remove('active'));
        thumbs[currentIndex].classList.add('active');
      }
    }
  }

  function open(list, startIndex, group) {
    currentList = list;
    currentGroup = group || null;
    show(startIndex);
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
  }

  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', () => show(currentIndex - 1));
  btnNext.addEventListener('click', () => show(currentIndex + 1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(currentIndex - 1);
    if (e.key === 'ArrowRight') show(currentIndex + 1);
  });

  document.querySelectorAll('.piece').forEach((piece) => {
    const isGroup = piece.classList.contains('piece-group');
    const imgEl = piece.querySelector(isGroup ? '.piece-main' : '.piece-frame img');
    if (!imgEl) return;

    let list;
    if (isGroup) {
      list = Array.from(piece.querySelectorAll('.thumb')).map((t) => ({
        src: t.dataset.src,
        alt: imgEl.alt,
      }));
    } else {
      list = [{ src: imgEl.getAttribute('src'), alt: imgEl.alt }];
    }

    imgEl.addEventListener('click', () => {
      let startIndex = 0;
      if (isGroup) {
        const active = piece.querySelector('.thumb.active');
        const thumbs = Array.from(piece.querySelectorAll('.thumb'));
        startIndex = active ? thumbs.indexOf(active) : 0;
      }
      open(list, startIndex, isGroup ? piece : null);
    });
  });
})();
document.querySelectorAll('.piece-group').forEach((group) => {
  const main = group.querySelector('.piece-main');
  const thumbs = group.querySelectorAll('.thumb');
  thumbs.forEach((thumb) => {
    thumb.addEventListener('click', (e) => {
      e.preventDefault();
      main.src = thumb.dataset.src;
      thumbs.forEach((t) => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });
});

// Collage masonry: pack items into columns by always filling the
// shortest column next, so there's no leftover gap at the bottom.
function layoutCollageMasonry(container) {
  const items = Array.from(container.querySelectorAll('.collage-item'));
  if (!items.length) return;

  const width = container.getBoundingClientRect().width;
  let cols = 3;
  if (width < 560) cols = 1;
  else if (width < 900) cols = 2;

  // Pack tallest items first (classic bin-packing heuristic) so the
  // greedy shortest-column placement below ends up close to balanced.
  const sorted = items.slice().sort((a, b) => {
    const ra = a.dataset.ratio ? parseFloat(a.dataset.ratio) : 1.25;
    const rb = b.dataset.ratio ? parseFloat(b.dataset.ratio) : 1.25;
    return rb - ra;
  });

  const colEls = [];
  const colHeights = new Array(cols).fill(0);
  const frag = document.createDocumentFragment();
  for (let i = 0; i < cols; i++) {
    const col = document.createElement('div');
    col.className = 'collage-col';
    colEls.push(col);
    frag.appendChild(col);
  }

  sorted.forEach((item) => {
    let shortest = 0;
    for (let i = 1; i < cols; i++) {
      if (colHeights[i] < colHeights[shortest]) shortest = i;
    }
    colEls[shortest].appendChild(item);
    const ratio = item.dataset.ratio ? parseFloat(item.dataset.ratio) : 1.25;
    colHeights[shortest] += (width / cols) * ratio + 24;
  });

  container.innerHTML = '';
  container.appendChild(frag);
}

const collage = document.querySelector('.collage');
if (collage) {
  const items = Array.from(collage.querySelectorAll('.collage-item'));
  const run = () => layoutCollageMasonry(collage);

  // Store each image's aspect ratio (height/width) once loaded so column
  // heights can be estimated accurately without waiting on layout thrash.
  let pending = items.length;
  const onReady = () => {
    pending -= 1;
    if (pending <= 0) run();
  };
  items.forEach((item) => {
    const img = item.querySelector('img');
    const setRatio = () => {
      if (img.naturalWidth && img.naturalHeight) {
        item.dataset.ratio = img.naturalHeight / img.naturalWidth;
      }
      onReady();
    };
    if (img.complete && img.naturalWidth) {
      setRatio();
    } else {
      img.addEventListener('load', setRatio, { once: true });
      img.addEventListener('error', onReady, { once: true });
    }
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(run, 200);
  });
}
