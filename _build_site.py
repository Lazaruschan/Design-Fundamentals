# -*- coding: utf-8 -*-
"""Rebuild the guide shell around each page's digest.

Each page keeps its own content inside <div class="digest">. This script reads
that content back and rewrites everything around it: the sidebar and its search
index, the jump links, the contents rail, the pager, and the directory on the
home page. Edit a digest, then run this to refresh the navigation.

usage: python _build_site.py
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

CATEGORIES = [
    ("01", "design-basics", "Design Basics & Composition"),
    ("02", "colour", "Colour"),
    ("03", "typography", "Typography & Lettering"),
    ("04", "layout-grid", "Layout & Grid Systems"),
    ("05", "logo-branding", "Logo & Branding"),
    ("06", "packaging", "Packaging"),
    ("07", "book-print", "Book Design & Print"),
    ("08", "infographics", "Information Graphics"),
    ("09", "interaction-ux", "Interaction, Web & UX"),
    ("10", "graphic-practice", "Graphic Design Practice"),
    ("11", "interior", "Interior Design"),
    ("12", "architecture-space", "Architecture & Space"),
    ("13", "product", "Product Design"),
    ("14", "design-art-history", "Design & Art History"),
    ("15", "theory-psychology", "Design Theory & Psychology"),
    ("16", "pattern-ornament", "Pattern & Ornament"),
    ("18", "magazines-annuals", "Magazines & Annuals"),
    ("20", "advertising", "Advertising"),
]

SUMMARY = {
    "01": "Point, line, plane, composition, and the four design principles",
    "02": "Hue, value, chroma, colour systems, palettes, and colour psychology",
    "03": "Letter structure, classification, typesetting, and mixed Chinese and Latin type",
    "04": "Grids, hierarchy, and arranging image with text",
    "05": "Mark types, identity systems, and brand strategy",
    "06": "Structure, the shelf, materials, and brand",
    "07": "Book structure, paper, binding, and print",
    "08": "Visualising information and explaining with diagrams",
    "09": "Goal-directed design, usability, and interface principles",
    "10": "Process, design thinking, creative methods, and practice",
    "11": "Drawings, scale, light, materials, construction, and furnishing",
    "12": "Form, space, order, and proportion",
    "13": "Minimalism, ten principles of good design, and Muji",
    "14": "From manuscripts and Arts and Crafts through the Bauhaus to the digital era",
    "15": "Gestalt, cognition, emotional design, and Kenya Hara",
    "16": "Pattern structure, Chinese and Western motifs, and auspicious meaning",
    "18": "How to look at annuals and magazines",
    "20": "Positioning, AIDA, creative tactics, and point of purchase",
}

COURSE = {
    "01": "Week 2, 6–7",
    "02": "Week 8",
    "03": "Week 9",
    "04": "Week 3, 4, 5",
    "05": "Week 10, 11",
    "06": "Week 11",
    "07": "Week 5, 9",
    "08": "Week 4",
    "09": "Week 11 (and 4)",
    "10": "Week 1, 11",
    "11": "Further reading",
    "12": "Week 2, 6–7",
    "13": "Week 11 (and 6–7)",
    "14": "Week 1",
    "15": "Week 4, 6–7, 10",
    "16": "Week 8 (and 6–7)",
    "18": "Week 1–13",
    "20": "Week 10, 11",
}

DIGEST_OPEN = '<div class="digest">\n'
DIGEST_CLOSE = "\n      </div>\n"
H1_RE = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.S)
H2_RE = re.compile(r'<h2\s+id="([^"]+)"[^>]*>(.*?)</h2>', re.S)
BOOK_RE = re.compile(r'<h3\s+class="book"[^>]*>(.*?)</h3>', re.S)
ORIG_TITLE_RE = re.compile(r"<p><strong>Original title:</strong>\s*(.*?)</p>", re.S)
IMG_RE = re.compile(r"<img\b([^>]*)>", re.S)
ATTR_RE = re.compile(r'(\w+)="([^"]*)"')
CJK_RE = re.compile(r"[\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]")
# Book titles stay in Traditional Chinese: marked with lang="zh-Hant", in double angle
# brackets inside diagrams, and copied into the sidebar search index.
ZH_ALLOWED_RE = re.compile(r'<span lang="zh-Hant">.*?</span>|\u300a[^\u300b\n]*\u300b|\sdata-search="[^"]*"')

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0b1428">
  <title>@@TITLE@@</title>
  <script>document.documentElement.classList.add("js");</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/guide.css">
</head>
"""

