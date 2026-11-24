/* Las raíces que perdimos · Raúl Cruz Muñoz (ID 00576757)
   Lee los CSV de /data, dibuja el árbol (vista general), las raíces (exploración) y la tarjeta (detalle). */
(function () {
  'use strict';

  // ---------- configuración del alfabeto visual (Entrega 2) ----------
  const REGIONS = [
    { name: 'Península de Yucatán', light: '#5CC2B5', dark: '#24665E' },
    { name: 'Sur y Golfo', light: '#E6D27A', dark: '#8C7A2E' },
    { name: 'Norte', light: '#E39A4C', dark: '#94571F' },
    { name: 'Occidente y Pacífico', light: '#D2604E', dark: '#7E2E22' },
    { name: 'Centro', light: '#BDB2A6', dark: '#6E6257' },
  ];
  const REG = Object.fromEntries(REGIONS.map(r => [r.name, r]));
  const ROOT_W = 16;           // ancho fijo de cada raíz (px)
  const CANCHA_HA = 0.714;     // cancha de futbol profesional: 105 m × 68 m
  const SVGNS = 'http://www.w3.org/2000/svg';

  // ---------- utilidades ----------
  const nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf1 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const setHTML = (key, val) => document.querySelectorAll(`[data-fill-html="${key}"]`).forEach(n => { n.textContent = val; });
  const fill = (key, val) => document.querySelectorAll(`[data-fill="${key}"]`).forEach(n => { n.textContent = val; });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');
  function countUp(node, to, suffix, dec, dur = 1400, delay = 0) {
    if (!node) return;
    const f = new Intl.NumberFormat('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (reduceMotion) { node.textContent = f.format(to) + suffix; return; }
    setTimeout(() => {
      const t0 = performance.now();
      (function step(now) {
        const k = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - k, 3);
        node.textContent = f.format(to * e) + suffix;
        if (k < 1) requestAnimationFrame(step); else node.textContent = f.format(to) + suffix;
      })(t0);
    }, delay);
  }
  function setCount(key, to, suffix, dec) {
    document.querySelectorAll(`[data-count="${key}"]`).forEach(n => {
      n.textContent = new Intl.NumberFormat('es-MX', { maximumFractionDigits: dec }).format(to) + suffix;
      n.dataset.to = to; n.dataset.suffix = suffix; n.dataset.dec = dec;
    });
  }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // Lector de CSV (RFC 4180: comillas, comas dentro de campos, BOM)
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = []; let row = []; let field = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = ''; if (row.some(v => v !== '')) rows.push(row); row = [];
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    const head = rows.shift();
    return rows.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]])));
  }
  const NUMERIC = ['Posicion', 'Periodo_inicio', 'Periodo_fin', 'Anio_mayor_perdida', 'Perdida_anio_mayor_ha', 'Perdida_ha', 'Perdida_miles_ha', 'Porcentaje_nacional', 'Perdida_bosque_primario_ha', 'Perdida_por_incendios_ha', 'Cobertura_arborea_2000_ha', 'Porcentaje_cobertura_perdida', 'Emisiones_MtCO2e', 'Altura_Barra_PX', 'Perdida_municipio_ha', 'Anio'];
  const typed = (r) => { for (const k of NUMERIC) if (k in r) r[k] = Number(r[k]); return r; };

  async function load(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(path);
    return parseCSV(await res.text()).map(typed);
  }

  // ---------- arranque ----------
  Promise.all([load('data/datos_limpios.csv'), load('data/contexto.csv'), load('data/perdida_anual_mexico.csv')])
    .then(([estados, contexto, anual]) => init(estados, contexto, anual))
    .catch((e) => { console.error(e); $('#loadError').hidden = false; });

  function init(estados, contexto, anual) {
    estados.sort((a, b) => a.Posicion - b.Posicion);
    const ctx = Object.fromEntries(contexto.map(c => [c.Estado, c]));
    anual.sort((a, b) => a.Anio - b.Anio);

    const total = estados.reduce((s, r) => s + r.Perdida_ha, 0);
    const cover = estados.reduce((s, r) => s + r.Cobertura_arborea_2000_ha, 0);
    const leafHa = cover / 100;
    const maxAlt = Math.max(...estados.map(r => r.Altura_Barra_PX));
    const factor = Math.round((500 / Math.max(...estados.map(r => r.Perdida_miles_ha))) * 1e4) / 1e4;
    const relMax = Math.max(...estados.map(r => r.Porcentaje_cobertura_perdida));
    const relFactor = Math.round((500 / relMax) * 1e4) / 1e4;
    const top5 = estados.slice(0, 5).reduce((s, r) => s + r.Perdida_ha, 0);
    const pen = estados.filter(r => r.Region === 'Península de Yucatán').reduce((s, r) => s + r.Perdida_ha, 0);
    const last5 = anual.slice(-5);
    const rate = last5.reduce((s, r) => s + r.Perdida_ha, 0) / last5.length;
    const remain = cover - total;
    const yearEnd = anual[anual.length - 1].Anio + Math.ceil(remain / rate);

    fill('totalM', nf2.format(total / 1e6));
    fill('pctLost', nf1.format((total / cover) * 100));
    fill('leafHa', nf0.format(leafHa));
    setCount('top5Pct', (top5 / total) * 100, ' %', 0);
    setCount('penPct', (pen / total) * 100, ' %', 0);
    fill('rate', nf0.format(rate));
    fill('remainM', nf1.format(remain / 1e6));
    fill('yearEnd', String(yearEnd));

    buildLegend();
    const tree = buildTree($('#tree'), { leaves: true });
    const hypoTree = buildTree($('#deadTree'), { leaves: true, hypo: true });
    setupStory(tree, anual, leafHa, cover, total);
    const roots = buildRoots(estados, ctx, { factor, relFactor, maxAlt });
    setupLegendVisibility();
    setupHypo(hypoTree, { total, cover, leafHa, rate, yearEnd, lastYear: anual[anual.length - 1].Anio });
    setupLive(rate);
    countUp($('#heroCount'), total / 1e6, '', 2, 1900, 700);
    return roots;
  }

  // ---------- leyenda ----------
  function buildLegend() {
    document.querySelectorAll('[data-legend-colors]').forEach(u => { u.innerHTML = REGIONS.map(r => `<li><i style="background:${r.light}"></i>${r.name}</li>`).join(''); });
  }
  function setupLegendVisibility() {
    const legend = $('#legendTree'); const btn = $('#legendToggle');
    btn.addEventListener('click', () => {
      const open = !legend.classList.contains('is-open');
      legend.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open));
      if (open && window.scrollY < $('#arbol').offsetTop) $('#arbol').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }
  // ---------- fondo de video por sección, progreso, apariciones y botones ----------
  (function setupPage() {
    const stage = $('#bgStage');
    const videos = [...stage.querySelectorAll('video')];
    const sections = [...document.querySelectorAll('section[data-bg]')];
    const navMap = { arbol: 'arbol', descent: 'raices', raices: 'raices', hipotesis: 'hipotesis', conclusion: 'hipotesis', fuentes: 'fuentes' };
    const navLinks = [...document.querySelectorAll('.nav a')];
    const pauseTimers = new Map();
    let current = null; let currentSec = null;
    const order = ['portada', 'arbol', 'raices', 'cierre'];
    function warm(key) { const v = videos.find(x => x.dataset.bg === key); if (v && v.preload !== 'auto') { v.preload = 'auto'; v.load(); } }
    function activate(key, gray) {
      stage.classList.toggle('is-gray', !!gray);
      if (key === current) return; current = key;
      videos.forEach(v => {
        const on = v.dataset.bg === key;
        v.classList.toggle('is-on', on);
        clearTimeout(pauseTimers.get(v));
        if (on) { warm(key); const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
        else pauseTimers.set(v, setTimeout(() => v.pause(), 1800));
      });
      const nx = order[order.indexOf(key) + 1]; if (nx) setTimeout(() => warm(nx), 1500);
    }
    function onScroll() {
      const mid = window.innerHeight * 0.55;
      const sec = sections.find(s => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; }) || sections[0];
      if (sec !== currentSec) {
        currentSec = sec;
        activate(sec.dataset.bg, sec.dataset.bgGray);
        const navKey = navMap[sec.id];
        navLinks.forEach(l => l.classList.toggle('is-current', l.getAttribute('href') === '#' + navKey));
      }
      const max = document.documentElement.scrollHeight - window.innerHeight;
      $('#progressBar').style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      // raíz que baja en la transición
      const ds = $('#descent'); const dp = $('#descentPath');
      if (ds && dp) {
        const r = ds.getBoundingClientRect(); const len = dp.__len || (dp.__len = dp.getTotalLength());
        const k = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (r.height + window.innerHeight * 0.3)));
        dp.style.strokeDasharray = len; dp.style.strokeDashoffset = len * (1 - k);
      }
    }
    let tick = false;
    window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(() => { tick = false; onScroll(); }); } }, { passive: true });
    window.addEventListener('resize', onScroll);
    document.addEventListener('visibilitychange', () => {
      const v = videos.find(x => x.dataset.bg === current);
      if (v) { if (document.hidden) v.pause(); else { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); } }
    });
    // un video que no carga simplemente no se muestra
    videos.forEach(v => v.addEventListener('error', () => v.remove(), true));
    onScroll();

    // aparición al entrar en pantalla (+ contadores)
    const io = new IntersectionObserver((ents) => ents.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in'); io.unobserve(e.target);
      e.target.querySelectorAll('[data-count]').forEach(n => countUp(n, Number(n.dataset.to), n.dataset.suffix, Number(n.dataset.dec), 1400));
    }), { threshold: 0.2 });
    document.querySelectorAll('.reveal').forEach(n => io.observe(n));

    // onda al presionar botones
    document.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.chip, .segmented button, .replay, .cta');
      if (!b || reduceMotion) return;
      const r = b.getBoundingClientRect(); const s = Math.max(r.width, r.height);
      const sp = document.createElement('span'); sp.className = 'ripple';
      sp.style.width = sp.style.height = `${s}px`; sp.style.left = `${e.clientX - r.left - s / 2}px`; sp.style.top = `${e.clientY - r.top - s / 2}px`;
      b.appendChild(sp); setTimeout(() => sp.remove(), 650);
    });
  })();

  // ---------- contador en vivo (conclusión) ----------
  function setupLive(rate) {
    const m2s = (rate * 10000) / (365.25 * 24 * 3600);
    fill('m2s', nf1.format(m2s));
    const t0 = performance.now();
    setInterval(() => {
      const m2 = ((performance.now() - t0) / 1000) * m2s;
      $('#liveM2').textContent = nf0.format(m2);
      $('#liveCanchas').textContent = nf1.format(m2 / 7140);
    }, 120);
  }

  // ---------- escenario hipotético interactivo ----------
  function setupHypo(tree, { total, cover, leafHa, rate, yearEnd, lastYear }) {
    const range = $('#simRange'); range.min = lastYear; range.max = yearEnd; range.value = lastYear;
    const svg = tree.svg;
    function update(year) {
      const cum = Math.min(cover, total + (year - lastYear) * rate);
      const fallen = Math.min(100, Math.floor(cum / leafHa + 1e-9));
      tree.fallers.forEach((f, k) => {
        const down = k < fallen;
        f.g.classList.toggle('is-fallen', down);
        f.move.style.transform = down ? `translate(${(f.tx - f.x).toFixed(1)}px, ${(f.ty - f.y).toFixed(1)}px) rotate(${(-f.a + (k % 2 ? 7 : -7)).toFixed(1)}deg)` : '';
      });
      svg.style.filter = `saturate(${(1 - 0.8 * fallen / 100).toFixed(2)})`;
      $('#simYear').textContent = year;
      $('#simLeaves').textContent = 100 - fallen;
      $('#simPct').textContent = nf1.format(Math.max(0, (cover - cum) / cover * 100));
    }
    range.addEventListener('input', () => { stop(); update(Number(range.value)); });
    let raf = null;
    const btn = $('#simPlay');
    const icon = (playing) => { btn.innerHTML = playing ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 4 H8.5 V16 H5 Z M11.5 4 H15 V16 H11.5 Z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4 L16 10 L6 16 Z" fill="currentColor"/></svg>'; btn.setAttribute('aria-label', playing ? 'Pausar la proyección' : 'Reproducir la proyección'); };
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; icon(false); }
    btn.addEventListener('click', () => {
      if (raf) { stop(); return; }
      if (Number(range.value) >= yearEnd) range.value = lastYear;
      const startY = Number(range.value); const t0 = performance.now(); const dur = 9000 * (yearEnd - startY) / (yearEnd - lastYear);
      icon(true);
      (function step(now) {
        const k = Math.min(1, (now - t0) / dur);
        const y = Math.round(startY + (yearEnd - startY) * k);
        if (String(y) !== range.value) { range.value = y; update(y); }
        if (k < 1) raf = requestAnimationFrame(step); else stop();
      })(t0);
    });
    update(lastYear);
  }

  // ---------- árbol (vista general) ----------
  function treeGeometry() {
    const rnd = mulberry32(11);
    const segs = []; const tips = [];
    (function growAll() {
      const grow = (x, y, ang, len, w, depth) => {
        const x2 = x + len * Math.cos(ang * Math.PI / 180); const y2 = y - len * Math.sin(ang * Math.PI / 180);
        segs.push([x, y, x2, y2, w, w * 0.7]);
        if (depth === 0 || len < 26) { tips.push([x2, y2]); return; }
        const spread = depth > 1 ? [-28, 26] : [-34, 0, 32];
        for (const sp of spread) grow(x2, y2, ang + sp + (rnd() * 18 - 9), len * (0.70 + rnd() * 0.10), w * 0.68, depth - 1);
      };
      for (const [a0, l0] of [[90, 150], [122, 128], [58, 128]]) grow(600, 510, a0 + (rnd() * 8 - 4), l0, 30, 5);
    })();
    // 100 hojas cerca de las puntas de las ramas, sin encimarse
    const leaves = []; let tries = 0;
    while (leaves.length < 100 && tries < 400000) {
      tries++;
      const [tx, ty] = tips[tries % tips.length];
      const g = () => { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
      const x = tx + g() * 30; const y = ty + g() * 26;
      if (y > 500 || y < 30 || x < 190 || x > 1010) continue;
      if (leaves.every(([a, b]) => (x - a) ** 2 + (y - b) ** 2 >= 35 ** 2)) leaves.push([x, y, rnd() * 140 - 70]);
    }
    return { segs, leaves };
  }
  const GEO = treeGeometry();
  const GROUND = 820;
  const TRUNK = `M 536 ${GROUND} C 556 ${GROUND - 40} 566 710 572 630 C 576 570 578 540 580 500 L 620 500 C 622 540 624 570 628 630 C 634 710 644 ${GROUND - 40} 664 ${GROUND} Z`;
  const LEAF_D = 'M -23 0 C -11.5 -9.2 11.5 -9.7 23 0 C 11.5 8.7 -11.5 9.2 -23 0 Z';

  function defs(svg) {
    const d = el('defs', {}, svg);
    d.innerHTML = `
      <linearGradient id="gLeaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9BD27A"/><stop offset=".5" stop-color="#5DA14A"/><stop offset="1" stop-color="#2F6A2C"/></linearGradient>
      <linearGradient id="gDry" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9A86E"/><stop offset=".55" stop-color="#A9743F"/><stop offset="1" stop-color="#6E4724"/></linearGradient>
      <linearGradient id="gTrunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1E140E"/><stop offset=".28" stop-color="#5C4231"/><stop offset=".45" stop-color="#6E5240"/><stop offset=".75" stop-color="#3B2A1F"/><stop offset="1" stop-color="#1A110B"/></linearGradient>
      <linearGradient id="gDead" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3A3836"/><stop offset=".4" stop-color="#8A8783"/><stop offset="1" stop-color="#3A3836"/></linearGradient>
      <linearGradient id="gSoil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2A1D" stop-opacity=".95"/><stop offset="1" stop-color="#1A120C" stop-opacity="0"/></linearGradient>
      <linearGradient id="gFadeX" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".22" stop-color="#fff"/><stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="mFadeX" maskUnits="userSpaceOnUse" x="0" y="0" width="1200" height="900"><rect width="1200" height="900" fill="url(#gFadeX)"/></mask>
      <radialGradient id="gGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3E6B3A" stop-opacity=".5"/><stop offset="1" stop-color="#3E6B3A" stop-opacity="0"/></radialGradient>
      <filter id="fBark" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035 0.42" numOctaves="3" seed="4" result="n"/>
        <feDiffuseLighting in="n" surfaceScale="2.6" lighting-color="#ffffff" result="l"><feDistantLight azimuth="210" elevation="38"/></feDiffuseLighting>
        <feComposite in="l" in2="SourceAlpha" operator="in" result="lc"/>
        <feBlend in="SourceGraphic" in2="lc" mode="multiply"/>
      </filter>`;
  }

  function buildTree(svg, { leaves, dead, hypo }) {
    defs(svg);
    if (!dead) el('ellipse', { cx: 600, cy: 300, rx: 520, ry: 360, fill: 'url(#gGlow)' }, svg);
    const soil = el('g', { mask: 'url(#mFadeX)' }, svg);
    el('rect', { x: 0, y: GROUND, width: 1200, height: 900 - GROUND, fill: 'url(#gSoil)' }, soil);
    el('line', { x1: 0, y1: GROUND, x2: 1200, y2: GROUND, stroke: dead ? '#8A8580' : '#7A6248', 'stroke-width': 2 }, soil);
    const links = el('g', { class: 'links' }, svg);
    const wood = el('g', { class: 'wood' }, svg);
    const woodFill = dead ? '#77736E' : '#5E4636';
    for (const [x1, y1, x2, y2, w1, w2] of GEO.segs) {
      const L = Math.hypot(x2 - x1, y2 - y1) || 1; const nx = -(y2 - y1) / L; const ny = (x2 - x1) / L;
      const p = [[x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x2 + nx * w2 / 2, y2 + ny * w2 / 2], [x2 - nx * w2 / 2, y2 - ny * w2 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2]];
      el('polygon', { points: p.map(q => q.map(v => v.toFixed(1)).join(',')).join(' '), fill: woodFill }, wood);
      el('circle', { cx: x2.toFixed(1), cy: y2.toFixed(1), r: (w2 / 2).toFixed(1), fill: woodFill }, wood);
    }
    el('path', { d: TRUNK, fill: dead ? 'url(#gDead)' : woodFill }, wood);
    if (!leaves) return null;

    const layer = el('g', { class: 'leaves' }, svg);
    // las 10 hojas que caen: las más exteriores, emparejadas con su lugar en el suelo de izquierda a derecha
    const byOuter = GEO.leaves.map((l, i) => ({ i, d: Math.hypot(l[0] - 600, (l[1] - 280) * 1.3) })).sort((a, b) => b.d - a.d);
    const falling = byOuter.slice(0, 10).map(o => o.i).sort((a, b) => GEO.leaves[a][0] - GEO.leaves[b][0]);
    const spots = [300, 352, 404, 456, 508, 692, 744, 796, 848, 900];
    const order = [4, 5, 3, 6, 2, 7, 1, 8, 0, 9]; // orden de caída: alterna izquierda y derecha
    const nodes = GEO.leaves.map(([x, y, a], i) => {
      const g = el('g', { class: 'leaf', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, layer);
      const move = el('g', { class: 'move' }, g);
      const pop = el('g', { class: 'pop' }, move);
      pop.style.animationDelay = `${(0.15 + (i % 25) * 0.035 + Math.floor(i / 25) * 0.08).toFixed(2)}s`;
      const rot = el('g', { transform: `rotate(${a.toFixed(1)})` }, pop);
      const alive = el('g', { class: 'alive' }, rot);
      el('path', { d: LEAF_D, class: 'leaf-shape alive' }, alive);
      el('path', { d: 'M -21 0 L 20 0', class: 'leaf-vein' }, alive);
      const dry = el('g', { class: 'dry' }, rot);
      el('path', { d: LEAF_D, class: 'leaf-shape dry' }, dry);
      el('path', { d: 'M -21 0 L 20 0', class: 'leaf-vein dark' }, dry);
      return { g, move, x, y, a };
    });
    if (hypo) {
      // las 100 hojas pueden caer: primero las 10 reales (mismo orden), después de afuera hacia adentro
      const rest = byOuter.map(o => o.i).filter(i => !falling.includes(i));
      const seq = order.map(k => falling[k]).concat(rest);
      const spotsH = seq.map((_, k) => {
        const side = k % 2; const n = Math.floor(k / 2); const r = Math.floor(n / 17); const c = n % 17;
        const x = side === 0 ? 515 - c * 22 - (r % 2) * 11 : 685 + c * 22 + (r % 2) * 11;
        return [x, GROUND - 9 - r * 8];
      });
      const fallersH = seq.map((idx, k) => { const n = nodes[idx]; const [tx, ty] = spotsH[k]; return { ...n, tx, ty }; });
      return { svg, links, fallers: fallersH };
    }
    const fallers = order.map(k => {
      const idx = falling[k]; const n = nodes[idx];
      return { ...n, tx: spots[k], ty: GROUND - 9 };
    });
    return { svg, links, fallers };
  }

  function setupStory(tree, anual, leafHa, cover, total) {
    const sec = $('#arbol'); const years = anual.map(r => r.Anio);
    let cum = 0; const cumBy = anual.map(r => (cum += r.Perdida_ha));
    const fallenBy = cumBy.map(c => Math.floor(c / leafHa));
    const firstFall = years[fallenBy.findIndex(n => n >= 1)];
    const early = anual.filter(r => r.Anio <= 2015);
    const peakEarly = early.reduce((m, r) => (r.Perdida_ha > m.Perdida_ha ? r : m));
    const peak = anual.reduce((m, r) => (r.Perdida_ha > m.Perdida_ha ? r : m));
    const avg = (a, b) => { const s = anual.filter(r => r.Anio >= a && r.Anio <= b); return s.reduce((t, r) => t + r.Perdida_ha, 0) / s.length; };
    const lastYear = years[years.length - 1]; const finalCum = cumBy[cumBy.length - 1];
    const steps = [
      { y: years[0], t: 'Un árbol de 100 hojas', x: `En el año 2000, México tenía ${nf1.format(cover / 1e6)} millones de hectáreas de cobertura arbórea. Este árbol es ese bosque: cada hoja equivale a ${nf0.format(leafHa)} ha, el 1 %.` },
      { y: firstFall, t: 'Cae la primera hoja', x: `Entre 2001 y ${firstFall} se perdieron ${nf0.format(cumBy[years.indexOf(firstFall)])} ha: ya se fue el primer 1 % del bosque.` },
      { y: peakEarly.Anio, t: `${peakEarly.Anio}: el peor año de su década`, x: `${nf0.format(peakEarly.Perdida_ha)} ha perdidas en un solo año.` },
      { y: 2016, t: 'La pérdida se acelera', x: `Entre 2016 y 2020 se perdieron en promedio ${nf0.format(avg(2016, 2020))} ha por año, contra ${nf0.format(avg(2001, 2015))} entre 2001 y 2015.` },
      { y: peak.Anio, t: `${peak.Anio}: el año récord`, x: `${nf0.format(peak.Perdida_ha)} ha en un año marcado por incendios forestales. México entró en la lista de los 10 países con más pérdida de bosque primario tropical.` },
      { y: lastYear, t: `${fallenBy[fallenBy.length - 1]} hojas en el suelo`, x: `Al cierre de ${lastYear} se acumulan ${nf0.format(finalCum)} ha perdidas, el ${nf1.format(finalCum / cover * 100)} % del bosque del año 2000. Pero el árbol no pierde igual por todos lados: baja a las raíces.` },
    ];

    // franja de años: altura proporcional a la pérdida anual
    const strip = $('#yearsStrip'); const maxV = Math.max(...anual.map(r => r.Perdida_ha));
    const btns = anual.map((r, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.style.height = `${(r.Perdida_ha / maxV) * 30 + 4}px`;
      b.title = `${r.Anio}: ${nf0.format(r.Perdida_ha)} ha`; b.setAttribute('aria-label', b.title);
      b.addEventListener('click', () => {
        const span = sec.offsetHeight - window.innerHeight;
        window.scrollTo({ top: sec.offsetTop + ((i + 0.5) / years.length) * span, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      strip.appendChild(b); return b;
    });

    // conector tipo raíz entre el tronco y la tarjeta
    const link = el('path', { class: 'root-link', d: 'M 590 640 C 470 640 360 600 40 560' }, tree.links);
    const linkLen = link.getTotalLength(); link.style.strokeDasharray = linkLen; link.style.strokeDashoffset = linkLen;

    let shownStep = -1; let lastIdx = -1;
    function render() {
      const span = Math.max(1, sec.offsetHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, (window.scrollY - sec.offsetTop) / span));
      const idx = Math.min(years.length - 1, Math.floor(p * years.length));
      if (idx !== lastIdx) {
        lastIdx = idx;
        $('#yearNow').textContent = years[idx];
        $('#cumHa').textContent = nf0.format(cumBy[idx]);
        $('#fallenN').textContent = fallenBy[idx];
        btns.forEach((b, i) => { b.classList.toggle('is-past', i < idx); b.classList.toggle('is-now', i === idx); });
        tree.fallers.forEach((f, k) => {
          const down = k < fallenBy[idx];
          f.g.classList.toggle('is-fallen', down);
          f.move.style.transform = down ? `translate(${(f.tx - f.x).toFixed(1)}px, ${(f.ty - f.y).toFixed(1)}px) rotate(${(-f.a + (k % 2 ? 8 : -8)).toFixed(1)}deg)` : '';
        });
        let s = 0; steps.forEach((st, i) => { if (years[idx] >= st.y) s = i; });
        if (s !== shownStep) {
          shownStep = s; const card = $('#storyCard');
          card.classList.add('is-swap');
          setTimeout(() => {
            $('#storyYear').textContent = steps[s].y; $('#storyTitle').textContent = steps[s].t; $('#storyText').textContent = steps[s].x;
            card.classList.remove('is-swap');
            link.style.transition = 'none'; link.style.strokeDashoffset = linkLen;
            requestAnimationFrame(() => { link.style.transition = ''; link.style.strokeDashoffset = 0; });
          }, shownStep === 0 && !$('#storyTitle').textContent ? 0 : 220);
        }
      }
    }
    let ticking = false;
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; render(); }); } }, { passive: true });
    window.addEventListener('resize', render);
    render();
  }

  // ---------- raíces (exploración y detalle) ----------
  function buildRoots(estados, ctx, { factor, relFactor }) {
    const svg = $('#roots');
    const SP = 46, PADX = 80, GND = 70, Y0 = 150, MAXL = 500;
    const n = estados.length; const W = PADX * 2 + (n - 1) * SP; const H = Y0 + MAXL + 230;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const d = el('defs', {}, svg);
    d.innerHTML = REGIONS.map((r, i) => `<linearGradient id="gR${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${r.dark}"/><stop offset=".3" stop-color="${r.light}"/><stop offset=".55" stop-color="${r.light}"/><stop offset="1" stop-color="${r.dark}"/></linearGradient>`).join('') +
      '<pattern id="pFiber" width="16" height="9" patternUnits="userSpaceOnUse"><path d="M0 4 Q 4 2 8 4 T 16 4" stroke="#000" stroke-opacity=".18" fill="none"/></pattern>' +
      '<linearGradient id="gStub" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1E140E"/><stop offset=".4" stop-color="#6E5240"/><stop offset="1" stop-color="#1A110B"/></linearGradient>';
    const cx0 = W / 2;
    el('rect', { x: 0, y: 0, width: W, height: GND, fill: 'transparent' }, svg);
    el('path', { d: `M ${cx0 - 46} ${GND} C ${cx0 - 30} ${GND - 30} ${cx0 - 22} 20 ${cx0 - 20} 0 L ${cx0 + 20} 0 C ${cx0 + 22} 20 ${cx0 + 30} ${GND - 30} ${cx0 + 46} ${GND} Z`, fill: 'url(#gStub)' }, svg);
    el('line', { x1: 0, y1: GND, x2: W, y2: GND, stroke: '#7A6248', 'stroke-width': 2 }, svg);
    el('line', { x1: PADX - 30, y1: Y0, x2: W - PADX + 30, y2: Y0, stroke: '#C9B79E', 'stroke-width': 1.2, 'stroke-dasharray': '5 7', opacity: 0.55 }, svg);
    const t = el('text', { x: W - PADX + 30, y: Y0 - 12, 'text-anchor': 'end', fill: '#A08E78', 'font-size': 14, 'font-family': 'Inter, sans-serif' }, svg); t.textContent = 'línea de medición ↓';

    const center = Math.floor(n / 2);
    const slotOf = (i) => (i % 2 ? center + (i + 1) / 2 : center - i / 2);
    const tip = $('#tooltip');
    let mode = 'abs';
    const items = estados.map((r, i) => {
      const cx = PADX + slotOf(i) * SP; const reg = REG[r.Region]; const ri = REGIONS.indexOf(reg);
      const bx = cx0 + (cx - cx0) * 0.07;
      const conn = el('path', { class: 'conn', d: `M ${bx.toFixed(1)} ${GND} C ${bx.toFixed(1)} ${GND + 45} ${cx} ${Y0 - 45} ${cx} ${Y0}`, fill: 'none', stroke: reg.light, 'stroke-width': 4, opacity: 0.32 }, svg);
      const connLen = conn.getTotalLength(); conn.style.strokeDasharray = connLen; conn.style.strokeDashoffset = connLen;
      const g = el('g', { class: 'root is-seed', tabindex: 0, role: 'button', 'aria-label': `${r.Estado}: ${nf0.format(r.Perdida_ha)} hectáreas perdidas. Abrir detalle.` }, svg);
      const hit = el('rect', { class: 'hit', x: cx - 20, y: Y0 - 14, width: 40, height: 60, fill: 'transparent', rx: 8 }, g);
      const bar = el('rect', { class: 'bar', x: cx - ROOT_W / 2, y: Y0, width: ROOT_W, height: 0, fill: `url(#gR${ri})`, 'data-estado': r.Estado }, g);
      const fib = el('rect', { x: cx - ROOT_W / 2, y: Y0, width: ROOT_W, height: 0, fill: 'url(#pFiber)', 'pointer-events': 'none' }, g);
      el('circle', { class: 'knot', cx, cy: Y0, r: 7, fill: '#140E09', stroke: reg.light, 'stroke-width': 3 }, g);
      const tipDot = el('circle', { class: 'tip', cx, cy: Y0, r: 5, fill: reg.light, opacity: 0, 'pointer-events': 'none' }, g);
      const lbl = el('text', { class: 'lbl', 'font-size': 15, 'font-family': 'Inter, sans-serif', fill: '#F1ECE2' }, g);
      const nm = el('tspan', { 'font-weight': 700 }, lbl); nm.textContent = r.Estado;
      const val = el('tspan', { fill: '#B9AE9F' }, lbl);
      const item = { r, g, bar, fib, hit, lbl, val, cx, cur: 0, reg, conn, connLen, tipDot };
      g.addEventListener('mouseenter', (e) => showTip(e, item));
      g.addEventListener('mousemove', (e) => moveTip(e));
      g.addEventListener('mouseleave', () => { tip.hidden = true; });
      g.addEventListener('click', () => openPanel(item));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(item); } });
      return item;
    });

    const lengthOf = (it) => (mode === 'abs' ? it.r.Altura_Barra_PX : Math.round(it.r.Porcentaje_cobertura_perdida * relFactor * 100) / 100);
    const valueText = (it) => (mode === 'abs' ? ` · ${nf0.format(it.r.Perdida_ha)} ha` : ` · ${nf2.format(it.r.Porcentaje_cobertura_perdida)} %`);
    function setLen(it, L) {
      it.cur = L;
      it.bar.setAttribute('height', L.toFixed(2)); it.fib.setAttribute('height', L.toFixed(2));
      it.hit.setAttribute('height', (L + 60).toFixed(2));
      it.lbl.setAttribute('transform', `translate(${it.cx + 5} ${(Y0 + L + 16).toFixed(2)}) rotate(90)`);
      it.tipDot.setAttribute('cy', (Y0 + L).toFixed(2));
    }
    // crecimiento orgánico: primero la raicilla, luego el nudo, luego la raíz y al final el nombre
    let growToken = 0;
    function grow(list, { dur = 1300, stagger = 55 } = {}) {
      const token = ++growToken; const to = list.map(lengthOf);
      list.forEach(it => { it.val.textContent = valueText(it); });
      if (reduceMotion) { list.forEach((it, i) => { it.conn.style.strokeDashoffset = 0; it.g.classList.remove('is-seed'); setLen(it, to[i]); }); return; }
      list.forEach((it, i) => {
        it.g.classList.add('is-seed'); setLen(it, 0);
        it.conn.style.transition = 'none'; it.conn.style.strokeDashoffset = it.connLen;
        void it.conn.getBoundingClientRect();
        it.conn.style.transition = '';
        setTimeout(() => { if (token === growToken) it.conn.style.strokeDashoffset = 0; }, i * stagger);
        setTimeout(() => { if (token === growToken) it.g.classList.remove('is-seed'); }, i * stagger + 450);
      });
      const t0 = performance.now() + 500;
      const ease = (x) => 1 - Math.pow(1 - x, 3);
      (function frame(now) {
        if (token !== growToken) return;
        let done = true;
        list.forEach((it, i) => {
          const k = Math.min(1, Math.max(0, (now - t0 - i * stagger) / dur));
          if (k < 1) done = false;
          setLen(it, to[i] * ease(k));
          it.tipDot.setAttribute('opacity', k > 0 && k < 1 ? 0.9 : 0);
        });
        if (!done) requestAnimationFrame(frame);
        else list.forEach((it, i) => { setLen(it, to[i]); it.tipDot.setAttribute('opacity', 0); }); // valor exacto del CSV
      })(performance.now());
    }
    function animateTo(duration) {
      const from = items.map(it => it.cur); const to = items.map(lengthOf);
      items.forEach(it => { it.val.textContent = valueText(it); });
      if (reduceMotion || duration === 0) { items.forEach((it, i) => setLen(it, to[i])); return; }
      const t0 = performance.now();
      const ease = (x) => 1 - Math.pow(1 - x, 3);
      (function frame(now) {
        const k = Math.min(1, (now - t0) / duration);
        items.forEach((it, i) => setLen(it, from[i] + (to[i] - from[i]) * ease(k)));
        if (k < 1) requestAnimationFrame(frame);
        else items.forEach((it, i) => setLen(it, to[i])); // valor final exacto del CSV
      })(t0);
    }
    items.forEach(it => setLen(it, 0));
    items.forEach(it => { it.val.textContent = valueText(it); });
    const sc = $('#rootsScroll'); const centerScroll = () => { sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; };
    centerScroll(); window.addEventListener('resize', centerScroll);
    let grown = false;
    new IntersectionObserver(([e]) => { if (e.isIntersecting && !grown) { grown = true; grow(items); } }, { threshold: 0.15 }).observe(svg);
    $('#replayRoots').addEventListener('click', () => { grown = true; grow(items, { dur: 1100, stagger: 45 }); });

    // notas y leyenda según la vista
    const notes = () => {
      if (mode === 'abs') {
        $('#modeNote').innerHTML = `Longitud = columna <code>Altura_Barra_PX</code> del CSV: pérdida en miles de hectáreas × ${factor}. Campeche, el valor máximo, mide 499.95 px.`;
        setHTML('legendRule', 'Longitud = hectáreas perdidas 2001-2025 (Altura_Barra_PX). Se mide desde el nudo; el ancho es fijo.');
        setHTML('legendScale', `100 px = ${nf0.format((100 / factor) * 1000)} ha`);
        $('#rootsFoot').textContent = 'Escala completa: 1 px = ' + nf0.format(1000 / factor) + ' ha.' + (window.innerWidth < 900 ? ' Desliza el gráfico a los lados para ver los 32 estados.' : '');
      } else {
        $('#modeNote').innerHTML = `Longitud = <code>Porcentaje_cobertura_perdida</code> × ${relFactor} (500 px ÷ ${nf2.format(500 / relFactor)} %, el valor máximo). Muestra qué parte de su propio bosque perdió cada estado.`;
        setHTML('legendRule', 'Longitud = % de la cobertura del año 2000 que perdió el estado. Se mide desde el nudo; el ancho es fijo.');
        setHTML('legendScale', `100 px = ${nf2.format(100 / relFactor)} % de su cobertura`);
        $('#rootsFoot').textContent = 'En esta vista, un estado pequeño con poco bosque puede tener una raíz larga: mide la proporción, no las hectáreas.';
      }
    };
    notes();
    const setMode = (m) => {
      if (m === mode) return; mode = m;
      $('#modeAbs').classList.toggle('is-on', m === 'abs'); $('#modeAbs').setAttribute('aria-pressed', String(m === 'abs'));
      $('#modeRel').classList.toggle('is-on', m === 'rel'); $('#modeRel').setAttribute('aria-pressed', String(m === 'rel'));
      notes(); growToken++; items.forEach(it => { it.g.classList.remove('is-seed'); it.conn.style.strokeDashoffset = 0; }); animateTo(900);
    };
    $('#modeAbs').addEventListener('click', () => setMode('abs'));
    $('#modeRel').addEventListener('click', () => setMode('rel'));

    // filtros
    const filt = { region: null, cause: null };
    const chip = (label, color, onClick) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = (color ? `<i style="background:${color}"></i>` : '') + label; b.addEventListener('click', onClick); return b;
    };
    const applyFilters = () => items.forEach(it => {
      const ok = (!filt.region || it.r.Region === filt.region) && (!filt.cause || it.r.Causa_principal === filt.cause);
      it.g.classList.toggle('is-dim', !ok);
    });
    const regrowFiltered = () => { const sel = items.filter(it => !it.g.classList.contains('is-dim')); if (sel.length < items.length) grow(sel, { dur: 800, stagger: 40 }); };
    function makeGroup(container, key, values, colorOf) {
      const all = chip('Ver todos', null, () => select(null)); all.setAttribute('aria-pressed', 'true'); container.appendChild(all);
      const map = new Map([[null, all]]);
      values.forEach(v => { const b = chip(v, colorOf(v), () => select(v)); map.set(v, b); container.appendChild(b); });
      function select(v) { filt[key] = v; map.forEach((b, k) => b.setAttribute('aria-pressed', String(k === v))); applyFilters(); regrowFiltered(); }
    }
    makeGroup($('#regionChips'), 'region', REGIONS.map(r => r.name), (v) => REG[v].light);
    const causes = [...new Set(estados.map(r => r.Causa_principal))].sort((a, b) => estados.filter(r => r.Causa_principal === b).length - estados.filter(r => r.Causa_principal === a).length);
    makeGroup($('#causeChips'), 'cause', causes, () => null);

    // tooltip
    function showTip(e, it) {
      tip.innerHTML = `${it.r.Estado}<small>${mode === 'abs' ? nf0.format(it.r.Perdida_ha) + ' ha perdidas' : nf2.format(it.r.Porcentaje_cobertura_perdida) + ' % de su cobertura'}</small>`;
      tip.hidden = false; moveTip(e);
    }
    function moveTip(e) {
      const x = Math.min(window.innerWidth - tip.offsetWidth - 12, e.clientX + 14);
      tip.style.left = `${x}px`; tip.style.top = `${e.clientY + 16}px`;
    }

    // tarjeta lateral (vista de detalle)
    const panel = $('#panel'); const scrim = $('#scrim'); let active = null; let lastFocus = null;
    function openPanel(it) {
      tip.hidden = true;
      if (active) active.g.classList.remove('is-active');
      active = it; it.g.classList.add('is-active'); lastFocus = document.activeElement;
      const r = it.r; const c = ctx[r.Estado] || {};
      $('#panelBody').innerHTML = `
        <span class="p-region"><i style="background:${it.reg.light}"></i>${r.Region}</span>
        <h2>${r.Estado}</h2>
        <p class="p-rank">Lugar ${r.Posicion} de 32 por pérdida de cobertura arbórea</p>
        <p class="p-big">${nf0.format(r.Perdida_ha)} ha</p>
        <p class="p-big-label">perdidas entre ${r.Periodo_inicio} y ${r.Periodo_fin}</p>
        <p class="p-equiv">Equivale a unas ${nf0.format(r.Perdida_ha / CANCHA_HA)} canchas de futbol.</p>
        <dl class="p-grid">
          <div><dt>% de la pérdida nacional</dt><dd>${nf2.format(r.Porcentaje_nacional)} %</dd></div>
          <div><dt>% de su cobertura de 2000</dt><dd>${nf2.format(r.Porcentaje_cobertura_perdida)} %</dd></div>
          <div><dt>Año de mayor pérdida</dt><dd>${r.Anio_mayor_perdida} · ${nf0.format(r.Perdida_anio_mayor_ha)} ha</dd></div>
          <div><dt>Causa principal</dt><dd>${r.Causa_principal}</dd></div>
          <div><dt>Bosque primario perdido</dt><dd>${nf0.format(r.Perdida_bosque_primario_ha)} ha</dd></div>
          <div><dt>Pérdida por incendios</dt><dd>${nf0.format(r.Perdida_por_incendios_ha)} ha</dd></div>
          <div><dt>Municipio más afectado</dt><dd>${c.Municipio_mas_afectado || '—'}${c.Perdida_municipio_ha ? ' · ' + nf0.format(c.Perdida_municipio_ha) + ' ha' : ''}</dd></div>
          <div><dt>Emisiones</dt><dd>${nf2.format(r.Emisiones_MtCO2e)} Mt CO₂e</dd></div>
        </dl>
        <div class="p-context"><h3>Qué se pierde ahí</h3><p>${c.Contexto || ''}</p></div>
        <p class="p-meta">Longitud de la raíz: ${nf2.format(r.Altura_Barra_PX)} px (Altura_Barra_PX) · Cobertura en 2000: ${nf0.format(r.Cobertura_arborea_2000_ha)} ha · Fuente: Global Forest Watch (2026)</p>`;
      panel.classList.add('is-open'); panel.setAttribute('aria-hidden', 'false'); scrim.hidden = false;
      $('#panelClose').focus({ preventScroll: true });
    }
    function closePanel() {
      if (!panel.classList.contains('is-open')) return;
      panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true'); scrim.hidden = true;
      if (active) active.g.classList.remove('is-active');
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    $('#panelClose').addEventListener('click', closePanel);
    scrim.addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
    return items;
  }
})();
