# Design Fundamentals

A reading guide for SSHD2382. Eighteen subjects, each with the main ideas, methods, figures, and a bookshelf.

Open `index.html` in a browser, or from this folder:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

The 3D scene (three.js), the fonts, and the diagrams (Mermaid) load from CDNs, so the first visit needs an internet connection. Without WebGL the pages fall back to a flat dark background. The look is a night studio for a foundation course: a dark blue ground with orange used as the highlight.

## Files

- `_build_site.py` rebuilds the shell around each page's `<div class="digest">`: loader, header, menu, sidebar, pager, and the home page. Edit a digest, then run `python _build_site.py`.
- `css/guide.css` holds the whole look.
- `js/guide.js` handles search, the mobile sidebar, and the contents rail.
- `js/motion.js` runs the loader, page transitions, cursor, menu, text reveals, and the figure lightbox.
- `js/scene.js` draws the three.js scene: point, line, and plane forms on the home page (hold to blast, click a form to open its guide) and one form per guide behind each page.
