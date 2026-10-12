// ============================================================================
// Site interactions
//   1. Day / night theme switch (circle wipe where the browser supports it)
//   2. First-visit loader with a % counter
//   3. Smooth inertial scrolling (Lenis) + smooth anchor links
//   4. Circle cursor with hover states and labels ("View", "Drag", ...)
//   5. Magnetic buttons
//   6. Heading word reveals and fade-ins
//   7. 3D card tilt, count-up numbers, scroll progress, hide-on-scroll nav
//   8. Tools sphere with logo chips
//   9. The fixed 3D world (loaded after the page is ready)
//  10. Hero character: head and eyes follow the mouse, then he goes back to work
// Every effect respects "reduce motion" and touch screens.
// ============================================================================
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const html = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const onReady = (fn) => (html.classList.contains('is-ready') ? fn() : document.addEventListener('site:ready', fn, { once: true }));

/* ---------- 1. Theme ---------- */
function initTheme() {
  const buttons = [...document.querySelectorAll('[data-theme-toggle]')];
  const metaColor = document.querySelector('meta[name="theme-color"]');
  const label = (t) => (t === 'dark' ? 'Switch to day mode' : 'Switch to night mode');
  const apply = (t) => {
    html.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) { /* private mode */ }
    buttons.forEach((b) => b.setAttribute('aria-label', label(t)));
    if (metaColor) metaColor.setAttribute('content', t === 'dark' ? '#000000' : '#f6f7f9');
    document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
    (window.dataLayer = window.dataLayer || []).push({ event: 'theme_change', theme: t });
  };
  const current = () => (html.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  buttons.forEach((b) => b.setAttribute('aria-label', label(current())));
  if (metaColor) metaColor.setAttribute('content', current() === 'dark' ? '#000000' : '#f6f7f9');

  buttons.forEach((btn) => btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || reduced) { apply(next); return; }
    // Circle wipe that grows from the switch
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(() => apply(next));
    vt.ready.then(() => {
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  }));
}

/* ---------- 2. Loader ---------- */
function initLoader() {
  if (!html.classList.contains('is-loading')) {
    document.dispatchEvent(new Event('site:ready'));
    return;
  }
  const num = document.querySelector('[data-loader-num]');
  const bar = document.querySelector('.loader-bar');
  const t0 = performance.now();
  const minTime = 1300;
  let pageLoaded = document.readyState === 'complete';
  window.addEventListener('load', () => { pageLoaded = true; }, { once: true });

  const tick = (now) => {
    const time = now - t0;
    // Count to 90% by time, the last 10% waits for the page to finish loading
    let p = Math.min(time / minTime, 1) * 0.9;
    if (pageLoaded && time >= minTime) p = Math.min(1, 0.9 + (time - minTime) / 350 * 0.1);
    if (time > 4000) p = 1;
    const eased = 1 - Math.pow(1 - p, 2);
    if (num) num.textContent = String(Math.round(eased * 100)).padStart(3, '0');
    if (bar) bar.style.setProperty('--p', eased.toFixed(3));
    if (p < 1) { requestAnimationFrame(tick); return; }
    html.classList.add('is-leaving');
    html.classList.remove('is-loading');
    html.classList.add('is-ready');
    try { sessionStorage.setItem('intro-seen', '1'); } catch (e) { /* ignore */ }
    document.dispatchEvent(new Event('site:ready'));
    setTimeout(() => html.classList.remove('is-leaving'), 1100);
  };
  requestAnimationFrame(tick);
}

/* ---------- 3. Smooth scroll ---------- */
let lenis = null;
function initScroll() {
  if (!reduced) {
    lenis = new Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    window.lenis = lenis;
    if (html.classList.contains('is-loading')) {
      lenis.stop();
      onReady(() => lenis.start());
    }
  }
  // Smooth jump for "/#section" and "#section" links on the home page
  const navH = () => parseInt(getComputedStyle(html).getPropertyValue('--nav-h'), 10) || 72;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"], a[href^="/#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href.startsWith('/#') && location.pathname !== '/') return; // normal navigation
    const id = href.split('#')[1];
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    // Lenis already respects the CSS scroll-padding (the nav height)
    if (lenis) lenis.scrollTo(id === 'hero' ? 0 : target, { duration: 1.4 });
    else window.scrollTo({ top: id === 'hero' ? 0 : target.getBoundingClientRect().top + scrollY - navH(), behavior: reduced ? 'auto' : 'smooth' });
    history.pushState(null, '', '#' + id);
  });
}

