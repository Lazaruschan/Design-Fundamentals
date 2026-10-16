(function () {
  var canvas = document.getElementById("scene");
  if (!canvas) return;

  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";

  function webglOK() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }

  if (!webglOK()) { document.documentElement.classList.add("no-webgl"); return; }

  import(THREE_URL).then(start).catch(function () {
    document.documentElement.classList.add("no-webgl");
  });

  function start(THREE) {
    var mode = canvas.dataset.scene === "home" ? "home" : "page";
    var cat = canvas.dataset.cat || "00";
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var narrow = window.matchMedia("(max-width: 760px)");

    var BG = 0x0b1428;
    var ORANGE = 0xff6a2b;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mode === "home" ? 1.75 : 1.25));
    renderer.setClearColor(BG, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(BG, 10, 46);

    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    camera.position.set(0, 0, 14);

    /* ---------- Light ---------- */

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    var key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-6, 8, 10);
    scene.add(key);
    var rim = new THREE.PointLight(ORANGE, 60, 40, 1.6);
    rim.position.set(7, -2, -4);
    scene.add(rim);
    var cool = new THREE.PointLight(0x4c7fd4, 30, 40, 1.6);
    cool.position.set(-8, 3, -2);
    scene.add(cool);

    /* ---------- Shared builders ---------- */

    function glass(accent) {
      return new THREE.MeshPhysicalMaterial({
        color: 0x101b34,
        metalness: 0.55,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
        emissive: new THREE.Color(accent || 0x000000),
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0.94
      });
    }

    function lines(geo, curved, opacity) {
      var g = curved ? new THREE.WireframeGeometry(geo) : new THREE.EdgesGeometry(geo, 20);
      var m = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: opacity == null ? (curved ? 0.08 : 0.42) : opacity });
      return new THREE.LineSegments(g, m);
    }

    function form(geo, opts) {
      opts = opts || {};
      var group = new THREE.Group();
      var mesh = new THREE.Mesh(geo, glass(opts.accent));
      var edge = lines(opts.wire || geo, !!opts.curved, opts.edgeOpacity);
      group.add(mesh);
      group.add(edge);
      group.userData = {
        mesh: mesh,
        edge: edge,
        edgeBase: edge.material.opacity,
        accent: opts.accent || 0xffffff,
        label: opts.label || "",
        href: opts.href || "",
        base: new THREE.Vector3(),
        offset: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        spin: new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3),
        phase: Math.random() * Math.PI * 2,
        hover: 0,
        intro: 0
      };
      mesh.userData.owner = group;
      return group;
    }

    /* ---------- Stars ---------- */

    var STAR_N = mode === "home" ? 1600 : 900;
    var starGeo = new THREE.BufferGeometry();
    var starPos = new Float32Array(STAR_N * 3);
    for (var i = 0; i < STAR_N; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 90;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 60;
      starPos[i * 3 + 2] = -Math.random() * 60 + 8;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc5d4ea, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false }));
    scene.add(stars);

    /* ---------- Warp streaks ---------- */

    var STREAK_N = mode === "home" ? 48 : 20;
    var streakGeo = new THREE.BufferGeometry();
    var sPos = new Float32Array(STREAK_N * 6);
    var sCol = new Float32Array(STREAK_N * 6);
    var streaks = [];
    function resetStreak(s, anywhere) {
      var a = Math.random() * Math.PI * 2;
      var r = 3 + Math.pow(Math.random(), 0.7) * 22;
      s.x = Math.cos(a) * r;
      s.y = Math.sin(a) * r * 0.65;
      s.z = anywhere ? -Math.random() * 70 + 10 : -70 - Math.random() * 10;
      s.speed = 1.1 + Math.random() * 1.8;
      s.len = 0.25 + Math.random() * 0.7;
      var hot = Math.random() < 0.09;
      s.c = hot ? [1, 0.42, 0.17] : [0.72, 0.8, 0.92];
    }
    for (i = 0; i < STREAK_N; i++) {
      var s = {};
      resetStreak(s, true);
      streaks.push(s);
    }
    streakGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    streakGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 3));
    var streakMesh = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: mode === "home" ? 0.32 : 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    scene.add(streakMesh);

    /* ---------- Orbit arcs ---------- */

    var arcs = new THREE.Group();
    [[16, 0.35, 0.1], [22, -0.5, 0.06], [12, 1.1, 0.07]].forEach(function (a) {
      var curve = new THREE.EllipseCurve(0, 0, a[0], a[0] * 0.55, 0, Math.PI * 2);
      var g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160));
      var l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: a[2] }));
      l.rotation.set(1.2, a[1], 0.4);
      arcs.add(l);
    });
    scene.add(arcs);

    /* ---------- Sparks for the blast ---------- */

    var SPARK_N = 360;
    var sparkGeo = new THREE.BufferGeometry();
    var spPos = new Float32Array(SPARK_N * 3);
    var spVel = new Float32Array(SPARK_N * 3);
    for (i = 0; i < SPARK_N * 3; i++) spPos[i] = 9999;
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
    var sparkMat = new THREE.PointsMaterial({ color: ORANGE, size: 0.12, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    var sparks = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparks);

    function burst(origin) {
      for (var k = 0; k < SPARK_N; k++) {
        spPos[k * 3] = origin.x; spPos[k * 3 + 1] = origin.y; spPos[k * 3 + 2] = origin.z;
        var v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(6 + Math.random() * 16);
        spVel[k * 3] = v.x; spVel[k * 3 + 1] = v.y; spVel[k * 3 + 2] = v.z;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = 1;
    }

    /* ---------- Forms ---------- */

    var forms = [];
    var stage = new THREE.Group();
    scene.add(stage);

    function place(f, x, y, z) {
      f.userData.base.set(x, y, z);
      f.position.set(x, y, z);
      stage.add(f);
      forms.push(f);
      return f;
    }

    if (mode === "home") {
      // Kandinsky's three: blue circle, red square, yellow triangle, with a line and a plane.
      var sphere = form(new THREE.SphereGeometry(1.25, 48, 32), {
        accent: 0x2f5bff, curved: true, wire: new THREE.IcosahedronGeometry(1.27, 2), edgeOpacity: 0.16,
        label: "Point / 01", href: "01_design-basics.html"
      });
      var cube = form(new THREE.BoxGeometry(2, 2, 2), { accent: 0xff3b2f, label: "Space / 12", href: "12_architecture-space.html" });
      var prism = form(new THREE.CylinderGeometry(1.45, 1.45, 1.3, 3), { accent: 0xffc21a, label: "Colour / 02", href: "02_colour.html" });
      prism.children.forEach(function (c) { c.rotation.x = Math.PI / 2; });
      var line = form(new THREE.BoxGeometry(0.12, 7.5, 0.12), { accent: 0xffffff, label: "Grid / 04", href: "04_layout-grid.html", edgeOpacity: 0.7 });
      var plane = form(new THREE.BoxGeometry(3.4, 3.4, 0.06), { accent: ORANGE, label: "Type / 03", href: "03_typography.html", edgeOpacity: 0.55 });
      var ring = form(new THREE.TorusGeometry(0.85, 0.07, 16, 96), { accent: 0xffffff, curved: true, label: "Form / 15", href: "15_theory-psychology.html", edgeOpacity: 0.1 });

      place(sphere, -1.6, 1.2, 0.6);
      place(cube, 2.4, -0.4, -0.8);
      place(prism, 0.2, -2.1, 1.4);
      place(line, 0.6, 0.4, -1.6);
      line.rotation.z = -0.7;
      place(plane, 3.2, 2.3, -3);
      plane.rotation.set(0.3, -0.5, 0.2);
      place(ring, -3.3, -1.6, -0.6);

      var floor = new THREE.GridHelper(120, 120, 0x2a3d5c, 0x152240);
      floor.position.y = -6.5;
      floor.material.transparent = true;
      floor.material.opacity = 0.5;
      scene.add(floor);
    } else {
      buildPageForm(cat);
    }

    function buildPageForm(n) {
      var g;
      var A = ORANGE;
      switch (n) {
        case "01": place(form(new THREE.IcosahedronGeometry(2.4, 0), { accent: A }), 0, 0, 0); break;
        case "02":
          [[0xff3b2f, -0.9, 0.5], [0x3bff6a, 0.9, 0.5], [0x2f5bff, 0, -0.9]].forEach(function (c) {
            place(form(new THREE.SphereGeometry(1.35, 40, 24), { accent: c[0], curved: true, wire: new THREE.IcosahedronGeometry(1.37, 1) }), c[1], c[2], 0);
          });
          break;
        case "03": place(form(new THREE.TorusGeometry(1.9, 0.62, 24, 72), { accent: A, curved: true, wire: new THREE.TorusGeometry(1.92, 0.64, 8, 24) }), 0, 0, 0); break;
        case "04":
          for (var gx = -1; gx <= 1; gx++) for (var gy = -1; gy <= 1; gy++) {
            place(form(new THREE.BoxGeometry(1.1, 1.1, 0.4 + Math.random() * 0.8), { accent: A }), gx * 1.4, gy * 1.4, 0);
          }
          break;
        case "05": place(form(new THREE.OctahedronGeometry(2.5, 0), { accent: A }), 0, 0, 0); break;
        case "06": place(form(new THREE.BoxGeometry(2.6, 3.2, 1.6), { accent: A }), 0, 0, 0); break;
        case "07":
        case "18":
          for (var p = 0; p < 9; p++) {
            var page = place(form(new THREE.BoxGeometry(2.4, 3.2, 0.05), { accent: A, edgeOpacity: 0.5 }), 0, 0, (p - 4) * 0.22);
            page.userData.fan = (p - 4) * 0.09;
          }
          break;
        case "08":
          [1.2, 2.4, 1.7, 3.1, 2.2].forEach(function (h, k) {
            place(form(new THREE.BoxGeometry(0.7, h, 0.7), { accent: k === 3 ? A : 0xffffff }), (k - 2) * 0.95, h / 2 - 1.5, 0);
          });
          break;
        case "09": place(form(new THREE.TorusKnotGeometry(1.5, 0.42, 160, 20), { accent: A, curved: true, wire: new THREE.TorusKnotGeometry(1.52, 0.44, 64, 6) }), 0, 0, 0); break;
        case "10": place(form(new THREE.DodecahedronGeometry(2.3, 0), { accent: A }), 0, 0, 0); break;
        case "11":
          place(form(new THREE.BoxGeometry(4.2, 2.8, 4.2), { accent: A, edgeOpacity: 0.5 }), 0, 0, 0).userData.mesh.material.opacity = 0.12;
          place(form(new THREE.BoxGeometry(1.2, 0.6, 0.8), { accent: A }), -0.8, -1.1, 0.6);
          break;
        case "12":
          place(form(new THREE.TorusGeometry(1.8, 0.3, 16, 48, Math.PI), { accent: A, curved: true, wire: new THREE.TorusGeometry(1.8, 0.3, 6, 16, Math.PI) }), 0, 0.4, 0);
          place(form(new THREE.BoxGeometry(0.6, 2.6, 0.6), { accent: A }), -1.8, -0.9, 0);
          place(form(new THREE.BoxGeometry(0.6, 2.6, 0.6), { accent: A }), 1.8, -0.9, 0);
          break;
        case "13": place(form(new THREE.CylinderGeometry(1.3, 1.3, 3.2, 48), { accent: A, curved: true, wire: new THREE.CylinderGeometry(1.32, 1.32, 3.2, 16, 4) }), 0, 0, 0); break;
        case "14":
          for (var h2 = 0; h2 < 16; h2++) {
            var ang = h2 * 0.55;
            place(form(new THREE.BoxGeometry(0.5, 0.5, 0.5), { accent: h2 % 4 ? 0xffffff : A }), Math.cos(ang) * 1.8, (h2 - 8) * 0.32, Math.sin(ang) * 1.8);
          }
          break;
        case "15":
          for (var c6 = 0; c6 < 7; c6++) {
            var a6 = (c6 / 7) * Math.PI * 2;
            place(form(new THREE.SphereGeometry(0.5, 24, 16), { accent: A, curved: true, wire: new THREE.IcosahedronGeometry(0.52, 1) }), Math.cos(a6) * 2, Math.sin(a6) * 2, 0);
          }
          break;
        case "16":
          for (var tx = -2; tx <= 2; tx++) for (var ty = -2; ty <= 2; ty++) {
            if ((tx + ty) % 2) continue;
            var t = place(form(new THREE.TetrahedronGeometry(0.6, 0), { accent: A }), tx * 1.05, ty * 1.05, 0);
            t.rotation.z = (tx + ty) * 0.4;
          }
          break;
        case "20": place(form(new THREE.ConeGeometry(1.6, 3.4, 48, 1, true), { accent: A, curved: true, wire: new THREE.ConeGeometry(1.62, 3.4, 16, 3, true) }), 0, 0, 0); break;
        default: place(form(new THREE.IcosahedronGeometry(2.2, 1), { accent: A }), 0, 0, 0);
      }
    }

    /* ---------- Interaction state ---------- */

    var pointer = new THREE.Vector2(0, 0);
    var pointerSmooth = new THREE.Vector2(0, 0);
    var ndc = new THREE.Vector2(-2, -2);
    var raycaster = new THREE.Raycaster();
    var hovered = null;
    var holding = false;
    var pressAt = 0;
    var charge = 0;
    var lastCharge = -1;
    var warp = 0;
    var shake = 0;
    var intro = 0;
    var started = false;
    var lastLabel = null;
    var heroEl = document.querySelector(".hero");

    function inHero(target) {
      return heroEl && heroEl.contains(target) && !target.closest("a, button, input, label");
    }

    function setLabel(text) {
      if (text === lastLabel) return;
      lastLabel = text;
      document.dispatchEvent(new CustomEvent("df:cursor", { detail: text }));
    }

    window.addEventListener("pointermove", function (e) {
      pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (mode === "home" && inHero(e.target)) ndc.copy(pointer);
      else ndc.set(-2, -2);
    }, { passive: true });

    if (mode === "home" && heroEl) {
      heroEl.addEventListener("pointerdown", function (e) {
        if (!inHero(e.target) || e.button > 0) return;
        holding = true;
        pressAt = performance.now();
      });
      window.addEventListener("pointerup", function () {
        if (!holding) return;
        holding = false;
        if (performance.now() - pressAt < 240 && hovered && hovered.userData.href) {
          var href = hovered.userData.href;
          if (window.dfGo) window.dfGo(href, hovered.userData.label); else location.assign(href);
        }
      });
      window.addEventListener("blur", function () { holding = false; });
      heroEl.addEventListener("contextmenu", function (e) { if (holding) e.preventDefault(); });
    }

    function blast() {
      burst(new THREE.Vector3(0, 0, 0));
      shake = 1;
      warp = 1;
      forms.forEach(function (f) {
        var d = f.userData.base.clone().normalize();
        if (d.lengthSq() < 0.01) d.set(Math.random() - 0.5, Math.random() - 0.5, 0.5).normalize();
        f.userData.vel.add(d.multiplyScalar(14 + Math.random() * 10));
        f.userData.vel.z += 6 + Math.random() * 8;
        f.userData.spin.multiplyScalar(-1).addScalar((Math.random() - 0.5) * 2);
      });
      document.dispatchEvent(new CustomEvent("df:blast"));
    }

    document.addEventListener("df:ready", function () { started = true; });
    setTimeout(function () { started = true; }, 4500);

    /* ---------- Layout ---------- */

    function layout() {
      var w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (mode === "home") {
        var s = narrow.matches ? 0.62 : Math.min(1, Math.max(0.68, (w / h) / 2));
        stage.scale.setScalar(s);
        stage.position.x = narrow.matches ? 0 : 2.6 * Math.min(1.2, (w / h) / 1.6);
        stage.position.y = narrow.matches ? -1.8 : 0;
      } else {
        stage.scale.setScalar(narrow.matches ? 0.8 : 1);
        stage.position.x = narrow.matches ? 0 : 5.2;
      }
    }
    layout();
    window.addEventListener("resize", layout);

    /* ---------- Loop ---------- */

    var clock = new THREE.Clock();
    var running = true;
    var time = 0;
    var tmp = new THREE.Vector3();

    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      if (running) { clock.getDelta(); requestAnimationFrame(frame); }
    });

    function frame() {
      if (!running) return;
      var dt = Math.min(0.05, clock.getDelta());
      var ts = reduce ? 0.15 : 1;
      time += dt * ts;
      var scrollY = window.scrollY / innerHeight;

      if (started) intro = Math.min(1, intro + dt * 0.7);
      var introE = 1 - Math.pow(1 - intro, 3);

      // Charge while holding; blast at full charge.
      if (holding && !reduce) {
        charge = Math.min(1, charge + dt * 0.75);
        if (charge >= 1) { blast(); charge = 0; holding = false; }
      } else {
        charge = Math.max(0, charge - dt * 1.8);
      }
      if (charge !== lastCharge) {
        lastCharge = charge;
        document.dispatchEvent(new CustomEvent("df:hold", { detail: charge }));
      }
      warp = Math.max(0, warp - dt * 0.9);
      shake = Math.max(0, shake - dt * 1.6);

      pointerSmooth.lerp(pointer, 0.05);

      // Streaks: a slow drift that becomes warp speed on charge and blast.
      var speedMul = (0.45 + charge * 6 + warp * 12 + (1 - introE) * 2) * ts;
      var lenMul = 1 + charge * 2.5 + warp * 4 + (1 - introE) * 1.5;
      for (var k = 0; k < STREAK_N; k++) {
        var st = streaks[k];
        st.z += st.speed * dt * speedMul;
        if (st.z > camera.position.z + 2) resetStreak(st, false);
        var tail = st.z - st.len * lenMul;
        var o = k * 6;
        sPos[o] = st.x; sPos[o + 1] = st.y; sPos[o + 2] = st.z;
        sPos[o + 3] = st.x; sPos[o + 4] = st.y; sPos[o + 5] = tail;
        sCol[o] = st.c[0]; sCol[o + 1] = st.c[1]; sCol[o + 2] = st.c[2];
        sCol[o + 3] = 0; sCol[o + 4] = 0; sCol[o + 5] = 0;
      }
      streakGeo.attributes.position.needsUpdate = true;
      streakGeo.attributes.color.needsUpdate = true;

      stars.rotation.z += dt * 0.004 * ts;
      arcs.rotation.z += dt * 0.03 * ts;
      arcs.rotation.y = pointerSmooth.x * 0.1;

      // Sparks
      if (sparkMat.opacity > 0) {
        for (k = 0; k < SPARK_N; k++) {
          spVel[k * 3] *= 0.97; spVel[k * 3 + 1] = spVel[k * 3 + 1] * 0.97 - dt * 4; spVel[k * 3 + 2] *= 0.97;
          spPos[k * 3] += spVel[k * 3] * dt; spPos[k * 3 + 1] += spVel[k * 3 + 1] * dt; spPos[k * 3 + 2] += spVel[k * 3 + 2] * dt;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        sparkMat.opacity = Math.max(0, sparkMat.opacity - dt * 0.55);
      }

      // Hover
      var hit = null;
      if (mode === "home" && ndc.x > -1.5) {
        raycaster.setFromCamera(ndc, camera);
        var meshes = forms.map(function (f) { return f.userData.mesh; });
        var hits = raycaster.intersectObjects(meshes, false);
        if (hits.length) hit = hits[0].object.userData.owner;
      }
      hovered = hit;
      if (mode === "home") setLabel(hovered ? hovered.userData.label : (ndc.x > -1.5 ? "Hold" : ""));

      // Forms
      for (k = 0; k < forms.length; k++) {
        var f = forms[k];
        var u = f.userData;
        var stagger = Math.max(0, Math.min(1, introE * 1.6 - k * 0.08));
        var e = 1 - Math.pow(1 - stagger, 3);

        // Spring back to rest after a blast; tremble while charging.
        u.vel.addScaledVector(u.offset, -dt * 9);
        u.vel.multiplyScalar(Math.pow(0.18, dt));
        u.offset.addScaledVector(u.vel, dt);
        var jit = charge * 0.12 + shake * 0.2;
        var bob = Math.sin(time * 0.9 + u.phase) * 0.18;

        f.position.set(
          u.base.x * (1 + charge * 0.35) + u.offset.x + (Math.random() - 0.5) * jit,
          u.base.y * (1 + charge * 0.35) + u.offset.y + bob + (Math.random() - 0.5) * jit,
          u.base.z + u.offset.z + (Math.random() - 0.5) * jit
        );

        var spinMul = (1 + charge * 6 + warp * 4) * ts;
        f.rotation.x += u.spin.x * dt * spinMul;
        f.rotation.y += u.spin.y * dt * spinMul;
        if (u.fan != null) f.rotation.y = u.fan + Math.sin(time * 0.6) * 0.35;

        u.hover += ((f === hovered ? 1 : 0) - u.hover) * 0.12;
        f.scale.setScalar(Math.max(0.0001, e * (1 + u.hover * 0.12 + charge * 0.08)));
        u.mesh.material.emissiveIntensity = mode === "home" ? u.hover * 1.4 + charge * 0.5 + warp * 0.8 : 0.08 + Math.sin(time + k) * 0.04;
        u.edge.material.opacity = u.edgeBase + u.hover * 0.5 + charge * 0.3;
      }

      // Stage and camera
      if (mode === "home") {
        stage.rotation.y = pointerSmooth.x * 0.35 + time * 0.05;
        stage.rotation.x = -pointerSmooth.y * 0.2 + scrollY * 0.5;
        stage.position.y = (narrow.matches ? -1.8 : 0.35) + scrollY * 4.2;
        camera.fov = 40 + charge * 14 + warp * 18;
      } else {
        stage.rotation.y = time * 0.12 + scrollY * 0.35 + pointerSmooth.x * 0.2;
        stage.rotation.x = 0.25 + scrollY * 0.08 - pointerSmooth.y * 0.1;
        stage.position.y = Math.sin(time * 0.4) * 0.2;
        camera.fov = 40;
      }
      camera.updateProjectionMatrix();
      tmp.set(pointerSmooth.x * 0.8, pointerSmooth.y * 0.5, 14);
      camera.position.lerp(tmp, 0.05);
      camera.position.x += (Math.random() - 0.5) * shake * 0.3;
      camera.position.y += (Math.random() - 0.5) * shake * 0.3;
      camera.lookAt(0, 0, 0);
      rim.intensity = 60 + charge * 140 + warp * 200;

      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }

    canvas.classList.add("is-on");
    requestAnimationFrame(frame);
  }
})();
