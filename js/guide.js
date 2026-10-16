(function () {
  var input = document.getElementById("q");
  var empty = document.getElementById("empty");
  var side = document.querySelector(".sidebar");
  var btn = document.querySelector(".side-toggle");
  var narrow = window.matchMedia("(max-width: 1020px)");

  function applySearch() {
    if (!input) return;
    var n = input.value.trim().toLowerCase();
    var shown = 0;
    document.querySelectorAll(".sidebar [data-search]").forEach(function (a) {
      var ok = !n || a.dataset.search.indexOf(n) !== -1;
      a.hidden = !ok;
      if (ok) shown += 1;
    });
    document.querySelectorAll(".side-group").forEach(function (g) {
      var any = false;
      g.querySelectorAll("[data-search]").forEach(function (a) { if (!a.hidden) any = true; });
      g.hidden = !any;
    });
    var listed = 0;
    document.querySelectorAll(".directory [data-search]").forEach(function (a) {
      var ok = !n || a.dataset.search.indexOf(n) !== -1;
      var li = a.closest("li");
      if (li) li.hidden = !ok;
      if (ok) listed += 1;
    });
    if (empty) empty.hidden = (side ? shown : listed) !== 0;
  }

  if (input) input.addEventListener("input", applySearch);

  var currentLink = document.querySelector('.sidebar a[aria-current="page"]');
  if (currentLink && side) {
    var linkTop = currentLink.getBoundingClientRect().top;
    var sideTop = side.getBoundingClientRect().top;
    side.scrollTop += linkTop - sideTop - side.clientHeight / 2 + currentLink.offsetHeight / 2;
  }

  var backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  document.body.appendChild(backdrop);
  var lastFocus = null;

  function setOpen(open) {
    if (!side) return;
    side.classList.toggle("open", open);
    backdrop.classList.toggle("show", open);
    document.body.classList.toggle("nav-open", open);
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "Close" : "Guides";
    }
    if (open) {
      lastFocus = document.activeElement;
      if (input) input.focus();
    } else if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
      lastFocus = null;
    }
  }

  function drawerOpen() {
    return side && side.classList.contains("open") && narrow.matches;
  }

  function focusable() {
    return Array.prototype.slice.call(side.querySelectorAll("a, input, button")).filter(function (el) {
      return !el.hidden && el.offsetParent !== null;
    });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || a.target === "_blank" || a.hasAttribute("download")) return;
    var url = new URL(a.href, window.location.href);
    var samePage = url.origin === window.location.origin && url.pathname === window.location.pathname;
    if (samePage && url.hash) {
      var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
        history.replaceState(null, "", url.hash);
        return;
      }
    }
    e.preventDefault();
    if (window.dfGo && /\.html?$/i.test(url.pathname) && url.protocol === window.location.protocol) {
      window.dfGo(a.href, a.dataset.label || a.textContent);
    } else {
      window.location.assign(a.href);
    }
  });

  if (btn && side) {
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "sidebar");
    btn.addEventListener("click", function () {
      setOpen(!side.classList.contains("open"));
    });
    backdrop.addEventListener("click", function () { setOpen(false); });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && side && side.classList.contains("open")) setOpen(false);
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && input) {
      var t = e.target;
      var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (!typing) {
        e.preventDefault();
        if (narrow.matches) setOpen(true);
        else input.focus();
      }
    }
    if (e.key !== "Tab" || !drawerOpen()) return;
    var items = focusable();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  var tocLinks = Array.prototype.slice.call(
    document.querySelectorAll(".rail a[href^='#'], .jump a[href^='#']")
  );
  var seen = {};
  var sections = [];
  tocLinks.forEach(function (a) {
    var id = a.getAttribute("href").slice(1);
    if (seen[id]) return;
    var el = document.getElementById(id);
    if (!el) return;
    seen[id] = true;
    sections.push(el);
  });

  function spy() {
    if (!sections.length) return;
    var current = sections[0];
    sections.forEach(function (el) {
      if (el.getBoundingClientRect().top <= 100) current = el;
    });
    tocLinks.forEach(function (a) {
      if (a.getAttribute("href") === "#" + current.id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  }

  if (sections.length) {
    spy();
    document.addEventListener("scroll", spy, { passive: true });
  }
})();
