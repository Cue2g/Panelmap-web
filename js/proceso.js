"use strict";

/*
 * "Cómo funciona": full-section 3D scene rendered on a 2D canvas with a small
 * perspective camera. Sources (left) → organization model on the PANELMAP core
 * (centre) → intelligence panels (right), wrapped by a governance ring.
 */
(function () {
  const section = document.getElementById("como-funciona");
  const canvas = document.getElementById("procScene");
  if (!section || !(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- World constants ---------- */
  const DURATIONS = [4600, 4800, 5200, 6200, 6000];
  const DIST = 1500;
  const FLOOR = 150;
  const SLAB_TOP = 112;
  const SLAB_H = 22;
  const CORE_TOP = 118;
  const CORE_R = 255;
  const SRC_X = -560;
  const OUT_X = 560;
  const ROWS = [225, 75, -75, -225];

  const SOURCES = [
    { id: "erp", label: "Sistemas de gestión", sub: "ERP · Bases de datos", color: "#1f6fff", x: SRC_X, z: ROWS[0] },
    { id: "docs", label: "Documentos", sub: "Contratos · Correos · Audio", color: "#8b5cf6", x: SRC_X, z: ROWS[1] },
    { id: "act", label: "Actividad y ubicación", sub: "Registros · Sensores · GPS", color: "#14b8a6", x: SRC_X, z: ROWS[2] },
    { id: "ctx", label: "Contexto externo", sub: "Fuentes relevantes", color: "#f59e0b", x: SRC_X, z: ROWS[3] },
  ];
  const SRC = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

  const OUTPUTS = [
    { id: "metrics", label: "Métricas y avisos", from: 2, x: OUT_X, z: ROWS[0] },
    { id: "query", label: "Consultas y síntesis", from: 3, x: OUT_X, z: ROWS[1] },
    { id: "reco", label: "Recomendaciones", from: 4, x: OUT_X, z: ROWS[2] },
    { id: "decide", label: "Decisiones y seguimiento", from: 4, x: OUT_X, z: ROWS[3] },
  ];

  const NODES = [
    { id: "clientes", label: "Clientes", p: [-185, -95, 130], src: ["erp"] },
    { id: "contratos", label: "Contratos", p: [-40, -160, 70], src: ["erp", "docs"] },
    { id: "resultados", label: "Margen", p: [135, -135, 120], src: ["erp"] },
    { id: "incidencias", label: "Incidencias", p: [-165, -15, -40], src: ["docs", "act"] },
    { id: "servicios", label: "Servicios", p: [10, -55, 10], src: ["erp", "act"] },
    { id: "recursos", label: "Recursos", p: [180, -35, -20], src: ["erp", "act"] },
    { id: "entorno", label: "Demanda", p: [-130, 45, -165], src: ["ctx"] },
    { id: "ubicaciones", label: "Territorio", p: [25, 40, -150], src: ["act", "ctx"] },
    { id: "personas", label: "Personas", p: [175, 45, -160], src: ["erp"] },
  ];
  const EDGES = [
    ["clientes", "contratos"], ["contratos", "resultados"], ["contratos", "servicios"],
    ["servicios", "recursos"], ["recursos", "personas"], ["servicios", "incidencias"],
    ["servicios", "ubicaciones"], ["ubicaciones", "entorno"], ["incidencias", "resultados"],
    ["recursos", "resultados"], ["personas", "servicios"], ["entorno", "clientes"],
  ];
  const key = (a, b) => [a, b].sort().join("|");
  const PATTERN = new Set([key("incidencias", "resultados"), key("servicios", "incidencias")]);
  const PATH_NODES = ["resultados", "contratos", "servicios", "incidencias", "recursos"];
  const PATH_EDGES = [key("resultados", "contratos"), key("contratos", "servicios"), key("servicios", "incidencias"), key("servicios", "recursos")];
  const ROLE_SCOPE = new Set(["servicios", "recursos", "personas", "incidencias", "ubicaciones"]);
  const GOV = [
    { id: "perm", label: "Permisos", angle: Math.PI * 1.25 },
    { id: "trace", label: "Trazabilidad", angle: Math.PI * 1.5 },
    { id: "sup", label: "Supervisión", angle: Math.PI * 1.75 },
  ];
  const GOV_R = 330;
  const QUERY = "¿Dónde está cayendo el margen y qué factores están asociados?";
  const ANSWER = "Factores asociados: incidencias del servicio · recursos utilizados";
  const RECO = "Revisar condiciones del servicio y asignación de recursos en los contratos afectados.";

  const PHASES = [
    { t: "Conectamos y preparamos la información", d: "Revisamos las fuentes disponibles e incorporamos los datos acordados, desde sistemas de gestión hasta documentos, ubicación o flujos en directo. Preparamos la información para que pueda relacionarse y utilizarse en los análisis definidos." },
    { t: "Representamos tu organización", d: "Construimos un mapa de sus elementos, propiedades y relaciones. Conectamos personas, contratos, servicios, recursos y resultados según su función en la organización para aportar contexto al análisis." },
    { t: "Incorporamos su lógica y aplicamos análisis e IA", d: "Definimos con tus equipos los objetivos, indicadores, reglas y referencias relevantes. Los motores analíticos y de IA exploran patrones, siguen la evolución y detectan situaciones que requieren atención." },
    { t: "Acercamos la inteligencia a tus equipos", d: "Desde la plataforma, los usuarios consultan métricas y relaciones, revisan avisos y acceden a las síntesis y consultas habilitadas para su perfil. Cada equipo dispone de una lectura acorde con sus responsabilidades." },
    { t: "Orientamos la actuación y seguimos los resultados", d: "Vinculamos los análisis con los problemas y decisiones que quieres abordar. Tus equipos valoran recomendaciones, establecen prioridades y observan la evolución de los indicadores después de actuar, con nuestro acompañamiento." },
  ];

  /* Camera shot per phase (desktop focus x; on mobile it travels between zones). */
  const SHOTS = [
    { fx: -70, mfx: -400, yaw: -0.1, pitch: 0.6, zoom: 1.0 },
    { fx: 0, mfx: 0, yaw: 0.1, pitch: 0.5, zoom: 1.06 },
    { fx: 20, mfx: 0, yaw: -0.08, pitch: 0.46, zoom: 1.12 },
    { fx: 90, mfx: 0, yaw: 0.12, pitch: 0.5, zoom: 1.06 },
    { fx: 70, mfx: 400, yaw: -0.08, pitch: 0.55, zoom: 1.0 },
  ];

  const KPI_BASE = [64, 65, 63, 66, 65, 64, 62, 59, 56, 53];
  const KPI_FOLLOW = [53, 54, 57, 59, 61, 62];
  const KPI_TARGET = 62;

  /* ---------- State ---------- */
  const state = {
    phase: 0, t: 0, playing: !reduceMotion, inView: false,
    active: { erp: true, docs: true, act: true, ctx: true },
    selected: null, hover: null,
    perm: false, trace: false, sup: false,
    decided: false, decideT: 0, queryChars: 0, pathStep: -1, answerT: 0,
  };

  const steps = Array.from(section.querySelectorAll(".proc-step"));
  const playBtn = $("procPlay");
  const phaseBox = section.querySelector(".proc__phase");
  const headBox = section.querySelector(".proc__head");
  const bottomBox = section.querySelector(".proc__bottom");
  const phaseN = $("procN");
  const phaseT = $("procT");
  const phaseD = $("procD");

  const nodeById = new Map();
  NODES.forEach((n) => {
    Object.assign(n, {
      x: n.p[0], y: n.p[1], z: n.p[2], tx: n.p[0], ty: n.p[1], tz: n.p[2],
      vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, s: 1, sr: 20, cz: 0, flash: 0, appear: 0, delay: 0, drag: false, seed: Math.random() * 6.28,
    });
    nodeById.set(n.id, n);
  });
  const edges = EDGES.map(([a, b]) => ({ a: nodeById.get(a), b: nodeById.get(b), k: key(a, b) }));
  edges.forEach((e) => { e.rest = Math.hypot(e.a.tx - e.b.tx, e.a.ty - e.b.ty, e.a.tz - e.b.tz); });
  const nodeOn = (n) => n.src.some((s) => state.active[s]);
  SOURCES.forEach((s) => { s.level = 1; });
  OUTPUTS.forEach((o) => { o.level = 0; o.ping = 0; });
  GOV.forEach((g) => { g.level = 0; });

  /* ---------- Camera ---------- */
  const cam = { yaw: SHOTS[0].yaw, pitch: SHOTS[0].pitch, zoom: 1, fx: SHOTS[0].fx, fy: -10, fz: 0 };
  const user = { yaw: 0, pitch: 0 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let W = 0, H = 0, DPR = 1, CX = 0, CY = 0, BASEZOOM = 1, MOBILE = false, HUD_Y = 0;
  let cy1 = 1, sy1 = 0, cp1 = 1, sp1 = 0;

  function trig() {
    cy1 = Math.cos(cam.yaw); sy1 = Math.sin(cam.yaw);
    cp1 = Math.cos(cam.pitch); sp1 = Math.sin(cam.pitch);
  }
  function rot(x, y, z) {
    const x1 = x * cy1 + z * sy1;
    const z1 = -x * sy1 + z * cy1;
    return { x: x1, y: y * cp1 - z1 * sp1, z: y * sp1 + z1 * cp1 };
  }
  function cam3(x, y, z) { return rot(x - cam.fx, y - cam.fy, z - cam.fz); }
  function project(x, y, z) {
    const c = cam3(x, y, z);
    const s = (DIST / (DIST + c.z)) * cam.zoom;
    return { x: CX + c.x * s, y: CY + c.y * s, s, z: c.z };
  }
  function unrotate(dx, dy) {
    const y1 = dy * cp1;
    const z1 = -dy * sp1;
    return { x: dx * cy1 - z1 * sy1, y: y1, z: dx * sy1 + z1 * cy1 };
  }

  /* ---------- Colour helpers ---------- */
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };

  /* ---------- Drawing primitives ---------- */
  function poly(pts, fill, stroke, lw) {
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function polyline(pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  }
  function line3(a, b, stroke, lw) {
    const p = project(a[0], a[1], a[2]);
    const q = project(b[0], b[1], b[2]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke();
  }
  function ring(x, y, z, r, n) {
    const pts = [];
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      pts.push(project(x + Math.cos(a) * r, y, z + Math.sin(a) * r));
    }
    return pts;
  }
  function hull(points) {
    const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    p.forEach((pt) => { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop(); lower.push(pt); });
    const upper = [];
    for (let i = p.length - 1; i >= 0; i -= 1) {
      const pt = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
      upper.push(pt);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }
  function box(x, y, z, w, h, d, top, side, stroke) {
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y, y1 = y + h, z0 = z - d / 2, z1 = z + d / 2;
    const C = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    const P = C.map((c) => project(c[0], c[1], c[2]));
    const faces = [
      { i: [0, 1, 2, 3], n: [0, -1, 0], c: [x, y0, z], f: top },
      { i: [4, 5, 1, 0], n: [0, 0, -1], c: [x, (y0 + y1) / 2, z0], f: side },
      { i: [7, 6, 2, 3], n: [0, 0, 1], c: [x, (y0 + y1) / 2, z1], f: side },
      { i: [4, 0, 3, 7], n: [-1, 0, 0], c: [x0, (y0 + y1) / 2, z], f: side },
      { i: [5, 1, 2, 6], n: [1, 0, 0], c: [x1, (y0 + y1) / 2, z], f: side },
    ];
    faces
      .map((fc) => {
        const n = rot(fc.n[0], fc.n[1], fc.n[2]);
        const c = cam3(fc.c[0], fc.c[1], fc.c[2]);
        return { fc, vis: n.x * c.x + n.y * c.y + n.z * (c.z + DIST) < 0, z: c.z };
      })
      .filter((o) => o.vis)
      .sort((a, b) => b.z - a.z)
      .forEach(({ fc }) => poly(fc.i.map((i) => P[i]), fc.f, stroke, 1));
  }
  function cylinder(x, yTop, yBot, z, r, side, top, stroke) {
    const tr = ring(x, yTop, z, r, 24);
    const br = ring(x, yBot, z, r, 24);
    poly(hull(tr.concat(br)), side, stroke, 1);
    poly(tr, top, stroke, 1);
  }
  function sphere(x, y, z, r, c0, c1, c2, alpha) {
    const p = project(x, y, z);
    const rr = Math.max(0.5, r * p.s);
    const g = ctx.createRadialGradient(p.x - rr * 0.35, p.y - rr * 0.4, rr * 0.1, p.x, p.y, rr);
    g.addColorStop(0, c0); g.addColorStop(0.45, c1); g.addColorStop(1, c2);
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath(); ctx.ellipse(p.x - rr * 0.32, p.y - rr * 0.4, rr * 0.32, rr * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.globalAlpha = 1;
    return { x: p.x, y: p.y, r: rr, s: p.s };
  }
  function text(str, x, y, z, size, color, opts) {
    const o = opts || {};
    const p = project(x, y, z);
    const fs = o.fixed ? size : Math.max(o.min || 10, Math.min(size * p.s, size * 1.3));
    ctx.font = `${o.weight || 600} ${fs}px ${o.family || "Inter, system-ui, sans-serif"}`;
    ctx.textAlign = o.align || "center";
    ctx.textBaseline = o.base || "middle";
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.halo) { ctx.lineWidth = 4; ctx.strokeStyle = "rgba(6,10,34,0.9)"; ctx.lineJoin = "round"; ctx.strokeText(str, p.x, p.y); }
    ctx.fillStyle = color;
    ctx.fillText(str, p.x, p.y);
    ctx.globalAlpha = 1;
    return { x: p.x, y: p.y, fs };
  }
  function wrap(str, maxW) {
    const words = str.split(" ");
    const lines = [];
    let cur = "";
    words.forEach((w) => {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  const bez3 = (a, b, c, t) => {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1], u * u * a[2] + 2 * u * t * b[2] + t * t * c[2]];
  };
  const projectArr = (a) => project(a[0], a[1], a[2]);

  /* ---------- Layout ---------- */
  function layout() {
    const r = section.getBoundingClientRect();
    W = r.width; H = r.height;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    MOBILE = W < 760;
    CX = W / 2;
    CY = H * 0.575;
    if (MOBILE && headBox && bottomBox) {
      const hb = headBox.getBoundingClientRect().bottom - r.top;
      const bt = bottomBox.getBoundingClientRect().top - r.top;
      HUD_Y = hb + 22;
      CY = HUD_Y + 110 + (bt - HUD_Y - 110) * 0.5;
    }
    BASEZOOM = MOBILE ? W / 820 : Math.min(W / 1860, H / 1040);
  }

  /* ---------- Phase control ---------- */
  function setPhase(i) {
    state.phase = (i + PHASES.length) % PHASES.length;
    state.t = 0;
    state.queryChars = 0;
    state.pathStep = -1;
    state.answerT = 0;
    state.decided = false;
    state.decideT = 0;
    section.dataset.phase = String(state.phase);
    steps.forEach((b, j) => {
      const sel = j === state.phase;
      b.setAttribute("aria-selected", String(sel));
      b.tabIndex = sel ? 0 : -1;
      b.classList.toggle("is-done", j < state.phase);
      const bar = b.querySelector("i");
      if (bar) bar.style.width = j < state.phase ? "100%" : sel && !state.playing ? "100%" : "0";
    });
    const list = steps[0] && steps[0].parentElement;
    if (list && list.scrollWidth > list.clientWidth) {
      const b = steps[state.phase];
      list.scrollTo({ left: b.offsetLeft - (list.clientWidth - b.offsetWidth) / 2, behavior: reduceMotion ? "auto" : "smooth" });
    }
    const ph = PHASES[state.phase];
    if (phaseN) phaseN.textContent = "Fase " + String(state.phase + 1).padStart(2, "0");
    if (phaseT) phaseT.textContent = ph.t;
    if (phaseD) phaseD.textContent = ph.d;
    if (phaseBox) { phaseBox.classList.remove("is-swap"); void phaseBox.offsetWidth; phaseBox.classList.add("is-swap"); }
    if (reduceMotion && state.phase === 3) { state.queryChars = QUERY.length; state.pathStep = PATH_NODES.length - 1; state.answerT = 1; }
    if (state.phase === 0) seedRaw();
    if (state.phase === 1) NODES.forEach((n, k) => { n.appear = 0; n.delay = k * 90; });
  }
  function setPlaying(on) {
    state.playing = on;
    if (playBtn) {
      playBtn.setAttribute("aria-pressed", String(on));
      playBtn.setAttribute("aria-label", on ? "Pausar recorrido" : "Reproducir recorrido");
    }
    const bar = steps[state.phase] && steps[state.phase].querySelector("i");
    if (bar && !on) bar.style.width = "100%";
  }
  function decide() {
    if (state.phase !== 4 || state.decided) return;
    state.decided = true;
    state.decideT = 0;
    nodeById.get("resultados").flash = 1;
  }
  const userTook = () => setPlaying(false);

  /* ---------- Raw data & particles ---------- */
  let raw = [];
  let particles = [];
  function randomOnCore() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (CORE_R - 40);
    return [Math.cos(a) * r, CORE_TOP - 6, Math.sin(a) * r];
  }
  function addRaw(src, p) {
    const fed = NODES.filter((n) => n.src.includes(src));
    raw.push({ src, x: p[0], y: p[1], z: p[2], vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3, bob: Math.random() * 6, node: fed[Math.floor(Math.random() * fed.length)], a: 1 });
    if (raw.length > 56) raw.shift();
  }
  function seedRaw() {
    raw = [];
    SOURCES.forEach((s) => { if (state.active[s.id]) for (let i = 0; i < 8; i += 1) addRaw(s.id, randomOnCore()); });
  }
  const srcTop = (s) => [s.x, SLAB_TOP - 46, s.z];
  const panelCenter = (o) => [o.x, SLAB_TOP - 52, o.z];

  function spawn(dt) {
    if (reduceMotion) return;
    const rate = state.phase === 0 ? 0.0036 : 0.0019;
    SOURCES.forEach((s) => {
      if (!state.active[s.id] || Math.random() > rate * dt) return;
      let target = null;
      let end = null;
      if (state.phase >= 1) {
        const fed = NODES.filter((n) => n.src.includes(s.id));
        target = fed[Math.floor(Math.random() * fed.length)];
      } else end = randomOnCore();
      particles.push({ kind: "in", src: s, a: srcTop(s), b: [-300, -110, s.z * 0.45], target, end, t: 0, sp: 0.00062 + Math.random() * 0.00025 });
    });
    if (state.phase >= 2 && NODES.some(nodeOn)) {
      OUTPUTS.forEach((o) => {
        if (o.level < 0.5 || Math.random() > 0.0013 * dt) return;
        const pool = PATH_NODES.map((id) => nodeById.get(id)).filter(nodeOn);
        if (!pool.length) return;
        particles.push({ kind: "out", out: o, from: pool[Math.floor(Math.random() * pool.length)], b: [340, -120, o.z * 0.6], t: 0, sp: 0.00065 + Math.random() * 0.00025 });
      });
    }
  }

  /* ---------- Simulation ---------- */
  function simulate(dt, time) {
    const k = Math.min(dt / 16.7, 3);
    const p = state.phase;
    NODES.forEach((n) => {
      if (p >= 1) {
        if (n.delay > 0) n.delay -= dt; else n.appear = Math.min(1, n.appear + dt / 900);
      } else n.appear = Math.max(0, n.appear - dt / 500);
      n.flash = Math.max(0, n.flash - dt * 0.002);
      if (n.drag) return;
      const wob = reduceMotion ? 0 : 7;
      const ax = n.tx + Math.cos(time * 0.0005 + n.seed) * wob;
      const ay = n.ty + Math.sin(time * 0.0007 + n.seed) * wob;
      const az = n.tz + Math.sin(time * 0.0004 + n.seed * 2) * wob * 1.6;
      n.vx += (ax - n.x) * 0.012 * k;
      n.vy += (ay - n.y) * 0.012 * k;
      n.vz += (az - n.z) * 0.012 * k;
    });
    for (let i = 0; i < NODES.length; i += 1) {
      for (let j = i + 1; j < NODES.length; j += 1) {
        const a = NODES[i], b = NODES[j];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.max(1, Math.hypot(dx, dy, dz));
        if (d < 110) {
          const f = ((110 - d) / 110) * 0.8 * k;
          if (!a.drag) { a.vx -= (dx / d) * f; a.vy -= (dy / d) * f; a.vz -= (dz / d) * f; }
          if (!b.drag) { b.vx += (dx / d) * f; b.vy += (dy / d) * f; b.vz += (dz / d) * f; }
        }
      }
    }
    edges.forEach((e) => {
      const a = e.a, b = e.b;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const d = Math.max(1, Math.hypot(dx, dy, dz));
      const f = (d - e.rest) * 0.0035 * k;
      if (!a.drag) { a.vx += (dx / d) * f; a.vy += (dy / d) * f; a.vz += (dz / d) * f; }
      if (!b.drag) { b.vx -= (dx / d) * f; b.vy -= (dy / d) * f; b.vz -= (dz / d) * f; }
    });
    NODES.forEach((n) => {
      if (n.drag) return;
      n.vx *= 0.86; n.vy *= 0.86; n.vz *= 0.86;
      n.x = Math.max(-CORE_R + 30, Math.min(CORE_R - 30, n.x + n.vx * k));
      n.y = Math.max(-260, Math.min(CORE_TOP - 40, n.y + n.vy * k));
      n.z = Math.max(-CORE_R + 30, Math.min(CORE_R - 30, n.z + n.vz * k));
    });

    const lerp = (v, t, ms) => v + (t - v) * Math.min(1, dt / ms);
    SOURCES.forEach((s) => { s.level = lerp(s.level, state.active[s.id] ? 1 : 0, 220); });
    OUTPUTS.forEach((o) => {
      const on = o.id === "decide" ? p >= 4 && state.decided : p >= o.from;
      o.level = lerp(o.level, on ? 1 : 0, 300);
      o.ping = Math.max(0, o.ping - dt * 0.003);
    });
    GOV.forEach((g) => { g.level = lerp(g.level, state[g.id] ? 1 : 0, 250); });

    raw.forEach((r) => {
      if (p === 0) {
        r.x += r.vx; r.z += r.vz;
        if (Math.hypot(r.x, r.z) > CORE_R - 30) { r.vx *= -1; r.vz *= -1; }
        r.y = CORE_TOP - 8 - Math.abs(Math.sin(time / 900 + r.bob)) * 8;
      } else {
        const n = r.node;
        r.x += (n.x - r.x) * 0.07; r.y += (n.y - r.y) * 0.07; r.z += (n.z - r.z) * 0.07;
        r.a -= 0.015;
      }
    });
    if (p !== 0) {
      raw = raw.filter((r) => {
        if (r.a <= 0 || Math.hypot(r.node.x - r.x, r.node.y - r.y, r.node.z - r.z) < 10) { r.node.flash = Math.max(r.node.flash, 0.6); return false; }
        return true;
      });
    }
  }

  /* ---------- Camera motion: per-phase shot + slow breathing + parallax + user orbit ---------- */
  function moveCamera(dt, time) {
    const shot = SHOTS[state.phase];
    const b = reduceMotion ? 0 : 1;
    const tgt = {
      yaw: shot.yaw + user.yaw + Math.sin((time / 10000) * Math.PI * 2) * 0.12 * b + pointer.x * 0.12,
      pitch: Math.max(0.18, Math.min(0.95, shot.pitch + user.pitch + Math.sin((time / 7600) * Math.PI * 2) * 0.04 * b + pointer.y * 0.06)),
      zoom: BASEZOOM * shot.zoom * (1 + Math.sin((time / 5600) * Math.PI * 2) * 0.022 * b),
      fx: MOBILE ? shot.mfx : shot.fx,
    };
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt / 700);
    cam.yaw += (tgt.yaw - cam.yaw) * k;
    cam.pitch += (tgt.pitch - cam.pitch) * k;
    cam.zoom += (tgt.zoom - cam.zoom) * k;
    cam.fx += (tgt.fx - cam.fx) * k;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt / 400);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt / 400);
    trig();
  }

  /* ---------- Timeline ---------- */
  function tick(dt) {
    state.t += dt;
    const p = state.phase;
    if (p === 3 && !reduceMotion) {
      state.queryChars = Math.max(0, Math.min(QUERY.length, Math.floor((state.t - 300) / 24)));
      const typedAt = 300 + QUERY.length * 24;
      const step = Math.min(PATH_NODES.length - 1, Math.floor((state.t - typedAt - 150) / 300));
      if (step !== state.pathStep && step >= 0) {
        state.pathStep = step;
        nodeById.get(PATH_NODES[step]).flash = 1;
      }
      if (state.pathStep === PATH_NODES.length - 1) state.answerT = Math.min(1, state.answerT + dt / 500);
    }
    if (p === 4) {
      if (state.playing && state.t > 2300) decide();
      if (state.decided) state.decideT = Math.min(1, state.decideT + dt / 1600);
    }
    if (state.playing) {
      const bar = steps[p] && steps[p].querySelector("i");
      if (bar) bar.style.width = Math.min(100, (state.t / DURATIONS[p]) * 100) + "%";
      if (state.t >= DURATIONS[p]) setPhase(p + 1);
    }
  }

  /* ---------- Scene drawing ---------- */
  let hits = [];

  function drawFloor(time) {
    const gx = 820, gz = 460, n = 15;
    for (let i = 0; i <= n; i += 1) {
      const z = -gz + (i / n) * gz * 2;
      const fade = 1 - Math.abs(z) / gz;
      line3([-gx, FLOOR, z], [gx, FLOOR, z], `rgba(111,157,255,${(0.05 + fade * 0.16).toFixed(3)})`, 1);
    }
    for (let i = 0; i <= 22; i += 1) {
      const x = -gx + (i / 22) * gx * 2;
      const fade = 1 - Math.abs(x) / gx;
      line3([x, FLOOR, -gz], [x, FLOOR, gz], `rgba(111,157,255,${(0.04 + fade * 0.13).toFixed(3)})`, 1);
    }
    const c = project(0, FLOOR, 0);
    const R = 560 * c.s;
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
    g.addColorStop(0, "rgba(31,111,255,0.3)");
    g.addColorStop(0.5, "rgba(31,111,255,0.08)");
    g.addColorStop(1, "rgba(31,111,255,0)");
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(1, Math.max(0.25, sp1));
    ctx.translate(-c.x, -c.y);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const govOn = state.perm || state.trace || state.sup;
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -time * 0.02;
    poly(ring(0, FLOOR - 1, 0, GOV_R, 72), null, govOn ? "rgba(94,234,212,0.55)" : "rgba(127,170,255,0.35)", 1.4);
    ctx.setLineDash([]);
  }

  function drawCore(time) {
    cylinder(0, CORE_TOP, CORE_TOP + 22, 0, CORE_R, "rgba(14,24,70,0.88)", "rgba(20,40,110,0.55)", "rgba(110,160,255,0.55)");
    poly(ring(0, CORE_TOP - 0.5, 0, CORE_R * 0.72, 48), null, "rgba(110,160,255,0.18)", 1);
    poly(ring(0, CORE_TOP - 0.5, 0, CORE_R * 0.4, 40), null, "rgba(110,160,255,0.14)", 1);
    const a = reduceMotion ? 0 : (time / 4000) * Math.PI * 2;
    const arc = [];
    for (let i = 0; i <= 16; i += 1) {
      const t = a + (i / 16) * 1.1;
      arc.push(project(Math.cos(t) * CORE_R, CORE_TOP, Math.sin(t) * CORE_R));
    }
    polyline(arc);
    ctx.strokeStyle = "rgba(160,200,255,0.9)";
    ctx.lineWidth = 2.2;
    ctx.shadowColor = "#4d8dff"; ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (state.phase === 2 && !reduceMotion) {
      const m = nodeById.get("resultados");
      const cyc = (state.t % 2200) / 2200;
      const r = 10 + cyc * (CORE_R + 60);
      poly(ring(m.x, CORE_TOP - 1, m.z, r, 48), null, `rgba(255,107,129,${(0.85 * (1 - cyc)).toFixed(2)})`, 1.8);
    }
    NODES.forEach((n) => {
      if (n.appear <= 0.01) return;
      const p = project(n.x, CORE_TOP - 1, n.z);
      const lift = (CORE_TOP - n.y) / 380;
      ctx.globalAlpha = Math.max(0, n.appear * (0.55 - lift * 0.3) * (nodeOn(n) ? 1 : 0.3));
      ctx.fillStyle = "#000";
      const rx = 24 * p.s * (1 + lift * 0.5);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, rx * Math.max(0.2, sp1), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawRaw() {
    raw
      .map((r) => ({ r, z: cam3(r.x, r.y, r.z).z }))
      .sort((a, b) => b.z - a.z)
      .forEach(({ r }) => {
        const col = SRC[r.src].color;
        const alpha = Math.max(0, r.a) * (state.active[r.src] ? 1 : 0.2);
        if (alpha <= 0.02) return;
        ctx.globalAlpha = alpha;
        box(r.x, r.y - 9, r.z, 11, 9, 11, rgba(col, 0.95), rgba(col, 0.55), "rgba(255,255,255,0.25)");
        ctx.globalAlpha = 1;
      });
  }

  function drawSource(s, time) {
    const lv = 0.25 + s.level * 0.75;
    const bob = reduceMotion ? 0 : Math.sin(time / 1200 + s.z) * 3;
    box(s.x, SLAB_TOP, s.z, 160, SLAB_H, 112, rgba(s.color, (0.1 + 0.16 * s.level).toFixed(3)), "rgba(10,18,56,0.92)", rgba(s.color, (0.25 + 0.5 * s.level).toFixed(3)));
    ctx.globalAlpha = lv;
    const top = SLAB_TOP - 2 - bob * s.level;
    if (s.id === "erp") {
      for (let k = 0; k < 3; k += 1) {
        const y = top - 12 - k * 17;
        cylinder(s.x, y, y + 12, s.z, 30, rgba(s.color, 0.6), "rgba(150,190,255,0.9)", "rgba(207,224,255,0.6)");
      }
    } else if (s.id === "docs") {
      for (let k = 0; k < 3; k += 1) {
        box(s.x - 12 + k * 12, top - 8 - k * 13, s.z + 12 - k * 12, 58, 3, 72, k === 2 ? "rgba(225,215,255,0.95)" : rgba(s.color, 0.8), rgba(s.color, 0.5), "rgba(255,255,255,0.35)");
      }
      const yy = top - 8 - 2 * 13 - 0.5;
      for (let l = 0; l < 4; l += 1) {
        const zz = s.z - 12 + 26 - l * 14;
        line3([s.x + 12 - 20, yy, zz], [s.x + 12 + (l === 3 ? 4 : 20), yy, zz], "rgba(90,60,170,0.8)", 1.4);
      }
    } else if (s.id === "act") {
      const cyc = reduceMotion ? 0.4 : (time / 1800) % 1;
      for (let k = 0; k < 2; k += 1) {
        const c = (cyc + k * 0.5) % 1;
        poly(ring(s.x, SLAB_TOP - 0.5, s.z, 10 + c * 50, 28), null, rgba(s.color, ((1 - c) * 0.8 * s.level).toFixed(3)), 1.5);
      }
      line3([s.x, SLAB_TOP, s.z], [s.x, top - 38, s.z], rgba(s.color, 0.8), 2);
      sphere(s.x, top - 46, s.z, 14, "#d5fff7", s.color, "#064e45", lv);
    } else {
      const cy = top - 44;
      const c = project(s.x, cy, s.z);
      const R = 32;
      ctx.beginPath(); ctx.arc(c.x, c.y, R * c.s, 0, Math.PI * 2);
      ctx.fillStyle = rgba(s.color, 0.16); ctx.fill();
      ctx.strokeStyle = rgba(s.color, 0.9); ctx.lineWidth = 1.4; ctx.stroke();
      const spin = reduceMotion ? 0 : time / 2600;
      for (let m = 0; m < 3; m += 1) {
        const a0 = spin + (m * Math.PI) / 3;
        const pts = [];
        for (let i = 0; i <= 24; i += 1) {
          const t = (i / 24) * Math.PI * 2;
          pts.push(project(s.x + Math.cos(a0) * Math.cos(t) * R, cy + Math.sin(t) * R, s.z + Math.sin(a0) * Math.cos(t) * R));
        }
        polyline(pts);
        ctx.strokeStyle = rgba(s.color, 0.55); ctx.lineWidth = 1; ctx.stroke();
      }
      [-0.5, 0, 0.5].forEach((lat) => {
        poly(ring(s.x, cy + Math.sin(lat) * R, s.z, Math.cos(lat) * R, 28), null, rgba(s.color, 0.5), 1);
      });
    }
    ctx.globalAlpha = 1;
    const hp = project(s.x, SLAB_TOP - 30, s.z);
    hits.push({ type: "src", id: s.id, x: hp.x, y: hp.y, r: 80 * hp.s });
  }

  function panelPoint(o, u, v) {
    const w = 128, h = 86;
    return project(o.x - w / 2 + u * w, SLAB_TOP - 6 - h + v * h, o.z);
  }
  function panelLine(o, pts, stroke, lw) {
    ctx.beginPath();
    pts.forEach(([u, v], i) => { const p = panelPoint(o, u, v); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
  }
  const kpiV = (v) => 0.88 - ((v - 48) / 22) * 0.6;
  const kpiPts = (values, offset, total) => values.map((v, i) => [0.1 + ((i + offset) / (total - 1)) * 0.8, kpiV(v)]);

  function drawOutput(o, time) {
    const lv = o.level;
    box(o.x, SLAB_TOP, o.z, 160, SLAB_H, 112, `rgba(77,141,255,${(0.06 + 0.16 * lv).toFixed(3)})`, "rgba(10,18,56,0.92)", `rgba(110,160,255,${(0.2 + 0.5 * lv).toFixed(3)})`);
    if (lv > 0.05) {
      const a = project(o.x, SLAB_TOP - 6, o.z);
      const b = project(o.x, SLAB_TOP - 260, o.z);
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, `rgba(77,141,255,${(0.32 * lv).toFixed(3)})`);
      g.addColorStop(1, "rgba(77,141,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(a.x - 64 * a.s, b.y, 128 * a.s, a.y - b.y);
    }
    const corners = [panelPoint(o, 0, 0), panelPoint(o, 1, 0), panelPoint(o, 1, 1), panelPoint(o, 0, 1)];
    ctx.shadowColor = "#4d8dff";
    ctx.shadowBlur = 18 * lv + o.ping * 20;
    poly(corners, `rgba(18,34,92,${(0.45 + 0.3 * lv).toFixed(3)})`, `rgba(130,175,255,${Math.min(1, 0.3 + 0.6 * lv + o.ping * 0.3).toFixed(3)})`, 1.4);
    ctx.shadowBlur = 0;
    const ink = `rgba(200,220,255,${(0.35 + 0.65 * lv).toFixed(3)})`;
    const accent = `rgba(77,141,255,${(0.4 + 0.6 * lv).toFixed(3)})`;
    if (o.id === "metrics") {
      if (state.phase >= 2) {
        const total = KPI_BASE.length;
        panelLine(o, [[0.1, kpiV(KPI_TARGET)], [0.9, kpiV(KPI_TARGET)]], "rgba(255,255,255,0.3)", 1);
        panelLine(o, kpiPts(KPI_BASE.slice(0, 7), 0, total), accent, 2);
        panelLine(o, kpiPts(KPI_BASE.slice(6), 6, total), "rgba(255,107,129,0.95)", 2.2);
        const last = panelPoint(o, 0.9, kpiV(KPI_BASE[total - 1]));
        ctx.beginPath(); ctx.arc(last.x, last.y, Math.max(1, 3 * last.s + Math.sin(time / 200) * 0.8), 0, Math.PI * 2); ctx.fillStyle = "#ff6b81"; ctx.fill();
      } else {
        const bw = 8 * panelPoint(o, 0.5, 0.5).s;
        [0.35, 0.55, 0.45, 0.7].forEach((h, i) => {
          const u = 0.2 + i * 0.2;
          panelLine(o, [[u, 0.85], [u, 0.85 - h * 0.65]], accent, bw);
        });
      }
    } else if (o.id === "query") {
      panelLine(o, [[0.12, 0.2], [0.7, 0.2], [0.7, 0.44], [0.24, 0.44], [0.16, 0.54], [0.18, 0.44], [0.12, 0.44], [0.12, 0.2]], ink, 1.4);
      panelLine(o, [[0.3, 0.58], [0.88, 0.58], [0.88, 0.82], [0.82, 0.82], [0.84, 0.92], [0.74, 0.82], [0.3, 0.82], [0.3, 0.58]], accent, 1.4);
      for (let d = 0; d < 3; d += 1) {
        const p = panelPoint(o, 0.48 + d * 0.11, 0.7);
        const on = lv > 0.5 && Math.floor(time / 300) % 3 === d;
        ctx.beginPath(); ctx.arc(p.x, p.y, (on ? 3 : 2) * p.s, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
      }
    } else if (o.id === "reco") {
      [0.25, 0.5, 0.75].forEach((v, i) => {
        panelLine(o, [[0.14, v], [0.22, v + 0.07], [0.32, v - 0.08]], i === 0 ? "rgba(94,234,212,0.95)" : ink, 1.8);
        panelLine(o, [[0.42, v], [i === 0 ? 0.88 : 0.74, v]], i === 0 ? accent : ink, 2);
      });
    } else if (state.decided && state.phase === 4) {
      const total = KPI_BASE.length + KPI_FOLLOW.length - 1;
      panelLine(o, [[0.1, kpiV(KPI_TARGET)], [0.9, kpiV(KPI_TARGET)]], "rgba(255,255,255,0.3)", 1);
      panelLine(o, kpiPts(KPI_BASE.slice(5), 5, total), "rgba(255,107,129,0.8)", 1.8);
      const n = Math.max(2, Math.round(KPI_FOLLOW.length * state.decideT));
      panelLine(o, kpiPts(KPI_FOLLOW.slice(0, n), KPI_BASE.length - 1, total), "rgba(94,234,212,0.95)", 2.2);
    } else {
      const h = panelPoint(o, 0.5, 0.32);
      ctx.beginPath(); ctx.arc(h.x, h.y, 9 * h.s, 0, Math.PI * 2); ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.stroke();
      panelLine(o, [[0.3, 0.86], [0.34, 0.66], [0.5, 0.58], [0.66, 0.66], [0.7, 0.86]], ink, 1.6);
    }
    const hp = panelPoint(o, 0.5, 0.6);
    hits.push({ type: "out", id: o.id, x: hp.x, y: hp.y, r: 72 * hp.s });
  }

  const isFlag = (n) => n.id === "resultados" && state.phase >= 2 && !(state.phase === 4 && state.decided);
  function isPath(n) {
    const i = PATH_NODES.indexOf(n.id);
    if (i < 0) return false;
    return (state.phase === 3 && i <= state.pathStep) || state.phase === 4;
  }
  function nodeColors(n) {
    if (isFlag(n)) return ["#ffc2cc", "#e0405d", "#4a0c22"];
    if (state.phase === 4 && state.decided && n.id === "resultados") return ["#d5fff7", "#14b8a6", "#064e45"];
    if (isPath(n)) return ["#e6f0ff", "#3f86ff", "#0b3cb0"];
    return ["#6a8ae0", "#1b2a66", "#080d2a"];
  }
  function focusSet() {
    const f = state.selected || state.hover;
    if (!f) return null;
    const set = new Set([f]);
    edges.forEach((e) => { if (e.a.id === f) set.add(e.b.id); if (e.b.id === f) set.add(e.a.id); });
    return set;
  }

  function drawEdges(time) {
    const focus = state.selected || state.hover;
    const pathSet = new Set(state.phase === 3 ? PATH_EDGES.slice(0, Math.max(0, state.pathStep)) : state.phase === 4 ? PATH_EDGES : []);
    edges.forEach((e) => {
      const app = Math.min(e.a.appear, e.b.appear);
      if (app <= 0.02) return;
      const on = nodeOn(e.a) && nodeOn(e.b);
      const dim = focus && e.a.id !== focus && e.b.id !== focus;
      let col = "rgba(150,185,255,0.55)";
      let lw = 1.4;
      let dash = [4, 7];
      if (state.phase === 2 && PATTERN.has(e.k)) { col = "rgba(245,158,11,0.95)"; lw = 2.6; dash = [8, 6]; }
      if (pathSet.has(e.k)) { col = "rgba(230,240,255,0.98)"; lw = 3; dash = []; }
      ctx.globalAlpha = app * (on ? 1 : 0.08) * (dim ? 0.2 : 1);
      ctx.setLineDash(dash);
      ctx.lineDashOffset = -time * 0.03;
      if (lw > 2) { ctx.shadowColor = col; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.moveTo(e.a.sx, e.a.sy); ctx.lineTo(e.b.sx, e.b.sy);
      ctx.strokeStyle = col; ctx.lineWidth = lw * Math.max(0.7, (e.a.s + e.b.s) / 2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    });
  }

  function drawNode(n, time) {
    if (n.appear <= 0.01) return;
    const fs = focusSet();
    const on = nodeOn(n);
    const locked = state.perm && !ROLE_SCOPE.has(n.id);
    const ease = 1 - Math.pow(1 - n.appear, 3);
    const breath = reduceMotion ? 1 : 1 + Math.sin(time / 1700 + n.seed) * 0.03;
    const r = 21 * ease * breath * (1 + n.flash * 0.25);
    const rise = (1 - ease) * 90;
    const alpha = ease * (on ? 1 : 0.22) * (locked ? 0.35 : 1) * (fs && !fs.has(n.id) ? 0.4 : 1);
    const [c0, c1, c2] = nodeColors(n);
    const p = project(n.x, n.y + rise, n.z);
    const focused = n.id === (state.selected || state.hover);
    if (n.flash > 0.05 || focused || isPath(n)) {
      ctx.globalAlpha = alpha * Math.max(n.flash, 0.55) * 0.55;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * p.s * 1.75, 0, Math.PI * 2);
      ctx.fillStyle = isFlag(n) ? "rgba(255,107,129,0.45)" : "rgba(77,141,255,0.45)"; ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (isFlag(n) && !reduceMotion) {
      const c = (time % 1800) / 1800;
      ctx.globalAlpha = alpha * (1 - c);
      ctx.beginPath(); ctx.arc(p.x, p.y, r * p.s * (1 + c * 1.2), 0, Math.PI * 2);
      ctx.strokeStyle = "#ff6b81"; ctx.lineWidth = 2; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const sp = sphere(n.x, n.y + rise, n.z, r, c0, c1, c2, alpha);
    n.src.forEach((s, i) => {
      const off = (i - (n.src.length - 1) / 2) * 9 * sp.s;
      ctx.globalAlpha = alpha * (state.active[s] ? 1 : 0.2);
      ctx.beginPath(); ctx.arc(sp.x + off, sp.y + 6 * sp.s, 3.4 * sp.s, 0, Math.PI * 2);
      ctx.fillStyle = SRC[s].color; ctx.fill();
      ctx.globalAlpha = 1;
    });
    if (locked) {
      const lx = sp.x + sp.r * 0.85, ly = sp.y - sp.r * 0.95;
      ctx.strokeStyle = "#9aa6c7"; ctx.fillStyle = "#9aa6c7"; ctx.lineWidth = 1.6 * sp.s;
      ctx.fillRect(lx - 6 * sp.s, ly, 12 * sp.s, 9 * sp.s);
      ctx.beginPath(); ctx.arc(lx, ly, 3.6 * sp.s, Math.PI, 0); ctx.stroke();
    }
    n.sx = sp.x; n.sy = sp.y; n.s = sp.s; n.sr = sp.r;
    if (state.phase >= 1) hits.push({ type: "node", id: n.id, x: sp.x, y: sp.y, r: Math.max(18, sp.r + 6) });
  }

  function comet(a, b, head, tail, glow) {
    const g = ctx.createLinearGradient(b.x, b.y, a.x, a.y);
    g.addColorStop(0, tail);
    g.addColorStop(1, head);
    ctx.strokeStyle = g; ctx.lineWidth = 3 * a.s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.shadowColor = glow; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(a.x, a.y, 2.6 * a.s, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  function drawParticles(dt) {
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    particles = particles.filter((pt) => {
      pt.t += pt.sp * dt;
      if (pt.kind === "in") {
        const end = pt.target ? [pt.target.x, pt.target.y, pt.target.z] : pt.end;
        if (pt.t >= 1) {
          if (pt.target) pt.target.flash = Math.max(pt.target.flash, 0.7);
          else if (state.phase === 0) addRaw(pt.src.id, pt.end);
          return false;
        }
        const t = ease(pt.t);
        comet(projectArr(bez3(pt.a, pt.b, end, t)), projectArr(bez3(pt.a, pt.b, end, Math.max(0, t - 0.06))), rgba(pt.src.color, 0.9), rgba(pt.src.color, 0), pt.src.color);
        return true;
      }
      if (pt.t >= 1) { pt.out.ping = 1; return false; }
      const start = [pt.from.x, pt.from.y, pt.from.z];
      const end = panelCenter(pt.out);
      comet(projectArr(bez3(start, pt.b, end, pt.t)), projectArr(bez3(start, pt.b, end, Math.max(0, pt.t - 0.06))), "rgba(200,225,255,0.95)", "rgba(160,200,255,0)", "#4d8dff");
      return true;
    });
  }

  function curve(a, b, c, n) {
    const pts = [];
    for (let i = 0; i <= n; i += 1) pts.push(projectArr(bez3(a, b, c, i / n)));
    polyline(pts);
  }
  function drawFlowGuides(time) {
    ctx.setLineDash([3, 7]);
    ctx.lineDashOffset = -time * 0.03;
    ctx.lineWidth = 1.2;
    SOURCES.forEach((s) => {
      curve(srcTop(s), [-300, -110, s.z * 0.45], [-CORE_R * 0.7, CORE_TOP - 60, s.z * 0.35], 20);
      ctx.strokeStyle = rgba(s.color, (0.12 + 0.35 * s.level).toFixed(3)); ctx.stroke();
    });
    OUTPUTS.forEach((o) => {
      curve([CORE_R * 0.6, -60, o.z * 0.3], [340, -120, o.z * 0.6], panelCenter(o), 20);
      ctx.strokeStyle = `rgba(130,175,255,${(0.08 + 0.4 * o.level).toFixed(3)})`; ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  function drawTrace(time) {
    const id = state.selected || state.hover;
    if (!id || state.phase === 0) return;
    const n = nodeById.get(id);
    ctx.setLineDash([7, 6]);
    ctx.lineDashOffset = time * 0.05;
    n.src.forEach((sid) => {
      if (!state.active[sid]) return;
      const s = SRC[sid];
      curve([n.x, n.y, n.z], [-320, -220, (n.z + s.z) / 2], srcTop(s), 24);
      ctx.strokeStyle = rgba(s.color, 0.95); ctx.lineWidth = 2; ctx.shadowColor = s.color; ctx.shadowBlur = 10; ctx.stroke();
      ctx.shadowBlur = 0;
    });
    ctx.setLineDash([]);
  }

  function drawDome(time) {
    const lv = GOV[0].level;
    if (lv < 0.02) return;
    const R = CORE_R + 20;
    ctx.globalAlpha = lv;
    for (let k = 1; k <= 4; k += 1) {
      const lat = (k / 5) * (Math.PI / 2);
      poly(ring(0, CORE_TOP - Math.sin(lat) * R, 0, Math.cos(lat) * R, 48), null, "rgba(94,234,212,0.22)", 1);
    }
    const spin = reduceMotion ? 0 : time / 9000;
    for (let m = 0; m < 8; m += 1) {
      const a = spin + (m / 8) * Math.PI * 2;
      const pts = [];
      for (let i = 0; i <= 12; i += 1) {
        const lat = (i / 12) * (Math.PI / 2);
        pts.push(project(Math.cos(a) * Math.cos(lat) * R, CORE_TOP - Math.sin(lat) * R, Math.sin(a) * Math.cos(lat) * R));
      }
      polyline(pts);
      ctx.strokeStyle = "rgba(94,234,212,0.2)"; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawGovMarkers(time) {
    GOV.forEach((g) => {
      const x = Math.cos(g.angle) * GOV_R, z = Math.sin(g.angle) * GOV_R;
      const lv = g.level;
      const col = lv > 0.5 ? "#5eead4" : "#7faaff";
      line3([x, FLOOR, z], [x, FLOOR - 34, z], rgba(col, (0.5 + 0.5 * lv).toFixed(3)), 1.6);
      const p = project(x, FLOOR - 40, z);
      const r = (8 + lv * 3 + (reduceMotion ? 0 : Math.sin(time / 600 + g.angle))) * p.s;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y); ctx.closePath();
      ctx.fillStyle = lv > 0.5 ? "#5eead4" : "rgba(31,111,255,0.7)";
      ctx.shadowColor = col; ctx.shadowBlur = 12 + lv * 10; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1; ctx.stroke();
      poly(ring(x, FLOOR - 0.5, z, 18 + lv * 8, 20), null, rgba(col, (0.3 + 0.4 * lv).toFixed(3)), 1);
      text(g.label, x, FLOOR + 22, z, 13, lv > 0.5 ? "#ccfbf1" : "#c7d4f5", { min: 10, halo: true });
      hits.push({ type: "gov", id: g.id, x: p.x, y: p.y + 14 * p.s, r: Math.max(26, 36 * p.s) });
    });
  }

  function haloText(str, x, y, color) {
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(6,10,34,0.95)"; ctx.lineJoin = "round";
    ctx.strokeText(str, x, y); ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  function drawLabels(time) {
    const p = state.phase;
    SOURCES.forEach((s) => {
      const a = (0.45 + 0.55 * s.level).toFixed(3);
      const lt = text(s.label, s.x + 96, SLAB_TOP - 4, s.z, 14, `rgba(255,255,255,${a})`, { min: 10, halo: true, align: "left" });
      if (!MOBILE) {
        ctx.font = "500 11px Inter, system-ui, sans-serif"; ctx.globalAlpha = +a;
        haloText(s.sub, lt.x, lt.y + lt.fs + 2, "rgba(154,166,199,1)");
        ctx.globalAlpha = 1;
      }
      const st = project(s.x + 66, SLAB_TOP + 11, s.z - 57);
      ctx.beginPath(); ctx.arc(st.x, st.y, 4 * st.s, 0, Math.PI * 2);
      ctx.fillStyle = state.active[s.id] ? s.color : "rgba(255,255,255,0.25)";
      ctx.shadowColor = s.color; ctx.shadowBlur = state.active[s.id] ? 8 : 0; ctx.fill(); ctx.shadowBlur = 0;
    });
    OUTPUTS.forEach((o) => {
      const lt = text(o.label, o.x - 96, SLAB_TOP - 4, o.z, 14, `rgba(255,255,255,${(0.4 + 0.6 * o.level).toFixed(3)})`, { min: 10, halo: true, align: "right" });
      if (state.sup && (o.id === "reco" || o.id === "decide")) {
        ctx.font = "700 10.5px Inter, system-ui, sans-serif";
        haloText(o.id === "reco" ? "Supervisada" : "Decisión humana", lt.x, lt.y - lt.fs - 2, "#5eead4");
      }
    });
    text("PANELMAP", 0, CORE_TOP + 12, -CORE_R - 6, 13, "rgba(200,220,255,0.95)", { min: 10, weight: 700, family: "'Inter Tight', Inter, sans-serif", halo: true });

    const fs = focusSet();
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    NODES.forEach((n) => {
      if (n.appear < 0.3) return;
      const dim = fs && !fs.has(n.id);
      ctx.globalAlpha = n.appear * (nodeOn(n) ? 1 : 0.35) * (dim ? 0.45 : 1);
      haloText(n.label, n.sx, n.sy + n.sr + 13, "#e7ecfa");
      ctx.globalAlpha = 1;
    });

    const id = state.selected || state.hover;
    if (id && p >= 1) {
      const n = nodeById.get(id);
      const lines = [
        ["Origen: " + n.src.map((s) => SRC[s].label).join(" · "), "#c7d4f5"],
        ["Relacionado con: " + edges.filter((e) => e.a.id === id || e.b.id === id).map((e) => (e.a.id === id ? e.b : e.a).label).join(", "), "#9aa6c7"],
      ];
      if (state.perm && !ROLE_SCOPE.has(id)) lines.push(["Fuera del perfil Operaciones · acceso restringido", "#ffb3c0"]);
      else if (!nodeOn(n)) lines.push(["Sin fuentes activas · pierde su contexto", "#ffb3c0"]);
      const right = n.sx < W * 0.6;
      const dir = right ? 1 : -1;
      const x0 = n.sx + dir * (n.sr + 24);
      const y0 = n.sy - 26;
      ctx.strokeStyle = "rgba(127,170,255,0.7)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(n.sx + dir * n.sr, n.sy); ctx.lineTo(x0 - dir * 6, y0 + 6); ctx.stroke();
      ctx.textAlign = right ? "left" : "right"; ctx.textBaseline = "top";
      ctx.font = "700 14px 'Inter Tight', Inter, sans-serif";
      haloText(n.label, x0, y0, "#ffffff");
      ctx.font = "500 11.5px Inter, sans-serif";
      let row = 0;
      lines.forEach(([t, c]) => {
        wrap(t, Math.min(250, W * 0.45)).forEach((ln) => { haloText(ln, x0, y0 + 20 + row * 15, c); row += 1; });
      });
    }

    const cx = 0, cz = 60;
    const hud = (y) => (MOBILE ? { x: W / 2, y: HUD_Y + (y + 370) * 0.9 } : project(cx, y, cz));
    const head = (str, y, size, color, weight, alpha) => {
      const a = hud(y);
      ctx.font = `${weight || 600} ${size}px ${size >= 15 ? "'Inter Tight', Inter, sans-serif" : "Inter, system-ui, sans-serif"}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      haloText(str, a.x, a.y, color);
      ctx.globalAlpha = 1;
    };
    const maxW = Math.min(400, W * 0.86);
    if (p === 0) {
      const pct = Math.round((NODES.filter(nodeOn).length / NODES.length) * 100);
      const colr = pct === 100 ? "#ffffff" : pct >= 50 ? "#fbbf24" : "#ff6b81";
      text(pct + "%", SRC_X, SLAB_TOP - 196, ROWS[0], 28, colr, { min: 18, weight: 700, family: "'Inter Tight', Inter, sans-serif", halo: true });
      const t = text("Contexto disponible", SRC_X, SLAB_TOP - 172, ROWS[0], 12, "rgba(154,166,199,1)", { min: 10, halo: true });
      const bw = 120;
      ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fillRect(t.x - bw / 2, t.y + 12, bw, 3);
      ctx.fillStyle = pct === 100 ? "#4d8dff" : pct >= 50 ? "#f59e0b" : "#ff6b81"; ctx.fillRect(t.x - bw / 2, t.y + 12, (bw * pct) / 100, 3);
      head("Pulsa una fuente para conectarla o desconectarla", -300, 12, "rgba(154,166,199,1)", 500);
    }
    if (p === 1) {
      const activeEdges = edges.filter((e) => nodeOn(e.a) && nodeOn(e.b)).length;
      head(`${NODES.filter(nodeOn).length} elementos · ${activeEdges} relaciones · ${SOURCES.filter((s) => state.active[s.id]).length} fuentes`, -320, 16, "#ffffff", 600);
      head("Arrastra los elementos · haz clic para ver su origen", -294, 12, "rgba(154,166,199,1)", 500);
    }
    if (p === 2) {
      const orbit = reduceMotion ? 0 : time / 5000;
      const fade = Math.min(1, state.t / 600);
      ["Objetivos", "Indicadores", "Reglas"].forEach((w, i) => {
        const a = orbit + (i / 3) * Math.PI * 2;
        const x = Math.cos(a) * 235, z = Math.sin(a) * 235;
        const pp = project(x, -215, z);
        ctx.globalAlpha = fade;
        ctx.beginPath(); ctx.arc(pp.x, pp.y, 4 * pp.s, 0, Math.PI * 2);
        ctx.fillStyle = "#4d8dff"; ctx.shadowColor = "#4d8dff"; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        text(w, x, -237, z, 13, "#b7d0ff", { min: 10, halo: true, alpha: fade });
      });
      head("Desviación del margen respecto al objetivo", -340, 15, "#ffb3c0", 600);
      head("Patrón detectado: incidencias del servicio ↔ margen", -314, 12, "#fcd34d", 500);
    }
    if (p === 3) {
      ctx.font = "600 17px 'Inter Tight', Inter, sans-serif";
      const caret = !reduceMotion && Math.floor(time / 500) % 2 === 0 ? "▍" : "";
      const lines = wrap(QUERY.slice(0, state.queryChars) + caret, maxW);
      lines.forEach((ln, i) => head(ln, -350 + i * 24, 17, "#ffffff", 600));
      if (state.answerT > 0) {
        ctx.font = "500 13px Inter, sans-serif";
        wrap(ANSWER, maxW).forEach((ln, i) => head(ln, -350 + lines.length * 24 + 8 + i * 18, 13, "#b7d0ff", 500, state.answerT));
      }
    }
    if (p === 4) {
      head("RECOMENDACIÓN PARA VALORAR", -370, 11, "#4d8dff", 700);
      ctx.font = "600 16px 'Inter Tight', Inter, sans-serif";
      const lines = wrap(RECO, Math.min(480, W * 0.86));
      lines.forEach((ln, i) => head(ln, -346 + i * 22, 16, "#ffffff", 600));
      const by = -346 + lines.length * 22 + 4;
      if (!state.decided) {
        const c = hud(by);
        const label = "El equipo decide actuar";
        ctx.font = "600 13px Inter, sans-serif";
        const w = ctx.measureText(label).width + 32;
        const h = 34;
        const bx = c.x - w / 2;
        ctx.fillStyle = "#1f6fff"; ctx.shadowColor = "#1f6fff"; ctx.shadowBlur = 16 + (reduceMotion ? 0 : Math.sin(time / 400) * 6);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, c.y, w, h, 8); else ctx.rect(bx, c.y, w, h);
        ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, c.x, c.y + h / 2);
        hits.push({ type: "decide", x: c.x, y: c.y + h / 2, rect: [bx, c.y, w, h] });
      } else {
        head("Decisión del equipo responsable · seguimiento activo", by + 14, 13, "#5eead4", 600);
      }
    }
  }

  /* ---------- Frame ---------- */
  let last = 0;
  let raf = 0;
  function frame(time) {
    const dt = last ? Math.min(64, time - last) : 16;
    last = time;
    tick(dt);
    moveCamera(dt, time);
    simulate(dt, time);
    spawn(dt);
    hits = [];

    ctx.clearRect(0, 0, W, H);
    drawFloor(time);
    drawCore(time);
    drawFlowGuides(time);
    if (raw.length) drawRaw();

    const solids = [];
    SOURCES.forEach((s) => solids.push({ z: cam3(s.x, SLAB_TOP, s.z).z, f: () => drawSource(s, time) }));
    OUTPUTS.forEach((o) => solids.push({ z: cam3(o.x, SLAB_TOP, o.z).z, f: () => drawOutput(o, time) }));
    solids.sort((a, b) => b.z - a.z).forEach((d) => d.f());

    NODES.forEach((n) => {
      const ease = 1 - Math.pow(1 - n.appear, 3);
      const p = project(n.x, n.y + (1 - ease) * 90, n.z);
      n.sx = p.x; n.sy = p.y; n.s = p.s; n.cz = p.z;
    });
    drawEdges(time);
    NODES.slice().sort((a, b) => b.cz - a.cz).forEach((n) => drawNode(n, time));
    drawDome(time);
    drawGovMarkers(time);
    drawParticles(dt);
    drawTrace(time);
    drawLabels(time);

    if (state.inView) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf) cancelAnimationFrame(raf);
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  /* ---------- Interaction ---------- */
  const PRIORITY = { decide: 0, node: 1, gov: 2, src: 3, out: 4 };
  function hitAt(x, y) {
    const found = hits.filter((h) => (h.rect ? x >= h.rect[0] && x <= h.rect[0] + h.rect[2] && y >= h.rect[1] && y <= h.rect[1] + h.rect[3] : Math.hypot(x - h.x, y - h.y) <= h.r));
    found.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);
    return found[0] || null;
  }
  function toggleSource(id) {
    state.active[id] = !state.active[id];
    if (state.active[id] && state.phase === 0) for (let i = 0; i < 6; i += 1) addRaw(id, randomOnCore());
  }
  function toggleGov(id) {
    state[id] = !state[id];
    if (state.phase === 0 && (id === "perm" || id === "trace")) setPhase(1);
    if (id === "trace") state.selected = state.trace ? state.selected || "resultados" : null;
    if (id === "sup" && state.sup && state.phase < 4) setPhase(4);
  }

  let drag = null;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  canvas.addEventListener("pointerdown", (e) => {
    const p = local(e);
    const h = hitAt(p.x, p.y);
    drag = { x: p.x, y: p.y, lx: p.x, ly: p.y, moved: false, hit: h, node: null };
    if (h && h.type === "node") {
      const n = nodeById.get(h.id);
      n.drag = true;
      drag.node = n;
    }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = local(e);
    if (e.pointerType !== "touch") {
      pointer.tx = (p.x / W - 0.5) * 2;
      pointer.ty = (p.y / H - 0.5) * 2;
    }
    if (!drag) {
      const h = hitAt(p.x, p.y);
      state.hover = h && h.type === "node" ? h.id : null;
      canvas.classList.toggle("is-pointer", Boolean(h));
      return;
    }
    if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) > 5) {
      drag.moved = true;
      userTook();
      canvas.classList.add("is-dragging");
    }
    const dx = p.x - drag.lx, dy = p.y - drag.ly;
    drag.lx = p.x; drag.ly = p.y;
    if (!drag.moved) return;
    if (drag.node) {
      const n = drag.node;
      const s = Math.max(0.3, n.s);
      const d = unrotate(dx / s, dy / s);
      n.x = Math.max(-CORE_R + 30, Math.min(CORE_R - 30, n.x + d.x));
      n.y = Math.max(-260, Math.min(CORE_TOP - 40, n.y + d.y));
      n.z = Math.max(-CORE_R + 30, Math.min(CORE_R - 30, n.z + d.z));
      n.vx = 0; n.vy = 0; n.vz = 0;
    } else {
      user.yaw = Math.max(-0.9, Math.min(0.9, user.yaw + dx * 0.005));
      user.pitch = Math.max(-0.3, Math.min(0.35, user.pitch + dy * 0.003));
    }
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    canvas.classList.remove("is-dragging");
    if (d.node) {
      d.node.drag = false;
      if (d.moved) { d.node.tx = d.node.x; d.node.ty = d.node.y; d.node.tz = d.node.z; }
    }
    if (d.moved || e.type === "pointercancel") return;
    const h = d.hit;
    userTook();
    if (!h) { if (!state.trace) state.selected = null; return; }
    if (h.type === "node") state.selected = state.selected === h.id ? null : h.id;
    else if (h.type === "src") toggleSource(h.id);
    else if (h.type === "gov") toggleGov(h.id);
    else if (h.type === "decide") decide();
    else if (h.type === "out") setPhase(OUTPUTS.find((o) => o.id === h.id).from);
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => { pointer.tx = 0; pointer.ty = 0; if (!drag) state.hover = null; });
  canvas.addEventListener("dblclick", () => { user.yaw = 0; user.pitch = 0; });

  steps.forEach((b, i) => {
    b.addEventListener("click", () => { userTook(); setPhase(i); });
    b.addEventListener("keydown", (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d === undefined) return;
      e.preventDefault(); userTook(); setPhase(state.phase + d); steps[state.phase].focus();
    });
  });
  const prev = $("procPrev");
  const next = $("procNext");
  if (prev) prev.addEventListener("click", () => { userTook(); setPhase(state.phase - 1); });
  if (next) next.addEventListener("click", () => { userTook(); setPhase(state.phase + 1); });
  if (playBtn) playBtn.addEventListener("click", () => {
    const on = !state.playing;
    setPlaying(on);
    if (on) state.t = Math.min(state.t, DURATIONS[state.phase] - 1200);
  });
  section.querySelectorAll("[data-a11y-src]").forEach((b) => b.addEventListener("click", () => { userTook(); toggleSource(b.getAttribute("data-a11y-src")); }));
  section.querySelectorAll("[data-a11y-gov]").forEach((b) => b.addEventListener("click", () => { userTook(); toggleGov(b.getAttribute("data-a11y-gov")); }));

  /* ---------- Boot ---------- */
  layout();
  trig();
  cam.zoom = BASEZOOM;
  setPhase(0);
  setPlaying(state.playing);
  if ("ResizeObserver" in window) new ResizeObserver(layout).observe(section);
  else window.addEventListener("resize", layout);
  new IntersectionObserver((entries) => {
    const v = Boolean(entries[0] && entries[0].isIntersecting);
    if (v === state.inView) return;
    state.inView = v;
    if (v) { layout(); start(); }
  }, { threshold: 0.1 }).observe(section);
  frame(0);
})();