LOGO = (
    '<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true">'
    '<circle cx="11" cy="11" r="7.5"/><rect x="22.5" y="3.5" width="14" height="14"/>'
    '<path d="M3.5 36.5 11 22.5l7.5 14z"/><path d="M22.5 36.5l14-14"/></svg>'
)

BOLT = (
    '<svg class="bolt" viewBox="0 0 10 16" aria-hidden="true">'
    '<path d="M6.2 0 0 9.2h3.9L2.9 16 10 6.1H5.9z"/></svg>'
)

CHROME = """  <a class="skip" href="#content">Skip to content</a>
  <div class="loader" id="loader" data-label="@@LABEL@@" aria-hidden="true">
    <p class="loader-label">SSHD2382 / Design Fundamentals</p>
    <div class="loader-box">
      <span class="plus tl"></span><span class="plus tr"></span><span class="plus bl"></span><span class="plus br"></span>
      @@LOGO@@
    </div>
    <p class="loader-count" data-count-slots></p>
    <p class="loader-page"></p>
  </div>
  <header class="site-head">
    <a class="logo" href="index.html" aria-label="Design Fundamentals, home">@@LOGO@@<span>Fundamentals<sup>&reg;</sup></span></a>
    <nav class="head-nav" aria-label="Site">
      <a class="pill pill-solid" href="index.html#browse" data-magnetic><span data-text="Browse">Browse</span></a>
      <button class="pill pill-line" type="button" aria-expanded="false" aria-controls="menu" data-menu-toggle data-magnetic><span data-text="Menu">Menu</span><i class="burger" aria-hidden="true"></i></button>
    </nav>
  </header>
  <div class="menu-panel" id="menu" inert>
    <div class="menu-inner">
      <p class="menu-label">(Guides)</p>
      <ol class="menu-list">@@MENU@@</ol>
      <div class="menu-foot"><span>SSHD2382 Design Fundamentals</span><span>Eighteen guides, thirteen weeks</span><a href="index.html">Home</a></div>
    </div>
  </div>
  <canvas class="scene" id="scene" data-scene="@@SCENE@@" data-cat="@@CAT@@" aria-hidden="true"></canvas>
  <div class="progress" aria-hidden="true"></div>
"""

SCRIPTS = """  <script src="js/guide.js"></script>
  <script src="js/motion.js"></script>
  <script src="js/scene.js"></script>
"""

MERMAID = """  <script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true, theme: "dark", themeVariables: { background: "#101b34", primaryColor: "#1b2b4d", primaryTextColor: "#e6eef8", primaryBorderColor: "#4e6586", lineColor: "#8ea0b8", fontFamily: "Source Sans 3, sans-serif" } });
  </script>
"""

PAGE = HEAD + """<body class="page-guide">
""" + CHROME + """  <div class="app">
    <aside class="sidebar" id="sidebar">
      <p class="side-brand">SSHD2382 / Guides</p>
      <label class="visually-hidden" for="q">Search categories</label>
      <input class="search" id="q" type="search" placeholder="Name, term, or category" autocomplete="off">
      <p class="empty" id="empty" hidden>No category matches.</p>
      <nav aria-label="Categories">@@SIDEBAR@@</nav>
    </aside>
    <main class="main" id="content" tabindex="-1">
      <div class="topbar">
        <button class="side-toggle" type="button">Guides</button>
        <nav class="jump" aria-label="On this page">@@JUMP@@</nav>
      </div>
      <p class="kicker">@@KICKER@@</p>
      <div class="digest">
@@BODY@@
      </div>
@@EXTRA@@
      @@PAGER@@
    </main>
    <aside class="rail" aria-label="On this page">
      <p>On this page</p>
      @@RAIL@@
    </aside>
  </div>
""" + SCRIPTS + MERMAID + """</body>
</html>
"""

