# fotobuch

Browser-based photobook layout builder. Drag photos onto page layouts,
fine-tune crops, and get a print-ready PDF — compiled entirely in the
browser via [typst](https://typst.app/open-source) (WASM). No backend,
no accounts: photos and layout state never leave your browser.

![](https://img.shields.io/badge/runtime-static%20site-informational)

## Features

- **20 page layouts** — full bleed, grids, bands, split screens,
  triptychs, portrait pairs on black, panoramas spanning a full spread
  with correct bleed continuity at the fold, and more. The palette shows
  a to-scale schematic of every layout.
- **Drag & drop** photos from the tray into layout slots; drag inside a
  slot to choose the crop window, shift+drag to zoom (aspect preserved,
  never below full coverage), double-click to reset.
- **Facing-spread preview** with physical page numbers, so you see the
  book exactly as it will be bound; panoramas warn when they don't start
  on a left page.
- **Print guides**: trim line (Endformat) and 3 mm safety margin
  (Sicherheitsabstand) drawn on every page, matching common print-shop
  templates (3 mm bleed on every side).
- **Print formats**: 16:9 (18.7 × 10.5 cm), A5 landscape, A5 portrait —
  switchable at any time.
- **Lossless-feeling photo handling**: photos are stored in the
  browser's origin-private file system (OPFS); rotate directly in the
  tray; sort by name or date.
- **Output**:
  - *compile PDF* — in-browser typst compilation, downloads `book.pdf`
  - *download bundle* — zip with `main.typ`, `layouts.typ`, the used
    photos, the builder state and a README; compile anywhere with
    `typst compile main.typ book.pdf`
  - *download main.typ* — just the regenerated typst file after changes
- **Backups**: layout state autosaves locally; save/load JSON backups to
  move between browsers or keep milestones.

## Running

Use it at **<https://pinpox.github.io/fotobuch/>**, photos and layout state stay
in your browser. To self-host, serve `index.html`, `app.js` and `layouts.typ`
with any static file host, there is no build step.

## How it works

- `layouts.typ` is the single source of truth for the page geometry and
  all layout functions. The app parses its constants at startup, renders
  the preview with the same math typst uses (cover crops, focus points
  and zoom map 1:1 to the `ph()` helper), and generates `main.typ` —
  one layout call per page.
- The selected print format is patched into `layouts.typ` when
  compiling or bundling; bleed is 3 mm on every side.
- PDF compilation uses
  [typst.ts](https://github.com/Myriad-Dreamin/typst.ts) with photos
  mapped into the compiler's virtual file system.

## Custom layouts

Add a function to `layouts.typ` (one function = one page; take photo
arguments and place them with `ph(spec, w, h)`), then mirror its slot
geometry in `buildLayouts()` in `app.js`. The palette icon is generated
automatically from the slot rectangles.
