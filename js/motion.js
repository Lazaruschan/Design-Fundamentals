(function () {
  var root = document.documentElement;
  var body = document.body;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var isHome = body.classList.contains("page-home");
  var ready = false;

  function emitReady() {
    if (ready) return;
    ready = true;
    body.classList.add("is-ready");
    document.dispatchEvent(new CustomEvent("df:ready"));
  }

  /* ---------- Loader and page transitions ---------- */

  var loader = document.getElementById("loader");
  var EASE_MS = 900;

  function buildSlots(el) {
    el.innerHTML = "";
    var cols = [];
    for (var c = 0; c < 3; c++) {
      var col = document.createElement("span");
      col.className = "slot";
      var strip = document.createElement("span");
      strip.className = "slot-strip";
      for (var d = 0; d <= 9; d++) {
        var s = document.createElement("span");
        s.textContent = d;
        strip.appendChild(s);
      }
      col.appendChild(strip);
      el.appendChild(col);
      cols.push(strip);
    }
    var pct = document.createElement("span");
    pct.className = "slot-pct";
    pct.textContent = "%";
    el.appendChild(pct);
    return function (n) {
      var str = ("00" + Math.round(n)).slice(-3);
      for (var i = 0; i < 3; i++) cols[i].style.transform = "translateY(" + (-Number(str[i]) * 10) + "%)";
    };
  }

  function hideLoader() {
    if (!loader) return emitReady();
    loader.classList.add("is-gone");
    setTimeout(emitReady, reduce ? 0 : 350);
  }

  function runLoader() {
    if (!loader) return emitReady();
    loader.classList.add("is-live");
    var page = loader.querySelector(".loader-page");
    if (page) page.textContent = loader.dataset.label || "";

    var first = false;
    try { first = !sessionStorage.getItem("df-seen"); sessionStorage.setItem("df-seen", "1"); } catch (e) {}

    if (reduce) {
      loader.classList.add("mode-page", "no-anim");
      hideLoader();
      return;
    }

    if (!first) {
      loader.classList.add("mode-page");
      requestAnimationFrame(function () { setTimeout(hideLoader, 120); });
      return;
    }

    var slots = loader.querySelector("[data-count-slots]");
    var setCount = slots ? buildSlots(slots) : function () {};
    var loaded = document.readyState === "complete";
    window.addEventListener("load", function () { loaded = true; });
    var start = performance.now();
    var shown = 0;

    (function tick(now) {
      var t = now - start;
      var target = Math.min(1, t / 1500);
      if (!loaded && t < 4000) target = Math.min(target, 0.86);
      shown += (target - shown) * 0.12;
      if (target >= 1 && shown > 0.995) shown = 1;
      setCount(shown * 100);
      if (shown < 1) return requestAnimationFrame(tick);
      setTimeout(function () {
        loader.classList.add("is-out");
        setTimeout(hideLoader, EASE_MS - 200);
      }, 180);
    })(start);
  }

  window.dfGo = function (href, label) {
    if (!loader || reduce) { window.location.assign(href); return; }
    var page = loader.querySelector(".loader-page");
    if (page) page.textContent = cleanLabel(label);
    loader.classList.remove("is-out");
    loader.classList.add("mode-page", "is-prep");
    void loader.offsetWidth;
    loader.classList.remove("is-gone", "is-prep");
    loader.classList.add("is-leaving");
    setTimeout(function () { window.location.assign(href); }, 620);
  };

  function cleanLabel(label) {
    var text = String(label || "").replace(/\s+/g, " ").replace(/[\u2192\u2191]/g, "").trim();
    return text.length > 48 ? text.slice(0, 46) + "..." : text;
  }

  window.addEventListener("pageshow", function (e) {
    if (e.persisted && loader) {
      loader.classList.remove("is-leaving");
      loader.classList.add("is-gone");
    }
  });

  /* ---------- Split text with blur-in letters ---------- */

  function splitLetters(el) {
    if (el.dataset.splitDone) return el.querySelectorAll(".ch");
    el.dataset.splitDone = "1";
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var word = document.createElement("span");
        word.className = "wd";
        Array.from(part).forEach(function (c) {
          var ch = document.createElement("span");
          ch.className = "ch";
          ch.textContent = c;
          ch.style.setProperty("--d", Math.round(Math.random() * 520) + "ms");
          word.appendChild(ch);
        });
        frag.appendChild(word);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return el.querySelectorAll(".ch");
  }

  function setupHeadings() {
    var targets = Array.prototype.slice.call(document.querySelectorAll("[data-split], .digest h1"));
    if (isHome) targets = targets.filter(function (el) { return !el.closest(".about"); });
    targets.forEach(function (el) {
      if (el.tagName === "H1" && !el.hasAttribute("aria-label")) el.setAttribute("aria-label", el.textContent.trim());
      splitLetters(el);
      el.classList.add("split");
    });
    var cycle = document.querySelector("[data-cycle]");
    if (cycle) {
      splitLetters(cycle);
      cycle.classList.add("split");
    }
    function reveal() {
      targets.forEach(function (el) { el.classList.add("is-in"); });
      if (cycle) {
        cycle.classList.add("is-in");
        startCycle(cycle);
      }
    }
    if (ready) reveal(); else document.addEventListener("df:ready", reveal, { once: true });
  }

  function startCycle(el) {
    if (reduce) return;
    var words = el.dataset.cycle.split("|");
    var i = 0;
    setInterval(function () {
      if (document.hidden) return;
      el.classList.remove("is-in");
      el.classList.add("is-out");
      setTimeout(function () {
        i = (i + 1) % words.length;
        el.textContent = words[i];
        delete el.dataset.splitDone;
        splitLetters(el);
        el.classList.remove("is-out");
        void el.offsetWidth;
        el.classList.add("is-in");
        document.dispatchEvent(new CustomEvent("df:word", { detail: { word: words[i], index: i } }));
      }, 700);
    }, 4600);
  }

  /* ---------- Custom cursor ---------- */

  var cursor = null;
  var ring = null;
  var ringLabel = null;

  function setupCursor() {
    if (!finePointer || reduce) return;
    cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = '<span class="cursor-dot"></span><span class="cursor-ring"><em></em></span>';
    body.appendChild(cursor);
    ring = cursor.querySelector(".cursor-ring");
    ringLabel = ring.querySelector("em");
    root.classList.add("has-cursor");

    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    var dot = cursor.querySelector(".cursor-dot");
    window.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate(" + mx + "px," + my + "px)";
      cursor.classList.add("is-visible");
    }, { passive: true });
    document.addEventListener("pointerleave", function () { cursor.classList.remove("is-visible"); });
    window.addEventListener("pointerdown", function () { cursor.classList.add("is-down"); });
    window.addEventListener("pointerup", function () { cursor.classList.remove("is-down"); });

    (function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = "translate(" + rx + "px," + ry + "px)";
      requestAnimationFrame(loop);
    })();

    var sceneLabel = "";
    document.addEventListener("df:cursor", function (e) {
      sceneLabel = e.detail || "";
      applyLabel(null);
    });

    function applyLabel(target) {
      var interactive = target && target.closest("a, button, summary, label, [data-cursor]");
      var text = "";
      if (interactive) {
        text = interactive.getAttribute("data-cursor") || "";
        if (!text && interactive.closest(".directory, .pager, .outro")) text = "Open";
        if (!text && interactive.matches(".digest figure img")) text = "Zoom";
      } else if (target && target.closest(".digest figure img")) {
        text = "Zoom";
      }
      if (!text && !interactive && sceneLabel) text = sceneLabel;
      cursor.classList.toggle("is-link", !!interactive || !!text);
      cursor.classList.toggle("has-label", !!text);
      ringLabel.textContent = text;
    }

    document.addEventListener("pointerover", function (e) { applyLabel(e.target); });
  }

  /* ---------- Magnetic buttons ---------- */

  function setupMagnetic() {
    if (!finePointer || reduce) return;
    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.3;
        var y = (e.clientY - r.top - r.height / 2) * 0.4;
        el.style.transform = "translate(" + x + "px," + y + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* ---------- Menu overlay ---------- */

  function setupMenu() {
    var toggle = document.querySelector("[data-menu-toggle]");
    var panel = document.getElementById("menu");
    if (!toggle || !panel) return;
    var label = toggle.querySelector("span");
    function set(open) {
      body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (label) { label.textContent = open ? "Close" : "Menu"; label.dataset.text = label.textContent; }
      if (open) {
        panel.removeAttribute("inert");
        var first = panel.querySelector("a");
        if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 300);
      } else {
        panel.setAttribute("inert", "");
      }
    }
    toggle.addEventListener("click", function () { set(!body.classList.contains("menu-open")); });
    panel.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && body.classList.contains("menu-open")) { set(false); toggle.focus(); }
    });
    panel.querySelectorAll(".menu-list li").forEach(function (li, i) { li.style.setProperty("--i", i); });
    var here = location.pathname.split("/").pop() || "index.html";
    panel.querySelectorAll("a[href]").forEach(function (a) {
      if (a.getAttribute("href") === here) a.setAttribute("aria-current", "page");
    });
  }

  /* ---------- Header, progress bar, scroll velocity ---------- */

  var scrollVel = 0;

  function setupScroll() {
    var head = document.querySelector(".site-head");
    var bar = document.querySelector(".progress");
    var last = window.scrollY;
    function onScroll() {
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
      if (head) {
        var down = y > last && y > 160;
        head.classList.toggle("is-hidden", down && !body.classList.contains("menu-open"));
        head.classList.toggle("is-solid", y > 40);
      }
      scrollVel += (y - last);
      last = y;
      root.style.setProperty("--scroll", (y / innerHeight).toFixed(4));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Scroll reveal ---------- */

  function setupReveal() {
    var selectors = [
      ".digest > h2", ".digest > h3", ".digest > p", ".digest > ul", ".digest > ol",
      ".digest > table", ".digest > blockquote", ".digest > pre", ".digest > details",
      ".digest .chart", ".digest .figs > figure", ".digest > figure", ".digest .cards > div",
      ".pager a", ".see", ".sec-label", ".browse-head",
      ".directory li", ".outro-link", ".outro-foot", ".cross-rule"
    ];
    var els = document.querySelectorAll(selectors.join(","));
    if (reduce || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
    var lastParent = null, idx = 0;
    els.forEach(function (el) {
      if (el.closest(".about .digest") && !el.matches(".sec-label")) return;
      if (el.parentElement !== lastParent) { lastParent = el.parentElement; idx = 0; }
      if (el.matches(".figs > figure, .cards > div, .directory li")) {
        el.style.setProperty("--stagger", (idx++ % 6) * 70 + "ms");
      }
      el.setAttribute("data-reveal", "");
      io.observe(el);
    });
  }

  /* ---------- Home: statement words light up while scrolling ---------- */

  function setupStatement() {
    var el = document.querySelector(".about .digest .meta");
    if (!el) return;
    var words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.innerHTML = words.map(function (w) { return '<span class="sw" aria-hidden="true">' + w.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span>"; }).join(" ");
    var spans = el.querySelectorAll(".sw");
    function update() {
      var r = el.getBoundingClientRect();
      var p = (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35);
      p = Math.max(0, Math.min(1, p));
      var lit = Math.round(p * spans.length);
      for (var i = 0; i < spans.length; i++) spans[i].classList.toggle("on", i < lit);
    }
    if (reduce) { spans.forEach(function (s) { s.classList.add("on"); }); return; }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  /* ---------- Home: marquee reacts to scroll speed ---------- */

  function setupMarquee() {
    var track = document.querySelector(".marquee-track");
    if (!track || reduce) return;
    var x = 0, boost = 0, last = performance.now();
    (function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      boost += (Math.abs(scrollVel) * 0.6 - boost) * 0.08;
      scrollVel *= 0.85;
      var dir = scrollVel < -0.5 ? -1 : 1;
      var w = track.scrollWidth / 2;
      x -= (28 + boost * 4) * dt * dir;
      if (w > 0) { if (x <= -w) x += w; if (x > 0) x -= w; }
      track.style.transform = "translate3d(" + x + "px,0,0)";
      requestAnimationFrame(loop);
    })(last);
  }

  /* ---------- Home: floating preview for guide rows ---------- */

  function setupPreview() {
    var box = document.querySelector(".dir-preview");
    if (!box || !finePointer || reduce) return;
    var img = box.querySelector("img");
    var x = 0, y = 0, tx = 0, ty = 0, on = false;
    document.querySelectorAll(".directory a").forEach(function (a) {
      var thumb = a.querySelector(".dir-thumb");
      a.addEventListener("pointerenter", function () {
        if (!thumb) return;
        img.src = thumb.currentSrc || thumb.src;
        on = true;
        box.classList.add("is-on");
      });
      a.addEventListener("pointerleave", function () { on = false; box.classList.remove("is-on"); });
    });
    window.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() {
      var dx = tx - x;
      x += dx * 0.14;
      y += (ty - y) * 0.14;
      box.style.transform = "translate(" + x + "px," + y + "px) rotate(" + Math.max(-12, Math.min(12, dx * 0.08)) + "deg)";
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- Guides: figure lightbox ---------- */

  function setupLightbox() {
    var imgs = document.querySelectorAll(".digest figure img");
    if (!imgs.length) return;
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Enlarged figure");
    box.innerHTML = '<button class="lightbox-close" type="button">Close</button><figure><img alt=""><figcaption></figcaption></figure>';
    body.appendChild(box);
    var big = box.querySelector("img");
    var cap = box.querySelector("figcaption");
    var closeBtn = box.querySelector(".lightbox-close");
    var lastFocus = null;
    function close() {
      box.classList.remove("is-open");
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }
    imgs.forEach(function (im) {
      im.setAttribute("tabindex", "0");
      im.setAttribute("role", "button");
      function open() {
        lastFocus = im;
        big.src = im.currentSrc || im.src;
        big.alt = im.alt || "";
        var fc = im.closest("figure").querySelector("figcaption");
        cap.textContent = fc ? fc.textContent : (im.alt || "");
        box.classList.add("is-open");
        closeBtn.focus({ preventScroll: true });
      }
      im.addEventListener("click", open);
      im.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
    box.addEventListener("click", function (e) { if (e.target === box || e.target === closeBtn || e.target === big) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("is-open")) close(); });
  }

  /* ---------- Hold-to-blast feedback from the 3D scene ---------- */

  function setupHoldFeedback() {
    document.addEventListener("df:hold", function (e) {
      var p = e.detail || 0;
      root.style.setProperty("--hold", p.toFixed(3));
      body.classList.toggle("is-holding", p > 0.01);
    });
    document.addEventListener("df:blast", function () {
      body.classList.remove("blast");
      void body.offsetWidth;
      body.classList.add("blast");
    });
  }

  setupHeadings();
  setupCursor();
  setupMagnetic();
  setupMenu();
  setupScroll();
  setupReveal();
  setupStatement();
  setupMarquee();
  setupPreview();
  setupLightbox();
  setupHoldFeedback();
  runLoader();
})();