HOME = HEAD + """<body class="page-home">
""" + CHROME + """  <main class="home" id="content" tabindex="-1">
    <section class="hero" aria-label="Introduction">
      <div class="hero-copy">
        <p class="hero-kicker">SSHD2382 &middot; Design Fundamentals</p>
        <div class="hero-title" aria-hidden="true">
          <span class="hero-line" data-split>Design starts</span>
          <span class="hero-line"><span data-split>with a</span> <span class="cycle" data-cycle="point.|line.|plane.|colour.|type.|grid.|space.">point.</span></span>
        </div>
        <div class="hero-cta">
          <a class="btn-line" href="01_design-basics.html"><span>Start with guide 01</span><i aria-hidden="true">&rarr;</i></a>
          <a class="btn-line" href="#browse"><span>Browse @@COUNT@@ guides</span><i aria-hidden="true">&rarr;</i></a>
        </div>
      </div>
      <aside class="hero-info" aria-label="At a glance">
        <p>Point, line, plane, colour, type and space: a reading guide for learning to see like a designer.</p>
      </aside>
      <p class="hold-hint" aria-hidden="true"><span>Hold to @@BOLT@@ blast</span><span>Dare @@BOLT@@ to touch the shapes</span></p>
      <a class="scroll-cue" href="#about" aria-label="Scroll to the introduction"><span></span></a>
    </section>

    <section class="about" id="about" aria-label="About this guide">
      <p class="sec-label">(About)</p>
      <div class="digest">
@@BODY@@
      </div>
      <div class="cross-rule" aria-hidden="true"><span></span></div>
    </section>

    <section class="marquee" aria-hidden="true">
      <div class="marquee-track">@@MARQUEE@@</div>
    </section>

    <section class="browse" aria-labelledby="browse">
      <div class="browse-head">
        <p class="sec-label">(Guides)</p>
        <h2 id="browse">Browse</h2>
        <div class="search-wrap">
          <label class="visually-hidden" for="q">Search guides</label>
          <input class="search" id="q" type="search" placeholder="Search a subject, term, or book" autocomplete="off">
          <kbd aria-hidden="true">/</kbd>
        </div>
        <p class="empty" id="empty" hidden>No guide matches.</p>
      </div>
@@DIRECTORY@@
    </section>

    <section class="outro" aria-label="Begin">
      <p class="sec-label">(Begin)</p>
      <a class="outro-link" href="01_design-basics.html"><span>Start with</span><span>a point.</span></a>
      <div class="outro-foot"><span>SSHD2382 Design Fundamentals</span><span>Eighteen guides to the subjects of the course</span><a href="#content">Back to top</a></div>
    </section>
  </main>
  <div class="dir-preview" aria-hidden="true"><img alt=""></div>
""" + SCRIPTS + """</body>
</html>
"""

MARQUEE_WORDS = ["Point", "Line", "Plane", "Colour", "Type", "Grid", "Form", "Space"]


def esc(text):
    return html.escape(text, quote=True)


def plain(fragment):
    text = re.sub(r"<[^>]+>", " ", fragment)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def attrs(raw):
    return {k: html.unescape(v) for k, v in ATTR_RE.findall(raw)}


def fill(mapping, template=PAGE):
    out = template
    for key, value in {"LOGO": LOGO, "BOLT": BOLT, **mapping}.items():
        out = out.replace("@@" + key + "@@", value)
    leftover = re.findall(r"@@[A-Z]+@@", out)
    if leftover:
        raise SystemExit("unfilled placeholders: " + ", ".join(leftover))
    return out


def digest_body(path):
    text = path.read_text(encoding="utf-8")
    start = text.find(DIGEST_OPEN)
    if start == -1:
        raise SystemExit(f"no digest in {path.name}")
    start += len(DIGEST_OPEN)
    end = text.find(DIGEST_CLOSE, start)
    if end == -1:
        raise SystemExit(f"unclosed digest in {path.name}")
    return text[start:end]