/* ---------- 4. Cursor ---------- */
function initCursor() {
  if (!finePointer) return;
  const dot = document.createElement('div');
  const ring = document.createElement('div');
  dot.className = 'cursor-dot is-hidden';
  ring.className = 'cursor-ring is-hidden';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  ring.appendChild(text);
  document.body.append(dot, ring);
  html.classList.add('has-cursor');

  let x = -100, y = -100, rx = -100, ry = -100, raf = 0, seen = false;
  const follow = reduced ? 1 : 0.2;
  const loop = () => {
    rx += (x - rx) * follow;
    ry += (y - ry) * follow;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
  };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!seen) { rx = x; ry = y; seen = true; }
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    dot.classList.remove('is-hidden'); ring.classList.remove('is-hidden');
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { dot.classList.add('is-hidden'); ring.classList.add('is-hidden'); });
  window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
  window.addEventListener('pointerup', () => ring.classList.remove('is-down'));

  const setState = (el) => {
    ring.classList.remove('is-link', 'is-label');
    dot.classList.remove('is-link');
    if (seen) { ring.classList.remove('is-hidden'); dot.classList.remove('is-hidden'); }
    if (!el) return;
    if (el.matches('input, textarea, select')) { ring.classList.add('is-hidden'); dot.classList.add('is-hidden'); return; }
    const lbl = el.getAttribute('data-cursor');
    if (lbl) { text.textContent = lbl; ring.classList.add('is-label'); dot.classList.add('is-link'); return; }
    ring.classList.add('is-link'); dot.classList.add('is-link');
  };
  document.addEventListener('pointerover', (e) => {
    setState(e.target.closest('[data-cursor], a, button, input, textarea, select, label, .logo-tile'));
  });
}

/* ---------- 5. Magnetic buttons ---------- */
function initMagnet() {
  if (!finePointer || reduced) return;
  document.querySelectorAll('[data-magnet]').forEach((el) => {
    const strength = el.classList.contains('theme-toggle') ? 0.35 : 0.28;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.classList.add('is-magnet');
      el.style.setProperty('--mx', `${dx * strength}px`);
      el.style.setProperty('--my', `${dy * strength * 1.3}px`);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-magnet');
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    });
  });
}

