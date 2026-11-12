"use strict";

(function () {
  const doc = document.documentElement;
  doc.classList.add("js");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SVG_NS = "http://www.w3.org/2000/svg";

  /* ---------- Navigation ---------- */
  function initNav() {
    const nav = document.getElementById("nav");
    const toggle = document.getElementById("navToggle");
    const links = document.getElementById("navLinks");
    if (!nav || !toggle || !links) return;

    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      links.classList.toggle("is-open", open);
      nav.classList.toggle("menu-open", open);
    };
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    links.addEventListener("click", (e) => {
      if (e.target instanceof Element && e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    const anchors = Array.from(links.querySelectorAll('a[href^="#"]:not(.btn)'));
    const sections = anchors
      .map((a) => document.querySelector(a.getAttribute("href")))
      .filter((s) => s instanceof HTMLElement);

    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          anchors.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + entry.target.id));
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const siblings = el.parentElement ? Array.from(el.parentElement.children).filter((c) => c.classList.contains("reveal")) : [];
          const index = Math.max(0, siblings.indexOf(el));
          el.style.transitionDelay = Math.min(index * 70, 350) + "ms";
          el.classList.add("is-visible");
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Hero network canvas ---------- */
  function initHeroCanvas() {
    const canvas = document.getElementById("heroCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = ["#4d8dff", "#8b5cf6", "#14b8a6", "#b7d0ff"];
    const pointer = { x: -9999, y: -9999 };
    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes = [];
    let packets = [];
    let running = true;
    let frame = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(Math.min(90, Math.max(32, (width * height) / 16000)));
      nodes = Array.from({ length: count }, () => {
        const biasRight = Math.random() < 0.65;
        return {
          x: biasRight ? width * (0.45 + Math.random() * 0.55) : Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: 1.4 + Math.random() * 2.2,
          c: colors[Math.floor(Math.random() * colors.length)],
        };
      });
      packets = [];
    }

    const linkDist = () => Math.min(170, Math.max(110, width / 9));

    function step() {
      if (!running) return;
      frame += 1;
      ctx.clearRect(0, 0, width, height);
      const maxD = linkDist();

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;

        const dx = pointer.x - n.x;
        const dy = pointer.y - n.y;
        const d = Math.hypot(dx, dy);
        if (d < 180 && d > 1) {
          n.x += (dx / d) * 0.35;
          n.y += (dy / d) * 0.35;
        }
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < maxD) {
            const alpha = (1 - d / maxD) * 0.42;
            ctx.strokeStyle = "rgba(110, 160, 255," + alpha.toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            if (frame % 18 === 0 && packets.length < 24 && Math.random() < 0.012) {
              packets.push({ a, b, t: 0, speed: 0.008 + Math.random() * 0.012 });
            }
          }
        }
      }

      packets = packets.filter((p) => {
        p.t += p.speed;
        if (p.t >= 1 || Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) > maxD) return false;
        const x = p.a.x + (p.b.x - p.a.x) * p.t;
        const y = p.a.y + (p.b.y - p.a.y) * p.t;
        ctx.fillStyle = "rgba(200, 220, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      for (const n of nodes) {
        ctx.fillStyle = n.c;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(step);
    }

    resize();
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    });

    const hero = canvas.parentElement;
    if (hero) {
      hero.addEventListener("pointermove", (e) => {
        const rect = canvas.getBoundingClientRect();
        pointer.x = e.clientX - rect.left;
        pointer.y = e.clientY - rect.top;
      });
      hero.addEventListener("pointerleave", () => {
        pointer.x = -9999;
        pointer.y = -9999;
      });
    }

    if (reduceMotion) {
      running = true;
      step();
      running = false;
      return;
    }

    const visibility = new IntersectionObserver((entries) => {
      const visible = entries[0] ? entries[0].isIntersecting : true;
      if (visible && !running) {
        running = true;
        requestAnimationFrame(step);
      } else if (!visible) {
        running = false;
      }
    });
    visibility.observe(canvas);
    requestAnimationFrame(step);
  }

  /* ---------- Problem / Solution ---------- */
  function initProblemSolution() {
    const ps = document.getElementById("ps");
    const svg = document.getElementById("psSvg");
    const title = document.getElementById("psTitle");
    const tabProblem = document.getElementById("tabProblem");
    const tabSolution = document.getElementById("tabSolution");
    const panelProblem = document.getElementById("panelProblem");
    const panelSolution = document.getElementById("panelSolution");
    if (!ps || !svg || !title || !tabProblem || !tabSolution || !panelProblem || !panelSolution) return;
    const switchEl = tabProblem.parentElement;

    const titles = {
      problem: "Tener datos no basta para saber dónde actuar.",
      solution: "Primero comprendemos tu organización. Después adaptamos la plataforma.",
    };

    const el = (name, attrs) => {
      const node = document.createElementNS(SVG_NS, name);
      Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
      return node;
    };

    const silos = [
      { x: 24, y: 56, w: 186, h: 340, label: "ERP · Gestión", type: "a" },
      { x: 250, y: 40, w: 246, h: 166, label: "Documentos", type: "b" },
      { x: 250, y: 246, w: 246, h: 166, label: "Contexto", type: "c" },
    ];

    const problemPos = {
      a: [[70, 120], [150, 160], [88, 230], [160, 290], [96, 350]],
      b: [[300, 100], [380, 86], [450, 120], [330, 170], [420, 172]],
      c: [[296, 310], [372, 292], [450, 320], [330, 380], [420, 380]],
    };

    const types = ["a", "b", "c"];
    const fills = { a: "#1f6fff", b: "#8b5cf6", c: "#14b8a6" };
    const cx = 260;
    const cy = 220;
    const nodes = [];
    for (let i = 0; i < 5; i += 1) {
      types.forEach((t) => nodes.push({ type: t, p: problemPos[t][i] }));
    }
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const radius = i % 2 === 0 ? 172 : 118;
      n.s = [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
    });

    const gSilos = el("g", {});
    silos.forEach((s) => {
      gSilos.appendChild(el("rect", { class: "ps-silo", x: s.x, y: s.y, width: s.w, height: s.h, rx: 14 }));
      const label = el("text", { class: "ps-silo-label", x: s.x + 14, y: s.y + 24 });
      label.textContent = s.label;
      gSilos.appendChild(label);
    });
    [[230, 140], [230, 300], [373, 226]].forEach(([x, y]) => {
      gSilos.appendChild(el("path", { class: "ps-x", d: `M${x - 6} ${y - 6}l12 12M${x + 6} ${y - 6}l-12 12` }));
    });
    svg.appendChild(gSilos);

    const gLinks = el("g", {});
    const pairs = [];
    nodes.forEach((_, i) => {
      pairs.push([i, -1]);
      pairs.push([i, (i + 1) % nodes.length]);
      if (i % 3 === 0) pairs.push([i, (i + 5) % nodes.length]);
    });
    pairs.forEach(([i, j]) => {
      const a = nodes[i].s;
      const b = j === -1 ? [cx, cy] : nodes[j].s;
      const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const line = el("line", { class: "ps-link", x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
      line.style.strokeDasharray = String(length);
      line.style.strokeDashoffset = String(length);
      if (j === -1) line.style.strokeWidth = "0.8";
      gLinks.appendChild(line);
    });
    svg.appendChild(gLinks);

    const core = el("g", { class: "ps-core" });
    core.appendChild(el("circle", { cx, cy, r: 62, fill: "none", stroke: "#4d8dff", "stroke-opacity": 0.3 }));
    core.appendChild(el("circle", { cx, cy, r: 46, fill: "#1f6fff" }));
    const coreText = el("text", { x: cx, y: cy + 5, "text-anchor": "middle" });
    coreText.textContent = "PANELMAP";
    core.appendChild(coreText);
    svg.appendChild(core);

    const gNodes = el("g", {});
    const nodeEls = nodes.map((n, i) => {
      const g = el("g", { class: "psn" });
      g.style.transitionDelay = (i * 35) + "ms";
      g.appendChild(el("circle", { class: "psn__ring", r: 15 }));
      let shape;
      if (n.type === "a") shape = el("rect", { x: -9, y: -9, width: 18, height: 18, rx: 4 });
      else if (n.type === "b") shape = el("circle", { r: 9.5 });
      else shape = el("path", { d: "M0 -11 L10 7 L-10 7 Z" });
      shape.setAttribute("class", "psn__shape");
      shape.setAttribute("fill", fills[n.type]);
      g.appendChild(shape);
      gNodes.appendChild(g);
      return g;
    });
    svg.appendChild(gNodes);

    function place(state) {
      nodeEls.forEach((g, i) => {
        const [x, y] = state === "solution" ? nodes[i].s : nodes[i].p;
        g.style.transform = `translate(${x}px, ${y}px)`;
      });
    }

    function setState(state, focusTab) {
      if (ps.dataset.state === state) return;
      ps.dataset.state = state;
      const isSolution = state === "solution";
      if (switchEl) switchEl.classList.toggle("is-solution", isSolution);
      tabProblem.setAttribute("aria-selected", String(!isSolution));
      tabSolution.setAttribute("aria-selected", String(isSolution));
      tabProblem.tabIndex = isSolution ? -1 : 0;
      tabSolution.tabIndex = isSolution ? 0 : -1;
      panelProblem.hidden = isSolution;
      panelSolution.hidden = !isSolution;
      place(state);

      title.classList.add("is-fading");
      window.setTimeout(() => {
        title.textContent = titles[state];
        title.classList.remove("is-fading");
      }, 220);

      if (focusTab) (isSolution ? tabSolution : tabProblem).focus();
    }

    place("problem");
    [tabProblem, tabSolution].forEach((tab) => {
      tab.addEventListener("click", () => setState(tab.dataset.state || "problem", false));
      tab.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          setState(ps.dataset.state === "problem" ? "solution" : "problem", true);
        }
      });
    });
    ps.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setState(btn.getAttribute("data-go") || "problem", false);
        const head = document.querySelector(".ps__head");
        if (head && head.getBoundingClientRect().top < 0) head.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  /* ---------- AI questions typewriter ---------- */
  function initAsk() {
    const text = document.getElementById("askText");
    const chips = document.getElementById("askChips");
    if (!text || !chips) return;
    const buttons = Array.from(chips.querySelectorAll("button"));
    const questions = buttons.map((b) => b.textContent || "");
    let index = 0;
    let timer = 0;
    let typing = 0;

    const mark = (i) => buttons.forEach((b, j) => b.classList.toggle("is-active", i === j));

    function type(i) {
      window.clearInterval(typing);
      window.clearTimeout(timer);
      index = i;
      mark(i);
      const target = questions[i];
      if (reduceMotion) {
        text.textContent = target;
        return;
      }
      let n = 0;
      text.textContent = "";
      typing = window.setInterval(() => {
        n += 1;
        text.textContent = target.slice(0, n);
        if (n >= target.length) {
          window.clearInterval(typing);
          timer = window.setTimeout(() => type((index + 1) % questions.length), 2600);
        }
      }, 45);
    }

    buttons.forEach((b, i) => b.addEventListener("click", () => type(i)));

    const io = new IntersectionObserver((entries) => {
      if (entries[0] && entries[0].isIntersecting) {
        type(index);
      } else {
        window.clearInterval(typing);
        window.clearTimeout(timer);
        text.textContent = questions[index];
      }
    });
    io.observe(text);
  }

  /* ---------- FAQ ---------- */
  function initFaq() {
    const list = document.getElementById("faqList");
    const search = document.getElementById("faqSearch");
    const empty = document.getElementById("faqEmpty");
    if (!list || !(search instanceof HTMLInputElement) || !empty) return;
    const items = Array.from(list.querySelectorAll("details"));

    items.forEach((item) => {
      item.addEventListener("toggle", () => {
        if (!item.open || search.value.trim()) return;
        items.forEach((other) => {
          if (other !== item) other.open = false;
        });
      });
    });

    const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const summaries = items.map((item) => {
      const summary = item.querySelector("summary");
      return { summary, text: summary ? summary.textContent || "" : "" };
    });

    function highlight(summary, original, query) {
      if (!summary) return;
      summary.textContent = "";
      if (!query) {
        summary.textContent = original;
        return;
      }
      const hay = normalize(original);
      let from = 0;
      let at = hay.indexOf(query, from);
      while (at !== -1) {
        summary.appendChild(document.createTextNode(original.slice(from, at)));
        const m = document.createElement("mark");
        m.textContent = original.slice(at, at + query.length);
        summary.appendChild(m);
        from = at + query.length;
        at = hay.indexOf(query, from);
      }
      summary.appendChild(document.createTextNode(original.slice(from)));
    }

    search.addEventListener("input", () => {
      const query = normalize(search.value.trim());
      let shown = 0;
      items.forEach((item, i) => {
        const match = !query || normalize(item.textContent || "").includes(query);
        item.hidden = !match;
        if (match) shown += 1;
        highlight(summaries[i].summary, summaries[i].text, query);
        item.open = Boolean(query) && match;
      });
      empty.hidden = shown > 0;
    });
  }

  /* ---------- Contact form ---------- */
  function initForm() {
    const form = document.getElementById("contactForm");
    const status = document.getElementById("formStatus");
    if (!(form instanceof HTMLFormElement) || !status) return;

    const fields = Array.from(form.querySelectorAll("input, select"));
    const check = (field) => {
      const wrap = field.closest(".field");
      const valid = field.checkValidity() && (!field.required || field.value.trim() !== "");
      if (wrap) wrap.classList.toggle("is-invalid", !valid);
      return valid;
    };

    fields.forEach((f) => {
      f.addEventListener("blur", () => {
        if (f.value) check(f);
      });
      f.addEventListener("input", () => {
        const wrap = f.closest(".field");
        if (wrap && wrap.classList.contains("is-invalid")) check(f);
      });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const invalid = fields.filter((f) => !check(f));
      if (invalid.length) {
        invalid[0].focus();
        status.textContent = "Revisa los campos marcados.";
        return;
      }

      const endpoint = form.dataset.endpoint || "";
      if (!endpoint) {
        status.textContent = "Formulario listo. Falta configurar el destino de envío (data-endpoint).";
        return;
      }

      const submit = form.querySelector('button[type="submit"]');
      if (submit instanceof HTMLButtonElement) submit.disabled = true;
      status.textContent = "Enviando…";
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        if (!response.ok) throw new Error(String(response.status));
        form.reset();
        status.textContent = "Gracias. Te contactaremos en breve.";
      } catch {
        status.textContent = "No se ha podido enviar. Inténtalo de nuevo más tarde.";
      } finally {
        if (submit instanceof HTMLButtonElement) submit.disabled = false;
      }
    });
  }

  /* ---------- Misc ---------- */
  function initMisc() {
    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());

    const play = document.getElementById("videoPlay");
    const soon = document.getElementById("videoSoon");
    if (play && soon) play.addEventListener("click", () => { soon.hidden = false; });
  }

  initNav();
  initReveal();
  initHeroCanvas();
  initProblemSolution();
  initAsk();
  initFaq();
  initForm();
  initMisc();
})();