def headings(body):
    return [(m.group(1), plain(m.group(2))) for m in H2_RE.finditer(body)]


def book_titles(body):
    return [plain(m.group(1)) for m in BOOK_RE.finditer(body)] + [
        plain(m.group(1)) for m in ORIG_TITLE_RE.finditer(body)
    ]


def first_figure(body):
    for m in IMG_RE.finditer(body):
        found = attrs(m.group(1))
        src = found.get("src", "")
        if src and "/books/" not in src:
            return src, found.get("alt", "")
    return "", ""


def toc_links(items):
    return "".join(f'<a href="#{esc(i)}">{esc(label)}</a>' for i, label in items)


def pager_link(cat, kind):
    if not cat:
        return ""
    cls = ' class="next"' if kind == "Next" else ""
    name = f'{cat["num"]} {cat["english"]}'
    return (
        f'<a{cls} href="{esc(cat["href"])}" data-label="{esc(name)}"><span>{kind} guide</span>'
        f'<strong>{esc(name)}</strong><i aria-hidden="true">&rarr;</i></a>'
    )


def pager(prev_cat, next_cat):
    links = pager_link(prev_cat, "Previous") + pager_link(next_cat, "Next")
    if not links:
        return ""
    return f'<nav class="pager" aria-label="Categories">{links}</nav>'


def build():
    index_body = digest_body(ROOT / "index.html")
    cats = []
    for num, slug, english in CATEGORIES:
        href = f"{num}_{slug}.html"
        body = digest_body(ROOT / href)
        h1 = H1_RE.search(body)
        title = plain(h1.group(1)) if h1 else english
        section = headings(body)
        books = book_titles(body)
        src, alt = first_figure(body)
        search = " ".join(
            [num, slug.replace("-", " "), english, SUMMARY[num], COURSE[num]]
            + [label for _i, label in section]
            + books
        )
        cats.append({
            "num": num,
            "english": english,
            "href": href,
            "course": COURSE[num],
            "body": body,
            "title": title,
            "headings": section,
            "search": re.sub(r"\s+", " ", search).strip().lower(),
            "thumb": src,
            "alt": alt,
            "books": len(BOOK_RE.findall(body)),
        })

    menu = "".join(
        f'<li><a href="{esc(cat["href"])}" data-label="{esc(cat["num"] + " " + cat["english"])}">'
        f'<span class="menu-num">{esc(cat["num"])}</span>'
        f'<span class="menu-name">{esc(cat["english"])}</span>'
        f'<span class="menu-week">{esc(cat["course"])}</span></a></li>'
        for cat in cats
    )

    def sidebar(current):
        links = []
        for cat in cats:
            current_attr = ' aria-current="page"' if cat["href"] == current else ""
            links.append(
                f'<a href="{esc(cat["href"])}" data-search="{esc(cat["search"])}"{current_attr}>'
                f'<span class="side-num">{esc(cat["num"])}</span> {esc(cat["english"])}</a>'
            )
        return '<div class="side-group"><p class="side-label">Categories</p>' + "".join(links) + "</div>"

    rows = []
    for cat in cats:
        img = ""
        if cat["thumb"]:
            img = f'<img class="dir-thumb" src="{esc(cat["thumb"])}" alt="{esc(cat["alt"])}" loading="lazy">'
        rows.append(
            "<li>"
            f'<a href="{esc(cat["href"])}" data-search="{esc(cat["search"])}" data-label="{esc(cat["num"] + " " + cat["english"])}">'
            f"{img}"
            f'<span class="dir-num">{esc(cat["num"])}</span>'
            f'<span class="dir-name">{esc(cat["english"])}</span>'
            f'<span class="dir-gloss">{esc(SUMMARY[cat["num"]])}</span>'
            f'<span class="dir-group">{esc(cat["course"])}</span>'
            '<span class="dir-arrow" aria-hidden="true">&rarr;</span>'
            "</a></li>"
        )
    directory = (
        '      <nav class="directory" aria-label="Guides">'
        f'<ul>{"".join(rows)}</ul>'
        "</nav>"
    )

    marquee_set = "".join(
        f'<span class="mq-word{" mq-outline" if i % 2 else ""}">{w}</span><span class="mq-star">&#10022;</span>'
        for i, w in enumerate(MARQUEE_WORDS)
    )
    index_html = fill({
        "TITLE": "Design Fundamentals",
        "LABEL": "Design Fundamentals",
        "MENU": menu,
        "SCENE": "home",
        "CAT": "00",
        "BODY": index_body,
        "COUNT": str(len(cats)),
        "MARQUEE": f'<div class="marquee-set">{marquee_set}</div><div class="marquee-set">{marquee_set}</div>',
        "DIRECTORY": directory,
    }, HOME)
    (ROOT / "index.html").write_text(index_html, encoding="utf-8", newline="\n")

    for i, cat in enumerate(cats):
        page = fill({
            "TITLE": esc(cat["title"] + " · Design Fundamentals"),
            "LABEL": esc(cat["num"] + " " + cat["english"]),
            "MENU": menu,
            "SCENE": "page",
            "CAT": cat["num"],
            "SIDEBAR": sidebar(cat["href"]),
            "JUMP": toc_links(cat["headings"]),
            "KICKER": f'<a href="index.html">SSHD2382</a> · Category {esc(cat["num"])}',
            "BODY": cat["body"],
            "EXTRA": "",
            "PAGER": pager(cats[i - 1] if i else None, cats[i + 1] if i + 1 < len(cats) else None),
            "RAIL": toc_links(cat["headings"]),
        })
        (ROOT / cat["href"]).write_text(page, encoding="utf-8", newline="\n")

    print(f"wrote index + {len(cats)} category pages")
    return cats