/* ---------- 6. Reveals ---------- */
function initReveals() {
  if (reduced || !('IntersectionObserver' in window)) return;
  const heads = document.querySelectorAll('.section-head h2, .cs-page-title, .sub-head, .values h3, .faq h3');
  heads.forEach((h) => {
    if (h.dataset.split) return;
    h.dataset.split = '1';
    // Gradient text must move onto each word, or it disappears when words move
    const grad = [...h.classList].find((c) => c.startsWith('grad-'));
    if (grad) h.classList.remove(grad);
    const words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span class="wi${grad ? ' ' + grad : ''}" style="--i:${i}">${w.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span></span>`).join(' ');
    h.classList.add('split');
  });
  html.classList.add('reveal-on');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });
  onReady(() => document.querySelectorAll('.split, [data-fade]').forEach((el) => io.observe(el)));
}

/* ---------- 7a. 3D tilt ---------- */
function initTilt() {
  if (reduced || !finePointer) return;
  const sel = '.stat, .ww-card, .skill-card, .cert, .result, .cs-card, .faq-item, .info-card, .step, .side-highlight, .cs-snapshot, .job, .promise';
  document.querySelectorAll(sel).forEach((el) => {
    el.classList.add('tilt');
    const max = el.matches('.cs-snapshot, .skill-card, .side-highlight, .job, .ww-card') ? 3.5 : 8;
    let raf = 0;
    el.addEventListener('pointerenter', () => el.classList.add('is-tilting'));
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`);
        el.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`);
        el.style.setProperty('--gx', `${px * 100}%`);
        el.style.setProperty('--gy', `${py * 100}%`);
      });
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
}

/* ---------- 7b. Count-up numbers ---------- */
function initCountUp() {
  if (reduced) return;
  const run = (el) => {
    const final = el.dataset.final || el.textContent.trim();
    el.dataset.final = final;
    const m = final.match(/^([^\d]*)(\d[\d,]*\.?\d*)(.*)$/);
    if (!m) return;
    const [, pre, num, post] = m;
    const target = parseFloat(num.replace(/,/g, ''));
    const decimals = (num.split('.')[1] || '').length;
    const t0 = performance.now(), dur = 1500;
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = pre + (target * eased).toFixed(decimals) + post;
      if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting && !en.target.dataset.counted) { en.target.dataset.counted = '1'; run(en.target); }
    });
  }, { threshold: 0.6 });
  onReady(() => setTimeout(() => {
    document.querySelectorAll('.stat-value, .result-value, .snap-value, .cs-card-value').forEach((el) => io.observe(el));
  }, 500));
  document.querySelectorAll('.cs-tab').forEach((tab) => tab.addEventListener('click', () => {
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (panel) panel.querySelectorAll('.result-value, .snap-value').forEach(run);
  }));
}

/* ---------- 7c. Scroll progress, nav hide, marquee skew ---------- */
function initScrollUi() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  const nav = document.getElementById('nav');
  const menu = document.getElementById('nav-mobile');
  const marquee = document.querySelector('.marquee');
  let lastY = scrollY, skew = 0, raf = 0, pointerNearTop = false;
  // Bring the hidden nav back when the mouse goes to the top of the screen
  window.addEventListener('pointermove', (e) => {
    const near = e.pointerType === 'mouse' && e.clientY < 90;
    if (near !== pointerNearTop) { pointerNearTop = near; if (near && nav) nav.classList.remove('is-hidden'); }
  }, { passive: true });

  const update = () => {
    const y = scrollY;
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
    if (nav) {
      const menuOpen = menu && !menu.hasAttribute('hidden');
      if (y < lastY - 2 || y < 400 || menuOpen || pointerNearTop) nav.classList.remove('is-hidden');
      else if (y > lastY + 2) nav.classList.add('is-hidden');
    }
    if (marquee && !reduced) {
      skew += ((y - lastY) * 0.35 - skew) * 0.2;
      skew = Math.max(-10, Math.min(10, skew));
      marquee.style.setProperty('--skew', `${skew.toFixed(2)}deg`);
      clearTimeout(raf);
      raf = setTimeout(() => marquee.style.setProperty('--skew', '0deg'), 120);
    }
    lastY = y;
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ---------- 8. Tools sphere: logo chips on a ball that spins and can be dragged ---------- */
function initSphere() {
  const box = document.querySelector('[data-sphere]');
  if (!box || reduced) return;
  const chips = [...box.querySelectorAll('.sphere-chip')];
  const n = chips.length;
  if (!n) return;
  box.classList.add('is-live');
  const fallback = document.querySelector('[data-sphere-fallback]');
  if (fallback) fallback.hidden = true;

  // Spread the chips evenly over the ball
  const pts = chips.map((_, i) => {
    const y = 1 - ((i + 0.5) * 2) / n, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
  let radius = 220, radiusX = 270;
  const size = () => {
    radius = Math.min(box.clientWidth * 0.36, box.clientHeight * 0.42);
    radiusX = Math.max(90, Math.min(radius * 1.25, box.clientWidth / 2 - 62));   // wider than tall, but never off the screen
  };
  size();
  window.addEventListener('resize', size);

  const idle = 0.0028;
  let ax = 0.25, ay = 0, vx = 0, vy = idle;
  let dragging = false, lx = 0, ly = 0, hoverX = 0, hoverY = 0, hx = 0, hy = 0;

  const render = () => {
    hx += (hoverX - hx) * 0.08; hy += (hoverY - hy) * 0.08;
    const cx = Math.cos(ax + hy), sx = Math.sin(ax + hy), cy = Math.cos(ay + hx), sy = Math.sin(ay + hx);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = pts[i];
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
      const depth = (z2 + 1) / 2;
      const el = chips[i];
      el.style.transform = `translate(-50%, -50%) translate3d(${(x1 * radiusX).toFixed(1)}px, ${(y2 * radius).toFixed(1)}px, 0) scale(${(0.62 + depth * 0.5).toFixed(3)})`;
      el.style.opacity = (0.16 + depth * depth * 0.84).toFixed(2);
      el.style.zIndex = String(Math.round(depth * 100));
      el.classList.toggle('front', depth > 0.8);
    }
  };

  let running = false;
  const loop = () => {
    if (!running) return;
    if (!dragging) { ay += vy; ax += vx; vx *= 0.95; vy += (idle - vy) * 0.02; }
    render();
    requestAnimationFrame(loop);
  };
  render();

  box.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; box.setPointerCapture(e.pointerId); box.classList.add('grabbing'); });
  box.addEventListener('pointermove', (e) => {
    if (!dragging) {
      const r = box.getBoundingClientRect();
      hoverX = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
      hoverY = -((e.clientY - r.top) / r.height - 0.5) * 0.5;
      return;
    }
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    ay += dx * 0.006; ax -= dy * 0.006;
    vy = dx * 0.0015; vx = -dy * 0.0015;
  });
  box.addEventListener('pointerleave', () => { hoverX = 0; hoverY = 0; });
  const end = () => { dragging = false; box.classList.remove('grabbing'); };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);

  new IntersectionObserver(([en]) => {
    if (en.isIntersecting && !running) { running = true; requestAnimationFrame(loop); }
    else if (!en.isIntersecting) running = false;
  }).observe(box);
}

let webglOk = null;
function hasWebGL() {
  if (webglOk === null) {
    try { const c = document.createElement('canvas'); webglOk = !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch (e) { webglOk = false; }
  }
  return webglOk;
}

/* ---------- 9. 3D world ---------- */
function initWorld() {
  const canvas = document.querySelector('canvas.world');
  if (!canvas) return;
  if (!hasWebGL()) return;
  const go = () => import('./world3d.js')
    .then((m) => m.initWorld(canvas, { reduced }))
    .catch(() => { /* the page still works without 3D */ });
  // Start loading the 3D code right away; it fades in when ready
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 600 });
  else setTimeout(go, 200);
}


/* ---------- 10. Hero character: head and eyes follow the mouse ---------- */
function initCharacter() {
  const el = document.querySelector('[data-char]');
  if (!el) return;
  const stage = el.querySelector('.char-stage');
  const canvas = el.querySelector('[data-char-canvas]');
  let live = null;

  // Speech bubble: he asks the visitor short questions, one after another.
  // A new line shows when he looks up from the laptop, every few seconds while
  // the mouse moves, and on each click.
  const bubble = el.querySelector('[data-bubble]');
  let next = null;
  if (bubble) {
    let lines = [];
    try { lines = JSON.parse(bubble.dataset.lines || '[]'); } catch (e) { /* ignore */ }
    const text = bubble.querySelector('[data-bubble-text]');
    let i = 0;
    // The line types out letter by letter, and his mouth moves at the same speed.
    // The letters not typed yet are there but invisible, so the bubble does not change size.
    const PER = 58;
    let timer = 0;
    const type = (line) => {
      const chars = Array.from(line);
      clearInterval(timer);
      if (reduced) { text.textContent = line; return; }
      const done = document.createElement('span'), rest = document.createElement('span');
      rest.style.visibility = 'hidden';
      rest.textContent = line;
      text.replaceChildren(done, rest);
      let n = 0;
      timer = setInterval(() => {
        n++;
        done.textContent = chars.slice(0, n).join('');
        rest.textContent = chars.slice(n).join('');
        if (n >= chars.length) clearInterval(timer);
      }, PER);
      if (live) live.speak(line, PER);
    };
    next = (clicked) => {
      if (lines.length < 2) return;
      i = (i + 1) % lines.length;
      bubble.setAttribute('aria-label', lines[i]);
      type(lines[i]);
      if (clicked) (window.dataLayer = window.dataLayer || []).push({ event: 'character_click', bubble_text: lines[i] });
    };
    el.addEventListener('click', () => { if (live) live.nod(); next(true); });
  }

  // "Reduce motion" or no WebGL: the still picture stays
  if (reduced || !canvas || !hasWebGL()) return;
  // The layers sit in the same folder as the still picture
  const still = el.querySelector('.char-still');
  const base = still ? still.src.slice(0, still.src.lastIndexOf('/') + 1) : '/character/';
  import('./character3d.js')
    .then((m) => m.initCharacter3D({ stage, canvas, base, touch: !finePointer, onSpeak: () => { if (next && html.classList.contains('is-ready')) next(false); } }))
    .then((api) => { live = api; window.__char = api; el.classList.add('is-live'); })
    .catch(() => { /* the still picture stays */ });
}

/* ---------- Run ---------- */
initTheme();
initScroll();
initCursor();
initMagnet();
initReveals();
initTilt();
initCountUp();
initScrollUi();
initSphere();
initCharacter();
initWorld();
initLoader();