def check_links():
    pages = sorted(ROOT.glob("*.html"))
    ids = {}
    errors = []
    for page in pages:
        text = page.read_text(encoding="utf-8")
        ids[page.name] = set(re.findall(r'\sid="([^"]+)"', text))
        for src in re.findall(r'\ssrc="([^"]+)"', text):
            if src.startswith(("http://", "https://", "data:")):
                continue
            path = (ROOT / src.split("#", 1)[0]).resolve()
            if not path.is_file():
                errors.append(f"{page.name} missing src {src}")
        for href in re.findall(r'\shref="([^"]+)"', text):
            if href.startswith(("http://", "https://", "mailto:", "#")):
                if href.startswith("#") and href[1:] not in ids[page.name]:
                    errors.append(f"{page.name} missing anchor {href}")
                continue
            target = href.partition("#")[0]
            if not (ROOT / target).exists():
                errors.append(f"{page.name} missing href {href}")
    for page in pages:
        text = page.read_text(encoding="utf-8")
        for href in re.findall(r'\shref="([^"]+\.html#[^"]+)"', text):
            target, _, frag = href.partition("#")
            if frag not in ids.get(target, set()):
                errors.append(f"{page.name} missing anchor {href}")
    if errors:
        print(f"link check: {len(errors)} problems")
        for line in errors[:40]:
            print(" ", line)
        return 1
    print(f"link check: {len(pages)} pages, no broken src or href")
    return 0


def check_english():
    problems = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        if CJK_RE.search(rel):
            problems.append(f"file name: {rel}")
        if path.suffix.lower() in {".html", ".css", ".js", ".md", ".py"}:
            for n, line in enumerate(path.read_text(encoding="utf-8").split("\n"), 1):
                found = CJK_RE.findall(ZH_ALLOWED_RE.sub("", line))
                if found:
                    problems.append(f"{rel}:{n}: {''.join(found)[:30]}")
    if problems:
        print(f"language check: {len(problems)} lines or files with Chinese or full-width text")
        for line in problems[:40]:
            print(" ", line)
        return 1
    print("language check: no Chinese or full-width text")
    return 0


if __name__ == "__main__":
    build()
    sys.exit(check_links() | check_english())
